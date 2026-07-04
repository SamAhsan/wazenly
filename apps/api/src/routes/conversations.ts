import { Router } from "express";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth, requireWorkspace);

// GET /api/conversations
conversationsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const { status, numberId, assignedToMe, q, page = "1", limit = "30" } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = { workspaceId: req.workspaceId! };
    if (status) where.status = status;
    if (numberId) where.numberId = numberId;
    if (assignedToMe === "true") where.assignedUserId = req.userId;
    if (q) where.OR = [{ contactName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }];
    // A campaign/quick-send message is recorded as soon as Meta accepts the API call,
    // before we know whether the number even exists on WhatsApp -- so a conversation
    // with no real customer activity and nothing but a failed send is just noise, not
    // a contact worth showing. Anything the contact ever actually messaged in on stays.
    where.NOT = {
      AND: [
        { messages: { none: { direction: "INBOUND" } } },
        { messages: { every: { status: "FAILED" } } },
      ],
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          number: { select: { displayName: true, phoneNumber: true } },
          contact: { select: { name: true } },
          assignedUser: { select: { id: true, name: true, image: true } },
          messages: { take: 1, orderBy: { timestamp: "desc" }, select: { body: true, type: true, direction: true, timestamp: true } },
        },
        orderBy: { lastMessageAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.conversation.count({ where }),
    ]);

    res.json({ data: conversations, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id
conversationsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      include: {
        number: true,
        contact: true,
        assignedUser: { select: { id: true, name: true, image: true } },
      },
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id/messages
conversationsRouter.get("/:id/messages", async (req: AuthRequest, res, next) => {
  try {
    const { cursor, limit = "50" } = req.query as Record<string, string>;

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      select: { id: true, numberId: true },
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id, numberId: conversation.numberId },
      orderBy: { timestamp: "desc" },
      take: Number(limit),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    res.json({ data: messages.reverse(), nextCursor: messages[0]?.id });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/assign
conversationsRouter.post("/:id/assign", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    const { userId } = z.object({ userId: z.string().nullable() }).parse(req.body);
    await prisma.conversation.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: { assignedUserId: userId },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/resolve
conversationsRouter.post("/:id/resolve", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    await prisma.conversation.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: { status: "RESOLVED" },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/reopen
conversationsRouter.post("/:id/reopen", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    await prisma.conversation.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: { status: "OPEN" },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/notes
conversationsRouter.post("/:id/notes", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    const { body } = z.object({ body: z.string().min(1) }).parse(req.body);
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      select: { id: true },
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    const note = await prisma.conversationNote.create({
      data: { conversationId: req.params.id, userId: req.userId!, body },
      include: { user: { select: { id: true, name: true, image: true } } },
    });
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id/notes
conversationsRouter.get("/:id/notes", async (req: AuthRequest, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      select: { id: true },
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    const notes = await prisma.conversationNote.findMany({
      where: { conversationId: req.params.id },
      include: { user: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(notes);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/conversations/:id/read
conversationsRouter.patch("/:id/read", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    await prisma.conversation.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: { unreadCount: 0 },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
