import { Worker, Job } from "bullmq";
import axios from "axios";
import { prisma } from "@wazenly/db";
import { QUEUE_NAMES, OPT_OUT_KEYWORDS } from "@wazenly/shared";
import type { MetaWebhookPayload } from "@wazenly/shared";
import { redisConnection } from "../redis";
import { findMatchingFlowStart, executeFromNode, resumeWaitingInput } from "../services/flow-engine.service";
import { notifyUsers, getMembersWithMinRole, wasRecentlyNotified, notifyOnFinalJobFailure } from "../services/notification.service";
import type { WhatsAppNumber, Workspace, Contact } from "@wazenly/db";

interface WebhookJobData {
  payload: MetaWebhookPayload;
  phoneNumberId: string;
}

// Meta sends message types beyond what's in the MessageType enum (e.g. new/rare
// ones); mapping unknowns to UNKNOWN instead of passing them through raw keeps a
// single unrecognized type from crashing the whole webhook job.
const KNOWN_MESSAGE_TYPES = new Set([
  "TEXT", "IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "LOCATION",
  "CONTACTS", "TEMPLATE", "INTERACTIVE", "STICKER", "REACTION", "BUTTON",
]);

function toMessageType(metaType: string): string {
  const upper = metaType.toUpperCase();
  return KNOWN_MESSAGE_TYPES.has(upper) ? upper : "UNKNOWN";
}

async function upsertDailyAnalytics(
  workspaceId: string,
  numberId: string,
  field: "messagesSent" | "delivered" | "read" | "failed" | "inbound" | "newContacts",
  amount = 1
): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await prisma.dailyAnalytics.upsert({
    where: { workspaceId_numberId_date: { workspaceId, numberId, date: today } },
    create: { workspaceId, numberId, date: today, [field]: amount } as any,
    update: { [field]: { increment: amount } } as any,
  });
}

async function runFlowEngineForMessage(
  number: WhatsAppNumber & { workspace: Workspace },
  contact: Contact,
  messageText: string | undefined,
  isNewContact: boolean
): Promise<void> {
  const session = await prisma.flowSession.findUnique({
    where: { contactId_numberId: { contactId: contact.id, numberId: number.id } },
  });

  if (session?.state === "WAITING_INPUT") {
    const flow = await prisma.flow.findUnique({ where: { id: session.flowId } });
    if (!flow) return;
    await resumeWaitingInput(
      { flow, contact, number, workspace: number.workspace, variables: (session.variables as Record<string, unknown>) || {} },
      session.nodeId,
      messageText || ""
    );
    return;
  }

  if (session?.state === "WAITING_DELAY") {
    // A delayed job is already scheduled to resume this session — leave it alone.
    return;
  }

  const match = await findMatchingFlowStart(number.workspaceId, number.id, messageText, isNewContact, !isNewContact);
  if (!match) return;

  await executeFromNode(
    { flow: match.flow, contact, number, workspace: number.workspace, variables: {} },
    match.startNodeId
  );
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
          const isNewContact = !contact;

          if (!contact) {
            contact = await prisma.contact.create({
              data: {
                workspaceId: number.workspaceId,
                name: contactName || `+${msg.from}`,
                phone: `+${msg.from}`,
              },
            });
            await upsertDailyAnalytics(number.workspaceId, number.id, "newContacts").catch(() => {});
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
              type: toMessageType(msg.type) as any,
              status: "DELIVERED",
              metaMessageId: msg.id,
              body: msg.text?.body,
              timestamp: new Date(Number(msg.timestamp) * 1000),
              raw: msg as any,
            },
          });

          await upsertDailyAnalytics(number.workspaceId, number.id, "inbound").catch(() => {});

          // Dispatch outbound webhooks
          await dispatchOutboundWebhooks(number.workspaceId, "message.received", {
            phone: `+${msg.from}`,
            message: msg,
            numberId: number.id,
          });

          // Flow Builder execution
          try {
            await runFlowEngineForMessage(number, contact, msg.text?.body, isNewContact);
          } catch (err) {
            console.error(`[WebhookWorker] Flow engine error for contact ${contact.id}:`, (err as Error).message);
          }

          // Notify: new incoming message — the assigned agent, or (for a brand-new contact only) the whole team
          try {
            const preview = msg.text?.body?.slice(0, 80) || `[${msg.type}]`;
            const recipients = conversation.assignedUserId
              ? [conversation.assignedUserId]
              : isNewContact
                ? await getMembersWithMinRole(number.workspaceId, "AGENT")
                : [];
            await notifyUsers(number.workspaceId, recipients, "NEW_MESSAGE", `New message from ${contact.name}`, preview, "/dashboard/inbox");
          } catch (err) {
            console.error(`[WebhookWorker] Notification error for contact ${contact.id}:`, (err as Error).message);
          }
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

          if (metaStatus === "delivered") {
            await upsertDailyAnalytics(number.workspaceId, number.id, "delivered").catch(() => {});
          } else if (metaStatus === "read") {
            await upsertDailyAnalytics(number.workspaceId, number.id, "read").catch(() => {});
          } else if (metaStatus === "failed") {
            await upsertDailyAnalytics(number.workspaceId, number.id, "failed").catch(() => {});
          }

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

      try {
        const recipients = await getMembersWithMinRole(workspaceId, "ADMIN");
        const alreadyNotified = await wasRecentlyNotified(recipients, "WEBHOOK_FAILED", 3600000, endpoint.id);
        if (!alreadyNotified) {
          await notifyUsers(
            workspaceId,
            recipients,
            "WEBHOOK_FAILED",
            "Webhook delivery failed",
            `Delivery to ${endpoint.url} failed.`,
            `/dashboard/settings?webhook=${endpoint.id}`
          );
        }
      } catch (err) {
        console.error(`[WebhookWorker] Failed to send webhook-failure notification:`, (err as Error).message);
      }
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
    if (job?.data.phoneNumberId) {
      prisma.whatsAppNumber
        .findUnique({ where: { phoneNumberId: job.data.phoneNumberId }, select: { workspaceId: true } })
        .then((number) => {
          if (number) return notifyOnFinalJobFailure(job, number.workspaceId, "Webhook processing", err.message);
        })
        .catch(() => {});
    }
  });

  return worker;
}
