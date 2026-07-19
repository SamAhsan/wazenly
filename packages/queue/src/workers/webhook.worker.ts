import { Worker, Job } from "bullmq";
import axios from "axios";
import { prisma } from "@wazenly/db";
import { QUEUE_NAMES, OPT_OUT_KEYWORDS, normalizeMessage } from "@wazenly/shared";
import type { MetaWebhookPayload } from "@wazenly/shared";
import { redisConnection } from "../redis";
import { findMatchingFlowStart, executeFromNode, resumeWaitingInput } from "../services/flow-engine.service";
import { notifyUsers, getMembersWithMinRole, wasRecentlyNotified, notifyOnFinalJobFailure } from "../services/notification.service";
import { recordDeliverySuccess, recordDeliveryFailure } from "../services/contact-status.service";
import { classifyReplyIntent } from "../services/reply-intent.service";
import type { WhatsAppNumber, Workspace, Contact } from "@wazenly/db";

interface WebhookJobData {
  payload: MetaWebhookPayload;
  phoneNumberId: string;
}

interface SocketEmitter {
  to(room: string): { emit(event: string, data: unknown): void };
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

// A tapped quick-reply or interactive button carries no msg.text — but the button's own
// label is exactly what the user "said" by tapping it, so flow keyword triggers (and
// message previews) should be able to match against it the same as typed text.
function extractMessageText(msg: {
  text?: { body: string };
  button?: { text: string };
  interactive?: { type: string; button_reply?: { title: string }; list_reply?: { title: string } };
}): string | undefined {
  if (msg.text?.body) return msg.text.body;
  if (msg.button?.text) return msg.button.text;
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title;
  return undefined;
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
  console.log(`[FlowEngine] Message from contact ${contact.id} on number ${number.id}: "${messageText ?? "(no text)"}" (isNewContact=${isNewContact})`);

  const session = await prisma.flowSession.findUnique({
    where: { contactId_numberId: { contactId: contact.id, numberId: number.id } },
  });

  if (session?.state === "WAITING_INPUT") {
    console.log(`[FlowEngine] Contact ${contact.id} has a session WAITING_INPUT on node ${session.nodeId} (flow ${session.flowId}) — resuming`);
    const flow = await prisma.flow.findUnique({ where: { id: session.flowId } });
    if (!flow) {
      console.log(`[FlowEngine] Session references flow ${session.flowId} which no longer exists — dropping session`);
      return;
    }
    await resumeWaitingInput(
      { flow, contact, number, workspace: number.workspace, variables: (session.variables as Record<string, unknown>) || {} },
      session.nodeId,
      messageText || ""
    );
    return;
  }

  if (session?.state === "WAITING_DELAY") {
    // A delayed job is already scheduled to resume this session — leave it alone.
    console.log(`[FlowEngine] Contact ${contact.id} has a session WAITING_DELAY — ignoring inbound message until it resumes`);
    return;
  }

  const match = await findMatchingFlowStart(number.workspaceId, number.id, messageText, isNewContact, !isNewContact);
  if (!match) {
    console.log(`[FlowEngine] No active flow trigger matched for contact ${contact.id} on number ${number.id}`);
    return;
  }

  console.log(`[FlowEngine] Matched flow "${match.flow.name}" (${match.flow.id}) for contact ${contact.id} — starting at node ${match.startNodeId ?? "(none — trigger has no outgoing edge)"}`);

  await executeFromNode(
    { flow: match.flow, contact, number, workspace: number.workspace, variables: {} },
    match.startNodeId
  );
}

async function processWebhook(job: Job<WebhookJobData>, io?: SocketEmitter): Promise<void> {
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
          // A crash processing one message must not prevent other messages/status
          // updates in the same batched webhook call from being processed -- Meta
          // already got its 200 OK before this job runs, so it won't retry, and
          // anything skipped here is gone for good.
          try {
          const contactProfile = value.contacts?.find((c) => c.wa_id === msg.from);
          const contactName = contactProfile?.profile?.name;

          // Upsert contact
          let contact = await prisma.contact.findFirst({
            where: { workspaceId: number.workspaceId, numberId: number.id, phone: `+${msg.from}` },
          });
          const isNewContact = !contact;

          if (!contact) {
            contact = await prisma.contact.create({
              data: {
                workspaceId: number.workspaceId,
                numberId: number.id,
                name: contactName || `+${msg.from}`,
                phone: `+${msg.from}`,
              },
            });
            await upsertDailyAnalytics(number.workspaceId, number.id, "newContacts").catch(() => {});
          }

          // Any inbound message is a sign of life — keeps the contact out of the
          // dormant-detection worker's "no activity" window.
          await prisma.contact.update({ where: { id: contact.id }, data: { lastMessaged: new Date() } }).catch(() => {});

          // Check opt-out, and otherwise classify reply interest. Both an
          // explicit opt-out keyword (STOP/UNSUBSCRIBE/iptal/...) and an
          // inferred "not interested" reply suppress the contact from future
          // campaigns (see isSuppressed()) -- statusReason keeps them
          // distinguishable in the dashboard.
          if (msg.type === "text") {
            const text = msg.text?.body || "";
            const sample = text.slice(0, 500);
            if (OPT_OUT_KEYWORDS.includes(normalizeMessage(text))) {
              await prisma.contact.update({
                where: { id: contact.id },
                data: {
                  optedOut: true, optedOutAt: new Date(),
                  status: "UNSUBSCRIBED", statusChangedAt: new Date(), statusReason: "Opted out via keyword reply",
                  replyIntent: "NOT_INTERESTED", replyIntentAt: new Date(), replyIntentSample: sample,
                },
              });
            } else {
              const intent = classifyReplyIntent(text);
              if (intent === "NOT_INTERESTED") {
                await prisma.contact.update({
                  where: { id: contact.id },
                  data: {
                    optedOut: true, optedOutAt: new Date(),
                    status: "UNSUBSCRIBED", statusChangedAt: new Date(), statusReason: "Marked not interested via reply",
                    replyIntent: intent, replyIntentAt: new Date(), replyIntentSample: sample,
                  },
                });
              } else if (intent) {
                await prisma.contact.update({
                  where: { id: contact.id },
                  data: { replyIntent: intent, replyIntentAt: new Date(), replyIntentSample: sample },
                });
              }
            }
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
              contactId: contact.id,
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
              body: extractMessageText(msg),
              timestamp: new Date(Number(msg.timestamp) * 1000),
              raw: msg as any,
            },
          });

          // Lets the inbox re-sort this conversation to the top and refresh its
          // unread badge immediately, instead of waiting for the next poll.
          if (io) {
            io.to(`workspace:${number.workspaceId}`).emit("message:new", { conversationId: conversation.id });
          }

          await upsertDailyAnalytics(number.workspaceId, number.id, "inbound").catch(() => {});

          // Dispatch outbound webhooks
          await dispatchOutboundWebhooks(number.workspaceId, "message.received", {
            phone: `+${msg.from}`,
            message: msg,
            numberId: number.id,
          });

          // Flow Builder execution
          try {
            await runFlowEngineForMessage(number, contact, extractMessageText(msg), isNewContact);
          } catch (err) {
            console.error(`[WebhookWorker] Flow engine error for contact ${contact.id}:`, (err as Error).message);
          }

          // Notify: new incoming message — the assigned agent, or (for a brand-new contact only) the whole team
          try {
            const preview = extractMessageText(msg)?.slice(0, 80) || `[${msg.type}]`;
            const recipients = conversation.assignedUserId
              ? [conversation.assignedUserId]
              : isNewContact
                ? await getMembersWithMinRole(number.workspaceId, "AGENT")
                : [];
            await notifyUsers(number.workspaceId, recipients, "NEW_MESSAGE", `New message from ${contact.name}`, preview, "/dashboard/inbox");
          } catch (err) {
            console.error(`[WebhookWorker] Notification error for contact ${contact.id}:`, (err as Error).message);
          }
          } catch (err) {
            console.error(`[WebhookWorker] Failed processing inbound message ${msg.id} from ${msg.from}:`, (err as Error).message);
          }
        }
      }

      // Process status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          try {
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

          // Track delivery outcomes toward each contact's health status.
          if (metaStatus === "delivered" || metaStatus === "failed") {
            const relatedMessage = await prisma.message.findFirst({
              where: { metaMessageId: status.id },
              select: { contactId: true },
            });
            if (relatedMessage?.contactId) {
              if (metaStatus === "delivered") {
                await recordDeliverySuccess(relatedMessage.contactId);
              } else {
                await recordDeliveryFailure(relatedMessage.contactId, String(status.errors?.[0]?.code || ""));
              }
            }
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
          } catch (err) {
            console.error(`[WebhookWorker] Failed processing status update for message ${status.id}:`, (err as Error).message);
          }
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

export function createWebhookWorker(io?: SocketEmitter) {
  const worker = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOK_PROCESSOR,
    (job) => processWebhook(job, io),
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
