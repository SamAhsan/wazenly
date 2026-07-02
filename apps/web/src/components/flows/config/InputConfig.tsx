"use client";

import { Plus, X } from "lucide-react";

export interface InputConfigData {
  question: string;
  inputType: "text" | "email" | "phone" | "number" | "choice" | "date";
  choices?: string[];
  required?: boolean;
  variableName: string;
}

export function InputConfig({ config, onChange }: { config: InputConfigData; onChange: (c: InputConfigData) => void }) {
  const inputType = config.inputType || "text";
  const choices = config.choices || [];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Question</label>
        <textarea
          value={config.question || ""}
          onChange={(e) => onChange({ ...config, question: e.target.value })}
          rows={2}
          placeholder="What's your email address?"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Expected answer type</label>
        <select
          value={inputType}
          onChange={(e) => onChange({ ...config, inputType: e.target.value as InputConfigData["inputType"] })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
        >
          {(["text", "email", "phone", "number", "choice", "date"] as const).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {inputType === "choice" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Choices</label>
          <div className="space-y-1.5">
            {choices.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={c}
                  onChange={(e) => { const next = [...choices]; next[i] = e.target.value; onChange({ ...config, choices: next }); }}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
                />
                <button onClick={() => onChange({ ...config, choices: choices.filter((_, idx) => idx !== i) })}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => onChange({ ...config, choices: [...choices, ""] })} className="flex items-center gap-1.5 text-sm text-primary font-medium mt-2">
            <Plus className="w-4 h-4" /> Add choice
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Store answer as variable</label>
        <input
          value={config.variableName || ""}
          onChange={(e) => onChange({ ...config, variableName: e.target.value.replace(/\s+/g, "_") })}
          placeholder="email"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-xs text-gray-400 mt-1">Reference later as {"{{variable." + (config.variableName || "name") + "}}"}</p>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={!!config.required} onChange={(e) => onChange({ ...config, required: e.target.checked })} />
        Required (re-ask if empty)
      </label>
    </div>
  );
}
