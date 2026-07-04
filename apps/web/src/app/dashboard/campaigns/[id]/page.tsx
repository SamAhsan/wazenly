"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, Pause, Play, X, Download, Users, Send, CheckCircle2, Eye, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import api from "@/lib/api";
import { formatNumber, pct, formatDateTime, statusColor } from "@/lib/utils";
import { RoleGuard } from "@/components/layout/role-guard";

function CampaignDetailPageContent() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => api.get(`/campaigns/${id}`).then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: contacts } = useQuery({
    queryKey: ["campaign-contacts", id],
    queryFn: () => api.get(`/campaigns/${id}/contacts`).then((r) => r.data),
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/pause`),
    onSuccess: () => { toast.success("Paused"); queryClient.invalidateQueries({ queryKey: ["campaign", id] }); },
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/resume`),
    onSuccess: () => { toast.success("Resumed"); queryClient.invalidateQueries({ queryKey: ["campaign", id] }); },
  });

  if (isLoading || !campaign) {
    return <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 skeleton rounded-xl" />)}</div>;
  }

  const pieData = [
    { name: "Read", value: campaign.readCount, color: "#25D366" },
    { name: "Delivered", value: Math.max(0, campaign.deliveredCount - campaign.readCount), color: "#3B82F6" },
    { name: "Sent", value: Math.max(0, campaign.sentCount - campaign.deliveredCount), color: "#8B5CF6" },
    { name: "Failed", value: campaign.failedCount, color: "#EF4444" },
    { name: "Pending", value: Math.max(0, campaign.totalRecipients - campaign.sentCount - campaign.failedCount), color: "#E5E7EB" },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/campaigns" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ChevronLeft className="w-4 h-4" /> Campaigns
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(campaign.status)}`}>{campaign.status}</span>
            {campaign.scheduledAt && <span className="text-xs text-gray-400">Scheduled: {formatDateTime(campaign.scheduledAt)}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === "RUNNING" && (
            <button onClick={() => pauseMutation.mutate()} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700">
              <Pause className="w-4 h-4" /> Pause
            </button>
          )}
          {campaign.status === "PAUSED" && (
            <button onClick={() => resumeMutation.mutate()} className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-600">
              <Play className="w-4 h-4" /> Resume
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: formatNumber(campaign.totalRecipients), icon: Users, color: "text-gray-600" },
          { label: "Sent", value: formatNumber(campaign.sentCount), icon: Send, color: "text-blue-600" },
          { label: "Delivered", value: pct(campaign.deliveredCount, campaign.totalRecipients), icon: CheckCircle2, color: "text-purple-600" },
          { label: "Read", value: pct(campaign.readCount, campaign.totalRecipients), icon: Eye, color: "text-primary" },
          { label: "Failed", value: formatNumber(campaign.failedCount), icon: AlertCircle, color: "text-red-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
            <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pie chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Delivery Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [v.toLocaleString()]} />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Contacts table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Contact Status</h3>
            <button
              onClick={() => {
                const rows = contacts?.data || [];
                if (!rows.length) return;
                const header = "Phone,Status,Sent At,Read At,Error";
                const csv = [header, ...rows.map((cc: { phone: string; status: string; sentAt: string | null; readAt: string | null; errorMessage: string | null }) =>
                  [cc.phone, cc.status, cc.sentAt || "", cc.readAt || "", cc.errorMessage || ""].join(",")
                )].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `campaign-${id}-contacts.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-xs text-gray-500">
                  <th className="text-left px-4 py-3">Phone</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Sent At</th>
                  <th className="text-left px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {(contacts?.data || []).slice(0, 20).map((cc: { id: string; phone: string; status: string; sentAt: string | null; readAt: string | null; errorMessage: string | null }) => (
                  <tr key={cc.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs">{cc.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(cc.status)}`}>{cc.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{cc.sentAt ? formatDateTime(cc.sentAt) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-red-500 max-w-xs truncate" title={cc.errorMessage || ""}>{cc.errorMessage || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  return (
    <RoleGuard minRole="MANAGER">
      <CampaignDetailPageContent />
    </RoleGuard>
  );
}
