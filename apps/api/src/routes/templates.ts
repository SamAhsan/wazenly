import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";
import { MetaApiService } from "../services/meta.service";
import { buildTemplateComponents } from "../services/template-payload";
import { decrypt } from "@wazenly/shared";

export const templatesRouter = Router();
templatesRouter.use(requireAuth, requireWorkspace);

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const templateSchema = z.object({
  name: z.string().regex(/^[a-z0-9_]+$/),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  language: z.string().default("en"),
  numberId: z.string(),
  headerType: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"]).default("NONE"),
  headerText: z.string().optional(),
  headerUrl: z.string().optional(),
  headerHandle: z.string().optional(),
  body: z.string().min(1).max(1024),
  footer: z.string().max(60).optional(),
  buttons: z.array(z.object({
    type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
    text: z.string(),
    url: z.string().optional(),
    phone_number: z.string().optional(),
  })).optional(),
  bodyExamples: z.record(z.string()).optional(),
});

// GET /api/templates
templatesRouter.get("/", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    const { status, category, numberId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = { workspaceId: req.workspaceId! };
    if (status) where.status = status;
    if (category) where.category = category;
    if (numberId) where.numberId = numberId;

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.template.count({ where }),
    ]);

    res.json({ data: templates, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

// POST /api/templates/upload-media — save to local disk (for our own preview),
// then push the file to Meta via the Resumable Upload API to get a header_handle.
// Meta's message_templates endpoint only accepts example.header_handle — a
// header_url is silently ignored, which is why templates were failing review.
templatesRouter.post("/upload-media", upload.single("file"), requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File required" });
    const { numberId } = req.body as { numberId: string };
    if (!numberId) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "numberId required" });
    }

    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: numberId, workspaceId: req.workspaceId! },
    });
    if (!number) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Number not found in this workspace" });
    }

    const baseUrl = process.env.WEBHOOK_BASE_URL;
    if (!baseUrl) {
      fs.unlink(req.file.path, () => {});
      return res.status(500).json({ error: "WEBHOOK_BASE_URL is not configured on the server" });
    }
    // Numbers connected through different Meta Apps/Business accounts each need
    // their own App ID for the Resumable Upload API — resolved and stored on the
    // number when its access token was set (see routes/numbers.ts). META_APP_ID
    // is only a fallback for numbers connected before that resolution existed.
    const appId = number.metaAppId || process.env.META_APP_ID;
    if (!appId) {
      fs.unlink(req.file.path, () => {});
      return res.status(500).json({ error: "Could not determine the Meta App ID for this number. Re-save its access token on the Numbers page to resolve it." });
    }

    const accessToken = decrypt(number.accessToken);
    const meta = new MetaApiService(accessToken, number.phoneNumberId);
    const fileBuffer = fs.readFileSync(req.file.path);

    let handle: string;
    try {
      handle = await meta.uploadResumableMedia(appId, fileBuffer, req.file.mimetype, req.file.originalname);
      console.log("[Templates] Resumable upload succeeded, handle=%s", handle);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { error?: { message?: string; error_user_msg?: string } } }; message?: string };
      const metaMsg = axErr.response?.data?.error?.error_user_msg || axErr.response?.data?.error?.message || axErr.message || "Unknown error";
      console.error("[Templates] Resumable upload failed:", JSON.stringify(axErr.response?.data || axErr.message));
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: `Meta rejected the media upload: ${metaMsg}` });
    }

    const publicUrl = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ url: publicUrl, handle });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(err);
  }
});

// POST /api/templates
templatesRouter.post("/", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const body = templateSchema.parse(req.body);

    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: body.numberId, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(400).json({ error: "Invalid number" });

    // Validate the media handle is present for media headers — Meta requires it,
    // and it can only come from a completed Resumable Upload (see /upload-media).
    if (["IMAGE", "VIDEO", "DOCUMENT"].includes(body.headerType) && !body.headerHandle) {
      return res.status(400).json({
        error: "A sample file is required for IMAGE/VIDEO/DOCUMENT headers. Upload one before submitting.",
      });
    }

    const accessToken = decrypt(number.accessToken);
    const meta = new MetaApiService(accessToken, number.phoneNumberId);
    const components = buildTemplateComponents(body);

    let metaId: string | undefined;
    try {
      console.log("[Templates] Sending to Meta wabaId=%s components=%s", number.wabaId, JSON.stringify(components));
      const result = await meta.createTemplate(number.wabaId, {
        name: body.name,
        category: body.category,
        language: body.language,
        components,
      }) as { id: string };
      metaId = result.id;
      console.log("[Templates] Meta createTemplate succeeded id=%s", metaId);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { error?: { message?: string; code?: number; error_user_msg?: string } } }; message?: string };
      const metaMsg = axErr.response?.data?.error?.error_user_msg
        || axErr.response?.data?.error?.message
        || axErr.message
        || "Unknown error";
      const metaCode = axErr.response?.data?.error?.code;
      console.error("[Templates] Meta createTemplate failed:", JSON.stringify(axErr.response?.data || axErr.message));
      return res.status(400).json({
        error: `Meta rejected the template: ${metaMsg}`,
        metaCode,
        metaDetails: axErr.response?.data,
      });
    }

    const template = await prisma.template.create({
      data: {
        workspaceId: req.workspaceId!,
        numberId: body.numberId,
        metaId,
        name: body.name,
        category: body.category,
        language: body.language,
        status: "PENDING",
        headerType: body.headerType,
        headerText: body.headerText,
        headerUrl: body.headerUrl,
        headerHandle: body.headerHandle,
        body: body.body,
        footer: body.footer,
        buttons: (body.buttons as any) ?? null,
      },
    });

    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

// GET /api/templates/:id
templatesRouter.get("/:id", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    const template = await prisma.template.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (err) {
    next(err);
  }
});

// PUT /api/templates/:id/header-media — set the send-time header image/video/document URL.
// Meta's template sync API never returns a reusable media reference (only an opaque,
// single-use upload handle from template creation), so for templates approved directly
// in Meta and synced in, this has to be supplied manually before the template can be sent.
templatesRouter.put("/:id/header-media", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const { headerUrl } = z.object({ headerUrl: z.string().url() }).parse(req.body);

    const template = await prisma.template.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!template) return res.status(404).json({ error: "Template not found" });
    if (!["IMAGE", "VIDEO", "DOCUMENT"].includes(template.headerType)) {
      return res.status(400).json({ error: "This template's header type doesn't use a media URL" });
    }

    const updated = await prisma.template.update({
      where: { id: template.id },
      data: { headerUrl },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/templates/:id
templatesRouter.delete("/:id", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    await prisma.template.deleteMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/templates/sync
templatesRouter.post("/sync", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const { numberId } = req.body as { numberId: string };
    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: numberId, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    const accessToken = decrypt(number.accessToken);
    const meta = new MetaApiService(accessToken, number.phoneNumberId);

    let rawTemplates: object[];
    try {
      rawTemplates = await meta.getTemplates(number.wabaId);
    } catch {
      return res.status(400).json({ error: "Failed to fetch templates from Meta. Check your access token." });
    }

    let synced = 0;
    for (const t of rawTemplates as any[]) {
      const bodyComp = t.components?.find((c: any) => c.type === "BODY");
      const headerComp = t.components?.find((c: any) => c.type === "HEADER");
      const footerComp = t.components?.find((c: any) => c.type === "FOOTER");
      const buttonComp = t.components?.find((c: any) => c.type === "BUTTONS");

      const existing = await prisma.template.findFirst({
        where: { workspaceId: req.workspaceId!, metaId: t.id },
        select: { id: true },
      });

      if (existing) {
        await prisma.template.update({
          where: { id: existing.id },
          data: { status: t.status, lastSyncedAt: new Date() },
        });
      } else {
        await prisma.template.create({
          data: {
            workspaceId: req.workspaceId!,
            numberId,
            metaId: t.id,
            name: t.name,
            category: t.category,
            language: t.language,
            status: t.status,
            headerType: (headerComp?.format?.toUpperCase() || "NONE") as any,
            headerText: headerComp?.format === "TEXT" ? headerComp.text : undefined,
            // Meta's template API never returns a reusable media URL for header examples —
            // only an opaque, single-use upload handle. A sendable headerUrl has to be set
            // manually afterward via PUT /:id/header-media for IMAGE/VIDEO/DOCUMENT headers.
            body: bodyComp?.text || "",
            footer: footerComp?.text,
            buttons: buttonComp?.buttons ?? null,
            lastSyncedAt: new Date(),
          },
        });
      }
      synced++;
    }

    res.json({ success: true, synced, message: `Synced ${synced} template${synced !== 1 ? "s" : ""}` });
  } catch (err) {
    next(err);
  }
});
