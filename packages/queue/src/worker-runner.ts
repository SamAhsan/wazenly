// Entry point for the worker process only — NOT imported by the API
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import { createCampaignWorker } from "./workers/campaign.worker";
import { createWebhookWorker } from "./workers/webhook.worker";
import { createTemplateSyncWorker } from "./workers/template-sync.worker";
import { createContactImporterWorker } from "./workers/contact-importer.worker";
import { createFlowWorker } from "./workers/flow.worker";
import { createNotificationWorker } from "./workers/notification.worker";
import { createNumberHealthWorker } from "./workers/number-health.worker";
import { createContactEngagementWorker } from "./workers/contact-engagement.worker";
import { templateSyncQueue, numberHealthCheckQueue, contactEngagementQueue } from "./queues";
import { prisma } from "@wazenly/db";

async function startWorkers() {
  console.log("🚀 Starting WAZENLY queue workers...");

  const workers = [
    createCampaignWorker(),
    createWebhookWorker(),
    createTemplateSyncWorker(),
    createContactImporterWorker(),
    createFlowWorker(),
    createNotificationWorker(),
    createNumberHealthWorker(),
    createContactEngagementWorker(),
  ];

  // Schedule hourly template sync for all connected numbers
  await templateSyncQueue.add(
    "sync-all-templates",
    {},
    {
      repeat: { every: 3600000 },
      jobId: "template-sync-recurring",
    }
  );

  // Schedule a health check every 30 minutes for every number (any status), so a
  // number removed/disabled on Meta's side gets marked DISCONNECTED automatically,
  // and one that was wrongly marked disconnected can recover too.
  await numberHealthCheckQueue.add(
    "check-all-numbers",
    {},
    {
      repeat: { every: 1800000 },
      jobId: "number-health-check-recurring",
    }
  );

  // Recompute contact status (Dormant detection) and engagement scores daily.
  await contactEngagementQueue.add(
    "check-all-contacts",
    {},
    {
      repeat: { every: 86400000 },
      jobId: "contact-engagement-recurring",
    }
  );

  // Initial sync for all connected numbers on startup
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

  console.log(`✅ ${workers.length} workers running. Waiting for jobs...`);

  const shutdown = async () => {
    console.log("\nShutting down workers...");
    await Promise.all(workers.map((w) => w.close()));
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startWorkers().catch((err) => {
  console.error("Failed to start workers:", err);
  process.exit(1);
});
