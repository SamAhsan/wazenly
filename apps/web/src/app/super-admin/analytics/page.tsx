"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { MessageSquare, CheckCircle2, Eye, AlertCircle, Building2 } from "lucide-react";
import api from "@/lib/api";
import { formatNumber, formatDate } from "@/lib/utils";
import { SuperAdminGuard } from "@/components/layout/super-admin-guard";
import { MetricCard } from "@/components/analytics/metric-card";

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function AnalyticsContent() {
  const [preset, setPreset] = useState(30);
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - preset * 86400000).toISOString().split("T")[0];
  const range = { from, to };

  const { data: overview } = useQuery({
    queryKey: ["super-admin-analytics-overview", range],
    queryFn: () => api.get("/super-admin/analytics/overview", { params: range }).then((r) => r.data),
  });

  const { data: daily = [] } = useQuery({
    queryKey: ["super-admin-analytics-daily", range],
    queryFn: () => api.get("/super-admin/analytics/daily", { params: range }).then((r) => r.data),
  });

  const { data: byCompany = [] } = useQuery({
    queryKey: ["super-admin-analytics-by-company", range],
    queryFn: () => api.get("/super-admin/analytics/by-company", { params: range }).then((r) => r.data),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Message volume across every company</p>
        </div>
        <div className="flex items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setPreset(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === p.days ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Messages Sent" value={formatNumber(overview?.messagesSent || 0)} icon={MessageSquare} color="bg-blue-50 text-blue-600" trend={overview?.sentChange} />
        <MetricCard title="Delivery Rate" value={`${overview?.deliveryRate || 0}%`} icon={CheckCircle2} color="bg-green-50 text-green-600" />
        <MetricCard title="Read Rate" value={`${overview?.readRate || 0}%`} icon={Eye} color="bg-purple-50 text-purple-600" />
        <MetricCard title="Failed Messages" value={formatNumber(overview?.failedMessages || 0)} icon={AlertCircle} color="bg-red-50 text-red-600" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Daily Volume</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatDate(v, "MMM d")} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [v.toLocaleString()]} labelFormatter={(v) => formatDate(v, "MMM d, yyyy")} />
            <Legend />
            <Line type="monotone" dataKey="messagesSent" name="Sent" stroke="#25D366" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="delivered" name="Delivered" stroke="#3B82F6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="read" name="Read" stroke="#8B5CF6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="failed" name="Failed" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Top Companies by Volume</h3>
        {byCompany.length === 0 ? (
          <p className="text-sm text-gray-400">No message activity in this range.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCompany}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v.toLocaleString()]} />
                <Bar dataKey="messagesSent" name="Sent" fill="#25D366" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-1">
              {byCompany.map((c: { workspaceId: string; name: string; messagesSent: number; delivered: number; failed: number }) => (
                <div key={c.workspaceId} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <Link href={`/super-admin/companies/${c.workspaceId}`} className="flex items-center gap-2 text-gray-700 hover:text-primary">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" /> {c.name}
                  </Link>
                  <span className="text-gray-500">{formatNumber(c.messagesSent)} sent</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SuperAdminAnalyticsPage() {
  return (
    <SuperAdminGuard>
      <AnalyticsContent />
    </SuperAdminGuard>
  );
}
