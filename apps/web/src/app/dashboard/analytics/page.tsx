"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedNumber } from "@/contexts/number-context";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, MessageSquare, CheckCircle2, Eye, AlertCircle, Megaphone, Users, UserX, Ban, ShieldAlert, Clock } from "lucide-react";
import api from "@/lib/api";
import { formatNumber, pct, formatDate, statusColor } from "@/lib/utils";

const SUPPRESSION_STATUSES: { key: string; label: string; icon: React.ElementType }[] = [
  { key: "UNSUBSCRIBED", label: "Unsubscribed", icon: UserX },
  { key: "BLACKLISTED", label: "Blacklisted", icon: Ban },
  { key: "INVALID", label: "Invalid", icon: AlertCircle },
  { key: "DORMANT", label: "Dormant", icon: Clock },
  { key: "FAILED_DELIVERY", label: "Failed Delivery", icon: ShieldAlert },
];

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "This month", days: -1 },
];

function MetricCard({ title, value, sub, icon: Icon, color, trend }: { title: string; value: string; sub?: string; icon: React.ElementType; color: string; trend?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
          <span className={`text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>{trend >= 0 ? "+" : ""}{trend}% vs prev</span>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [preset, setPreset] = useState(30);
  const { selectedNumberId } = useSelectedNumber();

  const getDateRange = () => {
    const to = new Date().toISOString().split("T")[0];
    if (preset === 0) return { from: to, to };
    if (preset === -1) {
      const d = new Date();
      return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`, to };
    }
    const from = new Date(Date.now() - preset * 86400000).toISOString().split("T")[0];
    return { from, to };
  };

  const range = getDateRange();
  const numberParam = selectedNumberId ? { numberId: selectedNumberId } : {};

  const { data: overview } = useQuery({
    queryKey: ["analytics-overview", range, selectedNumberId],
    queryFn: () => api.get("/analytics/overview", { params: { ...range, ...numberParam } }).then((r) => r.data),
  });

  const { data: daily = [] } = useQuery({
    queryKey: ["analytics-daily", range, selectedNumberId],
    queryFn: () => api.get("/analytics/daily", { params: { ...range, ...numberParam } }).then((r) => r.data),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["analytics-campaigns", selectedNumberId],
    queryFn: () => api.get("/analytics/campaigns", { params: numberParam }).then((r) => r.data),
  });

  const { data: numbers = [] } = useQuery({
    queryKey: ["analytics-numbers", range],
    queryFn: () => api.get("/analytics/numbers", { params: range }).then((r) => r.data),
  });

  const { data: suppression } = useQuery({
    queryKey: ["analytics-suppression", range, selectedNumberId],
    queryFn: () => api.get("/analytics/suppression", { params: { ...range, ...numberParam } }).then((r) => r.data),
  });
  const suppressionCounts: Record<string, number> = suppression?.counts || {};
  const totalContacts = Object.values(suppressionCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor your messaging performance</p>
        </div>
        <div className="flex gap-1.5">
          {PRESETS.map(({ label, days }) => (
            <button key={label} onClick={() => setPreset(days)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${preset === days ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Messages Sent" value={formatNumber(overview?.messagesSent || 0)} icon={MessageSquare} color="bg-blue-50 text-blue-600" trend={overview?.sentChange} />
        <MetricCard title="Delivery Rate" value={`${overview?.deliveryRate || 0}%`} icon={CheckCircle2} color="bg-green-50 text-green-600" />
        <MetricCard title="Read Rate" value={`${overview?.readRate || 0}%`} icon={Eye} color="bg-purple-50 text-purple-600" />
        <MetricCard title="Failed" value={formatNumber(overview?.failedMessages || 0)} icon={AlertCircle} color="bg-red-50 text-red-600" />
        <MetricCard title="Active Campaigns" value={overview?.activeCampaigns || 0} icon={Megaphone} color="bg-orange-50 text-orange-600" />
        <MetricCard title="New Contacts" value={formatNumber(overview?.newContacts || 0)} icon={Users} color="bg-cyan-50 text-cyan-600" sub={`in selected period`} />
      </div>

      {/* Daily chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Daily Message Volume</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatDate(v, "MMM d")} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [v.toLocaleString()]} />
            <Legend />
            <Line type="monotone" dataKey="messagesSent" name="Sent" stroke="#25D366" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="delivered" name="Delivered" stroke="#3B82F6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="read" name="Read" stroke="#8B5CF6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="failed" name="Failed" stroke="#EF4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top campaigns */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Top Campaigns</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-50">
                <th className="text-left px-5 py-3">Campaign</th>
                <th className="text-right px-5 py-3">Sent</th>
                <th className="text-right px-5 py-3">Delivery</th>
                <th className="text-right px-5 py-3">Read</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.slice(0, 6).map((c: { id: string; name: string; sentCount: number; deliveryRate: number; readRate: number; status: string }) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatNumber(c.sentCount)}</td>
                  <td className="px-5 py-3 text-right font-medium">{c.deliveryRate}%</td>
                  <td className="px-5 py-3 text-right font-medium text-primary">{c.readRate}%</td>
                </tr>
              ))}
              {campaigns.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No campaigns yet</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Per-number breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">By Number</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-50">
                <th className="text-left px-5 py-3">Number</th>
                <th className="text-right px-5 py-3">Sent</th>
                <th className="text-right px-5 py-3">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((n: { id: string; displayName: string; phoneNumber: string; messagesSent: number; delivered: number }) => (
                <tr key={n.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{n.displayName}</p>
                    <p className="text-xs text-gray-400 font-mono">{n.phoneNumber}</p>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatNumber(n.messagesSent)}</td>
                  <td className="px-5 py-3 text-right font-medium">{pct(n.delivered, n.messagesSent)}</td>
                </tr>
              ))}
              {numbers.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-gray-400 text-sm">No numbers connected</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hourly distribution */}
      {daily.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Inbound vs Outbound (Daily)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daily.slice(-14)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatDate(v, "MMM d")} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="messagesSent" name="Outbound" fill="#25D366" radius={[4, 4, 0, 0]} />
              <Bar dataKey="inbound" name="Inbound" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Contact Health & Suppression */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Contact Health & Suppression</h2>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {SUPPRESSION_STATUSES.map(({ key, label, icon: Icon }) => (
            <div key={key} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500 font-medium">{label}</p>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${statusColor(key)}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(suppressionCounts[key] || 0)}</p>
              <p className="text-xs text-gray-400 mt-1">{pct(suppressionCounts[key] || 0, totalContacts)} of contacts</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">New Suppressions (Unsubscribed / Blacklisted / Invalid)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={suppression?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatDate(v, "MMM d")} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(v) => formatDate(v as string)} />
                <Bar dataKey="count" name="New suppressions" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Top Blacklist Reasons</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-50">
                  <th className="text-left px-5 py-3">Reason</th>
                  <th className="text-right px-5 py-3">Contacts</th>
                </tr>
              </thead>
              <tbody>
                {(suppression?.topBlacklistReasons || []).map((r: { reason: string; count: number }) => (
                  <tr key={r.reason} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900">{r.reason}</td>
                    <td className="px-5 py-3 text-right font-medium">{r.count}</td>
                  </tr>
                ))}
                {(!suppression?.topBlacklistReasons || suppression.topBlacklistReasons.length === 0) && (
                  <tr><td colSpan={2} className="text-center py-8 text-gray-400 text-sm">No blacklisted contacts yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
