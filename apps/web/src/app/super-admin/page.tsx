"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Ban, Users, Phone, MessageSquare, Calendar } from "lucide-react";
import api from "@/lib/api";
import { formatNumber, formatRelativeTime } from "@/lib/utils";
import { SuperAdminGuard } from "@/components/layout/super-admin-guard";
import { MetricCard } from "@/components/analytics/metric-card";

interface Overview {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  totalUsers: number;
  newCompaniesLast7d: number;
  newUsersLast7d: number;
  totalNumbersConnected: number;
  messagesToday: number;
  messagesThisMonth: number;
  recentAuditLog: { id: string; action: string; targetType: string; targetId: string; createdAt: string; actor: { email: string; name: string | null } }[];
}

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function OverviewContent() {
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["super-admin-overview"],
    queryFn: () => api.get("/super-admin/overview").then((r) => r.data),
    refetchInterval: 30000,
  });

  if (isLoading || !data) return <div className="p-6 text-gray-400 text-sm">Loading overview…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Cross-tenant snapshot of the whole WazenlyApp business</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Companies" value={String(data.totalCompanies)} sub={`+${data.newCompaniesLast7d} this week`} icon={Building2} color="bg-blue-50 text-blue-600" />
        <MetricCard title="Active Companies" value={String(data.activeCompanies)} icon={CheckCircle2} color="bg-green-50 text-green-600" />
        <MetricCard title="Suspended Companies" value={String(data.suspendedCompanies)} icon={Ban} color="bg-red-50 text-red-600" />
        <MetricCard title="Total Users" value={String(data.totalUsers)} sub={`+${data.newUsersLast7d} this week`} icon={Users} color="bg-purple-50 text-purple-600" />
        <MetricCard title="Connected Numbers" value={String(data.totalNumbersConnected)} icon={Phone} color="bg-primary/10 text-primary" />
        <MetricCard title="Messages Today" value={formatNumber(data.messagesToday)} icon={MessageSquare} color="bg-blue-50 text-blue-600" />
        <MetricCard title="Messages This Month" value={formatNumber(data.messagesThisMonth)} icon={Calendar} color="bg-blue-50 text-blue-600" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {data.recentAuditLog.length === 0 ? (
          <p className="text-sm text-gray-400">No Super Admin actions yet.</p>
        ) : (
          <div className="space-y-1">
            {data.recentAuditLog.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-700">
                  <span className="font-medium">{log.actor.name || log.actor.email}</span> — {humanizeAction(log.action)}
                  <span className="text-gray-400"> ({log.targetType})</span>
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-3">{formatRelativeTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuperAdminOverviewPage() {
  return (
    <SuperAdminGuard>
      <OverviewContent />
    </SuperAdminGuard>
  );
}
