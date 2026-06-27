import { Router } from "express";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, AuthRequest } from "../middleware/auth";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, requireWorkspace);

// GET /api/analytics/overview
analyticsRouter.get("/overview", async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const prevStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));

    const [current, previous, activeCampaigns, newContacts] = await Promise.all([
      prisma.dailyAnalytics.aggregate({
        where: { workspaceId: req.workspaceId!, date: { gte: startDate, lte: endDate } },
        _sum: { messagesSent: true, delivered: true, read: true, failed: true, inbound: true },
      }),
      prisma.dailyAnalytics.aggregate({
        where: { workspaceId: req.workspaceId!, date: { gte: prevStart, lt: startDate } },
        _sum: { messagesSent: true },
      }),
      prisma.campaign.count({ where: { workspaceId: req.workspaceId!, status: "RUNNING" } }),
      prisma.contact.count({
        where: { workspaceId: req.workspaceId!, createdAt: { gte: startDate, lte: endDate } },
      }),
    ]);

    const sent = current._sum.messagesSent || 0;
    const prevSent = previous._sum.messagesSent || 0;
    const delivered = current._sum.delivered || 0;
    const read = current._sum.read || 0;
    const failed = current._sum.failed || 0;

    res.json({
      messagesSent: sent,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
      readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
      failedMessages: failed,
      activeCampaigns,
      newContacts,
      sentChange: prevSent > 0 ? Math.round(((sent - prevSent) / prevSent) * 100) : 0,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/daily
analyticsRouter.get("/daily", async (req: AuthRequest, res, next) => {
  try {
    const { from, to, numberId } = req.query as Record<string, string>;
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = { workspaceId: req.workspaceId!, date: { gte: startDate, lte: endDate } };
    if (numberId) where.numberId = numberId;

    const data = await prisma.dailyAnalytics.findMany({
      where,
      orderBy: { date: "asc" },
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/campaigns
analyticsRouter.get("/campaigns", async (req: AuthRequest, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId: req.workspaceId!, status: { in: ["COMPLETED", "RUNNING"] } },
      select: {
        id: true, name: true, status: true,
        totalRecipients: true, sentCount: true, deliveredCount: true, readCount: true, failedCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const enriched = campaigns.map((c) => ({
      ...c,
      deliveryRate: c.sentCount > 0 ? Math.round((c.deliveredCount / c.sentCount) * 100) : 0,
      readRate: c.deliveredCount > 0 ? Math.round((c.readCount / c.deliveredCount) * 100) : 0,
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/numbers
analyticsRouter.get("/numbers", async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const numbers = await prisma.whatsAppNumber.findMany({
      where: { workspaceId: req.workspaceId! },
      select: { id: true, displayName: true, phoneNumber: true },
    });

    const results = await Promise.all(
      numbers.map(async (n) => {
        const stats = await prisma.dailyAnalytics.aggregate({
          where: { workspaceId: req.workspaceId!, numberId: n.id, date: { gte: startDate, lte: endDate } },
          _sum: { messagesSent: true, delivered: true, read: true, failed: true },
        });
        return {
          ...n,
          messagesSent: stats._sum.messagesSent || 0,
          delivered: stats._sum.delivered || 0,
          read: stats._sum.read || 0,
          failed: stats._sum.failed || 0,
        };
      })
    );

    res.json(results);
  } catch (err) {
    next(err);
  }
});
