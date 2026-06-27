import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { authRateLimiter } from "../middleware/rate-limiter";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  name: z.string().min(2),
  workspaceName: z.string().min(2),
});

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

// POST /api/auth/register
authRouter.post("/register", authRateLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, password: hashedPassword },
    });

    const slug = `${slugify(body.workspaceName)}-${Date.now().toString(36)}`;
    const freePlan = await prisma.billingPlan.findFirst({ where: { name: "Free" } });
    const workspace = await prisma.workspace.create({
      data: {
        name: body.workspaceName,
        slug,
        planId: freePlan?.id,
        members: { create: { userId: user.id, role: "OWNER", joinedAt: new Date() } },
      },
    });

    if (freePlan) {
      await prisma.subscription.create({ data: { workspaceId: workspace.id, planId: freePlan.id } });
    }

    const token = createToken(user.id, workspace.id);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name }, workspace });
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

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { invitedAt: "asc" },
    });

    const token = createToken(user.id, membership?.workspaceId);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name }, workspace: membership?.workspace });
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

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "Reset your WAZENLY password",
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    });

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
