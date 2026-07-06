import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";
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
numbersRouter.post("/", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
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

    // Resolve which Meta App this token belongs to — required for the Resumable
    // Upload API used by template media headers. Different numbers can be
    // connected through different Meta Apps/Business accounts.
    const metaAppId = await meta.debugToken();
    if (!metaAppId) {
      console.warn("[Numbers] Could not resolve Meta App ID from access token — media template uploads for this number will fall back to META_APP_ID env var.");
    }

    const number = await prisma.whatsAppNumber.create({
      data: {
        workspaceId: req.workspaceId!,
        displayName: metaInfo.verified_name,
        phoneNumber: metaInfo.display_phone_number,
        phoneNumberId: body.phoneNumberId,
        wabaId: body.wabaId,
        accessToken: encrypt(body.accessToken),
        metaAppId,
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
numbersRouter.get("/:id", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
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
numbersRouter.put("/:id", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      displayName: z.string().min(2).optional(),
      phoneNumberId: z.string().optional(),
      wabaId: z.string().optional(),
      accessToken: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const data: Record<string, string | null> = {};
    if (body.displayName) data.displayName = body.displayName;
    if (body.phoneNumberId) data.phoneNumberId = body.phoneNumberId;
    if (body.wabaId) data.wabaId = body.wabaId;
    if (body.accessToken) {
      data.accessToken = encrypt(body.accessToken);
      const meta = new MetaApiService(body.accessToken, body.phoneNumberId || "");
      data.metaAppId = await meta.debugToken();
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "No fields to update" });
    const result = await prisma.whatsAppNumber.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data,
    });
    if (!result.count) return res.status(404).json({ error: "Number not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/numbers/:id/rotate-token
numbersRouter.post("/:id/rotate-token", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const { accessToken } = z.object({ accessToken: z.string() }).parse(req.body);
    const meta = new MetaApiService(accessToken, "");
    const metaAppId = await meta.debugToken();
    await prisma.whatsAppNumber.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: { accessToken: encrypt(accessToken), metaAppId },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/numbers/:id
numbersRouter.delete("/:id", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      select: { id: true },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    // Campaign/Conversation/Message/Flow/Template all reference this number without
    // a DB-level cascade (by design, so unrelated delete paths for those models stay
    // protected). Deleting a number is a deliberate, explicit "wipe everything under
    // it" action, so we cascade by hand here, ordered so each delete's own children
    // (already DB-cascaded one level down, e.g. Campaign -> CampaignContact) are gone
    // before we remove anything a sibling step still points to.
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { numberId: number.id } }),
      prisma.conversation.deleteMany({ where: { numberId: number.id } }),
      prisma.campaign.deleteMany({ where: { numberId: number.id } }),
      prisma.flow.deleteMany({ where: { numberId: number.id } }),
      prisma.template.deleteMany({ where: { numberId: number.id } }),
      prisma.whatsAppNumber.delete({ where: { id: number.id } }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/numbers/:id/stats
numbersRouter.get("/:id/stats", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
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
