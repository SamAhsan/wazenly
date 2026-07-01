import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, AuthRequest } from "../middleware/auth";
import { MetaApiService } from "../services/meta.service";
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
templatesRouter.get("/", async (req: AuthRequest, res, next) => {
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

// POST /api/templates/upload-media — save to local disk and return a public URL
// Meta requires a publicly accessible URL for example.header_url during template review.
// Uploading to Meta's /media endpoint returns an auth-gated URL which Meta itself cannot read back.
templatesRouter.post("/upload-media", upload.single("file"), async (req: AuthRequest, res, next) => {
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
    const publicUrl = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ url: publicUrl, mediaId: null });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(err);
  }
});

// POST /api/templates
templatesRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const body = templateSchema.parse(req.body);

    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: body.numberId, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(400).json({ error: "Invalid number" });

    const accessToken = decrypt(number.accessToken);
    const meta = new MetaApiService(accessToken, number.phoneNumberId);

    // Build Meta template components
    const components: object[] = [];

    if (body.headerType !== "NONE") {
      const headerComp: Record<string, unknown> = { type: "HEADER", format: body.headerType };
      if (body.headerType === "TEXT" && body.headerText) {
        headerComp.text = body.headerText;
      } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(body.headerType) && body.headerUrl) {
        // Include example URL for Meta review — speeds up approval
        headerComp.example = { header_url: [body.headerUrl] };
      }
      components.push(headerComp);
    }

    // Body with variable examples if provided
    const bodyComp: Record<string, unknown> = { type: "BODY", text: body.body };
    if (body.bodyExamples && Object.keys(body.bodyExamples).length > 0) {
      // Meta expects [[val1, val2, ...]] — one array per message sample
      const sortedKeys = Object.keys(body.bodyExamples).sort((a, b) => Number(a) - Number(b));
      const exampleValues = sortedKeys.map((k) => body.bodyExamples![k]).filter(Boolean);
      if (exampleValues.length > 0) {
        bodyComp.example = { body_text: [exampleValues] };
      }
    }
    components.push(bodyComp);

    if (body.footer) components.push({ type: "FOOTER", text: body.footer });
    if (body.buttons?.length) {
      components.push({
        type: "BUTTONS",
        buttons: body.buttons.map((b) => ({
          type: b.type,
          text: b.text,
          ...(b.url ? { url: b.url } : {}),
          ...(b.phone_number ? { phone_number: b.phone_number } : {}),
        })),
      });
    }

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
templatesRouter.get("/:id", async (req: AuthRequest, res, next) => {
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

// DELETE /api/templates/:id
templatesRouter.delete("/:id", async (req: AuthRequest, res, next) => {
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
templatesRouter.post("/sync", async (req: AuthRequest, res, next) => {
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
            headerUrl: headerComp?.example?.header_url?.[0],
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
