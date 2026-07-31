import { Router } from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import multer from "multer";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";
import { encrypt, decrypt } from "@wazenly/shared";
import { MetaApiService, exchangeCodeForToken, exchangeForLongLivedToken } from "../services/meta.service";
import { templateSyncQueue } from "@wazenly/queue";
import { createDefaultWorkspace } from "./auth";

export const numbersRouter = Router();
numbersRouter.use(requireAuth, requireWorkspace);

// Same disk-storage pattern as templates.ts's media upload -- the file only
// needs to live long enough to read its buffer for the Resumable Upload API,
// then it's deleted.
const LOGO_UPLOADS_DIR = path.join(__dirname, "../../uploads");
fs.mkdirSync(LOGO_UPLOADS_DIR, { recursive: true });
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, LOGO_UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, `logo-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Meta error #133005 "Two step verification PIN Mismatch" specifically means
// a PIN is already set on this number -- most likely by Meta's own Embedded
// Signup popup, before our /register call ever runs -- not that registration
// genuinely failed. Treat it as already-registered rather than falling
// through to the generic failure/PENDING path.
function isAlreadyRegisteredError(err: unknown): boolean {
  const code = (err as { response?: { data?: { error?: { code?: number } } } })?.response?.data?.error?.code;
  return code === 133005;
}

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

// POST /api/numbers — each workspace holds at most one number (enforced by a DB unique
// constraint), so this either fills a brand-new, number-less workspace (normal signup
// path) or, if the caller's current workspace already has its one number, spins up an
// entirely new company workspace for it. Only the Owner may create additional companies.
numbersRouter.post("/", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const body = numberSchema.parse(req.body);

    const existingNumber = await prisma.whatsAppNumber.findFirst({
      where: { workspaceId: req.workspaceId! },
      select: { id: true },
    });
    if (existingNumber && req.role !== "OWNER") {
      return res.status(403).json({ error: "This company already has a number. Only the account Owner can add a new company." });
    }

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

    const targetWorkspaceId = await prisma.$transaction(async (tx) => {
      if (!existingNumber) {
        // Filling a brand-new signup's default workspace (named after the
        // person, e.g. "John's Workspace", since the business name wasn't
        // known yet at signup time) -- rename it to the real business name
        // now that Meta has told us what it actually is.
        await tx.workspace.update({ where: { id: req.workspaceId! }, data: { name: metaInfo.verified_name } });
        return req.workspaceId!;
      }
      const newWorkspace = await createDefaultWorkspace(tx, req.userId!, metaInfo.verified_name);
      return newWorkspace.id;
    });

    const number = await prisma.whatsAppNumber.create({
      data: {
        workspaceId: targetWorkspaceId,
        displayName: metaInfo.verified_name,
        phoneNumber: metaInfo.display_phone_number,
        phoneNumberId: body.phoneNumberId,
        wabaId: body.wabaId,
        accessToken: encrypt(body.accessToken),
        metaAppId,
        webhookVerifyToken: verifyToken,
        status: "CONNECTED",
        qualityRating: metaInfo.quality_rating,
        metaMessagingLimitTier: metaInfo.messaging_limit_tier,
        lastHealthCheckAt: new Date(),
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
      workspaceId: targetWorkspaceId,
      numberId: number.id,
      wabaId: body.wabaId,
      accessToken: encrypt(body.accessToken),
    });

    const { accessToken: _, ...safeNumber } = number;
    res.status(201).json({ ...safeNumber, metaInfo, workspaceId: targetWorkspaceId, isNewCompany: !!existingNumber });
  } catch (err) {
    next(err);
  }
});

// POST /api/numbers/connect-embedded-signup — completes the WhatsApp Embedded
// Signup popup (App A, the WhatsApp Tech Provider app) once the user is
// already logged in via classic Facebook Login (App B, identity only). The
// two apps are deliberately separate: App B's "Facebook Login" product has no
// business-asset scope, and App A's "Facebook Login for Business" product has
// no email/profile scope -- neither app can do both halves alone. `code`
// here is App A's OAuth code from FB.login(), exchanged the same way
// numbers.ts's manual-entry POST / verifies a pasted token, just sourced
// from Meta instead of typed in.
const embeddedSignupSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  businessId: z.string().optional(),
});

numbersRouter.post("/connect-embedded-signup", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const body = embeddedSignupSchema.parse(req.body);

    const existingNumber = await prisma.whatsAppNumber.findFirst({
      where: { workspaceId: req.workspaceId! },
      select: { id: true },
    });
    if (existingNumber && req.role !== "OWNER") {
      return res.status(403).json({ error: "This company already has a number. Only the account Owner can add a new company." });
    }

    let accessToken: string;
    try {
      const shortLivedToken = await exchangeCodeForToken(body.code);
      accessToken = (await exchangeForLongLivedToken(shortLivedToken)).accessToken;
    } catch (err) {
      console.error("[EmbeddedSignup] Code exchange failed:", (err as Error).message);
      return res.status(400).json({ error: "Embedded Signup failed during token exchange. Please try Connect again." });
    }

    const meta = new MetaApiService(accessToken, body.phoneNumberId);
    let metaInfo: Awaited<ReturnType<typeof meta.getPhoneNumberInfo>>;
    try {
      metaInfo = await meta.getPhoneNumberInfo();
    } catch {
      return res.status(400).json({ error: "Could not verify the connected WhatsApp number with Meta." });
    }

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/webhooks/meta/${body.phoneNumberId}`;
    const metaAppId = await meta.debugToken();

    // A number picked via Embedded Signup isn't registered for Cloud API
    // messaging by default -- Meta leaves it "Pending" (visible in WhatsApp
    // Manager) until this runs. Best-effort: a genuine failure here shouldn't
    // block the connect entirely (the number still exists, just not
    // send/receive-ready yet) -- it's reflected in `status` instead, and
    // POST /:id/activate below lets it be retried without redoing signup.
    let registered = true;
    try {
      const pin = crypto.randomInt(100000, 999999).toString();
      await meta.registerPhoneNumber(pin);
    } catch (err) {
      if (isAlreadyRegisteredError(err)) {
        console.warn("[EmbeddedSignup] Number already registered (PIN mismatch #133005) -- treating as connected.");
      } else {
        registered = false;
        console.warn("[EmbeddedSignup] Phone registration failed, number will show as PENDING:", (err as Error).message);
      }
    }

    const targetWorkspaceId = await prisma.$transaction(async (tx) => {
      if (!existingNumber) {
        // Filling a brand-new signup's default workspace (named after the
        // person, e.g. "John's Workspace", since the business name wasn't
        // known yet at signup time) -- rename it to the real business name
        // now that Meta has told us what it actually is.
        await tx.workspace.update({ where: { id: req.workspaceId! }, data: { name: metaInfo.verified_name } });
        return req.workspaceId!;
      }
      const newWorkspace = await createDefaultWorkspace(tx, req.userId!, metaInfo.verified_name);
      return newWorkspace.id;
    });

    const number = await prisma.whatsAppNumber.create({
      data: {
        workspaceId: targetWorkspaceId,
        displayName: metaInfo.verified_name,
        phoneNumber: metaInfo.display_phone_number,
        phoneNumberId: body.phoneNumberId,
        wabaId: body.wabaId,
        accessToken: encrypt(accessToken),
        metaAppId,
        webhookVerifyToken: verifyToken,
        status: registered ? "CONNECTED" : "PENDING",
        qualityRating: metaInfo.quality_rating,
        metaMessagingLimitTier: metaInfo.messaging_limit_tier,
        lastHealthCheckAt: new Date(),
      },
    });

    try {
      await meta.registerWebhook(body.wabaId, webhookUrl, verifyToken);
    } catch {
      console.warn("[EmbeddedSignup] Webhook registration failed — configure manually in Meta dashboard");
    }

    await templateSyncQueue.add("sync-templates", {
      workspaceId: targetWorkspaceId,
      numberId: number.id,
      wabaId: body.wabaId,
      accessToken: encrypt(accessToken),
    });

    const { accessToken: _, ...safeNumber } = number;
    res.status(201).json({ ...safeNumber, metaInfo, workspaceId: targetWorkspaceId, isNewCompany: !!existingNumber });
  } catch (err) {
    next(err);
  }
});

// POST /api/numbers/:id/activate — retries Cloud API phone registration for a
// number stuck at PENDING (e.g. the registration call failed during connect,
// or an older connection never ran it at all).
numbersRouter.post("/:id/activate", requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    let accessToken: string;
    try {
      accessToken = decrypt(number.accessToken);
    } catch {
      return res.status(400).json({ error: "This number's stored access token can't be decrypted. Reconnect it instead." });
    }

    const meta = new MetaApiService(accessToken, number.phoneNumberId);
    const pin = crypto.randomInt(100000, 999999).toString();
    try {
      await meta.registerPhoneNumber(pin);
    } catch (err) {
      if (!isAlreadyRegisteredError(err)) {
        const metaError = (err as { response?: { data?: unknown } })?.response?.data;
        console.error("[Numbers] Activate failed:", JSON.stringify(metaError) || (err as Error).message);
        return res.status(400).json({ error: "Could not activate this number with Meta. Check the Meta App Dashboard for details." });
      }
      console.warn("[Numbers] Number already registered (PIN mismatch #133005) -- treating as activated.");
    }

    await prisma.whatsAppNumber.update({ where: { id: number.id }, data: { status: "CONNECTED" } });
    res.json({ success: true });
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
// Every workspace holds at most one number (@unique workspaceId on
// WhatsAppNumber) -- a number-less company has no purpose in this app, so
// deleting the number deletes the entire company, not just the number row.
// requireRole("OWNER") since this now removes every other teammate's access
// too, not just a piece of Meta config -- matches DELETE /api/workspaces/:id's
// own bar for the same reason. Deleting the workspace directly (rather than
// hand-cascading each numberId-scoped table like before) is both simpler and
// more complete: every workspaceId relation already has onDelete: Cascade,
// so Prisma wipes the number, messages, conversations, campaigns, contacts,
// templates, members, invitations, etc. in one step.
numbersRouter.delete("/:id", requireRole("OWNER"), async (req: AuthRequest, res, next) => {
  try {
    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      select: { id: true },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    // Message/Conversation/Campaign/Contact/ContactList/Flow/Template each
    // reference the number via a separate numberId FK that does NOT cascade
    // (by design, so unrelated delete paths for those models stay
    // protected) -- deleting the workspace alone leaves those rows still
    // pointing at the about-to-be-cascade-deleted WhatsAppNumber row and
    // the DB rejects it with a foreign key violation. Clear them by hand
    // first, then the workspace delete cascades everything else
    // (WhatsAppNumber itself, members, invitations, analytics, etc.) via
    // their workspaceId FKs, which DO cascade.
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { numberId: number.id } }),
      prisma.conversation.deleteMany({ where: { numberId: number.id } }),
      prisma.campaign.deleteMany({ where: { numberId: number.id } }),
      prisma.contact.deleteMany({ where: { numberId: number.id } }),
      prisma.contactList.deleteMany({ where: { numberId: number.id } }),
      prisma.flow.deleteMany({ where: { numberId: number.id } }),
      prisma.template.deleteMany({ where: { numberId: number.id } }),
      prisma.workspace.delete({ where: { id: req.workspaceId! } }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/numbers/:id/refresh-status — on-demand version of what the 30-min
// background health check already does: re-fetch quality rating, messaging
// tier, and WABA verification status from Meta using the stored token.
numbersRouter.post("/:id/refresh-status", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    let metaInfo: Awaited<ReturnType<InstanceType<typeof MetaApiService>["getPhoneNumberInfo"]>>;
    let meta: MetaApiService;
    try {
      // decrypt() itself can throw (e.g. this token was encrypted under a
      // different ENCRYPTION_KEY than the one currently configured) -- that
      // needs the same clean error response as a rejected Meta API call,
      // not an unhandled 500.
      meta = new MetaApiService(decrypt(number.accessToken), number.phoneNumberId);
      metaInfo = await meta.getPhoneNumberInfo();
    } catch {
      return res.status(400).json({ error: "Could not refresh status from Meta. The stored access token may be invalid, expired, or encrypted with a different key than this environment's." });
    }

    let wabaVerificationStatus = number.wabaVerificationStatus;
    try {
      wabaVerificationStatus = (await meta.getWabaInfo(number.wabaId)).account_review_status ?? wabaVerificationStatus;
    } catch {
      // Keep the previously stored value if this specific call fails.
    }

    const updated = await prisma.whatsAppNumber.update({
      where: { id: number.id },
      data: {
        displayName: metaInfo.verified_name,
        phoneNumber: metaInfo.display_phone_number,
        status: "CONNECTED",
        qualityRating: metaInfo.quality_rating,
        metaMessagingLimitTier: metaInfo.messaging_limit_tier,
        wabaVerificationStatus,
        lastHealthCheckAt: new Date(),
      },
    });

    const { accessToken: _, ...safe } = updated;
    res.json(safe);
  } catch (err) {
    next(err);
  }
});

type SetupStatusLevel = "approved" | "pending" | "not_started" | "rejected" | "unknown";

// business_verification_status values per Meta's Business Manager API --
// confirmed live against 4 production WABAs (see meta.service.ts comment).
function mapBusinessVerificationStatus(status: string | undefined): SetupStatusLevel {
  switch (status) {
    case "verified": return "approved";
    case "pending_submission":
    case "pending_need_more_info": return "pending";
    case "not_verified": return "not_started";
    case "rejected":
    case "expired":
    case "revoked": return "rejected";
    default: return "unknown";
  }
}

function mapNameStatus(status: string | undefined): SetupStatusLevel {
  switch (status) {
    case "APPROVED":
    case "AVAILABLE_WITHOUT_REVIEW": return "approved";
    case "PENDING_REVIEW": return "pending";
    case "DECLINED":
    case "EXPIRED": return "rejected";
    default: return "unknown";
  }
}

// GET /api/numbers/:id/setup-status — aggregates the onboarding checklist
// shown at /dashboard/onboarding. Computed live on every call (no caching
// table) so it's never stale, the same tradeoff refresh-status above already
// makes. Each Graph API call is independent (Promise.allSettled) so one
// failing lookup doesn't blank out the others -- each surfaces "unknown"
// on its own instead.
//
// Payment method is NOT checked here: Meta's Graph API has no documented,
// reliable field exposing "does this WABA have a payment method on file" --
// the closest fields relate to spend caps/prepaid balance, not billing setup
// itself, and guessing from those would risk showing "Completed" when it
// isn't. It's always reported "unknown"; the frontend links to Meta's
// Billing page instead of attempting to verify this.
numbersRouter.get("/:id/setup-status", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      include: { _count: { select: { templates: true } } },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    let meta: MetaApiService | null = null;
    try {
      meta = new MetaApiService(decrypt(number.accessToken), number.phoneNumberId);
    } catch {
      // Token can't be decrypted (e.g. encrypted under a different
      // ENCRYPTION_KEY) -- every Meta-derived field below stays "unknown".
    }

    const [phoneInfoResult, wabaInfoResult, subscribedAppsResult] = meta
      ? await Promise.allSettled([
          meta.getPhoneNumberInfo(),
          meta.getWabaInfo(number.wabaId),
          meta.getSubscribedApps(number.wabaId),
        ])
      : [null, null, null];

    const displayNameStatus = phoneInfoResult?.status === "fulfilled"
      ? mapNameStatus(phoneInfoResult.value.name_status)
      : "unknown";
    const businessVerification = wabaInfoResult?.status === "fulfilled"
      ? mapBusinessVerificationStatus(wabaInfoResult.value.business_verification_status)
      : "unknown";
    const webhook = subscribedAppsResult?.status === "fulfilled"
      ? (subscribedAppsResult.value.data.length > 0 ? "connected" : "disconnected")
      : "unknown";
    const templatesStatus = number._count.templates > 0 ? "synced" : "none";

    // Payment method deliberately excluded -- see comment above the route.
    const productionReady =
      number.status === "CONNECTED" &&
      businessVerification === "approved" &&
      displayNameStatus === "approved" &&
      webhook === "connected" &&
      templatesStatus === "synced";

    res.json({
      workspaceCreated: true,
      whatsappConnected: true,
      numberInfo: {
        displayName: number.displayName,
        phoneNumber: number.phoneNumber,
        wabaId: number.wabaId,
        phoneNumberId: number.phoneNumberId,
        status: number.status,
      },
      businessVerification,
      paymentMethod: "unknown",
      displayNameStatus,
      webhook,
      templates: { status: templatesStatus, count: number._count.templates },
      productionReady,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/numbers/:id/test-message — sends Meta's default "hello_world"
// sample template (present on every WABA automatically) to a phone number
// the user provides, purely to confirm the connection actually works.
// Deliberately bypasses the conversation/contact system entirely -- this is
// a connectivity check, not a real conversation.
numbersRouter.post("/:id/test-message", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const { to } = z.object({ to: z.string().min(6) }).parse(req.body);

    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    try {
      const meta = new MetaApiService(decrypt(number.accessToken), number.phoneNumberId);
      await meta.sendTemplate(to, "hello_world", "en_US");
    } catch (err) {
      const metaError = (err as { response?: { data?: unknown } })?.response?.data;
      console.error("[Numbers] Test message failed:", JSON.stringify(metaError) || (err as Error).message);
      return res.status(400).json({ error: "Could not send test message. Check the phone number and the Meta App Dashboard for details." });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/numbers/:id/logo — the WhatsApp Business Profile photo shown to
// customers, fetched live from Meta each time (not stored) since it's just
// as easy to ask Meta for the current one as it is to keep a copy in sync.
numbersRouter.get("/:id/logo", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    try {
      const meta = new MetaApiService(decrypt(number.accessToken), number.phoneNumberId);
      const profile = await meta.getBusinessProfile();
      res.json({ logoUrl: profile.profile_picture_url || null });
    } catch {
      res.json({ logoUrl: null });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/numbers/:id/logo — uploads a new WhatsApp Business Profile photo.
// Same Resumable Upload flow as template header media (templates.ts's
// /upload-media), just applied to the business profile endpoint instead of
// a template component.
numbersRouter.post("/:id/logo", logoUpload.single("file"), requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!number) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "Number not found" });
    }

    const appId = number.metaAppId || process.env.META_APP_ID;
    if (!appId) {
      fs.unlink(req.file.path, () => {});
      return res.status(500).json({ error: "Could not determine the Meta App ID for this number. Re-save its access token on the Numbers page to resolve it." });
    }

    try {
      const meta = new MetaApiService(decrypt(number.accessToken), number.phoneNumberId);
      const fileBuffer = fs.readFileSync(req.file.path);
      const handle = await meta.uploadResumableMedia(appId, fileBuffer, req.file.mimetype, req.file.originalname);
      await meta.setBusinessProfilePicture(handle);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { error?: { message?: string; error_user_msg?: string } } }; message?: string };
      const metaMsg = axErr.response?.data?.error?.error_user_msg || axErr.response?.data?.error?.message || axErr.message || "Unknown error";
      console.error("[Numbers] Logo upload failed:", JSON.stringify(axErr.response?.data || axErr.message));
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: `Meta rejected the logo upload: ${metaMsg}` });
    }

    fs.unlink(req.file.path, () => {});
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
