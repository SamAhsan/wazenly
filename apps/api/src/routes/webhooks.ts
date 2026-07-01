import { Router } from "express";
import { prisma } from "@wazenly/db";
import { webhookProcessorQueue } from "@wazenly/queue";
import type { MetaWebhookPayload } from "@wazenly/shared";

export const webhooksRouter = Router();

// GET /api/webhooks/meta — Meta webhook verification (one URL for ALL numbers)
webhooksRouter.get("/meta", (req, res) => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  if (mode !== "subscribe") return res.status(400).send("Invalid mode");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error("[Webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set in environment");
    return res.status(500).send("Webhook verify token not configured");
  }
  if (token !== verifyToken) return res.status(403).send("Invalid verify token");

  res.status(200).send(challenge);
});

// POST /api/webhooks/meta — Incoming Meta events (one endpoint for ALL numbers)
webhooksRouter.post("/meta", async (req, res) => {
  // Respond immediately — Meta requires 200 within 3 seconds
  res.status(200).send("EVENT_RECEIVED");

  const payload = req.body as MetaWebhookPayload;

  // Extract unique phoneNumberIds from payload and queue one job each
  const seen = new Set<string>();
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (phoneNumberId && !seen.has(phoneNumberId)) {
        seen.add(phoneNumberId);
        webhookProcessorQueue
          .add("process-webhook", { payload, phoneNumberId })
          .catch((err) => console.error("[Webhook] Failed to queue for", phoneNumberId, err));
      }
    }
  }
});
