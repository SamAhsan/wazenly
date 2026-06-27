import { Router } from "express";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, AuthRequest } from "../middleware/auth";
import { MetaApiService } from "../services/meta.service";
import { decrypt } from "@wazenly/shared";

export const templatesRouter = Router();
templatesRouter.use(requireAuth, requireWorkspace);

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

    // Build Meta template payload
    const components: object[] = [];

    if (body.headerType !== "NONE") {
      const headerComp: Record<string, unknown> = { type: "HEADER", format: body.headerType };
      if (body.headerType === "TEXT" && body.headerText) headerComp.text = body.headerText;
      components.push(headerComp);
    }

    components.push({ type: "BODY", text: body.body });
    if (body.footer) components.push({ type: "FOOTER", text: body.footer });
    if (body.buttons?.length) {
      components.push({ type: "BUTTONS", buttons: body.buttons.map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.url ? { url: b.url } : {}),
        ...(b.phone_number ? { phone_number: b.phone_number } : {}),
      })) });
    }

    let metaId: string | undefined;
    try {
      const result = await meta.createTemplate(number.wabaId, {
        name: body.name,
        category: body.category,
        language: body.language,
        components,
      }) as { id: string };
      metaId = result.id;
    } catch {
      return res.status(400).json({ error: "Failed to submit template to Meta. Check template content." });
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
        buttons: body.buttons || null,
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

    const { templateSyncQueue } = await import("@wazenly/queue");
    await templateSyncQueue.add("sync-templates", {
      workspaceId: req.workspaceId!,
      numberId: number.id,
      wabaId: number.wabaId,
      accessToken: number.accessToken,
    });

    res.json({ success: true, message: "Template sync queued" });
  } catch (err) {
    next(err);
  }
});
