import { Worker, Job } from "bullmq";
import axios from "axios";
import { prisma } from "@wazenly/db";
import { decrypt, QUEUE_NAMES, CAMPAIGN_BATCH_SIZE, META_GRAPH_URL, OPT_OUT_KEYWORDS } from "@wazenly/shared";
import type { CampaignJobData } from "@wazenly/shared";
import { redisConnection } from "../redis";
import { campaignSenderQueue } from "../queues";
import { notifyUsers, getMembersWithMinRole, notifyOnFinalJobFailure } from "../services/notification.service";

async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string,
  variables: Record<string, string>,
  header?: { type: string; url?: string | null }
): Promise<string> {
  const components: object[] = [];

  // IMAGE/VIDEO/DOCUMENT headers require a media parameter on every send —
  // Meta rejects the message with error 132012 otherwise, even if the body has no variables.
  if (header && ["IMAGE", "VIDEO", "DOCUMENT"].includes(header.type)) {
    if (!header.url) {
      throw new Error(
        `Template requires a ${header.type.toLowerCase()} header but no header media URL is set. Add one in Templates.`
      );
    }
    const mediaType = header.type.toLowerCase();
    components.push({
      type: "header",
      parameters: [{ type: mediaType, [mediaType]: { link: header.url } }],
    });
  }

  const varEntries = Object.entries(variables);
  if (varEntries.length > 0) {
    components.push({
      type: "body",
      parameters: varEntries.map(([, value]) => ({ type: "text", text: value })),
    });
  }

  const response = await axios.post(
    `${META_GRAPH_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components.length > 0 ? components : undefined,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.messages?.[0]?.id as string;
}

function renderTemplateBody(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => variables[n] ?? `{{${n}}}`);
}

async function isInQuietHours(quietStart: string | null, quietEnd: string | null, timezone: string): Promise<boolean> {
  if (!quietStart || !quietEnd) return false;
  const now = new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  return now >= quietStart && now <= quietEnd;
}

async function notifyCampaignCompleted(workspaceId: string, campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { name: true } });
  const recipients = await getMembersWithMinRole(workspaceId, "MANAGER");
  await notifyUsers(
    workspaceId,
    recipients,
    "CAMPAIGN_COMPLETED",
    "Campaign completed",
    `"${campaign?.name || campaignId}" has finished sending.`,
    "/dashboard/campaigns"
  );
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

async function processCampaignBatch(job: Job<CampaignJobData>): Promise<void> {
  const { campaignId, workspaceId, numberId, batchOffset, batchSize } = job.data;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: {
      template: true,
      number: true,
    },
  });

  if (!campaign || campaign.status === "PAUSED" || campaign.status === "FAILED") {
    console.log(`[Campaign ${campaignId}] Skipping — status: ${campaign?.status ?? "not found"}`);
    return;
  }

  if (!campaign.template || !campaign.number) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "FAILED" },
    });
    return;
  }

  // Check quiet hours
  const inQuiet = await isInQuietHours(campaign.quietHoursStart, campaign.quietHoursEnd, campaign.timezone);
  if (inQuiet) {
    // Re-schedule job for later
    await campaignSenderQueue.add("campaign-batch", job.data, { delay: 30 * 60 * 1000 });
    return;
  }

  const accessToken = decrypt(campaign.number.accessToken);
  const phoneNumberId = campaign.number.phoneNumberId;

  const contacts = await prisma.campaignContact.findMany({
    where: { campaignId, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  console.log(`[Campaign ${campaignId}] Found ${contacts.length} QUEUED contact(s)`);

  if (contacts.length === 0) {
    // All contacts processed — mark campaign complete
    const stats = await prisma.campaignContact.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: true,
    });

    const counts = { SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0 };
    stats.forEach((s) => {
      counts[s.status as keyof typeof counts] = s._count;
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "COMPLETED",
        sentCount: counts.SENT + counts.DELIVERED + counts.READ,
        deliveredCount: counts.DELIVERED + counts.READ,
        readCount: counts.READ,
        failedCount: counts.FAILED,
      },
    });
    console.log(`[Campaign ${campaignId}] Completed!`);
    await notifyCampaignCompleted(workspaceId, campaignId).catch(() => {});
    return;
  }

  const rateLimit = campaign.rateLimit || 60;
  const delayMs = Math.ceil(60000 / rateLimit);

  // Count {{1}}, {{2}}, ... placeholders in the template body
  const placeholderCount = (campaign.template.body.match(/\{\{\d+\}\}/g) || []).length;

  let sentCount = 0;
  let failedCount = 0;

  for (const cc of contacts) {
    try {
      // Only pass variables if the template actually has placeholders
      const rawVars = (cc.variables as Record<string, string>) || {};
      const variables = placeholderCount > 0 ? rawVars : {};
      const msgId = await sendWhatsAppMessage(
        phoneNumberId,
        accessToken,
        cc.phone,
        campaign.template!.name,
        campaign.template!.language,
        variables,
        { type: campaign.template!.headerType, url: campaign.template!.headerUrl }
      );

      await prisma.campaignContact.update({
        where: { id: cc.id },
        data: { status: "SENT", messageId: msgId, sentAt: new Date() },
      });
      sentCount++;
      await upsertDailyAnalytics(workspaceId, campaign.number.id, "messagesSent").catch(() => {});

      // Reflect the send in the Inbox immediately (not just once/if the contact replies),
      // and give the status-update handler in webhook.worker.ts a Message row to find —
      // it already looks one up by metaMessageId, but had nothing to match without this.
      try {
        const contact = cc.contactId ? await prisma.contact.findUnique({ where: { id: cc.contactId }, select: { name: true } }) : null;
        const conversation = await prisma.conversation.upsert({
          where: { workspaceId_numberId_phone: { workspaceId, numberId: campaign.number.id, phone: cc.phone } },
          update: { lastMessageAt: new Date(), contactName: contact?.name || undefined },
          create: {
            workspaceId,
            numberId: campaign.number.id,
            contactId: cc.contactId,
            phone: cc.phone,
            contactName: contact?.name || cc.phone,
            lastMessageAt: new Date(),
            status: "OPEN",
          },
        });
        await prisma.message.create({
          data: {
            workspaceId,
            conversationId: conversation.id,
            numberId: campaign.number.id,
            contactId: cc.contactId,
            phone: cc.phone,
            direction: "OUTBOUND",
            type: "TEMPLATE",
            status: "SENT",
            metaMessageId: msgId,
            body: renderTemplateBody(campaign.template!.body, variables),
            templateName: campaign.template!.name,
            templateVars: variables,
            timestamp: new Date(),
            sentAt: new Date(),
          },
        });
      } catch (inboxErr) {
        console.error(`[Campaign ${campaignId}] Failed to record inbox message for ${cc.phone}:`, (inboxErr as Error).message);
      }

      // Rate limit delay
      await new Promise((r) => setTimeout(r, delayMs));
    } catch (err: unknown) {
      const error = err as { response?: { status: number; data?: { error?: { message: string; code?: number } } }; message?: string };
      const metaError = error.response?.data?.error;
      console.error(`[Campaign ${campaignId}] FAILED to send to ${cc.phone}: ${metaError ? `Meta error ${metaError.code}: ${metaError.message}` : error.message ?? String(err)}`);

      if (error.response?.status === 429) {
        // Rate limited — re-queue remaining contacts after backoff
        await campaignSenderQueue.add(
          "campaign-batch",
          { ...job.data, batchOffset: batchOffset + sentCount },
          { delay: 60000 }
        );
        return;
      }

      await prisma.campaignContact.update({
        where: { id: cc.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: error.response?.data?.error?.message || error.message || "Unknown error",
        },
      });
      failedCount++;
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sentCount: { increment: sentCount },
      failedCount: { increment: failedCount },
    },
  });

  // Queue next batch or mark complete
  const remaining = await prisma.campaignContact.count({
    where: { campaignId, status: "QUEUED" },
  });

  if (remaining > 0) {
    await campaignSenderQueue.add("campaign-batch", {
      ...job.data,
      batchOffset: 0,
    });
  } else {
    // No QUEUED contacts left — compute final stats and mark complete
    const finalStats = await prisma.campaignContact.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: true,
    });
    const counts = { SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0 };
    finalStats.forEach((s) => { counts[s.status as keyof typeof counts] = s._count; });
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "COMPLETED",
        sentCount: counts.SENT + counts.DELIVERED + counts.READ,
        deliveredCount: counts.DELIVERED + counts.READ,
        readCount: counts.READ,
        failedCount: counts.FAILED,
      },
    });
    console.log(`[Campaign ${campaignId}] Completed — sent:${counts.SENT + counts.DELIVERED + counts.READ} failed:${counts.FAILED}`);
    await notifyCampaignCompleted(workspaceId, campaignId).catch(() => {});
  }
}

export function createCampaignWorker() {
  const worker = new Worker<CampaignJobData>(
    QUEUE_NAMES.CAMPAIGN_SENDER,
    processCampaignBatch,
    {
      connection: redisConnection,
      concurrency: 5,
      limiter: { max: 100, duration: 1000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[CampaignWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[CampaignWorker] Job ${job?.id} failed:`, err.message);
    if (job?.data.workspaceId) {
      notifyOnFinalJobFailure(job, job.data.workspaceId, `Campaign send (${job.data.campaignId})`, err.message).catch(() => {});
    }
  });

  return worker;
}
