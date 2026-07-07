import { Worker, Job } from "bullmq";
import axios from "axios";
import { prisma } from "@wazenly/db";
import { QUEUE_NAMES, META_GRAPH_URL, decrypt } from "@wazenly/shared";
import { redisConnection } from "../redis";

async function checkNumberHealth(_job: Job): Promise<void> {
  const numbers = await prisma.whatsAppNumber.findMany();

  for (const number of numbers) {
    try {
      await axios.get(`${META_GRAPH_URL}/${number.phoneNumberId}`, {
        headers: { Authorization: `Bearer ${decrypt(number.accessToken)}` },
        params: { fields: "id" },
      });
      if (number.status !== "CONNECTED") {
        await prisma.whatsAppNumber.update({ where: { id: number.id }, data: { status: "CONNECTED" } });
        console.log(`[NumberHealthWorker] ${number.displayName} recovered -> CONNECTED`);
      }
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { error?: { code?: number; error_subcode?: number } } } }).response;
      const metaStatus = response?.status;
      // Meta's Graph API returns 400 (not 404) with code 100 / error_subcode 33 for
      // "object does not exist" -- this is what a removed/deleted phone number ID
      // actually looks like in practice, confirmed against a real disabled number.
      const objectGone = metaStatus === 400 && response?.data?.error?.code === 100 && response?.data?.error?.error_subcode === 33;
      // Only flip to DISCONNECTED on a definitive rejection from Meta (token revoked,
      // number removed from the WABA, etc). A network blip or Meta 5xx shouldn't mark
      // a healthy number disconnected.
      if (metaStatus === 401 || metaStatus === 403 || metaStatus === 404 || objectGone) {
        if (number.status !== "DISCONNECTED") {
          await prisma.whatsAppNumber.update({ where: { id: number.id }, data: { status: "DISCONNECTED" } });
          console.log(`[NumberHealthWorker] ${number.displayName} -> DISCONNECTED (Meta status ${metaStatus}${objectGone ? ", object no longer exists" : ""})`);
        }
      } else {
        console.error(`[NumberHealthWorker] Health check inconclusive for ${number.displayName}, leaving status unchanged:`, (err as Error).message);
      }
    }
  }
}

export function createNumberHealthWorker() {
  const worker = new Worker(QUEUE_NAMES.NUMBER_HEALTH_CHECK, checkNumberHealth, {
    connection: redisConnection,
    concurrency: 1,
  });

  worker.on("failed", (job, err) => {
    console.error(`[NumberHealthWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
