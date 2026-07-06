"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Megaphone, Pause, Play, Trash2, BarChart3, Search, RotateCcw } from "lucide-react";
import api from "@/lib/api";
import { statusColor, formatDateTime, formatNumber, pct } from "@/lib/utils";
import { useSelectedNumber } from "@/contexts/number-context";
import { RoleGuard } from "@/components/layout/role-guard";

const STATUSES = ["ALL", "DRAFT", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED", "FAILED"];

function CampaignsPageContent() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { selectedNumber, selectedNumberId } = useSelectedNumber();

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", statusFilter, selectedNumberId],
    queryFn: () =>
      api.get("/campaigns", {
        params: {
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(selectedNumberId ? { numberId: selectedNumberId } : {}),
        },
      }).then((r) => r.data),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/pause`),
    onSuccess: () => { toast.success("Campaign paused"); queryClient.invalidateQueries({ queryKey: ["campaigns"] }); },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/resume`),
    onSuccess: () => { toast.success("Campaign resumed"); queryClient.invalidateQueries({ queryKey: ["campaigns"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => { toast.success("Campaign deleted"); queryClient.invalidateQueries({ queryKey: ["campaigns"] }); },
  });

  const campaigns = (data?.data || []).filter((c: { name: string }) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">
            {selectedNumber
              ? `${selectedNumber.displayName} (${selectedNumber.phoneNumber})`
              : "Select a number from the top bar to filter campaigns"}
          </p>
        </div>
        <Link href="/dashboard/campaigns/new" className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" /> New Campaign
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && campaigns.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No campaigns yet</h3>
          <p className="text-gray-500 text-sm mb-5">Create your first campaign to start messaging your contacts at scale.</p>
          <Link href="/dashboard/campaigns/new" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-600">
            <Plus className="w-4 h-4" /> Create Campaign
          </Link>
        </div>
      )}

      {/* Table */}
      {campaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                <th className="text-left px-5 py-3.5">Campaign</th>
                <th className="text-left px-5 py-3.5">Status</th>
                <th className="text-right px-5 py-3.5">Recipients</th>
                <th className="text-right px-5 py-3.5">Sent</th>
                <th className="text-right px-5 py-3.5">Delivered</th>
                <th className="text-right px-5 py-3.5">Read</th>
                <th className="text-left px-5 py-3.5">Scheduled</th>
                <th className="text-right px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c: {
                id: string; name: string; status: string; totalRecipients: number;
                sentCount: number; deliveredCount: number; readCount: number; scheduledAt: string | null;
                number: { displayName: string }; template: { name: string } | null;
              }) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/dashboard/campaigns/${c.id}`}>
                      <p className="text-sm font-medium text-gray-900 hover:text-primary">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.number?.displayName}{c.template ? ` · ${c.template.name}` : ""}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(c.status)}`}>{c.status}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-right text-gray-600">{formatNumber(c.totalRecipients)}</td>
                  <td className="px-5 py-4 text-sm text-right text-gray-600">{formatNumber(c.sentCount)}</td>
                  <td className="px-5 py-4 text-sm text-right font-medium text-gray-900">{pct(c.deliveredCount, c.totalRecipients)}</td>
                  <td className="px-5 py-4 text-sm text-right font-medium text-primary">{pct(c.readCount, c.totalRecipients)}</td>
                  <td className="px-5 py-4 text-xs text-gray-500">{c.scheduledAt ? formatDateTime(c.scheduledAt) : "—"}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/dashboard/campaigns/${c.id}`} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="View stats">
                        <BarChart3 className="w-4 h-4" />
                      </Link>
                      {c.status === "RUNNING" && (
                        <>
                          <button onClick={() => resumeMutation.mutate(c.id)} disabled={resumeMutation.isPending} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Re-trigger (if stuck)">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button onClick={() => pauseMutation.mutate(c.id)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg" title="Pause">
                            <Pause className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {c.status === "PAUSED" && (
                        <button onClick={() => resumeMutation.mutate(c.id)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Resume">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {["DRAFT", "SCHEDULED", "COMPLETED", "FAILED"].includes(c.status) && (
                        <button onClick={() => { if (confirm("Delete this campaign?")) deleteMutation.mutate(c.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <RoleGuard minRole="MANAGER">
      <CampaignsPageContent />
    </RoleGuard>
  );
}
