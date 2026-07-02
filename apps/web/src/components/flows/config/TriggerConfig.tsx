"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export interface TriggerConfigData {
  matchType: "keyword" | "exact" | "contains" | "regex" | "starts_with" | "any_message" | "first_message" | "returning_customer";
  keywords?: string[];
}

const MATCH_TYPES: { value: TriggerConfigData["matchType"]; label: string; needsKeywords: boolean }[] = [
  { value: "keyword", label: "Keyword match (any word)", needsKeywords: true },
  { value: "exact", label: "Exact match", needsKeywords: true },
  { value: "contains", label: "Contains", needsKeywords: true },
  { value: "starts_with", label: "Starts with", needsKeywords: true },
  { value: "regex", label: "Regex", needsKeywords: true },
  { value: "any_message", label: "Any message", needsKeywords: false },
  { value: "first_message", label: "First message from contact", needsKeywords: false },
  { value: "returning_customer", label: "Returning customer", needsKeywords: false },
];

export function TriggerConfig({ config, onChange }: { config: TriggerConfigData; onChange: (c: TriggerConfigData) => void }) {
  const [keywordInput, setKeywordInput] = useState("");
  const matchType = config.matchType || "keyword";
  const needsKeywords = MATCH_TYPES.find((m) => m.value === matchType)?.needsKeywords;
  const keywords = config.keywords || [];

  function addKeyword() {
    if (!keywordInput.trim()) return;
    onChange({ ...config, keywords: [...keywords, keywordInput.trim()] });
    setKeywordInput("");
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Match type</label>
        <select
          value={matchType}
          onChange={(e) => onChange({ ...config, matchType: e.target.value as TriggerConfigData["matchType"] })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {MATCH_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {needsKeywords && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {matchType === "regex" ? "Patterns" : "Keywords"}
          </label>
          <div className="flex gap-2 mb-2">
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
              placeholder={matchType === "regex" ? "^hi.*" : "hello"}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={addKeyword} className="px-3 py-2 bg-primary text-white rounded-lg">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                {k}
                <button onClick={() => onChange({ ...config, keywords: keywords.filter((_, idx) => idx !== i) })}>
                  <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
