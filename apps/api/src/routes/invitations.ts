import { Router } from "express";
import crypto from "crypto";
import { prisma } from "@wazenly/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { notifyUsers, getMembersWithMinRole } from "@wazenly/queue";

export const invitationsRouter = Router();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// GET /api/invitations/:token — public preview, no auth required
invitationsRouter.get("/:token", async (req, res, next) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashToken(req.params.token) },
      include: { workspace: { select: { name: true } }, invitedBy: { select: { name: true, email: true } } },
    });
    if (!invitation) return res.status(404).json({ error: "Invitation not found" });

    res.json({
      email: invitation.email,
      role: invitation.role,
      workspaceName: invitation.workspace.name,
      inviterName: invitation.invitedBy.name || invitation.invitedBy.email,
      expired: invitation.expires < new Date() || !!invitation.acceptedAt,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/invitations/:token/accept — requires login, but not an existing workspace membership
invitationsRouter.post("/:token/accept", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashToken(req.params.token) },
      include: { workspace: true },
    });
    if (!invitation || invitation.expires < new Date() || invitation.acceptedAt) {
      return res.status(400).json({ error: "Invalid or expired invitation" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
      // A JWT can still verify (requireAuth passes) after its underlying user row is
      // gone -- e.g. the account was deleted directly in the DB. Send 401 so the
      // frontend's existing interceptor redirects to login instead of retrying forever.
      return res.status(401).json({ error: "Your session is no longer valid. Please log in again." });
    }
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({ error: "This invitation was sent to a different email address" });
    }

    const existingMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: invitation.workspaceId, userId: user.id },
    });

    const [member] = await prisma.$transaction([
      existingMember
        ? prisma.workspaceMember.update({
            where: { id: existingMember.id },
            data: { role: invitation.role },
          })
        : prisma.workspaceMember.create({
            data: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role, joinedAt: new Date() },
          }),
      prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);

    const displayName = user.name || user.email;
    await notifyUsers(
      invitation.workspaceId,
      [invitation.invitedByUserId],
      "INVITATION_ACCEPTED",
      "Invitation accepted",
      `${displayName} accepted your invitation to join ${invitation.workspace.name}.`,
      "/dashboard/settings"
    );

    const otherAdmins = (await getMembersWithMinRole(invitation.workspaceId, "ADMIN")).filter(
      (id) => id !== invitation.invitedByUserId && id !== user.id
    );
    await notifyUsers(
      invitation.workspaceId,
      otherAdmins,
      "TEAM_MEMBER_JOINED",
      "New team member",
      `${displayName} joined as ${invitation.role}.`,
      "/dashboard/settings"
    );

    res.json({ member, workspace: invitation.workspace });
  } catch (err) {
    next(err);
  }
});
