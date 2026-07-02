"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface ActionConfigData {
  actionType: "assign_agent" | "add_tag" | "remove_tag" | "move_list" | "start_campaign" | "http_request";
  agentId?: string;
  tag?: string;
  listId?: string;
  campaignId?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url?: string;
  body?: string;
}

const ACTION_TYPES: { value: ActionConfigData["actionType"]; label: string }[] = [
  { value: "assign_agent", label: "Assign to agent" },
  { value: "add_tag", label: "Add tag" },
  { value: "remove_tag", label: "Remove tag" },
  { value: "move_list", label: "Move to contact list" },
  { value: "start_campaign", label: "Start campaign" },
  { value: "http_request", label: "HTTP request (webhook / API / Sheets / CRM)" },
];

export function ActionConfig({ config, onChange }: { config: ActionConfigData; onChange: (c: ActionConfigData) => void }) {
  const actionType = config.actionType || "add_tag";

  const { data: members = [] } = useQuery({
    queryKey: ["members-for-flow"],
    queryFn: () => api.get("/settings/members").then((r) => r.data),
    enabled: actionType === "assign_agent",
  });
  const { data: lists = [] } = useQuery({
    queryKey: ["lists-for-flow"],
    queryFn: () => api.get("/contacts/lists/all").then((r) => r.data),
    enabled: actionType === "move_list",
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-for-flow"],
    queryFn: () => api.get("/campaigns").then((r) => r.data?.data ?? r.data ?? []),
    enabled: actionType === "start_campaign",
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Action</label>
        <select
          value={actionType}
          onChange={(e) => onChange({ actionType: e.target.value as ActionConfigData["actionType"] })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      {actionType === "assign_agent" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Agent</label>
          <select value={config.agentId || ""} onChange={(e) => onChange({ ...config, agentId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
            <option value="">Select…</option>
            {(members as { user: { id: string; name?: string; email: string } }[]).map((m) => (
              <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>
            ))}
          </select>
        </div>
      )}

      {(actionType === "add_tag" || actionType === "remove_tag") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tag</label>
          <input value={config.tag || ""} onChange={(e) => onChange({ ...config, tag: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      )}

      {actionType === "move_list" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact list</label>
          <select value={config.listId || ""} onChange={(e) => onChange({ ...config, listId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
            <option value="">Select…</option>
            {(lists as { id: string; name: string }[]).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}

      {actionType === "start_campaign" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Campaign</label>
          <select value={config.campaignId || ""} onChange={(e) => onChange({ ...config, campaignId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
            <option value="">Select…</option>
            {(campaigns as { id: string; name: string }[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {actionType === "http_request" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select value={config.method || "POST"} onChange={(e) => onChange({ ...config, method: e.target.value as ActionConfigData["method"] })} className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
              {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              value={config.url || ""}
              onChange={(e) => onChange({ ...config, url: e.target.value })}
              placeholder="https://hooks.zapier.com/…"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Body (JSON, supports {"{{variable.x}}"})</label>
            <textarea
              value={config.body || ""}
              onChange={(e) => onChange({ ...config, body: e.target.value })}
              rows={3}
              placeholder='{"name": "{{contact.name}}"}'
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      )}
    </div>
  );
}
