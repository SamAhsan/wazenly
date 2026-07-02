import { Worker, Job } from "bullmq";
import { QUEUE_NAMES } from "@wazenly/shared";
import { prisma } from "@wazenly/db";
import { redisConnection } from "../redis";
import type { NotifyJobData } from "../services/notification.service";

interface SocketEmitter {
  to(room: string): { emit(event: string, data: unknown): void };
}

async function processNotifyJob(job: Job<NotifyJobData>, io?: SocketEmitter): Promise<void> {
  const { workspaceId, userIds, type, title, message, link } = job.data;

  const notifications = await prisma.$transaction(
    userIds.map((userId) =>
      prisma.notification.create({
        data: { workspaceId, userId, type, title, message, link },
      })
    )
  );

  if (io) {
    for (const notification of notifications) {
      io.to(`user:${notification.userId}`).emit("notification:new", notification);
    }
  }
}

export function createNotificationWorker(io?: SocketEmitter) {
  const worker = new Worker<NotifyJobData>(
    QUEUE_NAMES.NOTIFICATION_SENDER,
    (job) => processNotifyJob(job, io),
    { connection: redisConnection, concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
