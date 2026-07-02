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
} as const;

export const CAMPAIGN_BATCH_SIZE = 50;

export const MESSAGE_STATUSES = {
  QUEUED: "QUEUED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
  FAILED: "FAILED",
} as const;

export const OPT_OUT_KEYWORDS = [
  "STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT",
  "stop", "stopall", "unsubscribe", "cancel", "end", "quit",
];

export const ROLES_HIERARCHY = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  AGENT: 2,
  VIEWER: 1,
} as const;

export const DEFAULT_RATE_LIMIT_RPM = 100;
