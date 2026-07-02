"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface MessageConfigData {
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

const VARIABLES = ["{{contact.name}}", "{{contact.phone}}"];

export function MessageConfig({ config, onChange }: { config: MessageConfigData; onChange: (c: MessageConfigData) => void }) {
  const mode = config.mode || "text";
  const { data: templates = [] } = useQuery({
    queryKey: ["templates-for-flow"],
    queryFn: () => api.get("/templates").then((r) => r.data?.data ?? r.data ?? []),
    enabled: mode === "template",
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Message type</label>
        <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1">
          {(["text", "template", "media"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onChange({ ...config, mode: m })}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium capitalize ${mode === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "text" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Message text</label>
          <textarea
            value={config.text || ""}
            onChange={(e) => onChange({ ...config, text: e.target.value })}
            rows={4}
            placeholder="Hi {{contact.name}}, welcome!"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {VARIABLES.map((v) => (
              <button
                key={v}
                onClick={() => onChange({ ...config, text: `${config.text || ""}${v}` })}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono text-gray-600"
              >
                {v}
              </button>
            ))}
          </div>
          {config.text && (
            <div className="mt-3 p-3 bg-[#e7ffdb] rounded-lg rounded-tr-none max-w-[85%]">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{config.text}</p>
            </div>
          )}
        </div>
      )}

      {mode === "template" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Template</label>
          <select
            value={config.templateName || ""}
            onChange={(e) => {
              const tpl = (templates as { name: string; language: string }[]).find((t) => t.name === e.target.value);
              onChange({ ...config, templateName: e.target.value, templateLanguage: tpl?.language || "en" });
            }}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select a template…</option>
            {(templates as { name: string; status: string }[]).filter((t) => t.status === "APPROVED").map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {mode === "text" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Quick-reply buttons (up to 3)</label>
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              value={config.buttons?.[i] || ""}
              onChange={(e) => {
                const buttons = [...(config.buttons || [])];
                buttons[i] = e.target.value;
                onChange({ ...config, buttons: buttons.filter((b, idx) => b || idx < buttons.length - 1).slice(0, 3) });
              }}
              placeholder={`Button ${i + 1} (optional)`}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 mb-1.5"
            />
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Typing delay before sending (seconds)</label>
        <input
          type="number"
          min={0}
          max={30}
          value={config.typingDelaySeconds ?? 0}
          onChange={(e) => onChange({ ...config, typingDelaySeconds: Number(e.target.value) })}
          className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {mode === "media" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Media type</label>
            <select
              value={config.mediaType || "image"}
              onChange={(e) => onChange({ ...config, mediaType: e.target.value as MessageConfigData["mediaType"] })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {(["image", "video", "audio", "document"] as const).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Media URL</label>
            <input
              value={config.mediaUrl || ""}
              onChange={(e) => onChange({ ...config, mediaUrl: e.target.value })}
              placeholder="https://…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Caption (optional)</label>
            <input
              value={config.mediaCaption || ""}
              onChange={(e) => onChange({ ...config, mediaCaption: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      )}
    </div>
  );
}
