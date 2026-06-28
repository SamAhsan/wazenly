import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, AuthRequest } from "../middleware/auth";
import { normalizePhone, isValidPhone } from "@wazenly/shared";
import { contactImporterQueue } from "@wazenly/queue";

export const contactsRouter = Router();
contactsRouter.use(requireAuth, requireWorkspace);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string(),
  email: z.preprocess((v) => v === "" ? undefined : v, z.string().email().optional()),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

// GET /api/contacts
contactsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const { q, tags, listId, optedOut, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = { workspaceId: req.workspaceId! };
    if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }];
    if (tags) where.tags = { hasEvery: tags.split(",") };
    if (optedOut !== undefined) where.optedOut = optedOut === "true";
    if (listId) where.listMemberships = { some: { listId } };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
        include: { listMemberships: { include: { list: { select: { id: true, name: true } } } } },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({ data: contacts, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

// POST /api/contacts
contactsRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const body = contactSchema.parse(req.body);
    const phone = normalizePhone(body.phone);
    if (!isValidPhone(phone)) return res.status(400).json({ error: "Invalid phone number" });

    const contact = await prisma.contact.upsert({
      where: { workspaceId_phone: { workspaceId: req.workspaceId!, phone } },
      create: { workspaceId: req.workspaceId!, name: body.name, phone, email: body.email, tags: body.tags, customFields: body.customFields as any },
      update: { name: body.name, email: body.email, tags: body.tags, customFields: body.customFields as any },
    });

    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

// GET /api/contacts/:id
contactsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      include: {
        listMemberships: { include: { list: true } },
        campaignContacts: { include: { campaign: { select: { id: true, name: true, status: true } } }, take: 10, orderBy: { createdAt: "desc" } },
        conversations: { take: 5, orderBy: { lastMessageAt: "desc" } },
      },
    });
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    res.json(contact);
  } catch (err) {
    next(err);
  }
});

// PUT /api/contacts/:id
contactsRouter.put("/:id", async (req: AuthRequest, res, next) => {
  try {
    const body = contactSchema.partial().parse(req.body);
    const contact = await prisma.contact.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: body as any,
    });
    if (!contact.count) return res.status(404).json({ error: "Contact not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/contacts/:id
contactsRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    await prisma.contact.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId! } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/contacts/import
contactsRouter.post("/import", upload.single("file"), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "CSV file required" });
    const { listId, deduplicate = "true" } = req.body as { listId?: string; deduplicate?: string };

    const records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    if (!records.length) return res.status(400).json({ error: "CSV is empty" });

    const job = await contactImporterQueue.add("import-contacts", {
      workspaceId: req.workspaceId!,
      listId,
      contacts: records,
      deduplicate: deduplicate === "true",
    });

    res.json({ jobId: job.id, totalRows: records.length, message: "Import started" });
  } catch (err) {
    next(err);
  }
});

// ─── Contact Lists ────────────────────────────────────────

// GET /api/contacts/lists
contactsRouter.get("/lists/all", async (req: AuthRequest, res, next) => {
  try {
    const lists = await prisma.contactList.findMany({
      where: { workspaceId: req.workspaceId! },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(lists);
  } catch (err) {
    next(err);
  }
});

// POST /api/contacts/lists
contactsRouter.post("/lists", async (req: AuthRequest, res, next) => {
  try {
    const { name, description } = z.object({ name: z.string().min(2), description: z.string().optional() }).parse(req.body);
    const list = await prisma.contactList.create({
      data: { workspaceId: req.workspaceId!, name, description },
    });
    res.status(201).json(list);
  } catch (err) {
    next(err);
  }
});

// POST /api/contacts/lists/:id/members
contactsRouter.post("/lists/:listId/members", async (req: AuthRequest, res, next) => {
  try {
    const { contactIds } = z.object({ contactIds: z.array(z.string()) }).parse(req.body);
    await prisma.contactListMember.createMany({
      data: contactIds.map((contactId) => ({ listId: req.params.listId, contactId })),
      skipDuplicates: true,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
