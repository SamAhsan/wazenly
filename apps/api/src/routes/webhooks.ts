import { Router } from "express";
import { prisma } from "@wazenly/db";
import { webhookProcessorQueue } from "@wazenly/queue";
import type { MetaWebhookPayload } from "@wazenly/shared";

export const webhooksRouter = Router();

// GET /api/webhooks/meta/:phoneNumberId — Meta webhook verification
webhooksRouter.get("/meta/:phoneNumberId", async (req, res) => {
  const { phoneNumberId } = req.params;
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  if (mode !== "subscribe") return res.status(400).send("Invalid mode");

  const number = await prisma.whatsAppNumber.findUnique({ where: { phoneNumberId } });
  if (!number) return res.status(404).send("Number not found");

  if (token !== number.webhookVerifyToken) return res.status(403).send("Invalid verify token");

  res.status(200).send(challenge);
});

// POST /api/webhooks/meta/:phoneNumberId — Incoming Meta events
webhooksRouter.post("/meta/:phoneNumberId", async (req, res) => {
  // Respond immediately to Meta (must return 200 within 3 sec)
  res.status(200).send("EVENT_RECEIVED");

  const payload = req.body as MetaWebhookPayload;
  const { phoneNumberId } = req.params;

  try {
    await webhookProcessorQueue.add("process-webhook", { payload, phoneNumberId });
  } catch (err) {
    console.error("[Webhook] Failed to queue:", err);
  }
});
