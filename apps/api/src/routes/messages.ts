import { Router } from "express";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, requireRole, AuthRequest } from "../middleware/auth";
import { MetaApiService } from "../services/meta.service";
import { decrypt } from "@wazenly/shared";
import { io } from "../index";

export const messagesRouter = Router();
messagesRouter.use(requireAuth, requireWorkspace);

const sendMessageSchema = z.object({
  conversationId: z.string(),
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "TEMPLATE"]),
  body: z.string().optional(),
  mediaUrl: z.string().optional(),
  mediaCaption: z.string().optional(),
  mediaFilename: z.string().optional(),
  templateName: z.string().optional(),
  templateLanguage: z.string().optional(),
  templateVars: z.record(z.string()).optional(),
  replyToId: z.string().optional(),
});

// POST /api/messages/send
messagesRouter.post("/send", requireRole("AGENT"), async (req: AuthRequest, res, next) => {
  try {
    const body = sendMessageSchema.parse(req.body);

    const conversation = await prisma.conversation.findFirst({
      where: { id: body.conversationId, workspaceId: req.workspaceId! },
      include: { number: true },
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.number.status === "DISCONNECTED") {
      return res.status(400).json({ error: "This number is disconnected. Reconnect it in Numbers before sending." });
    }

    const accessToken = decrypt(conversation.number.accessToken);
    const meta = new MetaApiService(accessToken, conversation.number.phoneNumberId);

    let metaMessageId: string | undefined;

    if (body.type === "TEXT" && body.body) {
      const result = await meta.sendText(conversation.phone, body.body);
      metaMessageId = result.id;
    } else if (body.type === "TEMPLATE" && body.templateName) {
      const template = await prisma.template.findFirst({
        where: { workspaceId: req.workspaceId!, name: body.templateName },
      });
      const components: object[] = [];
      // IMAGE/VIDEO/DOCUMENT headers require a media parameter on every send —
      // Meta rejects the message with error 132012 otherwise, even if the body has no variables.
      if (template && ["IMAGE", "VIDEO", "DOCUMENT"].includes(template.headerType)) {
        if (!template.headerUrl) {
          return res.status(400).json({
            error: `This template requires a ${template.headerType.toLowerCase()} header but no header media URL is set. Add one in Templates.`,
          });
        }
        const mediaType = template.headerType.toLowerCase();
        components.push({ type: "header", parameters: [{ type: mediaType, [mediaType]: { link: template.headerUrl } }] });
      }
      const vars = body.templateVars ? Object.values(body.templateVars).map((v) => ({ type: "text", text: v })) : [];
      if (vars.length) components.push({ type: "body", parameters: vars });
      const result = await meta.sendTemplate(conversation.phone, body.templateName, body.templateLanguage || "en", components);
      metaMessageId = result.id;
    } else if (["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"].includes(body.type) && body.mediaUrl) {
      const result = await meta.sendMedia(
        conversation.phone,
        body.type.toLowerCase() as "image" | "video" | "audio" | "document",
        body.mediaUrl,
        body.mediaCaption,
        body.mediaFilename
      );
      metaMessageId = result.id;
    } else {
      return res.status(400).json({ error: "Invalid message payload" });
    }

    const message = await prisma.message.create({
      data: {
        workspaceId: req.workspaceId!,
        conversationId: body.conversationId,
        numberId: conversation.numberId,
        contactId: conversation.contactId,
        phone: conversation.phone,
        direction: "OUTBOUND",
        type: body.type as any,
        status: "SENT",
        metaMessageId,
        body: body.body,
        mediaUrl: body.mediaUrl,
        mediaCaption: body.mediaCaption,
        mediaFilename: body.mediaFilename,
        templateName: body.templateName,
        templateVars: body.templateVars,
        replyToId: body.replyToId,
        timestamp: new Date(),
        sentAt: new Date(),
      },
    });

    await prisma.conversation.update({
      where: { id: body.conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Emit socket event for real-time update
    io.to(`workspace:${req.workspaceId}`).emit("message:new", message);

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// GET /api/messages/:id
messagesRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const message = await prisma.message.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!message) return res.status(404).json({ error: "Message not found" });
    res.json(message);
  } catch (err) {
    next(err);
  }
});
