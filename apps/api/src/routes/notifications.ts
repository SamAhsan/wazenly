import { Router } from "express";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, AuthRequest } from "../middleware/auth";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth, requireWorkspace);

// GET /api/notifications
notificationsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId!, workspaceId: req.workspaceId! },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/unread-count
notificationsRouter.get("/unread-count", async (req: AuthRequest, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.userId!, workspaceId: req.workspaceId!, readAt: null },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
notificationsRouter.post("/read-all", async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId!, workspaceId: req.workspaceId!, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:id/read
notificationsRouter.post("/:id/read", async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.userId! },
      data: { readAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
