import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, AuthRequest } from "../middleware/auth";

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireWorkspace);

// GET /api/settings/workspace
settingsRouter.get("/workspace", async (req: AuthRequest, res, next) => {
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
settingsRouter.put("/workspace", async (req: AuthRequest, res, next) => {
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

// GET /api/settings/members
settingsRouter.get("/members", async (req: AuthRequest, res, next) => {
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
settingsRouter.post("/members/invite", async (req: AuthRequest, res, next) => {
  try {
    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"]),
    }).parse(req.body);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email, name: email.split("@")[0] } });
    }

    const existing = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.workspaceId!, userId: user.id },
    });
    if (existing) return res.status(409).json({ error: "User already a member" });

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const member = await prisma.workspaceMember.create({
      data: { workspaceId: req.workspaceId!, userId: user.id, role, inviteToken },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    res.status(201).json({ member, inviteToken });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/settings/members/:userId
settingsRouter.delete("/members/:userId", async (req: AuthRequest, res, next) => {
  try {
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
settingsRouter.get("/api-keys", async (req: AuthRequest, res, next) => {
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
settingsRouter.post("/api-keys", async (req: AuthRequest, res, next) => {
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
settingsRouter.delete("/api-keys/:id", async (req: AuthRequest, res, next) => {
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
settingsRouter.get("/webhooks", async (req: AuthRequest, res, next) => {
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
settingsRouter.post("/webhooks", async (req: AuthRequest, res, next) => {
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
settingsRouter.delete("/webhooks/:id", async (req: AuthRequest, res, next) => {
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
settingsRouter.get("/quick-replies", async (req: AuthRequest, res, next) => {
  try {
    const replies = await prisma.quickReply.findMany({ where: { workspaceId: req.workspaceId! } });
    res.json(replies);
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/quick-replies
settingsRouter.post("/quick-replies", async (req: AuthRequest, res, next) => {
  try {
    const { title, body } = z.object({ title: z.string(), body: z.string() }).parse(req.body);
    const reply = await prisma.quickReply.create({ data: { workspaceId: req.workspaceId!, title, body } });
    res.status(201).json(reply);
  } catch (err) {
    next(err);
  }
});
