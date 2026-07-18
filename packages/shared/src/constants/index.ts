export const META_API_VERSION = "v18.0";
export const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export const RATE_LIMITS = {
  TIER_1: { daily: 1000, perSecond: 1 },
  TIER_2: { daily: 10000, perSecond: 10 },
  TIER_3: { daily: 100000, perSecond: 20 },
  TIER_4: { daily: 1000000, perSecond: 80 },
} as const;

export const QUEUE_NAMES = {
  CAMPAIGN_SENDER: "campaign-sender",
  WEBHOOK_PROCESSOR: "webhook-processor",
  TEMPLATE_SYNC: "template-sync",
  CONTACT_IMPORTER: "contact-importer",
  NOTIFICATION_SENDER: "notification-sender",
  FLOW_EXECUTOR: "flow-executor",
  NUMBER_HEALTH_CHECK: "number-health-check",
  CONTACT_ENGAGEMENT: "contact-engagement",
} as const;

export const CAMPAIGN_BATCH_SIZE = 50;

export const MESSAGE_STATUSES = {
  QUEUED: "QUEUED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
  FAILED: "FAILED",
} as const;

// Canonical lowercase forms -- matched against a trim/case-folded/punctuation-
// stripped copy of the message body (see normalizeMessage() in
// utils/keyword-match.ts), not the raw text, so casing and stray punctuation
// ("Iptal!", "İPTAL", "stop.") don't prevent a match.
export const OPT_OUT_KEYWORDS = [
  "stop", "stopall", "unsubscribe", "cancel", "end", "quit",
  // Turkish
  "dur", "iptal", "abonelikten çık", "abonelikten cik",
  "aboneliği iptal et", "aboneligi iptal et", "mesaj almak istemiyorum",
];

// Rule-based reply-interest classification (v1 heuristic, no AI) -- tunable.
// Single-word "yes"/"no" are intentionally included since WhatsApp campaigns
// commonly end in a yes/no call-to-action.
export const INTERESTED_KEYWORDS = [
  "interested", "yes", "yes please", "sure", "sounds good",
  "im interested", "i'm interested", "tell me more", "more info", "please share",
  "count me in", "sign me up", "lets do it", "let's do it", "i want this",
  "definitely", "absolutely",
];

export const NOT_INTERESTED_KEYWORDS = [
  "not interested", "no thanks", "no thank you", "not now",
  "not right now", "maybe later", "not for me", "no interest", "dont need",
  "don't need", "no need", "not needed", "no", "nah", "not really", "remove me",
  // Turkish
  "ilgilenmiyorum", "istemiyorum",
];

export const ROLES_HIERARCHY = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  AGENT: 2,
  VIEWER: 1,
} as const;

export const DEFAULT_RATE_LIMIT_RPM = 100;
