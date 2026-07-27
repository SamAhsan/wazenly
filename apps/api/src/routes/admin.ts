import { Router } from "express";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireWorkspace, requireRole("OWNER"));

// Mirrors the requireRole(...) calls actually wired into the route files — informational only.
const PERMISSION_MATRIX = {
  OWNER: ["Everything, including removing/demoting the last OWNER is blocked platform-wide"],
  ADMIN: ["Workspace settings", "Team invite/remove", "Invitations", "API keys", "Webhooks", "WhatsApp numbers"],
  MANAGER: ["Campaigns", "Templates", "Flows"],
  AGENT: ["Contacts", "Conversations", "Quick replies"],
  VIEWER: ["Read-only access to everything above"],
};

// GET /api/admin/diagnostics — workspace-scoped only. Platform-wide signals
// (SMTP status, queue depths, cross-tenant email logs) previously shown here
// leaked to any workspace OWNER since those data sources have no workspaceId
// column; they now live under GET /api/super-admin/system-health instead.
adminRouter.get("/diagnostics", async (req: AuthRequest, res, next) => {
  try {
    const workspaceId = req.workspaceId!;

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
      invitations: { pending: pendingInvitations, expiredCount: expiredInvitations },
      unverifiedMembers,
      roleBreakdown,
      permissionMatrix: PERMISSION_MATRIX,
    });
  } catch (err) {
    next(err);
  }
});
