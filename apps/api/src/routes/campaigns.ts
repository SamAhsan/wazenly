import { Router } from "express";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";
import { campaignSenderQueue } from "@wazenly/queue";
import { CAMPAIGN_BATCH_SIZE } from "@wazenly/shared";

export const campaignsRouter = Router();
campaignsRouter.use(requireAuth, requireWorkspace);

const campaignSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  numberId: z.string(),
  templateId: z.string().optional(),
  type: z.enum(["ONE_TIME", "RECURRING"]).default("ONE_TIME"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
  scheduledAt: z.string().optional(),
  endDate: z.string().optional(),
  timezone: z.string().default("UTC"),
  rateLimit: z.number().int().min(1).max(1000).default(60),
  throttleHours: z.number().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  variableMapping: z.record(z.string()).optional(),
  contactListIds: z.array(z.string()).optional(),
  contacts: z.array(z.object({
    phone: z.string(),
    variables: z.record(z.string()).optional(),
  })).optional(),
});

// GET /api/campaigns
campaignsRouter.get("/", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const { status, numberId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = { workspaceId: req.workspaceId! };
    if (status) where.status = status;
    if (numberId) where.numberId = numberId;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: { number: { select: { displayName: true, phoneNumber: true } }, template: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.campaign.count({ where }),
    ]);

    res.json({ data: campaigns, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns
campaignsRouter.post("/", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const body = campaignSchema.parse(req.body);

    // Verify number belongs to workspace
    const number = await prisma.whatsAppNumber.findFirst({
      where: { id: body.numberId, workspaceId: req.workspaceId! },
    });
    if (!number) return res.status(400).json({ error: "Invalid number" });

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: req.workspaceId!,
        name: body.name,
        description: body.description,
        numberId: body.numberId,
        templateId: body.templateId,
        type: body.type,
        frequency: body.frequency,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        timezone: body.timezone,
        rateLimit: body.rateLimit,
        throttleHours: body.throttleHours,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd,
        variableMapping: body.variableMapping,
        status: "DRAFT",
        ...(body.contactListIds?.length
          ? { contactLists: { connect: body.contactListIds.map((id) => ({ id })) } }
          : {}),
      },
    });

    // Add inline contacts if provided
    if (body.contacts?.length) {
      await prisma.campaignContact.createMany({
        data: body.contacts.map((c) => ({
          campaignId: campaign.id,
          phone: c.phone,
          variables: c.variables || {},
        })),
        skipDuplicates: true,
      });
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { totalRecipients: body.contacts.length },
      });
    }

    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id
campaignsRouter.get("/:id", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      include: {
        number: { select: { displayName: true, phoneNumber: true } },
        template: true,
        contactLists: { select: { id: true, name: true } },
      },
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// PUT /api/campaigns/:id
campaignsRouter.put("/:id", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
      return res.status(400).json({ error: "Only DRAFT or SCHEDULED campaigns can be edited" });
    }

    const body = campaignSchema.partial().parse(req.body);
    const { contactListIds: _cids, contacts: _cts, variableMapping, scheduledAt: rawScheduledAt, endDate: rawEndDate, ...campaignFields } = body;
    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        ...campaignFields,
        scheduledAt: rawScheduledAt ? new Date(rawScheduledAt) : undefined,
        endDate: rawEndDate ? new Date(rawEndDate) : undefined,
        variableMapping: variableMapping as any,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns/:id/launch
campaignsRouter.post("/:id/launch", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      include: { contactLists: { include: { members: { include: { contact: true } } } } },
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
      return res.status(400).json({ error: "Campaign cannot be launched in its current state" });
    }

    // Build contact list from contact lists
    if (campaign.contactLists.length > 0) {
      const contactSet = new Map<string, { phone: string; variables: Record<string, string> }>();

      for (const list of campaign.contactLists) {
        for (const member of list.members) {
          if (!member.contact.optedOut) {
            contactSet.set(member.contact.phone, {
              phone: member.contact.phone,
              variables: { name: member.contact.name.split(" ")[0], ...((member.contact.customFields as object) || {}) },
            });
          }
        }
      }

      if (contactSet.size > 0) {
        await prisma.campaignContact.createMany({
          data: Array.from(contactSet.values()).map((c) => ({
            campaignId: campaign.id,
            phone: c.phone,
            variables: c.variables,
          })),
          skipDuplicates: true,
        });
      }
    }

    const totalRecipients = await prisma.campaignContact.count({
      where: { campaignId: campaign.id, status: "QUEUED" },
    });

    const isScheduled = campaign.scheduledAt && campaign.scheduledAt > new Date();
    const delay = isScheduled ? campaign.scheduledAt!.getTime() - Date.now() : 0;

    const job = await campaignSenderQueue.add(
      "campaign-batch",
      {
        campaignId: campaign.id,
        workspaceId: req.workspaceId!,
        numberId: campaign.numberId,
        batchOffset: 0,
        batchSize: CAMPAIGN_BATCH_SIZE,
      },
      { delay: Math.max(0, delay) }
    );

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: isScheduled ? "SCHEDULED" : "RUNNING",
        totalRecipients,
        bullJobId: job.id,
      },
    });

    res.json({ success: true, status: isScheduled ? "SCHEDULED" : "RUNNING", totalRecipients });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns/:id/pause
campaignsRouter.post("/:id/pause", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    await prisma.campaign.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId!, status: "RUNNING" },
      data: { status: "PAUSED" },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns/:id/resume  (also re-triggers stuck RUNNING campaigns)
campaignsRouter.post("/:id/resume", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId!, status: { in: ["PAUSED", "RUNNING"] } },
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found or not resumable" });

    await campaignSenderQueue.add("campaign-batch", {
      campaignId: campaign.id,
      workspaceId: req.workspaceId!,
      numberId: campaign.numberId,
      batchOffset: 0,
      batchSize: CAMPAIGN_BATCH_SIZE,
    });

    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "RUNNING" } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/campaigns/:id
campaignsRouter.delete("/:id", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    await prisma.campaign.deleteMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id/contacts
campaignsRouter.get("/:id/contacts", requireRole("MANAGER"), async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      select: { id: true },
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const { page = "1", limit = "50", status } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = { campaignId: req.params.id };
    if (status) where.status = status;

    const [contacts, total] = await Promise.all([
      prisma.campaignContact.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.campaignContact.count({ where }),
    ]);

    res.json({ data: contacts, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
});
