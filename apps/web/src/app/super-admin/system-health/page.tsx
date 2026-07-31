"use client";

import { useQuery } from "@tanstack/react-query";
import { Database, Server, Mail, Clock } from "lucide-react";
import api from "@/lib/api";
import { SuperAdminGuard } from "@/components/layout/super-admin-guard";
import { StatusPill } from "@/components/admin/status-pill";

interface SystemHealth {
  queues: { name: string; waiting: number; active: number; failed: number; delayed: number }[];
  database: { ok: boolean; latencyMs: number; error?: string };
  redis: { ok: boolean; latencyMs: number; error?: string };
  smtp: { configured: boolean; verified: boolean; error?: string };
  serverUptimeSeconds: number;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function SystemHealthContent() {
  const { data, isLoading } = useQuery<SystemHealth>({
    queryKey: ["super-admin-system-health"],
    queryFn: () => api.get("/super-admin/system-health").then((r) => r.data),
    refetchInterval: 15000,
  });

  if (isLoading || !data) return <div className="p-6 text-gray-400 text-sm">Loading system health…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
        <p className="text-gray-500 text-sm mt-1">Live infrastructure status — refreshes every 15s</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 text-sm">Database</h2>
          </div>
          <StatusPill ok={data.database.ok} label={data.database.ok ? `Healthy (${data.database.latencyMs}ms)` : "Down"} />
          {data.database.error && <p className="text-xs text-red-500 mt-2">{data.database.error}</p>}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 text-sm">Redis</h2>
          </div>
          <StatusPill ok={data.redis.ok} label={data.redis.ok ? `Healthy (${data.redis.latencyMs}ms)` : "Down"} />
          {data.redis.error && <p className="text-xs text-red-500 mt-2">{data.redis.error}</p>}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 text-sm">SMTP</h2>
          </div>
          <div className="flex flex-col gap-1.5 items-start">
            <StatusPill ok={data.smtp.configured} label={data.smtp.configured ? "Configured" : "Not configured"} />
            {data.smtp.configured && <StatusPill ok={data.smtp.verified} label={data.smtp.verified ? "Verified" : "Connection failed"} />}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900 text-sm">Server Uptime</h2>
        </div>
        <p className="text-2xl font-bold text-gray-900 mt-2">{formatUptime(data.serverUptimeSeconds)}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Background Queues</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left py-2">Queue</th>
              <th className="text-right py-2">Waiting</th>
              <th className="text-right py-2">Active</th>
              <th className="text-right py-2">Delayed</th>
              <th className="text-right py-2">Failed</th>
            </tr>
          </thead>
          <tbody>
            {data.queues.map((q) => (
              <tr key={q.name} className="border-b border-gray-50 last:border-0">
                <td className="py-2 font-medium text-gray-700">{q.name}</td>
                <td className="py-2 text-right">{q.waiting}</td>
                <td className="py-2 text-right">{q.active}</td>
                <td className="py-2 text-right">{q.delayed}</td>
                <td className={`py-2 text-right ${q.failed > 0 ? "text-red-600 font-semibold" : ""}`}>{q.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SuperAdminSystemHealthPage() {
  return (
    <SuperAdminGuard>
      <SystemHealthContent />
    </SuperAdminGuard>
  );
}
