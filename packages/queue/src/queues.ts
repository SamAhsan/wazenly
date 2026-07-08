import { Queue } from "bullmq";
import { redisConnection } from "./redis";
import { QUEUE_NAMES } from "@wazenly/shared";

const connection = redisConnection;

export const campaignSenderQueue = new Queue(QUEUE_NAMES.CAMPAIGN_SENDER, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const webhookProcessorQueue = new Queue(QUEUE_NAMES.WEBHOOK_PROCESSOR, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export const templateSyncQueue = new Queue(QUEUE_NAMES.TEMPLATE_SYNC, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "fixed", delay: 30000 },
    removeOnComplete: { count: 50 },
  },
});

export const contactImporterQueue = new Queue(QUEUE_NAMES.CONTACT_IMPORTER, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export const notificationSenderQueue = new Queue(QUEUE_NAMES.NOTIFICATION_SENDER, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
  },
});

export const flowExecutorQueue = new Queue(QUEUE_NAMES.FLOW_EXECUTOR, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export const numberHealthCheckQueue = new Queue(QUEUE_NAMES.NUMBER_HEALTH_CHECK, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 30000 },
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 50 },
  },
});

export const contactEngagementQueue = new Queue(QUEUE_NAMES.CONTACT_ENGAGEMENT, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 30000 },
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 50 },
  },
});

export { connection };
