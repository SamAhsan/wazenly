import { Worker, Job } from "bullmq";
import { prisma } from "@wazenly/db";
import { QUEUE_NAMES } from "@wazenly/shared";
import { redisConnection } from "../redis";

// Not "number health" (that's WhatsApp-number connectivity, see
// number-health.worker.ts) -- this is per-contact engagement/activity.
const DORMANT_AFTER_DAYS = 60;
const RECENT_REPLY_WINDOW_DAYS = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function computeEngagementScore(contactId: string, lastMessaged: Date | null): Promise<number> {
  const [statusCounts, repliedRecently] = await Promise.all([
    prisma.campaignContact.groupBy({
      by: ["status"],
      where: { contactId },
      _count: true,
    }),
    prisma.message.findFirst({
      where: {
        contactId,
        direction: "INBOUND",
        timestamp: { gte: new Date(Date.now() - RECENT_REPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    }),
  ]);

  const counts = { QUEUED: 0, SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0 };
  statusCounts.forEach((s) => { counts[s.status as keyof typeof counts] = s._count; });

  const attempted = counts.SENT + counts.DELIVERED + counts.READ + counts.FAILED;
  const delivered = counts.DELIVERED + counts.READ;
  const deliveryRate = attempted > 0 ? delivered / attempted : 0;
  const readRate = delivered > 0 ? counts.READ / delivered : 0;

  const daysSinceLastMessaged = lastMessaged ? (Date.now() - lastMessaged.getTime()) / (24 * 60 * 60 * 1000) : Infinity;
  const recencyBonus = clamp(20 - daysSinceLastMessaged / 3, 0, 20);

  const score = deliveryRate * 25 + readRate * 25 + (repliedRecently ? 30 : 0) + recencyBonus;
  return Math.round(clamp(score, 0, 100));
}

async function checkContactEngagement(_job: Job): Promise<void> {
  const contacts = await prisma.contact.findMany({
    where: { status: { in: ["ACTIVE", "DORMANT"] } },
    select: { id: true, status: true, lastMessaged: true },
  });

  const dormantCutoff = new Date(Date.now() - DORMANT_AFTER_DAYS * 24 * 60 * 60 * 1000);
  let dormantCount = 0;
  let recoveredCount = 0;

  for (const contact of contacts) {
    const isInactive = !contact.lastMessaged || contact.lastMessaged < dormantCutoff;
    const engagementScore = await computeEngagementScore(contact.id, contact.lastMessaged);

    const data: { engagementScore: number; status?: "DORMANT" | "ACTIVE"; statusChangedAt?: Date } = { engagementScore };
    if (isInactive && contact.status === "ACTIVE") {
      data.status = "DORMANT";
      data.statusChangedAt = new Date();
      dormantCount++;
    } else if (!isInactive && contact.status === "DORMANT") {
      data.status = "ACTIVE";
      data.statusChangedAt = new Date();
      recoveredCount++;
    }

    await prisma.contact.update({ where: { id: contact.id }, data }).catch(() => {});
  }

  console.log(`[ContactEngagementWorker] Checked ${contacts.length} contact(s): ${dormantCount} newly dormant, ${recoveredCount} recovered to active.`);
}

export function createContactEngagementWorker() {
  const worker = new Worker(QUEUE_NAMES.CONTACT_ENGAGEMENT, checkContactEngagement, {
    connection: redisConnection,
    concurrency: 1,
  });

  worker.on("failed", (job, err) => {
    console.error(`[ContactEngagementWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
