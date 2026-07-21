import { Worker, Job } from "bullmq";
import axios from "axios";
import { prisma } from "@wazenly/db";
import { QUEUE_NAMES, META_GRAPH_URL, decrypt } from "@wazenly/shared";
import { redisConnection } from "../redis";
import { templateSyncQueue } from "../queues";
import { notifyUsers, getMembersWithMinRole, notifyOnFinalJobFailure } from "../services/notification.service";

interface TemplateSyncJobData {
  workspaceId: string;
  numberId: string;
  wabaId: string;
  accessToken: string;
}

interface MetaTemplateResponse {
  data: Array<{
    id: string;
    name: string;
    category: string;
    language: string;
    status: string;
    components: Array<{
      type: string;
      format?: string;
      text?: string;
      buttons?: object[];
      example?: object;
    }>;
  }>;
}

async function syncTemplates(job: Job<TemplateSyncJobData>): Promise<void> {
  const { workspaceId, numberId, wabaId, accessToken } = job.data;

  // Recurring trigger job has no data — fan out to per-number sync jobs
  if (!wabaId || !accessToken) {
    const numbers = await prisma.whatsAppNumber.findMany({
      where: { status: "CONNECTED" },
    });
    for (const number of numbers) {
      await templateSyncQueue.add("sync-templates", {
        workspaceId: number.workspaceId,
        numberId: number.id,
        wabaId: number.wabaId,
        accessToken: number.accessToken,
      });
    }
    console.log(`[TemplateSyncWorker] Enqueued sync for ${numbers.length} connected number(s)`);
    return;
  }

  const decryptedToken = decrypt(accessToken);

  try {
    const response = await axios.get<MetaTemplateResponse>(
      `${META_GRAPH_URL}/${wabaId}/message_templates`,
      {
        headers: { Authorization: `Bearer ${decryptedToken}` },
        params: { limit: 100, fields: "id,name,category,language,status,components" },
      }
    );

    for (const t of response.data.data) {
      const bodyComponent = t.components.find((c) => c.type === "BODY");
      const headerComponent = t.components.find((c) => c.type === "HEADER");
      const footerComponent = t.components.find((c) => c.type === "FOOTER");
      const buttonComponent = t.components.find((c) => c.type === "BUTTONS");

      const existing = await prisma.template.findFirst({
        where: { workspaceId, metaId: t.id },
        select: { id: true, status: true },
      });
      if (existing) {
        await prisma.template.update({
          where: { id: existing.id },
          data: { status: t.status as any, metaId: t.id, lastSyncedAt: new Date() },
        });
        if (existing.status !== "APPROVED" && t.status === "APPROVED") {
          const recipients = await getMembersWithMinRole(workspaceId, "MANAGER");
          await notifyUsers(workspaceId, recipients, "TEMPLATE_APPROVED", "Template approved", `"${t.name}" was approved by Meta.`, "/dashboard/templates").catch(() => {});
        }
      } else {
        await prisma.template.create({
          data: {
            workspaceId,
            numberId,
            metaId: t.id,
            name: t.name,
            category: t.category as any,
            language: t.language,
            status: t.status as any,
            headerType: (headerComponent?.format?.toUpperCase() || "NONE") as any,
            headerText: headerComponent?.format === "TEXT" ? headerComponent.text : undefined,
            body: bodyComponent?.text || "",
            footer: footerComponent?.text,
            buttons: (buttonComponent?.buttons as any) || null,
            lastSyncedAt: new Date(),
          },
        });
      }
    }

    await prisma.whatsAppNumber.update({ where: { id: numberId }, data: { lastSyncAt: new Date() } }).catch(() => {});

    console.log(`[TemplateSyncWorker] Synced ${response.data.data.length} templates for workspace ${workspaceId}`);
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[TemplateSyncWorker] Sync failed for ${wabaId}:`, error.message);
    throw err;
  }
}

export function createTemplateSyncWorker() {
  const worker = new Worker<TemplateSyncJobData>(
    QUEUE_NAMES.TEMPLATE_SYNC,
    syncTemplates,
    { connection: redisConnection, concurrency: 3 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[TemplateSyncWorker] Job ${job?.id} failed:`, err.message);
    if (job?.data.workspaceId) {
      notifyOnFinalJobFailure(job, job.data.workspaceId, "Template sync", err.message).catch(() => {});
    }
  });

  return worker;
}
