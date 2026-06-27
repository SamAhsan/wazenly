import { Worker, Job } from "bullmq";
import { prisma } from "@wazenly/db";
import { QUEUE_NAMES, normalizePhone, isValidPhone } from "@wazenly/shared";
import { redisConnection } from "../redis";

interface ContactImportJobData {
  workspaceId: string;
  listId?: string;
  contacts: Array<{
    name: string;
    phone: string;
    email?: string;
    tags?: string[];
    [key: string]: unknown;
  }>;
  deduplicate: boolean;
}

async function importContacts(job: Job<ContactImportJobData>): Promise<void> {
  const { workspaceId, listId, contacts, deduplicate } = job.data;

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  const phones = new Set<string>();

  for (const row of contacts) {
    try {
      const phone = normalizePhone(row.phone);
      if (!isValidPhone(phone)) { failed++; continue; }
      if (deduplicate && phones.has(phone)) { skipped++; continue; }
      phones.add(phone);

      const { name, email, tags, ...rest } = row;
      const customFields = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !["phone"].includes(k))
      );

      const contact = await prisma.contact.upsert({
        where: { workspaceId_phone: { workspaceId, phone } },
        create: {
          workspaceId,
          name: String(name || phone),
          phone,
          email: email ? String(email) : undefined,
          tags: Array.isArray(tags) ? tags : [],
          customFields: Object.keys(customFields).length > 0 ? (customFields as any) : undefined,
        },
        update: {
          name: String(name || phone),
          email: email ? String(email) : undefined,
        },
      });

      if (listId) {
        await prisma.contactListMember.upsert({
          where: { listId_contactId: { listId, contactId: contact.id } },
          create: { listId, contactId: contact.id },
          update: {},
        });
      }

      imported++;
    } catch {
      failed++;
    }

    await job.updateProgress(Math.round(((imported + skipped + failed) / contacts.length) * 100));
  }

  console.log(`[ContactImporter] Workspace ${workspaceId}: imported=${imported} skipped=${skipped} failed=${failed}`);
}

export function createContactImporterWorker() {
  const worker = new Worker<ContactImportJobData>(
    QUEUE_NAMES.CONTACT_IMPORTER,
    importContacts,
    { connection: redisConnection, concurrency: 2 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[ContactImporterWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
