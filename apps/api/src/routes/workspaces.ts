import { Router } from "express";
import { prisma } from "@wazenly/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { createToken } from "./auth";

export const workspacesRouter = Router();
workspacesRouter.use(requireAuth);

// POST /api/workspaces/:id/switch — the Owner uses this to move between companies.
// Verifies membership against the TARGET workspace (not whatever's currently active),
// then issues a fresh token scoped to it. The frontend does a full reload afterward so
// every page, the WebSocket connection, and every cached query start clean.
workspacesRouter.post("/:id/switch", async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.params.id, userId: req.userId! },
    });
    if (!member) return res.status(403).json({ error: "You are not a member of this company" });

    const token = createToken(req.userId!, req.params.id);
    res.json({ token, workspaceId: req.params.id, role: member.role });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/workspaces/:id — remove a company entirely. Every table already cascades
// from Workspace, so this one delete cleans up the number, contacts, campaigns, etc.
workspacesRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.params.id, userId: req.userId! },
    });
    if (!member || member.role !== "OWNER") {
      return res.status(403).json({ error: "Only the Owner of this company can remove it" });
    }
    await prisma.workspace.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
