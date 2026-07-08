// A contact in one of these statuses must never receive a campaign send by
// default. Dormant/Failed-Delivery are deliberately excluded from this list —
// they're informational/filterable but often the exact intended audience for a
// re-engagement or retry campaign, so they stay includable.
export const HARD_SUPPRESSED_STATUSES = ["UNSUBSCRIBED", "BLACKLISTED", "INVALID"] as const;

export function isSuppressed(status: string): boolean {
  return (HARD_SUPPRESSED_STATUSES as readonly string[]).includes(status);
}
