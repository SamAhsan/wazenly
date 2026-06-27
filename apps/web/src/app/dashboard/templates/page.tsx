"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, FileText, Trash2, RefreshCw, Search } from "lucide-react";
import api from "@/lib/api";
import { statusColor, formatRelativeTime } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  MARKETING: "bg-orange-50 text-orange-700",
  UTILITY: "bg-blue-50 text-blue-700",
  AUTHENTICATION: "bg-purple-50 text-purple-700",
};

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["templates", statusFilter],
    queryFn: () => api.get("/templates", { params: statusFilter !== "ALL" ? { status: statusFilter } : {} }).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => { toast.success("Template deleted"); queryClient.invalidateQueries({ queryKey: ["templates"] }); },
  });

  const syncMutation = useMutation({
    mutationFn: (numberId: string) => api.post("/templates/sync", { numberId }),
    onSuccess: () => toast.success("Template sync queued"),
  });

  const { data: numbers = [] } = useQuery({ queryKey: ["numbers"], queryFn: () => api.get("/numbers").then((r) => r.data) });

  const templates = (data?.data || []).filter((t: { name: string }) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your approved WhatsApp message templates</p>
        </div>
        <div className="flex gap-2">
          {numbers[0] && (
            <button onClick={() => syncMutation.mutate(numbers[0].id)} disabled={syncMutation.isPending} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} /> Sync from Meta
            </button>
          )}
          <Link href="/dashboard/templates/new" className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 text-sm font-medium">
            <Plus className="w-4 h-4" /> New Template
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        {["ALL", "APPROVED", "PENDING", "REJECTED"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === s ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{s}</button>
        ))}
      </div>

      {!isLoading && templates.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-500 text-sm mb-5">Create message templates for your campaigns. They need Meta approval before use.</p>
          <Link href="/dashboard/templates/new" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Create Template
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t: { id: string; name: string; category: string; language: string; status: string; body: string; lastUsedAt: string | null; headerType: string; footer?: string; buttons?: unknown[] }) => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 group hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                <div className="flex gap-1.5 mt-1.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[t.category] || "bg-gray-100 text-gray-600"}`}>{t.category}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{t.language}</span>
                </div>
              </div>
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusColor(t.status)}`}>{t.status}</span>
            </div>

            {t.headerType !== "NONE" && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 text-xs text-gray-500 flex items-center gap-1.5">
                <span className="font-medium">{t.headerType}</span> header
              </div>
            )}

            <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">{t.body}</p>

            {t.footer && <p className="text-xs text-gray-400 mt-2 italic">{t.footer}</p>}
            {t.buttons && Array.isArray(t.buttons) && t.buttons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(t.buttons as { text: string }[]).map((b, i) => (
                  <span key={i} className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-600">{b.text}</span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
              <span className="text-xs text-gray-400">{t.lastUsedAt ? `Used ${formatRelativeTime(t.lastUsedAt)}` : "Never used"}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { if (confirm("Delete template?")) deleteMutation.mutate(t.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
