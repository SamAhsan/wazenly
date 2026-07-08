import { prisma } from "@wazenly/db";

// Meta's publicly documented codes for permanent, not-going-to-recover
// undeliverability (e.g. "recipient not on WhatsApp"). Best-effort and
// deliberately conservative -- unlike the number-health-check fix, there's no
// confirmed real-world example from this system's own data yet, so this list
// may need tuning once we see actual failures come through.
const PERMANENT_FAILURE_ERROR_CODES = ["131026", "131008", "132001"];

const FAILED_DELIVERY_THRESHOLD = 3;
const INVALID_THRESHOLD = 5;

export async function recordDeliverySuccess(contactId: string): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { status: true } });
  if (!contact) return;

  const data: { consecutiveFailures: number; status?: "ACTIVE"; statusChangedAt?: Date } = { consecutiveFailures: 0 };
  if (contact.status === "FAILED_DELIVERY") {
    data.status = "ACTIVE";
    data.statusChangedAt = new Date();
  }
  await prisma.contact.update({ where: { id: contactId }, data }).catch(() => {});
}

export async function recordDeliveryFailure(contactId: string, errorCode?: string): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { status: true, consecutiveFailures: true } });
  if (!contact) return;
  // Never override a manual blacklist or an existing unsubscribe.
  if (contact.status === "BLACKLISTED" || contact.status === "UNSUBSCRIBED") return;

  const consecutiveFailures = contact.consecutiveFailures + 1;
  const data: { consecutiveFailures: number; status?: "FAILED_DELIVERY" | "INVALID"; statusChangedAt?: Date } = { consecutiveFailures };

  if (consecutiveFailures >= INVALID_THRESHOLD && errorCode && PERMANENT_FAILURE_ERROR_CODES.includes(errorCode)) {
    data.status = "INVALID";
    data.statusChangedAt = new Date();
  } else if (consecutiveFailures >= FAILED_DELIVERY_THRESHOLD && (contact.status === "ACTIVE" || contact.status === "DORMANT")) {
    data.status = "FAILED_DELIVERY";
    data.statusChangedAt = new Date();
  }

  await prisma.contact.update({ where: { id: contactId }, data }).catch(() => {});
}
