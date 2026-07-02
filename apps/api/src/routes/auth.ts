import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { prisma, Prisma } from "@wazenly/db";
import { authRateLimiter } from "../middleware/rate-limiter";
import { sendMail } from "../services/mailer.service";
import { verificationEmail, passwordResetEmail } from "../services/email-templates";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  name: z.string().min(2),
  workspaceName: z.string().min(2).optional(),
  inviteToken: z.string().optional(),
});

const EMAIL_VERIFICATION_TTL_HOURS = Number(process.env.EMAIL_VERIFICATION_TTL_HOURS) || 24;
const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION !== "false";

function createToken(userId: string, workspaceId?: string): string {
  return jwt.sign(
    { sub: userId, workspaceId },
    process.env.NEXTAUTH_SECRET || "secret",
    { expiresIn: "7d" }
  );
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueVerificationEmail(email: string, name: string | null): Promise<void> {
  await prisma.emailVerificationToken.deleteMany({ where: { email } });
  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      email,
      tokenHash: hashToken(rawToken),
      expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 3600000),
    },
  });
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify/${rawToken}`;
  if (process.env.NODE_ENV === "development") {
    console.log(`[Dev] Verification link for ${email}: ${verifyUrl}`);
  }
  await sendMail({
    to: email,
    subject: "Verify your WAZENLY email",
    html: verificationEmail(name, verifyUrl, EMAIL_VERIFICATION_TTL_HOURS),
  });
}

async function createDefaultWorkspace(
  tx: Prisma.TransactionClient,
  userId: string,
  workspaceName: string
) {
  const slug = `${slugify(workspaceName)}-${Date.now().toString(36)}`;
  const freePlan = await tx.billingPlan.findFirst({ where: { name: "Free" } });
  const workspace = await tx.workspace.create({
    data: {
      name: workspaceName,
      slug,
      planId: freePlan?.id,
      members: { create: { userId, role: "OWNER", joinedAt: new Date() } },
    },
  });
  if (freePlan) {
    await tx.subscription.create({ data: { workspaceId: workspace.id, planId: freePlan.id } });
  }
  return workspace;
}

// POST /api/auth/register
authRouter.post("/register", authRateLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    // Registering via an invitation joins the inviter's existing workspace —
    // it must never spin up a second, empty workspace for the new user.
    let invitation = null;
    if (body.inviteToken) {
      invitation = await prisma.invitation.findUnique({
        where: { tokenHash: hashToken(body.inviteToken) },
      });
      if (!invitation || invitation.expires < new Date() || invitation.acceptedAt) {
        return res.status(400).json({ error: "This invitation is invalid or has expired" });
      }
      if (invitation.email.toLowerCase() !== body.email.toLowerCase()) {
        return res.status(400).json({ error: "This invitation was sent to a different email address" });
      }
    } else if (!body.workspaceName) {
      return res.status(400).json({ error: "Workspace name is required" });
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);

    const { user, workspace } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: body.email, name: body.name, password: hashedPassword },
      });
      if (invitation) {
        return { user, workspace: null };
      }
      const workspace = await createDefaultWorkspace(tx, user.id, body.workspaceName!);
      return { user, workspace };
    });

    try {
      await issueVerificationEmail(user.email, user.name);
    } catch (mailErr) {
      console.error("[Register] Failed to send verification email:", mailErr);
    }

    res.status(201).json({
      message: "Account created. Check your email to verify your account.",
      user: { id: user.id, email: user.email, name: user.name },
      workspace,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
authRouter.post("/login", authRateLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.password) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(body.password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    if (REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) {
      return res.status(403).json({ error: "EMAIL_NOT_VERIFIED", message: "Please verify your email before signing in." });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { invitedAt: "asc" },
    });

    const token = createToken(user.id, membership?.workspaceId);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name }, workspace: membership?.workspace, role: membership?.role });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
authRouter.post("/forgot-password", authRateLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ message: "If the email exists, a reset link was sent." });

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { email, token, expires: new Date(Date.now() + 3600000) },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

    try {
      await sendMail({
        to: email,
        subject: "Reset your WAZENLY password",
        html: passwordResetEmail(resetUrl),
      });
    } catch (mailErr) {
      console.error("[ForgotPassword] Failed to send reset email:", mailErr);
    }

    res.json({ message: "If the email exists, a reset link was sent." });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = z.object({
      token: z.string(),
      password: z.string().min(8),
    }).parse(req.body);

    const reset = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!reset || reset.expires < new Date()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { email: reset.email }, data: { password: hashed } });
    await prisma.passwordResetToken.delete({ where: { token } });

    res.json({ message: "Password reset successful" });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-email
authRouter.post("/verify-email", authRateLimiter, async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.expires < new Date()) {
      return res.status(400).json({ error: "Invalid or expired verification link" });
    }

    await prisma.user.update({ where: { email: record.email }, data: { emailVerified: new Date() } });
    await prisma.emailVerificationToken.deleteMany({ where: { email: record.email } });

    res.json({ message: "Email verified. You can now sign in." });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/resend-verification
authRouter.post("/resend-verification", authRateLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified) {
      try {
        await issueVerificationEmail(user.email, user.name);
      } catch (mailErr) {
        console.error("[ResendVerification] Failed to send verification email:", mailErr);
      }
    }
    res.json({ message: "If the account exists and isn't verified yet, a new verification email was sent." });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/oauth — internal, called only by the web app's NextAuth callbacks
authRouter.post("/oauth", async (req, res, next) => {
  try {
    if (req.headers["x-internal-secret"] !== process.env.INTERNAL_SERVICE_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = z.object({
      email: z.string().email(),
      name: z.string().nullish(),
      image: z.string().nullish(),
    }).parse(req.body);

    let user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: body.email, name: body.name || undefined, image: body.image || undefined, emailVerified: new Date() },
      });
    } else if (!user.emailVerified) {
      user = await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    }

    let membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { invitedAt: "asc" },
    });

    if (!membership) {
      const workspace = await prisma.$transaction((tx) =>
        createDefaultWorkspace(tx, user!.id, `${body.name || body.email.split("@")[0]}'s Workspace`)
      );
      membership = await prisma.workspaceMember.findFirstOrThrow({
        where: { workspaceId: workspace.id, userId: user.id },
        include: { workspace: true },
      });
    }

    const token = createToken(user.id, membership.workspaceId);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name }, workspace: membership.workspace, role: membership.role });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
authRouter.get("/me", async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET || "secret") as { sub: string; workspaceId?: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, image: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const workspaces = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });

    res.json({ user, workspaces: workspaces.map((m) => ({ ...m.workspace, role: m.role })) });
  } catch (err) {
    next(err);
  }
});
