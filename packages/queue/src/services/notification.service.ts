import { Job } from "bullmq";
import { prisma } from "@wazenly/db";
import { ROLES_HIERARCHY } from "@wazenly/shared";
import type { NotificationType, MemberRole } from "@wazenly/db";
import { notificationSenderQueue } from "../queues";

export interface NotifyJobData {
  workspaceId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function notifyUsers(
  workspaceId: string,
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  if (userIds.length === 0) return;
  await notificationSenderQueue.add("notify", { workspaceId, userIds, type, title, message, link });
}

export async function getMembersWithMinRole(workspaceId: string, minRole: keyof typeof ROLES_HIERARCHY): Promise<string[]> {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, joinedAt: { not: null } },
    select: { userId: true, role: true },
  });
  return members
    .filter((m) => ROLES_HIERARCHY[m.role as MemberRole] >= ROLES_HIERARCHY[minRole])
    .map((m) => m.userId);
}

/** Notifies OWNER+ADMIN of a workspace only once a job has exhausted all its retry attempts. */
export async function notifyOnFinalJobFailure(job: Job, workspaceId: string, jobLabel: string, errorMessage: string): Promise<void> {
  const maxAttempts = job.opts.attempts ?? 1;
  if (job.attemptsMade < maxAttempts) return;

  const recipients = await getMembersWithMinRole(workspaceId, "ADMIN");
  await notifyUsers(
    workspaceId,
    recipients,
    "QUEUE_JOB_FAILED",
    "Background job failed",
    `${jobLabel} failed after ${maxAttempts} attempt(s): ${errorMessage}`
  );
}

/** Guards against notification spam from a persistently-failing endpoint/job. */
export async function wasRecentlyNotified(userIds: string[], type: NotificationType, withinMs: number, linkContains?: string): Promise<boolean> {
  const since = new Date(Date.now() - withinMs);
  const recent = await prisma.notification.findFirst({
    where: {
      userId: { in: userIds },
      type,
      createdAt: { gte: since },
      ...(linkContains ? { link: { contains: linkContains } } : {}),
    },
  });
  return !!recent;
}
