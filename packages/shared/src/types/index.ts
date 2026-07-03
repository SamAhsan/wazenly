// Shared TypeScript types for WAZENLY

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Meta API Types ───────────────────────────────────────

export interface MetaMessagePayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: MetaMessageType;
  text?: { body: string; preview_url?: boolean };
  image?: MetaMedia;
  video?: MetaMedia;
  audio?: MetaMedia;
  document?: MetaMedia & { filename?: string };
  location?: MetaLocation;
  template?: MetaTemplate;
  interactive?: MetaInteractive;
  reaction?: { message_id: string; emoji: string };
  context?: { message_id: string };
}

export type MetaMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "location"
  | "template"
  | "interactive"
  | "reaction"
  | "contacts"
  | "sticker"
  | "button"
  | "order"
  | "system"
  | "unsupported";

export interface MetaMedia {
  id?: string;
  link?: string;
  caption?: string;
}

export interface MetaLocation {
  longitude: number;
  latitude: number;
  name?: string;
  address?: string;
}

export interface MetaTemplate {
  name: string;
  language: { code: string };
  components?: MetaTemplateComponent[];
}

export interface MetaTemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: number;
  parameters: MetaTemplateParameter[];
}

export interface MetaTemplateParameter {
  type: "text" | "image" | "video" | "document" | "currency" | "date_time";
  text?: string;
  image?: MetaMedia;
  video?: MetaMedia;
  document?: MetaMedia;
}

export interface MetaInteractive {
  type: "button" | "list" | "product" | "product_list";
  header?: { type: string; text?: string };
  body: { text: string };
  footer?: { text: string };
  action: Record<string, unknown>;
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: string;
}

export interface MetaWebhookValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: MetaWebhookContact[];
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
  errors?: MetaWebhookError[];
}

export interface MetaWebhookContact {
  profile: { name: string };
  wa_id: string;
}

export interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: MetaMessageType;
  text?: { body: string };
  image?: MetaWebhookMedia;
  video?: MetaWebhookMedia;
  audio?: MetaWebhookMedia;
  document?: MetaWebhookMedia & { filename?: string };
  location?: MetaLocation;
  button?: { payload: string; text: string };
  interactive?: { type: string; [key: string]: unknown };
  context?: { from: string; id: string };
}

export interface MetaWebhookMedia {
  caption?: string;
  mime_type: string;
  sha256: string;
  id: string;
}

export interface MetaWebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: MetaWebhookError[];
}

export interface MetaWebhookError {
  code: number;
  title: string;
  message?: string;
  error_data?: { details: string };
}

// ─── Campaign Types ────────────────────────────────────────

export interface CampaignJobData {
  campaignId: string;
  workspaceId: string;
  numberId: string;
  batchOffset: number;
  batchSize: number;
}

export interface SendMessageJobData {
  workspaceId: string;
  numberId: string;
  phoneNumberId: string;
  accessToken: string;
  campaignContactId: string;
  phone: string;
  templateName: string;
  templateLanguage: string;
  variables: Record<string, string>;
}

// ─── Socket Events ─────────────────────────────────────────

export interface SocketMessage {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  type: string;
  body?: string;
  status: string;
  timestamp: string;
}

export interface SocketConversationUpdate {
  conversationId: string;
  lastMessageAt: string;
  unreadCount: number;
}

export type SocketEventMap = {
  "message:new": SocketMessage;
  "message:status": { messageId: string; status: string; timestamp: string };
  "conversation:update": SocketConversationUpdate;
  "conversation:assign": { conversationId: string; userId: string };
};
