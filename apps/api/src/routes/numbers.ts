import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, AuthRequest } from "../middleware/auth";
import { encrypt, decrypt } from "@wazenly/shared";
import { MetaApiService } from "../services/meta.service";
import { templateSyncQueue } from "@wazenly/queue";

export const numbersRouter = Router();
numbersRouter.use(requireAuth, requireWorkspace);

const numberSchema = z.object({
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  accessToken: z.string().min(1),
});

// GET /api/numbers
numbersRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const numbers = await prisma.whatsAppNumber.findMany({
      where: { workspaceId: req.workspaceId! },
      orderBy: { createdAt: "desc" },
    });

    const sanitized = numbers.map(({ accessToken, ...rest }) => ({
      ...rest,
      hasAccessToken: !!accessToken,
    }));

    res.json(sanitized);
  } catch (err) {
    next(err);
  }
});

// POST /api/numbers
numbersRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const body = numberSchema.parse(req.body);

    // Verify number with Meta and auto-fetch business name + phone number
    const meta = new MetaApiService(body.accessToken, body.phoneNumberId);
    let metaInfo: Awaited<ReturnType<typeof meta.getPhoneNumberInfo>>;
    try {
      metaInfo = await meta.getPhoneNumberInfo();
    } catch {
      return res.status(400).json({ error: "Could not verify WhatsApp number with Meta. Check credentials." });
    }

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/webhooks/meta/${body.phoneNumberId}`;

    const number = await prisma.whatsAppNumber.create({
      data: {
        workspaceId: req.workspaceId!,
        displayName: metaInfo.verified_name,
        phoneNumber: metaInfo.display_phone_number,
        phoneNumberId: body.phoneNumberId,
        wabaId: body.wabaId,
        accessToken: encrypt(body.accessToken),
        webhookVerifyToken: verifyToken,
        status: "CONNECTED",
      },
    });

    // Register webhook with Meta
    try {
      await meta.registerWebhook(body.wabaId, webhookUrl, verifyToken);
    } catch {
      console.warn("[Numbers] Webhook registration failed — configure manually in Meta dashboard");
    }

    // Trigger template sync
    await templateSyncQueue.add("sync-templates", {
      workspaceId: req.workspaceId!,
      numberId: number.id,
      wabaId: body.wabaId,
      accessToken: encrypt(body.accessToken),
    });

    const { accessToken: _, ...safeNumber } = number;
    res.status(201).json({ ...safeNumber, metaInfo });
  } catch (err) {
    next(err);
  }
});

// GET /api/numbers/:id
numbersRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    const { accessToken: _, ...safe } = number;
    res.json(safe);
  } catch (err) {
    next(err);
  }
});

// PUT /api/numbers/:id
numbersRouter.put("/:id", async (req: AuthRequest, res, next) => {
  try {
    const { displayName } = z.object({ displayName: z.string().min(2) }).parse(req.body);
    const number = await prisma.whatsAppNumber.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: { displayName },
    });
    if (!number.count) return res.status(404).json({ error: "Number not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/numbers/:id/rotate-token
numbersRouter.post("/:id/rotate-token", async (req: AuthRequest, res, next) => {
  try {
    const { accessToken } = z.object({ accessToken: z.string() }).parse(req.body);
    await prisma.whatsAppNumber.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: { accessToken: encrypt(accessToken) },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/numbers/:id
numbersRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    await prisma.whatsAppNumber.deleteMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/numbers/:id/stats
numbersRouter.get("/:id/stats", async (req: AuthRequest, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayStats, monthStats] = await Promise.all([
      prisma.dailyAnalytics.findFirst({
        where: { workspaceId: req.workspaceId!, numberId: req.params.id, date: today },
      }),
      prisma.dailyAnalytics.aggregate({
        where: { workspaceId: req.workspaceId!, numberId: req.params.id, date: { gte: monthStart } },
        _sum: { messagesSent: true },
      }),
    ]);

    res.json({
      sentToday: todayStats?.messagesSent || 0,
      sentThisMonth: monthStats._sum.messagesSent || 0,
    });
  } catch (err) {
    next(err);
  }
});
