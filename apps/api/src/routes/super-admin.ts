import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { requireSuperAdmin } from "../middleware/require-super-admin";
import {
  campaignSenderQueue,
  webhookProcessorQueue,
  templateSyncQueue,
  contactImporterQueue,
  notificationSenderQueue,
  flowExecutorQueue,
  numberHealthCheckQueue,
  contactEngagementQueue,
  redis,
} from "@wazenly/queue";
import { verifyConnection } from "../services/mailer.service";

export const superAdminRouter = Router();
superAdminRouter.use(requireAuth, requireSuperAdmin);

const suspendSchema = z.object({ reason: z.string().min(1) });
const deleteSchema = z.object({ reason: z.string().optional() });
const impersonateSchema = z.object({ mode: z.enum(["READ_ONLY", "FULL"]).default("READ_ONLY") });
const exitImpersonationSchema = z.object({ workspaceId: z.string(), mode: z.enum(["READ_ONLY", "FULL"]) });

function createImpersonationToken(superAdminUserId: string, superAdminTokenVersion: number, targetWorkspaceId: string, mode: "READ_ONLY" | "FULL"): string {
  return jwt.sign(
    { sub: superAdminUserId, tokenVersion: superAdminTokenVersion, impersonation: { workspaceId: targetWorkspaceId, mode } },
    process.env.NEXTAUTH_SECRET || "secret",
    { expiresIn: "60m" }
  );
}

// ─── Overview ───────────────────────────────────────────────

// GET /api/super-admin/overview
superAdminRouter.get("/overview", async (req: AuthRequest, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const last7d = new Date(Date.now() - 7 * 86400000);

    const [
      totalCompanies, activeCompanies, suspendedCompanies,
      totalUsers, newCompaniesLast7d, newUsersLast7d,
      totalNumbersConnected, messagesToday, messagesThisMonth,
      recentAuditLog,
    ] = await Promise.all([
      prisma.workspace.count({ where: { status: { not: "DELETED" } } }),
      prisma.workspace.count({ where: { status: "ACTIVE" } }),
      prisma.workspace.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count(),
      prisma.workspace.count({ where: { createdAt: { gte: last7d }, status: { not: "DELETED" } } }),
      prisma.user.count({ where: { createdAt: { gte: last7d } } }),
      prisma.whatsAppNumber.count({ where: { status: "CONNECTED" } }),
      prisma.dailyAnalytics.aggregate({ where: { date: today }, _sum: { messagesSent: true } }),
      prisma.dailyAnalytics.aggregate({ where: { date: { gte: monthStart } }, _sum: { messagesSent: true } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { email: true, name: true } } } }),
    ]);

    res.json({
      totalCompanies, activeCompanies, suspendedCompanies,
      totalUsers, newCompaniesLast7d, newUsersLast7d,
      totalNumbersConnected,
      messagesToday: messagesToday._sum.messagesSent || 0,
      messagesThisMonth: messagesThisMonth._sum.messagesSent || 0,
      recentAuditLog,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Companies ──────────────────────────────────────────────

function buildCompanyWhere(req: AuthRequest): Record<string, unknown> {
  const { q, status, planId } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  where.status = status || { not: "DELETED" };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }];
  if (planId) where.planId = planId;
  return where;
}

// GET /api/super-admin/companies
superAdminRouter.get("/companies", async (req: AuthRequest, res, next) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);
    const where = buildCompanyWhere(req);

    const [companies, total] = await Promise.all([
      prisma.workspace.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, slug: true, status: true, createdAt: true,
          plan: { select: { name: true } },
          numbers: { select: { displayName: true, phoneNumber: true, status: true } },
          _count: { select: { contacts: true, campaigns: true, templates: true, members: true } },
        },
      }),
      prisma.workspace.count({ where }),
    ]);

    const pageIds = companies.map((c) => c.id);
    const [campaignMax, contactMax, convoMax] = pageIds.length
      ? await Promise.all([
          prisma.campaign.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: pageIds } }, _max: { createdAt: true } }),
          prisma.contact.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: pageIds } }, _max: { createdAt: true } }),
          prisma.conversation.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: pageIds } }, _max: { lastMessageAt: true } }),
        ])
      : [[], [], []];

    const lastActivityMap = new Map<string, Date>();
    const bump = (workspaceId: string, at: Date | null) => {
      if (!at) return;
      const existing = lastActivityMap.get(workspaceId);
      if (!existing || at > existing) lastActivityMap.set(workspaceId, at);
    };
    campaignMax.forEach((r) => bump(r.workspaceId, r._max.createdAt));
    contactMax.forEach((r) => bump(r.workspaceId, r._max.createdAt));
    convoMax.forEach((r) => bump(r.workspaceId, r._max.lastMessageAt));

    const data = companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      createdAt: c.createdAt,
      plan: c.plan?.name || null,
      number: c.numbers[0] || null,
      contactsCount: c._count.contacts,
      campaignsCount: c._count.campaigns,
      templatesCount: c._count.templates,
      usersCount: c._count.members,
      lastActivity: lastActivityMap.get(c.id) || c.createdAt,
    }));

    res.json({ data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/super-admin/companies/:id
superAdminRouter.get("/companies/:id", async (req: AuthRequest, res, next) => {
  try {
    const company = await prisma.workspace.findUnique({
      where: { id: req.params.id },
      include: {
        plan: true,
        subscription: true,
        numbers: true,
        members: {
          include: { user: { select: { id: true, email: true, name: true, image: true, suspendedAt: true, emailVerified: true } } },
          orderBy: { joinedAt: "asc" },
        },
        _count: { select: { contacts: true, campaigns: true, templates: true, conversations: true } },
      },
    });
    if (!company) return res.status(404).json({ error: "Company not found" });

    const auditLog = await prisma.auditLog.findMany({
      where: { targetType: "Workspace", targetId: company.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { email: true, name: true } } },
    });

    const { numbers, ...rest } = company;
    const safeNumbers = numbers.map(({ accessToken, ...n }) => n);

    res.json({ ...rest, numbers: safeNumbers, auditLog });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/companies/:id/suspend
superAdminRouter.post("/companies/:id/suspend", async (req: AuthRequest, res, next) => {
  try {
    const { reason } = suspendSchema.parse(req.body);
    const company = await prisma.workspace.findUnique({ where: { id: req.params.id } });
    if (!company) return res.status(404).json({ error: "Company not found" });

    await prisma.$transaction([
      prisma.workspace.update({
        where: { id: company.id },
        data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedReason: reason, suspendedByUserId: req.userId! },
      }),
      prisma.user.updateMany({
        where: { workspaceMembers: { some: { workspaceId: company.id } } },
        data: { tokenVersion: { increment: 1 } },
      }),
      prisma.auditLog.create({
        data: { actorUserId: req.userId!, action: "COMPANY_SUSPENDED", targetType: "Workspace", targetId: company.id, metadata: { reason }, ipAddress: req.ip },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/companies/:id/activate
superAdminRouter.post("/companies/:id/activate", async (req: AuthRequest, res, next) => {
  try {
    const company = await prisma.workspace.findUnique({ where: { id: req.params.id } });
    if (!company) return res.status(404).json({ error: "Company not found" });

    await prisma.$transaction([
      prisma.workspace.update({
        where: { id: company.id },
        data: { status: "ACTIVE", suspendedAt: null, suspendedReason: null, suspendedByUserId: null },
      }),
      prisma.auditLog.create({
        data: { actorUserId: req.userId!, action: "COMPANY_ACTIVATED", targetType: "Workspace", targetId: company.id, ipAddress: req.ip },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/super-admin/companies/:id — soft delete only
superAdminRouter.delete("/companies/:id", async (req: AuthRequest, res, next) => {
  try {
    const { reason } = deleteSchema.parse(req.body || {});
    const company = await prisma.workspace.findUnique({ where: { id: req.params.id } });
    if (!company) return res.status(404).json({ error: "Company not found" });

    await prisma.$transaction([
      prisma.workspace.update({
        where: { id: company.id },
        data: { status: "DELETED", deletedAt: new Date() },
      }),
      prisma.user.updateMany({
        where: { workspaceMembers: { some: { workspaceId: company.id } } },
        data: { tokenVersion: { increment: 1 } },
      }),
      prisma.auditLog.create({
        data: { actorUserId: req.userId!, action: "COMPANY_SOFT_DELETED", targetType: "Workspace", targetId: company.id, metadata: { reason }, ipAddress: req.ip },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/companies/:id/restore
superAdminRouter.post("/companies/:id/restore", async (req: AuthRequest, res, next) => {
  try {
    const company = await prisma.workspace.findUnique({ where: { id: req.params.id } });
    if (!company) return res.status(404).json({ error: "Company not found" });

    await prisma.$transaction([
      prisma.workspace.update({
        where: { id: company.id },
        data: { status: "ACTIVE", deletedAt: null },
      }),
      prisma.auditLog.create({
        data: { actorUserId: req.userId!, action: "COMPANY_RESTORED", targetType: "Workspace", targetId: company.id, ipAddress: req.ip },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/companies/:id/impersonate
superAdminRouter.post("/companies/:id/impersonate", async (req: AuthRequest, res, next) => {
  try {
    const { mode } = impersonateSchema.parse(req.body);
    const company = await prisma.workspace.findUnique({ where: { id: req.params.id } });
    if (!company || company.status === "DELETED") return res.status(404).json({ error: "Company not found" });

    const admin = await prisma.user.findUnique({ where: { id: req.userId! }, select: { tokenVersion: true } });
    if (!admin) return res.status(404).json({ error: "User not found" });

    const token = createImpersonationToken(req.userId!, admin.tokenVersion, company.id, mode);

    await prisma.auditLog.create({
      data: { actorUserId: req.userId!, action: "IMPERSONATION_STARTED", targetType: "Workspace", targetId: company.id, metadata: { mode }, ipAddress: req.ip },
    });

    res.json({ token, workspaceId: company.id, role: mode === "FULL" ? "OWNER" : "VIEWER", mode, companyName: company.name, expiresInMinutes: 60 });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/impersonate/exit — nothing to revoke server-side (the
// impersonation token just expires in 60 minutes); this exists purely to log
// the end of the session in the audit trail.
superAdminRouter.post("/impersonate/exit", async (req: AuthRequest, res, next) => {
  try {
    const { workspaceId, mode } = exitImpersonationSchema.parse(req.body);
    await prisma.auditLog.create({
      data: { actorUserId: req.userId!, action: "IMPERSONATION_ENDED", targetType: "Workspace", targetId: workspaceId, metadata: { mode }, ipAddress: req.ip },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── WhatsApp Numbers (cross-workspace, read-only) ─────────

// GET /api/super-admin/numbers
superAdminRouter.get("/numbers", async (req: AuthRequest, res, next) => {
  try {
    const { q, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (q) where.OR = [{ displayName: { contains: q, mode: "insensitive" } }, { phoneNumber: { contains: q } }];

    const [numbers, total] = await Promise.all([
      prisma.whatsAppNumber.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: { workspace: { select: { id: true, name: true, slug: true, status: true } } },
      }),
      prisma.whatsAppNumber.count({ where }),
    ]);

    const data = numbers.map(({ accessToken, ...n }) => n);
    res.json({ data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

// ─── Users ──────────────────────────────────────────────────

// GET /api/super-admin/users
superAdminRouter.get("/users", async (req: AuthRequest, res, next) => {
  try {
    const { q, suspended, isSuperAdmin, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (q) where.OR = [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }];
    if (suspended !== undefined) where.suspendedAt = suspended === "true" ? { not: null } : null;
    if (isSuperAdmin !== undefined) where.isSuperAdmin = isSuperAdmin === "true";

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        select: {
          id: true, email: true, name: true, image: true, emailVerified: true,
          suspendedAt: true, isSuperAdmin: true, createdAt: true,
          _count: { select: { workspaceMembers: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ data: users, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/super-admin/users/:id
superAdminRouter.get("/users/:id", async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, email: true, name: true, image: true, emailVerified: true,
        suspendedAt: true, isSuperAdmin: true, createdAt: true,
        workspaceMembers: {
          include: { workspace: { select: { id: true, name: true, slug: true, status: true } } },
        },
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const auditLog = await prisma.auditLog.findMany({
      where: { targetType: "User", targetId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { email: true, name: true } } },
    });

    res.json({ ...user, auditLog });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/users/:id/suspend
superAdminRouter.post("/users/:id/suspend", async (req: AuthRequest, res, next) => {
  try {
    const { reason } = suspendSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { suspendedAt: new Date(), tokenVersion: { increment: 1 } } }),
      prisma.auditLog.create({
        data: { actorUserId: req.userId!, action: "USER_SUSPENDED", targetType: "User", targetId: user.id, metadata: { reason }, ipAddress: req.ip },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/users/:id/activate
superAdminRouter.post("/users/:id/activate", async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { suspendedAt: null } }),
      prisma.auditLog.create({
        data: { actorUserId: req.userId!, action: "USER_ACTIVATED", targetType: "User", targetId: user.id, ipAddress: req.ip },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/users/:id/force-logout
superAdminRouter.post("/users/:id/force-logout", async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } }),
      prisma.auditLog.create({
        data: { actorUserId: req.userId!, action: "USER_FORCE_LOGOUT", targetType: "User", targetId: user.id, ipAddress: req.ip },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/users/:id/grant-super-admin
superAdminRouter.post("/users/:id/grant-super-admin", async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } }),
      prisma.auditLog.create({
        data: { actorUserId: req.userId!, action: "SUPER_ADMIN_GRANTED", targetType: "User", targetId: user.id, ipAddress: req.ip },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/users/:id/revoke-super-admin
superAdminRouter.post("/users/:id/revoke-super-admin", async (req: AuthRequest, res, next) => {
  try {
    if (req.userId === req.params.id) {
      return res.status(400).json({ error: "You cannot revoke your own Super Admin access" });
    }
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: false } }),
      prisma.auditLog.create({
        data: { actorUserId: req.userId!, action: "SUPER_ADMIN_REVOKED", targetType: "User", targetId: user.id, ipAddress: req.ip },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Platform Analytics ─────────────────────────────────────

// GET /api/super-admin/analytics/overview
superAdminRouter.get("/analytics/overview", async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const prevStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));

    const [current, previous, activeCompanies, newCompanies] = await Promise.all([
      prisma.dailyAnalytics.aggregate({
        where: { date: { gte: startDate, lte: endDate } },
        _sum: { messagesSent: true, delivered: true, read: true, failed: true, inbound: true },
      }),
      prisma.dailyAnalytics.aggregate({
        where: { date: { gte: prevStart, lt: startDate } },
        _sum: { messagesSent: true },
      }),
      prisma.workspace.count({ where: { status: "ACTIVE" } }),
      prisma.workspace.count({ where: { createdAt: { gte: startDate, lte: endDate }, status: { not: "DELETED" } } }),
    ]);

    const sent = current._sum.messagesSent || 0;
    const prevSent = previous._sum.messagesSent || 0;
    const delivered = current._sum.delivered || 0;
    const read = current._sum.read || 0;
    const failed = current._sum.failed || 0;
    const attempted = sent + failed;

    res.json({
      messagesSent: sent,
      deliveryRate: attempted > 0 ? Math.round((delivered / attempted) * 100) : 0,
      readRate: attempted > 0 ? Math.round((read / attempted) * 100) : 0,
      failedMessages: failed,
      activeCompanies,
      newCompanies,
      sentChange: prevSent > 0 ? Math.round(((sent - prevSent) / prevSent) * 100) : 0,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/super-admin/analytics/daily
superAdminRouter.get("/analytics/daily", async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await prisma.dailyAnalytics.groupBy({
      by: ["date"],
      where: { date: { gte: startDate, lte: endDate } },
      _sum: { messagesSent: true, delivered: true, read: true, failed: true, inbound: true },
      orderBy: { date: "asc" },
    });

    res.json(rows.map((r) => ({
      date: r.date,
      messagesSent: r._sum.messagesSent || 0,
      delivered: r._sum.delivered || 0,
      read: r._sum.read || 0,
      failed: r._sum.failed || 0,
      inbound: r._sum.inbound || 0,
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/super-admin/analytics/by-company
superAdminRouter.get("/analytics/by-company", async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await prisma.dailyAnalytics.groupBy({
      by: ["workspaceId"],
      where: { date: { gte: startDate, lte: endDate } },
      _sum: { messagesSent: true, delivered: true, read: true, failed: true },
      orderBy: { _sum: { messagesSent: "desc" } },
      take: 20,
    });

    const workspaces = await prisma.workspace.findMany({
      where: { id: { in: rows.map((r) => r.workspaceId) } },
      select: { id: true, name: true, slug: true },
    });
    const nameById = new Map(workspaces.map((w) => [w.id, w]));

    res.json(rows.map((r) => ({
      workspaceId: r.workspaceId,
      name: nameById.get(r.workspaceId)?.name || "Unknown",
      slug: nameById.get(r.workspaceId)?.slug || null,
      messagesSent: r._sum.messagesSent || 0,
      delivered: r._sum.delivered || 0,
      read: r._sum.read || 0,
      failed: r._sum.failed || 0,
    })));
  } catch (err) {
    next(err);
  }
});

// ─── System Health ──────────────────────────────────────────

const QUEUES = [
  { name: "campaign-sender", queue: campaignSenderQueue },
  { name: "webhook-processor", queue: webhookProcessorQueue },
  { name: "template-sync", queue: templateSyncQueue },
  { name: "contact-importer", queue: contactImporterQueue },
  { name: "notification-sender", queue: notificationSenderQueue },
  { name: "flow-executor", queue: flowExecutorQueue },
  { name: "number-health-check", queue: numberHealthCheckQueue },
  { name: "contact-engagement", queue: contactEngagementQueue },
];

// GET /api/super-admin/system-health
superAdminRouter.get("/system-health", async (_req: AuthRequest, res, next) => {
  try {
    const [queues, database, redisHealth, smtp] = await Promise.all([
      Promise.all(
        QUEUES.map(async ({ name, queue }) => ({
          name,
          ...(await queue.getJobCounts("waiting", "active", "failed", "delayed")),
        }))
      ),
      (async () => {
        const start = Date.now();
        try {
          await prisma.$queryRaw`SELECT 1`;
          return { ok: true, latencyMs: Date.now() - start };
        } catch (err) {
          return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
        }
      })(),
      (async () => {
        const start = Date.now();
        try {
          await redis.ping();
          return { ok: true, latencyMs: Date.now() - start };
        } catch (err) {
          return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
        }
      })(),
      (async () => {
        const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
        if (!configured) return { configured: false, verified: false };
        const result = await verifyConnection();
        return { configured: true, verified: result.ok, error: result.error };
      })(),
    ]);

    res.json({ queues, database, redis: redisHealth, smtp, serverUptimeSeconds: Math.round(process.uptime()) });
  } catch (err) {
    next(err);
  }
});
