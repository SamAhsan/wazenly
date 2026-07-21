import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";
import { encrypt } from "@wazenly/shared";
import { MetaApiService, exchangeCodeForToken, exchangeForLongLivedToken } from "../services/meta.service";
import { templateSyncQueue } from "@wazenly/queue";
import { createDefaultWorkspace } from "./auth";
import { META_API_VERSION } from "@wazenly/shared";

export const embeddedSignupRouter = Router();
embeddedSignupRouter.use(requireAuth, requireWorkspace);

const callbackSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  businessId: z.string().optional(),
});

// GET /api/embedded-signup/config — non-secret bootstrap info for the
// frontend's FB.init()/FB.login() calls. `configured: false` until the
// Embedded Signup Configuration has been created in Meta's App Dashboard
// and META_EMBEDDED_SIGNUP_CONFIG_ID is set, so the UI can hide the button
// instead of opening a popup that's guaranteed to fail.
embeddedSignupRouter.get("/config", requireRole("ADMIN"), async (_req: AuthRequest, res, next) => {
  try {
    const appId = process.env.META_APP_ID || null;
    const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || null;
    res.json({
      configured: !!(appId && configId),
      appId,
      configId,
      apiVersion: META_API_VERSION,
    });
  } catch (err) {
    next(err);
  }
});

// Shared exchange logic for both a fresh connect and a reconnect -- runs the
// code-for-token exchange, resolves a long-lived token, registers the phone
// number with Meta if needed, and fetches display metadata. Throws on the
// one failure that should actually block the request (getPhoneNumberInfo);
// everything else is best-effort, mirroring how the existing manual-connect
// flow (numbers.ts) already treats registerWebhook() failures as non-fatal.
async function runEmbeddedSignupExchange(body: z.infer<typeof callbackSchema>) {
  const shortLivedToken = await exchangeCodeForToken(body.code);
  const { accessToken, expiresAt } = await exchangeForLongLivedToken(shortLivedToken);

  const meta = new MetaApiService(accessToken, body.phoneNumberId);

  // Best-effort: a number picked/created during Embedded Signup usually isn't
  // registered for Cloud API yet, but a reconnect of an already-registered
  // number will hit "already registered" here -- not an error either way.
  try {
    const pin = crypto.randomInt(100000, 999999).toString();
    await meta.registerPhoneNumber(pin);
  } catch (err) {
    console.warn("[EmbeddedSignup] Phone registration skipped (likely already registered):", (err as Error).message);
  }

  let metaInfo: Awaited<ReturnType<typeof meta.getPhoneNumberInfo>>;
  try {
    metaInfo = await meta.getPhoneNumberInfo();
  } catch {
    throw new Error("Could not verify the connected WhatsApp number with Meta.");
  }

  let wabaInfo: { account_review_status?: string; name?: string } = {};
  try {
    wabaInfo = await meta.getWabaInfo(body.wabaId);
  } catch {
    console.warn("[EmbeddedSignup] Could not fetch WABA info — verification status/business name will be left blank.");
  }

  let businessName: string | undefined;
  if (body.businessId) {
    try {
      businessName = (await meta.getBusinessInfo(body.businessId)).name;
    } catch {
      console.warn("[EmbeddedSignup] Could not fetch business info.");
    }
  }

  const metaAppId = await meta.debugToken();

  let webhookSubscribed = false;
  const webhookVerifyToken = crypto.randomBytes(32).toString("hex");
  const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/webhooks/meta`;
  try {
    await meta.registerWebhook(body.wabaId, webhookUrl, webhookVerifyToken);
    webhookSubscribed = true;
  } catch (err) {
    console.warn("[EmbeddedSignup] Webhook registration failed:", (err as Error).message);
  }

  return {
    accessToken,
    tokenExpiresAt: expiresAt,
    metaInfo,
    metaAppId,
    webhookVerifyToken,
    webhookSubscribed,
    wabaVerificationStatus: wabaInfo.account_review_status,
    businessName: businessName || wabaInfo.name,
  };
}

// POST /api/embedded-signup/callback — completes a fresh connect. Follows the
// exact same "one number per workspace" branching as the existing manual
// POST /api/numbers: if the current workspace already has a number, only the
// Owner may add another (which spins up a brand-new company workspace);
// otherwise this fills the current (number-less) workspace.
embeddedSignupRouter.post("/callback", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const body = callbackSchema.parse(req.body);

    const existingNumber = await prisma.whatsAppNumber.findFirst({
      where: { workspaceId: req.workspaceId! },
      select: { id: true },
    });
    if (existingNumber && req.role !== "OWNER") {
      return res.status(403).json({ error: "This company already has a number. Only the account Owner can add a new company." });
    }

    let exchange: Awaited<ReturnType<typeof runEmbeddedSignupExchange>>;
    try {
      exchange = await runEmbeddedSignupExchange(body);
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message || "Embedded Signup failed." });
    }

    const targetWorkspaceId = await prisma.$transaction(async (tx) => {
      if (!existingNumber) return req.workspaceId!;
      const newWorkspace = await createDefaultWorkspace(tx, req.userId!, exchange.businessName || exchange.metaInfo.verified_name);
      return newWorkspace.id;
    });

    const number = await prisma.whatsAppNumber.create({
      data: {
        workspaceId: targetWorkspaceId,
        displayName: exchange.metaInfo.verified_name,
        phoneNumber: exchange.metaInfo.display_phone_number,
        phoneNumberId: body.phoneNumberId,
        wabaId: body.wabaId,
        accessToken: encrypt(exchange.accessToken),
        metaAppId: exchange.metaAppId,
        webhookVerifyToken: exchange.webhookVerifyToken,
        status: "CONNECTED",
        connectionMethod: "EMBEDDED_SIGNUP",
        metaBusinessId: body.businessId,
        businessName: exchange.businessName,
        wabaVerificationStatus: exchange.wabaVerificationStatus,
        qualityRating: exchange.metaInfo.quality_rating,
        metaMessagingLimitTier: exchange.metaInfo.messaging_limit_tier,
        tokenExpiresAt: exchange.tokenExpiresAt,
        webhookSubscribed: exchange.webhookSubscribed,
        connectedAt: new Date(),
      },
    });

    await templateSyncQueue.add("sync-templates", {
      workspaceId: targetWorkspaceId,
      numberId: number.id,
      wabaId: body.wabaId,
      accessToken: encrypt(exchange.accessToken),
    });

    const { accessToken: _, ...safeNumber } = number;
    res.status(201).json({ ...safeNumber, workspaceId: targetWorkspaceId, isNewCompany: !!existingNumber });
  } catch (err) {
    next(err);
  }
});

// POST /api/embedded-signup/reconnect/:numberId — re-runs the same exchange
// against an existing number (expired/revoked token, or the customer just
// wants to refresh permissions). Rejects if the popup returned a different
// phone number than the one already stored, so a mis-click in Meta's UI
// can't silently overwrite one number's data with another's.
embeddedSignupRouter.post("/reconnect/:numberId", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const body = callbackSchema.parse(req.body);

    const existing = await prisma.whatsAppNumber.findFirst({
      where: { id: req.params.numberId, workspaceId: req.workspaceId! },
    });
    if (!existing) return res.status(404).json({ error: "Number not found" });
    if (existing.phoneNumberId !== body.phoneNumberId) {
      return res.status(400).json({
        error: "The phone number selected in Facebook doesn't match this connection. To connect a different number, use Connect instead of Reconnect.",
      });
    }

    let exchange: Awaited<ReturnType<typeof runEmbeddedSignupExchange>>;
    try {
      exchange = await runEmbeddedSignupExchange(body);
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message || "Reconnect failed." });
    }

    const number = await prisma.whatsAppNumber.update({
      where: { id: existing.id },
      data: {
        displayName: exchange.metaInfo.verified_name,
        phoneNumber: exchange.metaInfo.display_phone_number,
        accessToken: encrypt(exchange.accessToken),
        metaAppId: exchange.metaAppId,
        webhookVerifyToken: exchange.webhookVerifyToken,
        status: "CONNECTED",
        connectionMethod: "EMBEDDED_SIGNUP",
        metaBusinessId: body.businessId,
        businessName: exchange.businessName,
        wabaVerificationStatus: exchange.wabaVerificationStatus,
        qualityRating: exchange.metaInfo.quality_rating,
        metaMessagingLimitTier: exchange.metaInfo.messaging_limit_tier,
        tokenExpiresAt: exchange.tokenExpiresAt,
        webhookSubscribed: exchange.webhookSubscribed,
        disconnectedAt: null,
      },
    });

    await templateSyncQueue.add("sync-templates", {
      workspaceId: req.workspaceId!,
      numberId: number.id,
      wabaId: body.wabaId,
      accessToken: encrypt(exchange.accessToken),
    });

    const { accessToken: _, ...safeNumber } = number;
    res.json(safeNumber);
  } catch (err) {
    next(err);
  }
});
