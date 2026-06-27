import { Worker, Job } from "bullmq";
import axios from "axios";
import { prisma } from "@wazenly/db";
import { QUEUE_NAMES, OPT_OUT_KEYWORDS } from "@wazenly/shared";
import type { MetaWebhookPayload } from "@wazenly/shared";
import { redisConnection } from "../redis";

interface WebhookJobData {
  payload: MetaWebhookPayload;
  phoneNumberId: string;
}

async function processWebhook(job: Job<WebhookJobData>): Promise<void> {
  const { payload, phoneNumberId } = job.data;

  const number = await prisma.whatsAppNumber.findUnique({
    where: { phoneNumberId },
    include: { workspace: true },
  });

  if (!number) {
    console.warn(`[WebhookWorker] Unknown number: ${phoneNumberId}`);
    return;
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const { value } = change;

      // Process incoming messages
      if (value.messages) {
        for (const msg of value.messages) {
          const contactProfile = value.contacts?.find((c) => c.wa_id === msg.from);
          const contactName = contactProfile?.profile.name;

          // Upsert contact
          let contact = await prisma.contact.findFirst({
            where: { workspaceId: number.workspaceId, phone: `+${msg.from}` },
          });

          if (!contact) {
            contact = await prisma.contact.create({
              data: {
                workspaceId: number.workspaceId,
                name: contactName || `+${msg.from}`,
                phone: `+${msg.from}`,
              },
            });
          }

          // Check opt-out
          if (msg.type === "text" && OPT_OUT_KEYWORDS.includes(msg.text?.body || "")) {
            await prisma.contact.update({
              where: { id: contact.id },
              data: { optedOut: true, optedOutAt: new Date() },
            });
          }

          // Upsert conversation
          const conversation = await prisma.conversation.upsert({
            where: {
              workspaceId_numberId_phone: {
                workspaceId: number.workspaceId,
                numberId: number.id,
                phone: `+${msg.from}`,
              },
            },
            update: {
              lastMessageAt: new Date(Number(msg.timestamp) * 1000),
              unreadCount: { increment: 1 },
              contactName: contactName || undefined,
            },
            create: {
              workspaceId: number.workspaceId,
              numberId: number.id,
              contactId: contact.id,
              phone: `+${msg.from}`,
              contactName: contactName || `+${msg.from}`,
              lastMessageAt: new Date(Number(msg.timestamp) * 1000),
              unreadCount: 1,
              status: "OPEN",
            },
          });

          // Save message
          await prisma.message.create({
            data: {
              workspaceId: number.workspaceId,
              conversationId: conversation.id,
              numberId: number.id,
              contactId: contact.id,
              phone: `+${msg.from}`,
              direction: "INBOUND",
              type: msg.type.toUpperCase() as any,
              status: "DELIVERED",
              metaMessageId: msg.id,
              body: msg.text?.body,
              timestamp: new Date(Number(msg.timestamp) * 1000),
              raw: msg as any,
            },
          });

          // Dispatch outbound webhooks
          await dispatchOutboundWebhooks(number.workspaceId, "message.received", {
            phone: `+${msg.from}`,
            message: msg,
            numberId: number.id,
          });
        }
      }

      // Process status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          const metaStatus = status.status;
          const updateData: Record<string, unknown> = {};

          if (metaStatus === "sent") updateData.status = "SENT";
          else if (metaStatus === "delivered") {
            updateData.status = "DELIVERED";
            updateData.deliveredAt = new Date(Number(status.timestamp) * 1000);
          } else if (metaStatus === "read") {
            updateData.status = "READ";
            updateData.readAt = new Date(Number(status.timestamp) * 1000);
          } else if (metaStatus === "failed") {
            updateData.status = "FAILED";
            updateData.failedAt = new Date(Number(status.timestamp) * 1000);
            updateData.errorCode = String(status.errors?.[0]?.code || "");
            updateData.errorMessage = status.errors?.[0]?.title || "Unknown error";
          }

          await prisma.message.updateMany({
            where: { metaMessageId: status.id },
            data: updateData,
          });

          // Update campaign contact status (if this message belongs to a campaign)
          if (updateData.status) {
            const campaignContact = await prisma.campaignContact.findFirst({
              where: { messageId: status.id },
              select: { campaignId: true },
            });

            await prisma.campaignContact.updateMany({
              where: { messageId: status.id },
              data: {
                status: (updateData.status as string) as any,
                deliveredAt: updateData.deliveredAt as Date | undefined,
                readAt: updateData.readAt as Date | undefined,
                failedAt: updateData.failedAt as Date | undefined,
                errorMessage: updateData.errorMessage as string | undefined,
              },
            });

            // Recalculate and persist campaign aggregate stats
            if (campaignContact) {
              const groupStats = await prisma.campaignContact.groupBy({
                by: ["status"],
                where: { campaignId: campaignContact.campaignId },
                _count: true,
              });
              const counts = { SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0, QUEUED: 0 };
              groupStats.forEach((s) => { counts[s.status as keyof typeof counts] = s._count; });
              await prisma.campaign.update({
                where: { id: campaignContact.campaignId },
                data: {
                  sentCount: counts.SENT + counts.DELIVERED + counts.READ,
                  deliveredCount: counts.DELIVERED + counts.READ,
                  readCount: counts.READ,
                  failedCount: counts.FAILED,
                },
              });
            }
          }

          await dispatchOutboundWebhooks(number.workspaceId, `message.${metaStatus}`, {
            messageId: status.id,
            status: metaStatus,
            phone: status.recipient_id,
          });
        }
      }
    }
  }
}

async function dispatchOutboundWebhooks(
  workspaceId: string,
  event: string,
  payload: unknown
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { workspaceId, isActive: true, events: { has: event } },
  });

  for (const endpoint of endpoints) {
    const webhookEvent = await prisma.webhookEvent.create({
      data: { endpointId: endpoint.id, event, payload: payload as any, status: "pending" },
    });

    try {
      await axios.post(endpoint.url, { event, data: payload }, {
        headers: {
          "Content-Type": "application/json",
          "X-Wazenly-Event": event,
          ...(endpoint.secret ? { "X-Wazenly-Signature": endpoint.secret } : {}),
        },
        timeout: 10000,
      });
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: "delivered", sentAt: new Date() },
      });
    } catch {
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: "failed", attempts: { increment: 1 } },
      });
    }
  }
}

export function createWebhookWorker() {
  const worker = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOK_PROCESSOR,
    processWebhook,
    { connection: redisConnection, concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[WebhookWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
