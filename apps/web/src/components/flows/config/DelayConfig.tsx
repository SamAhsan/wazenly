"use client";

export interface DelayConfigData {
  amount: number;
  unit: "seconds" | "minutes" | "hours" | "days";
  businessHoursOnly?: boolean;
  businessHoursStart?: string;
  businessHoursEnd?: string;
}

export function DelayConfig({ config, onChange }: { config: DelayConfigData; onChange: (c: DelayConfigData) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Wait for</label>
          <input
            type="number"
            min={1}
            value={config.amount ?? 1}
            onChange={(e) => onChange({ ...config, amount: Number(e.target.value) })}
            className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
          <select
            value={config.unit || "minutes"}
            onChange={(e) => onChange({ ...config, unit: e.target.value as DelayConfigData["unit"] })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
          >
            {(["seconds", "minutes", "hours", "days"] as const).map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={!!config.businessHoursOnly} onChange={(e) => onChange({ ...config, businessHoursOnly: e.target.checked })} />
        Only resume during business hours
      </label>

      {config.businessHoursOnly && (
        <div className="flex gap-2 items-center">
          <input
            type="time"
            value={config.businessHoursStart || "09:00"}
            onChange={(e) => onChange({ ...config, businessHoursStart: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="time"
            value={config.businessHoursEnd || "17:00"}
            onChange={(e) => onChange({ ...config, businessHoursEnd: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
          />
          <span className="text-xs text-gray-400">workspace timezone</span>
        </div>
      )}
    </div>
  );
}
