import { Worker, Job } from "bullmq";
import { prisma } from "@wazenly/db";
import { QUEUE_NAMES, normalizePhone, isValidPhone } from "@wazenly/shared";
import { redisConnection } from "../redis";
import { notifyOnFinalJobFailure } from "../services/notification.service";

interface ContactImportJobData {
  workspaceId: string;
  numberId: string;
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

interface ImportSummary {
  total: number;
  imported: number;
  duplicates: number;
  invalidNumbers: number;
  otherErrors: number;
}

async function importContacts(job: Job<ContactImportJobData>): Promise<ImportSummary> {
  const { workspaceId, numberId, listId, contacts, deduplicate } = job.data;

  let imported = 0;
  let duplicates = 0;
  let invalidNumbers = 0;
  let otherErrors = 0;

  const phones = new Set<string>();

  for (const row of contacts) {
    try {
      const phone = normalizePhone(row.phone);
      if (!isValidPhone(phone)) { invalidNumbers++; continue; }
      if (deduplicate && phones.has(phone)) { duplicates++; continue; }
      phones.add(phone);

      const { name, email, tags, ...rest } = row;
      const customFields = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !["phone"].includes(k))
      );

      const contact = await prisma.contact.upsert({
        where: { workspaceId_numberId_phone: { workspaceId, numberId, phone } },
        create: {
          workspaceId,
          numberId,
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
      otherErrors++;
    }

    await job.updateProgress(Math.round(((imported + duplicates + invalidNumbers + otherErrors) / contacts.length) * 100));
  }

  console.log(`[ContactImporter] Workspace ${workspaceId}: imported=${imported} duplicates=${duplicates} invalidNumbers=${invalidNumbers} otherErrors=${otherErrors}`);
  return { total: contacts.length, imported, duplicates, invalidNumbers, otherErrors };
}

export function createContactImporterWorker() {
  const worker = new Worker<ContactImportJobData, ImportSummary>(
    QUEUE_NAMES.CONTACT_IMPORTER,
    importContacts,
    { connection: redisConnection, concurrency: 2 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[ContactImporterWorker] Job ${job?.id} failed:`, err.message);
    if (job?.data.workspaceId) {
      notifyOnFinalJobFailure(job, job.data.workspaceId, "Contact import", err.message).catch(() => {});
    }
  });

  return worker;
}
