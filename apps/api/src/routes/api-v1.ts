// Public REST API v1 — authenticated via API key
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireApiKey, AuthRequest } from "../middleware/auth";
import { apiRateLimiter } from "../middleware/rate-limiter";
import { MetaApiService } from "../services/meta.service";
import { decrypt, normalizePhone } from "@wazenly/shared";
import { campaignSenderQueue } from "@wazenly/queue";
import { CAMPAIGN_BATCH_SIZE } from "@wazenly/shared";

export const apiV1Router = Router();
apiV1Router.use(requireApiKey, apiRateLimiter);

// POST /api/v1/messages/send
apiV1Router.post("/messages/send", async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      numberId: z.string(),
      to: z.string(),
      type: z.enum(["text", "image", "video", "audio", "document"]),
      text: z.string().optional(),
      mediaUrl: z.string().optional(),
      caption: z.string().optional(),
    }).parse(req.body);

    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: body.numberId, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    const meta = new MetaApiService(decrypt(number.accessToken), number.phoneNumberId);
    let result: { id: string };

    if (body.type === "text" && body.text) {
      result = await meta.sendText(body.to, body.text);
    } else if (body.mediaUrl) {
      result = await meta.sendMedia(body.to, body.type as "image" | "video" | "audio" | "document", body.mediaUrl, body.caption);
    } else {
      return res.status(400).json({ error: "Invalid payload" });
    }

    res.status(201).json({ messageId: result.id, status: "sent" });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/messages/template
apiV1Router.post("/messages/template", async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      numberId: z.string(),
      to: z.string(),
      templateName: z.string(),
      languageCode: z.string().default("en"),
      variables: z.record(z.string()).optional(),
    }).parse(req.body);

    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: body.numberId, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(404).json({ error: "Number not found" });

    const meta = new MetaApiService(decrypt(number.accessToken), number.phoneNumberId);
    const vars = body.variables ? Object.values(body.variables).map((v) => ({ type: "text", text: v })) : [];
    const components = vars.length ? [{ type: "body", parameters: vars }] : [];
    const result = await meta.sendTemplate(body.to, body.templateName, body.languageCode, components);

    res.status(201).json({ messageId: result.id, status: "sent" });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/messages/:id
apiV1Router.get("/messages/:id", async (req: AuthRequest, res, next) => {
  try {
    const message = await prisma.message.findFirst({
      where: { metaMessageId: req.params.id },
      select: { id: true, status: true, sentAt: true, deliveredAt: true, readAt: true, failedAt: true },
    });
    if (!message) return res.status(404).json({ error: "Message not found" });
    res.json(message);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/campaigns
apiV1Router.post("/campaigns", async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string(),
      numberId: z.string(),
      templateId: z.string(),
      contacts: z.array(z.object({ phone: z.string(), variables: z.record(z.string()).optional() })),
      scheduledAt: z.string().optional(),
    }).parse(req.body);

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: req.workspaceId!,
        name: body.name,
        numberId: body.numberId,
        templateId: body.templateId,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        status: "DRAFT",
        totalRecipients: body.contacts.length,
      },
    });

    await prisma.campaignContact.createMany({
      data: body.contacts.map((c) => ({
        campaignId: campaign.id,
        phone: normalizePhone(c.phone),
        variables: c.variables || {},
      })),
      skipDuplicates: true,
    });

    const job = await campaignSenderQueue.add("campaign-batch", {
      campaignId: campaign.id,
      workspaceId: req.workspaceId!,
      numberId: body.numberId,
      batchOffset: 0,
      batchSize: CAMPAIGN_BATCH_SIZE,
    });

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "RUNNING", bullJobId: job.id },
    });

    res.status(201).json({ id: campaign.id, status: "running" });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/campaigns/:id
apiV1Router.get("/campaigns/:id", async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      select: { id: true, name: true, status: true, totalRecipients: true, sentCount: true, deliveredCount: true, readCount: true, failedCount: true },
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/contacts
apiV1Router.post("/contacts", async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      numberId: z.string(),
      name: z.string(),
      phone: z.string(),
      email: z.string().email().optional(),
      tags: z.array(z.string()).optional(),
    }).parse(req.body);

    const phone = normalizePhone(body.phone);
    const contact = await prisma.contact.upsert({
      where: { workspaceId_numberId_phone: { workspaceId: req.workspaceId!, numberId: body.numberId, phone } },
      create: { workspaceId: req.workspaceId!, ...body, phone },
      update: { name: body.name, email: body.email },
    });
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/contacts
apiV1Router.get("/contacts", async (req: AuthRequest, res, next) => {
  try {
    const { page = "1", limit = "50", numberId } = req.query as Record<string, string>;
    const where: Record<string, unknown> = { workspaceId: req.workspaceId! };
    if (numberId) where.numberId = numberId;
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: { id: true, name: true, phone: true, email: true, tags: true, optedOut: true },
      }),
      prisma.contact.count({ where }),
    ]);
    res.json({ data: contacts, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/templates
apiV1Router.get("/templates", async (req: AuthRequest, res, next) => {
  try {
    const templates = await prisma.template.findMany({
      where: { workspaceId: req.workspaceId!, status: "APPROVED" },
      select: { id: true, name: true, category: true, language: true, status: true, body: true },
    });
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/numbers
apiV1Router.get("/numbers", async (req: AuthRequest, res, next) => {
  try {
    const numbers = await prisma.whatsAppNumber.findMany({
      where: { workspaceId: req.workspaceId! },
      select: { id: true, displayName: true, phoneNumber: true, status: true, tier: true },
    });
    res.json(numbers);
  } catch (err) {
    next(err);
  }
});
