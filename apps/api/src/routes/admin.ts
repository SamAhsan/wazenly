import { Router } from "express";
import { prisma } from "@wazenly/db";
import {
  campaignSenderQueue,
  webhookProcessorQueue,
  templateSyncQueue,
  contactImporterQueue,
  notificationSenderQueue,
  flowExecutorQueue,
} from "@wazenly/queue";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";
import { verifyConnection } from "../services/mailer.service";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireWorkspace, requireRole("OWNER"));

const QUEUES = [
  { name: "campaign-sender", queue: campaignSenderQueue },
  { name: "webhook-processor", queue: webhookProcessorQueue },
  { name: "template-sync", queue: templateSyncQueue },
  { name: "contact-importer", queue: contactImporterQueue },
  { name: "notification-sender", queue: notificationSenderQueue },
  { name: "flow-executor", queue: flowExecutorQueue },
];

// Mirrors the requireRole(...) calls actually wired into the route files — informational only.
const PERMISSION_MATRIX = {
  OWNER: ["Everything, including removing/demoting the last OWNER is blocked platform-wide"],
  ADMIN: ["Workspace settings", "Team invite/remove", "Invitations", "API keys", "Webhooks", "WhatsApp numbers"],
  MANAGER: ["Campaigns", "Templates", "Flows"],
  AGENT: ["Contacts", "Conversations", "Quick replies"],
  VIEWER: ["Read-only access to everything above"],
};

// GET /api/admin/diagnostics
adminRouter.get("/diagnostics", async (req: AuthRequest, res, next) => {
  try {
    const workspaceId = req.workspaceId!;

    const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    const smtpVerify = smtpConfigured ? await verifyConnection() : { ok: false, error: "SMTP not configured" };

    const queueCounts = await Promise.all(
      QUEUES.map(async ({ name, queue }) => ({
        name,
        ...(await queue.getJobCounts("waiting", "active", "failed", "delayed")),
      }))
    );

    const since24h = new Date(Date.now() - 24 * 3600000);
    const [emailsSent, emailsFailed, recentFailedEmails] = await Promise.all([
      prisma.emailLog.count({ where: { status: "sent", createdAt: { gte: since24h } } }),
      prisma.emailLog.count({ where: { status: "failed", createdAt: { gte: since24h } } }),
      prisma.emailLog.findMany({ where: { status: "failed", createdAt: { gte: since24h } }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

    const [pendingInvitations, expiredInvitations] = await Promise.all([
      prisma.invitation.findMany({ where: { workspaceId, acceptedAt: null, expires: { gte: new Date() } }, orderBy: { createdAt: "desc" } }),
      prisma.invitation.count({ where: { workspaceId, acceptedAt: null, expires: { lt: new Date() } } }),
    ]);

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { email: true, emailVerified: true } } },
    });
    const unverifiedMembers = members.filter((m) => !m.user.emailVerified).map((m) => m.user.email);
    const roleBreakdown = members.reduce<Record<string, number>>((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {});

    res.json({
      smtp: { configured: smtpConfigured, verified: smtpVerify.ok, error: smtpVerify.error },
      queues: queueCounts,
      emails: { sentLast24h: emailsSent, failedLast24h: emailsFailed, recentFailures: recentFailedEmails },
      invitations: { pending: pendingInvitations, expiredCount: expiredInvitations },
      unverifiedMembers,
      roleBreakdown,
      permissionMatrix: PERMISSION_MATRIX,
    });
  } catch (err) {
    next(err);
  }
});
