"use client";

import { Plus, Trash2 } from "lucide-react";

export interface ConditionRule {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than" | "has_tag" | "is_set" | "not_set";
  value?: string;
}

export interface ConditionConfigData {
  logic: "AND" | "OR";
  rules: ConditionRule[];
}

const FIELDS = [
  { value: "contact.name", label: "Contact name" },
  { value: "contact.phone", label: "Contact phone" },
  { value: "contact.tag", label: "Contact tag" },
];

const OPERATORS: { value: ConditionRule["operator"]; label: string; needsValue: boolean }[] = [
  { value: "equals", label: "equals", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "greater_than", label: "greater than", needsValue: true },
  { value: "less_than", label: "less than", needsValue: true },
  { value: "has_tag", label: "has tag", needsValue: true },
  { value: "is_set", label: "is set", needsValue: false },
  { value: "not_set", label: "is not set", needsValue: false },
];

export function ConditionConfig({ config, onChange }: { config: ConditionConfigData; onChange: (c: ConditionConfigData) => void }) {
  const rules = config.rules || [];

  function updateRule(i: number, patch: Partial<ConditionRule>) {
    const next = [...rules];
    next[i] = { ...next[i], ...patch };
    onChange({ ...config, rules: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Match</label>
        <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1 w-fit">
          {(["AND", "OR"] as const).map((l) => (
            <button
              key={l}
              onClick={() => onChange({ ...config, logic: l })}
              className={`px-4 py-1.5 rounded-md text-sm font-medium ${(config.logic || "AND") === l ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            >
              {l === "AND" ? "All conditions" : "Any condition"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {rules.map((rule, i) => {
          const op = OPERATORS.find((o) => o.value === rule.operator);
          return (
            <div key={i} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 space-y-1.5">
                <select
                  value={rule.field}
                  onChange={(e) => updateRule(i, { field: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none"
                >
                  {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(i, { operator: e.target.value as ConditionRule["operator"] })}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none"
                >
                  {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {op?.needsValue && (
                  <input
                    value={rule.value || ""}
                    onChange={(e) => updateRule(i, { value: e.target.value })}
                    placeholder="Value"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none"
                  />
                )}
              </div>
              <button onClick={() => onChange({ ...config, rules: rules.filter((_, idx) => idx !== i) })} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onChange({ ...config, rules: [...rules, { field: "contact.name", operator: "is_set" }] })}
        className="flex items-center gap-1.5 text-sm text-primary font-medium"
      >
        <Plus className="w-4 h-4" /> Add condition
      </button>

      <p className="text-xs text-gray-400">Connect the &quot;Yes&quot; output for when this matches, and &quot;No&quot; for when it doesn&apos;t.</p>
    </div>
  );
}
