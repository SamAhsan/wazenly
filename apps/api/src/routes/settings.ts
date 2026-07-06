import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";
import { sendMail } from "../services/mailer.service";
import { invitationEmail } from "../services/email-templates";

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireWorkspace);

const INVITATION_TTL_HOURS = Number(process.env.INVITATION_TTL_HOURS) || 168;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// GET /api/settings/workspace
settingsRouter.get("/workspace", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: req.workspaceId! },
      include: { plan: true, subscription: true },
    });
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });
    res.json(workspace);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/workspace
settingsRouter.put("/workspace", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2).optional(),
      timezone: z.string().optional(),
      defaultLang: z.string().optional(),
    }).parse(req.body);

    const workspace = await prisma.workspace.update({
      where: { id: req.workspaceId! },
      data: body,
    });
    res.json(workspace);
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/webhook-info — the callback URL/verify token to paste into Meta's
// App Dashboard. Every number shares the same one: the webhook receiver only serves a
// single global route (see routes/webhooks.ts), validated against one env-var token,
// regardless of which number the event is actually for.
settingsRouter.get("/webhook-info", requireRole("ADMIN"), async (_req: AuthRequest, res, next) => {
  try {
    res.json({
      webhookUrl: `${process.env.WEBHOOK_BASE_URL}/api/webhooks/meta`,
      verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/members — MANAGER+ (not just ADMIN+) because the flow builder's
// "assign to agent" action node needs the member list to populate its picker.
settingsRouter.get("/members", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: req.workspaceId! },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
    });
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/members/invite
settingsRouter.post("/members/invite", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"]),
    }).parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: req.workspaceId!, userId: existingUser.id },
      });
      if (existingMember) return res.status(409).json({ error: "User already a member" });
    }

    const existingInvite = await prisma.invitation.findUnique({
      where: { workspaceId_email: { workspaceId: req.workspaceId!, email } },
    });
    if (existingInvite && existingInvite.expires > new Date()) {
      return res.status(409).json({ error: "An invitation is already pending for this email" });
    }
    if (existingInvite) {
      await prisma.invitation.delete({ where: { id: existingInvite.id } });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: req.workspaceId! } });
    const inviter = await prisma.user.findUnique({ where: { id: req.userId! } });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const invitation = await prisma.invitation.create({
      data: {
        workspaceId: req.workspaceId!,
        email,
        role,
        tokenHash: hashToken(rawToken),
        invitedByUserId: req.userId!,
        expires: new Date(Date.now() + INVITATION_TTL_HOURS * 3600000),
      },
    });

    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${rawToken}`;
    try {
      await sendMail({
        to: email,
        subject: `You're invited to join ${workspace?.name} on WAZENLY`,
        html: invitationEmail(workspace?.name || "a workspace", role, inviter?.name || null, acceptUrl, Math.round(INVITATION_TTL_HOURS / 24)),
      });
    } catch (mailErr) {
      console.error("[InviteMember] Failed to send invitation email:", mailErr);
    }
    if (process.env.NODE_ENV === "development") {
      console.log(`[Dev] Invitation link for ${email}: ${acceptUrl}`);
    }

    res.status(201).json({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expires: invitation.expires } });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/invitations
settingsRouter.get("/invitations", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: { workspaceId: req.workspaceId!, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    });
    res.json(invitations);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/settings/invitations/:id
settingsRouter.delete("/invitations/:id", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    await prisma.invitation.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId! } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/members/:userId/role
settingsRouter.put("/members/:userId/role", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const { role } = z.object({ role: z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"]) }).parse(req.body);

    const target = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.workspaceId!, userId: req.params.userId },
    });
    if (!target) return res.status(404).json({ error: "Member not found" });
    if (target.role === "OWNER") {
      return res.status(403).json({ error: "The workspace owner's role cannot be changed" });
    }
    if (target.userId === req.userId) {
      return res.status(403).json({ error: "You cannot change your own role" });
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/settings/members/:userId
settingsRouter.delete("/members/:userId", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const target = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.workspaceId!, userId: req.params.userId },
    });
    if (target?.role === "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId: req.workspaceId!, role: "OWNER" },
      });
      if (ownerCount <= 1) return res.status(400).json({ error: "Cannot remove the workspace's only owner" });
    }

    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: req.workspaceId!, userId: req.params.userId },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── API Keys ─────────────────────────────────────────────

// GET /api/settings/api-keys
settingsRouter.get("/api-keys", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { workspaceId: req.workspaceId!, revokedAt: null },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, requestCount: true, createdAt: true },
    });
    res.json(keys);
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/api-keys
settingsRouter.post("/api-keys", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(2) }).parse(req.body);
    const rawKey = `waz_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 12);

    const key = await prisma.apiKey.create({
      data: { workspaceId: req.workspaceId!, name, keyHash, keyPrefix },
    });

    res.status(201).json({ id: key.id, name, key: rawKey, keyPrefix, createdAt: key.createdAt });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/settings/api-keys/:id
settingsRouter.delete("/api-keys/:id", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    await prisma.apiKey.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: { revokedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Webhooks ─────────────────────────────────────────────

// GET /api/settings/webhooks
settingsRouter.get("/webhooks", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { workspaceId: req.workspaceId! },
    });
    res.json(endpoints);
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/webhooks
settingsRouter.post("/webhooks", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      url: z.string().url(),
      events: z.array(z.string()).min(1),
      secret: z.string().optional(),
    }).parse(req.body);

    const endpoint = await prisma.webhookEndpoint.create({
      data: { workspaceId: req.workspaceId!, ...body },
    });
    res.status(201).json(endpoint);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/settings/webhooks/:id
settingsRouter.delete("/webhooks/:id", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    await prisma.webhookEndpoint.deleteMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/quick-replies
settingsRouter.get("/quick-replies", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    const replies = await prisma.quickReply.findMany({ where: { workspaceId: req.workspaceId! } });
    res.json(replies);
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/quick-replies
settingsRouter.post("/quick-replies", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    const { title, body } = z.object({ title: z.string(), body: z.string() }).parse(req.body);
    const reply = await prisma.quickReply.create({ data: { workspaceId: req.workspaceId!, title, body } });
    res.status(201).json(reply);
  } catch (err) {
    next(err);
  }
});
