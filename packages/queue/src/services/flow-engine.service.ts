import axios from "axios";
import { prisma } from "@wazenly/db";
import type { Contact, Flow, FlowNode, WhatsAppNumber, Workspace } from "@wazenly/db";
import { decrypt, META_GRAPH_URL } from "@wazenly/shared";
import { flowExecutorQueue, campaignSenderQueue } from "../queues";

export interface ExecCtx {
  flow: Flow;
  contact: Contact;
  number: WhatsAppNumber;
  workspace: Workspace;
  variables: Record<string, unknown>;
}

// The flow builder always saves a node's actual settings nested under data.config
// (see NodeConfigPanel.tsx) — data itself also carries label/type. Falls back to
// data directly for any node saved before this nesting existed.
function getNodeConfig<T>(data: unknown): T {
  const obj = (data || {}) as Record<string, unknown>;
  return (obj.config ?? obj) as T;
}

export interface TriggerConfig {
  matchType: "keyword" | "exact" | "contains" | "regex" | "starts_with" | "any_message" | "first_message" | "returning_customer";
  keywords?: string[];
}

interface MessageConfig {
  mode: "text" | "template" | "media";
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  mediaType?: "image" | "video" | "audio" | "document";
  mediaUrl?: string;
  mediaCaption?: string;
  buttons?: string[];
  typingDelaySeconds?: number;
}

export interface ConditionRule {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than" | "has_tag" | "is_set" | "not_set";
  value?: string;
}

export interface ConditionConfig {
  logic: "AND" | "OR";
  rules: ConditionRule[];
}

interface ActionConfig {
  actionType: "assign_agent" | "add_tag" | "remove_tag" | "move_list" | "start_campaign" | "http_request";
  agentId?: string;
  tag?: string;
  listId?: string;
  campaignId?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface InputConfig {
  question: string;
  inputType: "text" | "email" | "phone" | "number" | "choice" | "date";
  choices?: string[];
  required?: boolean;
  variableName: string;
}

interface DelayConfig {
  amount: number;
  unit: "seconds" | "minutes" | "hours" | "days";
  businessHoursOnly?: boolean;
  businessHoursStart?: string;
  businessHoursEnd?: string;
}

interface JumpConfig {
  targetType: "node" | "flow" | "end" | "restart";
  targetNodeId?: string;
  targetFlowId?: string;
}

function interpolate(text: string, ctx: ExecCtx): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    if (key === "contact.name") return ctx.contact.name || "";
    if (key === "contact.phone") return ctx.contact.phone || "";
    if (key.startsWith("variable.")) return String(ctx.variables[key.slice(9)] ?? "");
    return String(ctx.variables[key] ?? "");
  });
}

async function findConversation(ctx: ExecCtx) {
  return prisma.conversation.findFirst({
    where: { workspaceId: ctx.workspace.id, numberId: ctx.number.id, phone: ctx.contact.phone },
  });
}

async function logOutboundMessage(ctx: ExecCtx, body: string, metaMessageId?: string) {
  const conversation = await findConversation(ctx);
  await prisma.message.create({
    data: {
      workspaceId: ctx.workspace.id,
      conversationId: conversation?.id,
      numberId: ctx.number.id,
      contactId: ctx.contact.id,
      phone: ctx.contact.phone,
      direction: "OUTBOUND",
      type: "TEXT",
      status: "SENT",
      metaMessageId,
      body,
      sentAt: new Date(),
    },
  });
  if (conversation) {
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
  }
}

async function sendText(ctx: ExecCtx, text: string): Promise<void> {
  const accessToken = decrypt(ctx.number.accessToken);
  console.log(`[FlowEngine] Sending WhatsApp text message to ${ctx.contact.phone} via number ${ctx.number.id}`);
  const response = await axios.post(
    `${META_GRAPH_URL}/${ctx.number.phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: ctx.contact.phone,
      type: "text",
      text: { body: text },
    },
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
  );
  console.log(`[FlowEngine] WhatsApp API accepted message ${response.data.messages?.[0]?.id} for ${ctx.contact.phone}`);
  await logOutboundMessage(ctx, text, response.data.messages?.[0]?.id);
}

async function runMessageNode(ctx: ExecCtx, config: MessageConfig): Promise<void> {
  console.log(`[FlowEngine] Running message node (mode=${config.mode}) for contact ${ctx.contact.id}`);
  if (config.typingDelaySeconds) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(config.typingDelaySeconds!, 30) * 1000));
  }

  if (config.mode === "text" && config.buttons?.filter(Boolean).length) {
    const accessToken = decrypt(ctx.number.accessToken);
    const buttons = config.buttons.filter(Boolean).slice(0, 3);
    const text = interpolate(config.text || "", ctx);
    const response = await axios.post(
      `${META_GRAPH_URL}/${ctx.number.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: ctx.contact.phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text },
          action: { buttons: buttons.map((label, i) => ({ type: "reply", reply: { id: `btn_${i}`, title: label.slice(0, 20) } })) },
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );
    await logOutboundMessage(ctx, text, response.data.messages?.[0]?.id);
    return;
  }

  if (config.mode === "media" && config.mediaUrl && config.mediaType) {
    const accessToken = decrypt(ctx.number.accessToken);
    const mediaPayload: Record<string, unknown> = { link: config.mediaUrl, caption: config.mediaCaption ? interpolate(config.mediaCaption, ctx) : undefined };
    if (config.mediaType === "document") mediaPayload.filename = "file";
    const response = await axios.post(
      `${META_GRAPH_URL}/${ctx.number.phoneNumberId}/messages`,
      { messaging_product: "whatsapp", recipient_type: "individual", to: ctx.contact.phone, type: config.mediaType, [config.mediaType]: mediaPayload },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );
    await logOutboundMessage(ctx, config.mediaCaption || `[${config.mediaType}]`, response.data.messages?.[0]?.id);
    return;
  }

  if (config.mode === "template" && config.templateName) {
    const accessToken = decrypt(ctx.number.accessToken);
    const response = await axios.post(
      `${META_GRAPH_URL}/${ctx.number.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: ctx.contact.phone,
        type: "template",
        template: { name: config.templateName, language: { code: config.templateLanguage || "en" } },
      },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );
    await logOutboundMessage(ctx, `[template: ${config.templateName}]`, response.data.messages?.[0]?.id);
    return;
  }

  await sendText(ctx, interpolate(config.text || "", ctx));
}

function getFieldValue(ctx: ExecCtx, field: string): unknown {
  if (field === "contact.name") return ctx.contact.name;
  if (field === "contact.phone") return ctx.contact.phone;
  if (field === "contact.tag") return ctx.contact.tags;
  if (field.startsWith("contact.customField.")) {
    const key = field.slice("contact.customField.".length);
    return (ctx.contact.customFields as Record<string, unknown> | null)?.[key];
  }
  if (field.startsWith("variable.")) return ctx.variables[field.slice(9)];
  return undefined;
}

function evaluateRule(ctx: ExecCtx, rule: ConditionRule): boolean {
  const actual = getFieldValue(ctx, rule.field);
  switch (rule.operator) {
    case "is_set":
      return actual !== undefined && actual !== null && actual !== "";
    case "not_set":
      return actual === undefined || actual === null || actual === "";
    case "has_tag":
      return Array.isArray(actual) && actual.includes(rule.value);
    case "equals":
      return String(actual ?? "") === (rule.value ?? "");
    case "contains":
      return String(actual ?? "").toLowerCase().includes((rule.value ?? "").toLowerCase());
    case "greater_than":
      return Number(actual) > Number(rule.value);
    case "less_than":
      return Number(actual) < Number(rule.value);
    default:
      return false;
  }
}

function evaluateCondition(ctx: ExecCtx, config: ConditionConfig): boolean {
  if (!config.rules?.length) return false;
  return config.logic === "OR"
    ? config.rules.some((r) => evaluateRule(ctx, r))
    : config.rules.every((r) => evaluateRule(ctx, r));
}

async function runActionNode(ctx: ExecCtx, config: ActionConfig): Promise<void> {
  switch (config.actionType) {
    case "add_tag":
      if (config.tag && !ctx.contact.tags.includes(config.tag)) {
        await prisma.contact.update({ where: { id: ctx.contact.id }, data: { tags: { push: config.tag } } });
        ctx.contact.tags = [...ctx.contact.tags, config.tag];
      }
      break;
    case "remove_tag":
      if (config.tag) {
        const remaining = ctx.contact.tags.filter((t) => t !== config.tag);
        await prisma.contact.update({ where: { id: ctx.contact.id }, data: { tags: remaining } });
        ctx.contact.tags = remaining;
      }
      break;
    case "assign_agent":
      if (config.agentId) {
        const conversation = await findConversation(ctx);
        if (conversation) {
          await prisma.conversation.update({ where: { id: conversation.id }, data: { assignedUserId: config.agentId } });
        }
      }
      break;
    case "move_list":
      if (config.listId) {
        await prisma.contactListMember.upsert({
          where: { listId_contactId: { listId: config.listId, contactId: ctx.contact.id } },
          create: { listId: config.listId, contactId: ctx.contact.id },
          update: {},
        });
      }
      break;
    case "start_campaign":
      if (config.campaignId) {
        const campaign = await prisma.campaign.findUnique({ where: { id: config.campaignId } });
        if (campaign) {
          await prisma.campaignContact.create({
            data: { campaignId: campaign.id, contactId: ctx.contact.id, phone: ctx.contact.phone, variables: { name: ctx.contact.name.split(" ")[0] } },
          });
          await campaignSenderQueue.add("campaign-batch", {
            campaignId: campaign.id,
            workspaceId: ctx.workspace.id,
            numberId: campaign.numberId,
            batchOffset: 0,
            batchSize: 50,
          });
        }
      }
      break;
    case "http_request":
      if (config.url) {
        try {
          await axios.request({
            method: config.method || "POST",
            url: interpolate(config.url, ctx),
            headers: config.headers,
            data: config.body ? interpolate(config.body, ctx) : undefined,
            timeout: 10000,
          });
        } catch (err) {
          console.error(`[FlowEngine] http_request action failed:`, (err as Error).message);
        }
      }
      break;
  }
}

function delayToMs(config: DelayConfig): number {
  const unitMs = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 }[config.unit];
  return config.amount * unitMs;
}

function nextBusinessHoursStart(config: DelayConfig, timezone: string): Date | null {
  if (!config.businessHoursOnly || !config.businessHoursStart || !config.businessHoursEnd) return null;
  const now = new Date();
  const currentTime = now.toLocaleTimeString("en-US", { hour12: false, timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  if (currentTime >= config.businessHoursStart && currentTime <= config.businessHoursEnd) return null;
  const resumeAt = new Date(now.getTime() + 24 * 3600000);
  return resumeAt;
}

async function clearSession(contactId: string, numberId: string): Promise<void> {
  await prisma.flowSession.deleteMany({ where: { contactId, numberId } });
}

async function getFirstEdgeTarget(flowId: string, sourceNodeId: string): Promise<string | null> {
  const edge = await prisma.flowEdge.findFirst({ where: { flowId, sourceNodeId } });
  return edge?.targetNodeId ?? null;
}

/** Walks the flow graph starting at `nodeId`, executing each node until it stops (input/delay/end). */
export async function executeFromNode(ctx: ExecCtx, nodeId: string | null): Promise<void> {
  let currentNodeId = nodeId;

  if (!currentNodeId) {
    console.log(`[FlowEngine] Flow "${ctx.flow.name}" (${ctx.flow.id}) has no start node (trigger has no outgoing edge) — nothing to execute`);
    return;
  }

  while (currentNodeId) {
    const node: FlowNode | null = await prisma.flowNode.findUnique({ where: { id: currentNodeId } });
    if (!node) {
      console.log(`[FlowEngine] Node ${currentNodeId} referenced by an edge does not exist in flow "${ctx.flow.name}" — stopping execution`);
      break;
    }
    console.log(`[FlowEngine] Executing node ${node.id} (type=${node.type}) in flow "${ctx.flow.name}" for contact ${ctx.contact.id}`);

    if (node.type === "message") {
      await runMessageNode(ctx, getNodeConfig<MessageConfig>(node.data));
      currentNodeId = await getFirstEdgeTarget(ctx.flow.id, node.id);
      continue;
    }

    if (node.type === "condition") {
      const config = getNodeConfig<ConditionConfig>(node.data);
      const result = evaluateCondition(ctx, config);
      const edges = await prisma.flowEdge.findMany({ where: { flowId: ctx.flow.id, sourceNodeId: node.id } });
      const branch = edges.find((e) => e.label === (result ? "Yes" : "No")) || edges[result ? 0 : 1];
      currentNodeId = branch?.targetNodeId ?? null;
      continue;
    }

    if (node.type === "action") {
      await runActionNode(ctx, getNodeConfig<ActionConfig>(node.data));
      currentNodeId = await getFirstEdgeTarget(ctx.flow.id, node.id);
      continue;
    }

    if (node.type === "input") {
      const config = getNodeConfig<InputConfig>(node.data);
      await sendText(ctx, interpolate(config.question, ctx));
      await prisma.flowSession.upsert({
        where: { contactId_numberId: { contactId: ctx.contact.id, numberId: ctx.number.id } },
        create: {
          workspaceId: ctx.workspace.id,
          flowId: ctx.flow.id,
          contactId: ctx.contact.id,
          numberId: ctx.number.id,
          nodeId: node.id,
          state: "WAITING_INPUT",
          variables: ctx.variables as object,
        },
        update: { flowId: ctx.flow.id, nodeId: node.id, state: "WAITING_INPUT", variables: ctx.variables as object },
      });
      return;
    }

    if (node.type === "delay") {
      const config = getNodeConfig<DelayConfig>(node.data);
      const businessHoursResume = nextBusinessHoursStart(config, ctx.workspace.timezone);
      const delayMs = businessHoursResume ? businessHoursResume.getTime() - Date.now() : delayToMs(config);

      const session = await prisma.flowSession.upsert({
        where: { contactId_numberId: { contactId: ctx.contact.id, numberId: ctx.number.id } },
        create: {
          workspaceId: ctx.workspace.id,
          flowId: ctx.flow.id,
          contactId: ctx.contact.id,
          numberId: ctx.number.id,
          nodeId: node.id,
          state: "WAITING_DELAY",
          variables: ctx.variables as object,
        },
        update: { flowId: ctx.flow.id, nodeId: node.id, state: "WAITING_DELAY", variables: ctx.variables as object },
      });

      await flowExecutorQueue.add("resume", { sessionId: session.id }, { delay: Math.max(0, delayMs) });
      return;
    }

    if (node.type === "jump") {
      const config = getNodeConfig<JumpConfig>(node.data);
      if (config.targetType === "end") {
        await clearSession(ctx.contact.id, ctx.number.id);
        return;
      }
      if (config.targetType === "restart") {
        const trigger = await prisma.flowNode.findFirst({ where: { flowId: ctx.flow.id, type: "trigger" } });
        currentNodeId = trigger ? await getFirstEdgeTarget(ctx.flow.id, trigger.id) : null;
        continue;
      }
      if (config.targetType === "node" && config.targetNodeId) {
        currentNodeId = config.targetNodeId;
        continue;
      }
      if (config.targetType === "flow" && config.targetFlowId) {
        const targetFlow = await prisma.flow.findUnique({ where: { id: config.targetFlowId } });
        const trigger = targetFlow ? await prisma.flowNode.findFirst({ where: { flowId: targetFlow.id, type: "trigger" } }) : null;
        if (targetFlow && trigger) {
          ctx.flow = targetFlow;
          currentNodeId = await getFirstEdgeTarget(targetFlow.id, trigger.id);
          continue;
        }
      }
      return;
    }

    // Unknown/trigger node reached mid-walk: just follow its single outgoing edge
    currentNodeId = await getFirstEdgeTarget(ctx.flow.id, node.id);
  }

  // Ran off the end of the graph — flow complete
  console.log(`[FlowEngine] Flow "${ctx.flow.name}" reached the end of the graph for contact ${ctx.contact.id} — clearing session`);
  await clearSession(ctx.contact.id, ctx.number.id);
}

function matchesTrigger(config: TriggerConfig, messageText: string | undefined, isFirstMessage: boolean, isReturningCustomer: boolean): boolean {
  const text = (messageText || "").trim();
  const lowerText = text.toLowerCase();
  const keywords = (config.keywords || []).map((k) => k.toLowerCase());

  switch (config.matchType) {
    case "any_message":
      return true;
    case "first_message":
      return isFirstMessage;
    case "returning_customer":
      return isReturningCustomer;
    case "exact":
      return keywords.includes(lowerText);
    case "contains":
      return keywords.some((k) => lowerText.includes(k));
    case "starts_with":
      return keywords.some((k) => lowerText.startsWith(k));
    case "regex":
      return keywords.some((pattern) => {
        try {
          return new RegExp(pattern, "i").test(text);
        } catch {
          return false;
        }
      });
    case "keyword":
    default:
      return keywords.some((k) => lowerText.split(/\s+/).includes(k));
  }
}

/** Finds the first ACTIVE flow (scoped to this number) whose trigger node matches the inbound message. */
export async function findMatchingFlowStart(
  workspaceId: string,
  numberId: string,
  messageText: string | undefined,
  isFirstMessage: boolean,
  isReturningCustomer: boolean
): Promise<{ flow: Flow; startNodeId: string | null } | null> {
  const flows = await prisma.flow.findMany({
    where: { workspaceId, status: "ACTIVE", OR: [{ numberId }, { numberId: null }] },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[FlowEngine] Checking ${flows.length} ACTIVE flow(s) scoped to number ${numberId} (or unscoped) in workspace ${workspaceId}`);

  for (const flow of flows) {
    const triggerNodes = await prisma.flowNode.findMany({ where: { flowId: flow.id, type: "trigger" } });
    if (triggerNodes.length === 0) {
      console.log(`[FlowEngine] Flow "${flow.name}" (${flow.id}) has no trigger node — skipping`);
      continue;
    }
    for (const triggerNode of triggerNodes) {
      const config = getNodeConfig<TriggerConfig>(triggerNode.data);
      const matched = matchesTrigger(config, messageText, isFirstMessage, isReturningCustomer);
      console.log(
        `[FlowEngine] Flow "${flow.name}" trigger ${triggerNode.id} — matchType=${config.matchType} keywords=${JSON.stringify(config.keywords || [])} → ${matched ? "MATCH" : "no match"}`
      );
      if (matched) {
        const startNodeId = await getFirstEdgeTarget(flow.id, triggerNode.id);
        return { flow, startNodeId };
      }
    }
  }
  return null;
}

function validateInput(config: InputConfig, value: string): boolean {
  if (config.required && !value.trim()) return false;
  switch (config.inputType) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    case "phone":
      return /^\+?\d{7,15}$/.test(value.trim());
    case "number":
      return !isNaN(Number(value.trim()));
    case "choice":
      return !config.choices?.length || config.choices.includes(value.trim());
    case "date":
      return !isNaN(Date.parse(value.trim()));
    default:
      return true;
  }
}

/** Resumes a session paused at a WAITING_INPUT node with the contact's latest reply. */
export async function resumeWaitingInput(
  ctx: ExecCtx,
  waitingNodeId: string,
  replyText: string
): Promise<void> {
  const node = await prisma.flowNode.findUnique({ where: { id: waitingNodeId } });
  const config = getNodeConfig<InputConfig>(node?.data);

  if (!validateInput(config, replyText)) {
    await sendText(ctx, `That doesn't look right. ${config.question}`);
    return;
  }

  ctx.variables[config.variableName] = replyText.trim();
  const nextNodeId = await getFirstEdgeTarget(ctx.flow.id, waitingNodeId);
  await prisma.flowSession.deleteMany({ where: { contactId: ctx.contact.id, numberId: ctx.number.id } });
  await executeFromNode(ctx, nextNodeId);
}

/** Resumes a session paused at a WAITING_DELAY node (called by the flow.worker on timer). */
export async function resumeAfterDelay(sessionId: string): Promise<void> {
  const session = await prisma.flowSession.findUnique({ where: { id: sessionId } });
  if (!session || session.state !== "WAITING_DELAY") return;

  const [flow, contact] = await Promise.all([
    prisma.flow.findUnique({ where: { id: session.flowId } }),
    prisma.contact.findUnique({ where: { id: session.contactId } }),
  ]);
  const number = await prisma.whatsAppNumber.findUnique({ where: { id: session.numberId } });
  const workspace = flow ? await prisma.workspace.findUnique({ where: { id: flow.workspaceId } }) : null;
  if (!flow || !contact || !number || !workspace) {
    await prisma.flowSession.delete({ where: { id: sessionId } }).catch(() => {});
    return;
  }

  const ctx: ExecCtx = { flow, contact, number, workspace, variables: (session.variables as Record<string, unknown>) || {} };
  const nextNodeId = await getFirstEdgeTarget(flow.id, session.nodeId);
  await prisma.flowSession.delete({ where: { id: sessionId } }).catch(() => {});
  await executeFromNode(ctx, nextNodeId);
}
