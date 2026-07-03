import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";
import { normalizePhone, isValidPhone } from "@wazenly/shared";
import { contactImporterQueue } from "@wazenly/queue";

const MAX_IMPORT_ROWS = 10000;

// Reads CSV or XLSX into a uniform { columns, rows } shape, keeping original header
// text (not assuming any fixed column name/order) so the caller can build a mapping UI.
async function parseSpreadsheet(file: Express.Multer.File): Promise<{ columns: string[]; rows: Record<string, string>[]; truncated: boolean }> {
  const isExcel = /\.(xlsx)$/i.test(file.originalname) || file.mimetype.includes("spreadsheet");

  if (isExcel) {
    const workbook = new ExcelJS.Workbook();
    // ExcelJS's bundled type declares a Buffer shape from a different @types/node
    // version than this monorepo's — a type-level mismatch only, valid at runtime.
    await workbook.xlsx.load(Buffer.from(file.buffer) as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { columns: [], rows: [], truncated: false };

    const headerRow = sheet.getRow(1);
    const columns: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      columns[colNumber - 1] = String(cell.value ?? "").trim();
    });

    const rows: Record<string, string>[] = [];
    const totalDataRows = sheet.rowCount - 1;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (rows.length >= MAX_IMPORT_ROWS) return;
      const record: Record<string, string> = {};
      let hasValue = false;
      columns.forEach((col, idx) => {
        if (!col) return;
        const cell = row.getCell(idx + 1);
        const value = cell.value == null ? "" : String(cell.text ?? cell.value).trim();
        record[col] = value;
        if (value) hasValue = true;
      });
      if (hasValue) rows.push(record);
    });

    return { columns: columns.filter(Boolean), rows, truncated: totalDataRows > MAX_IMPORT_ROWS };
  }

  const records = parse(file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const columns = records.length > 0 ? Object.keys(records[0]) : [];
  const nonBlankRows = records.filter((r) => Object.values(r).some((v) => v && v.trim()));
  return {
    columns,
    rows: nonBlankRows.slice(0, MAX_IMPORT_ROWS),
    truncated: nonBlankRows.length > MAX_IMPORT_ROWS,
  };
}

export const contactsRouter = Router();
contactsRouter.use(requireAuth, requireWorkspace);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string(),
  email: z.preprocess((v) => v === "" ? undefined : v, z.string().email().optional()),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

// GET /api/contacts
contactsRouter.get("/", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
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
contactsRouter.post("/", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
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
contactsRouter.get("/:id", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
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
contactsRouter.put("/:id", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
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
contactsRouter.delete("/:id", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    await prisma.contact.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId! } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/contacts/import/parse — reads the file and returns its columns + rows so the
// frontend can show a mapping UI. Does not write anything to the database.
contactsRouter.post("/import/parse", upload.single("file"), requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File required" });
    const { columns, rows, truncated } = await parseSpreadsheet(req.file);
    if (columns.length === 0) return res.status(400).json({ error: "Couldn't find a header row in this file" });
    if (rows.length === 0) return res.status(400).json({ error: "File has no data rows" });

    res.json({ columns, rows, totalRows: rows.length, truncated });
  } catch (err) {
    next(err);
  }
});

const importMappingSchema = z.object({
  mapping: z.object({
    name: z.string().optional(),
    phone: z.string(),
    email: z.string().optional(),
    tags: z.string().optional(),
  }),
  rows: z.array(z.record(z.string())).min(1).max(MAX_IMPORT_ROWS),
  listId: z.string().optional(),
  listName: z.string().optional(),
  deduplicate: z.boolean().default(true),
});

// POST /api/contacts/import — takes the mapped column choices + previously parsed rows
// (from /import/parse) and queues the actual import.
contactsRouter.post("/import", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    const body = importMappingSchema.parse(req.body);

    let listId = body.listId;
    if (!listId && body.listName?.trim()) {
      const list = await prisma.contactList.create({
        data: { workspaceId: req.workspaceId!, name: body.listName.trim() },
      });
      listId = list.id;
    }

    const { name: nameCol, phone: phoneCol, email: emailCol, tags: tagsCol } = body.mapping;
    const contacts = body.rows.map((row) => ({
      name: nameCol ? row[nameCol] || "" : "",
      phone: row[phoneCol] || "",
      email: emailCol ? row[emailCol] || undefined : undefined,
      tags: tagsCol && row[tagsCol] ? row[tagsCol].split(/[,;]/).map((t) => t.trim()).filter(Boolean) : undefined,
    }));

    const job = await contactImporterQueue.add("import-contacts", {
      workspaceId: req.workspaceId!,
      listId,
      contacts,
      deduplicate: body.deduplicate,
    });

    res.json({ jobId: job.id, totalRows: contacts.length, message: "Import started" });
  } catch (err) {
    next(err);
  }
});

// GET /api/contacts/import/:jobId/status
contactsRouter.get("/import/:jobId/status", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    const job = await contactImporterQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Import job not found" });

    const state = await job.getState();
    res.json({
      state,
      progress: job.progress,
      result: state === "completed" ? job.returnvalue : null,
      failedReason: state === "failed" ? job.failedReason : null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Contact Lists ────────────────────────────────────────

// GET /api/contacts/lists
contactsRouter.get("/lists/all", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
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
contactsRouter.post("/lists", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
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
contactsRouter.post("/lists/:listId/members", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
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
