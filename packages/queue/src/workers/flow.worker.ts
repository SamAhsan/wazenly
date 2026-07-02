import { Worker, Job } from "bullmq";
import { QUEUE_NAMES } from "@wazenly/shared";
import { redisConnection } from "../redis";
import { resumeAfterDelay } from "../services/flow-engine.service";

interface FlowJobData {
  sessionId: string;
}

async function processFlowJob(job: Job<FlowJobData>): Promise<void> {
  if (job.name === "resume") {
    await resumeAfterDelay(job.data.sessionId);
  }
}

export function createFlowWorker() {
  const worker = new Worker<FlowJobData>(QUEUE_NAMES.FLOW_EXECUTOR, processFlowJob, {
    connection: redisConnection,
    concurrency: 10,
  });

  worker.on("failed", (job, err) => {
    console.error(`[FlowWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
