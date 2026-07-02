"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface JumpConfigData {
  targetType: "node" | "flow" | "end" | "restart";
  targetNodeId?: string;
  targetFlowId?: string;
}

const TARGET_TYPES: { value: JumpConfigData["targetType"]; label: string }[] = [
  { value: "node", label: "Jump to a node in this flow" },
  { value: "flow", label: "Jump to another flow" },
  { value: "restart", label: "Restart this flow" },
  { value: "end", label: "End flow" },
];

export function JumpConfig({
  config,
  onChange,
  flowNodes,
  currentFlowId,
}: {
  config: JumpConfigData;
  onChange: (c: JumpConfigData) => void;
  flowNodes: { id: string; label: string; type: string }[];
  currentFlowId?: string;
}) {
  const targetType = config.targetType || "node";
  const { data: flows = [] } = useQuery({
    queryKey: ["flows-for-jump"],
    queryFn: () => api.get("/flows").then((r) => r.data),
    enabled: targetType === "flow",
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Jump to</label>
        <select
          value={targetType}
          onChange={(e) => onChange({ targetType: e.target.value as JumpConfigData["targetType"] })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {TARGET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {targetType === "node" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Target node</label>
          <select value={config.targetNodeId || ""} onChange={(e) => onChange({ ...config, targetNodeId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
            <option value="">Select…</option>
            {flowNodes.filter((n) => n.type !== "jump").map((n) => <option key={n.id} value={n.id}>{n.label} ({n.type})</option>)}
          </select>
        </div>
      )}

      {targetType === "flow" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Target flow</label>
          <select value={config.targetFlowId || ""} onChange={(e) => onChange({ ...config, targetFlowId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
            <option value="">Select…</option>
            {(flows as { id: string; name: string }[]).filter((f) => f.id !== currentFlowId).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
