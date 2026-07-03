"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, FileText, Trash2, RefreshCw, Search, Send, X } from "lucide-react";
import api from "@/lib/api";
import { statusColor, formatRelativeTime } from "@/lib/utils";
import { useSelectedNumber } from "@/contexts/number-context";
import { RoleGuard } from "@/components/layout/role-guard";
import { hasMinRole } from "@/lib/permissions";

const CATEGORY_COLORS: Record<string, string> = {
  MARKETING: "bg-orange-50 text-orange-700",
  UTILITY: "bg-blue-50 text-blue-700",
  AUTHENTICATION: "bg-purple-50 text-purple-700",
};

type Template = {
  id: string; name: string; category: string; language: string; status: string;
  body: string; lastUsedAt: string | null; headerType: string; headerUrl?: string | null; footer?: string;
  buttons?: { text: string }[];
};

function TemplatesPageContent() {
  const { data: session } = useSession();
  const canManage = hasMinRole(session?.role, "MANAGER");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [quickSendTemplate, setQuickSendTemplate] = useState<Template | null>(null);
  const [quickSendPhone, setQuickSendPhone] = useState("");
  const [quickSendVars, setQuickSendVars] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { selectedNumber, selectedNumberId } = useSelectedNumber();

  const { data, isLoading } = useQuery({
    queryKey: ["templates", statusFilter, selectedNumberId],
    queryFn: () =>
      api.get("/templates", {
        params: {
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(selectedNumberId ? { numberId: selectedNumberId } : {}),
        },
      }).then((r) => r.data),
    enabled: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => { toast.success("Template deleted"); queryClient.invalidateQueries({ queryKey: ["templates"] }); },
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/templates/sync", { numberId: selectedNumberId }),
    onSuccess: (r) => {
      toast.success(r.data.message || "Templates synced");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || "Failed to sync templates"),
  });

  const setHeaderMediaMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return api.put(`/templates/${id}/header-media`, form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => { toast.success("Header media saved"); queryClient.invalidateQueries({ queryKey: ["templates"] }); },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || "Failed to save header media"),
  });

  const headerMediaFileRef = useRef<HTMLInputElement>(null);
  const [headerMediaTargetId, setHeaderMediaTargetId] = useState<string | null>(null);

  function addHeaderMedia(t: Template) {
    setHeaderMediaTargetId(t.id);
    headerMediaFileRef.current?.click();
  }

  const quickSendMutation = useMutation({
    mutationFn: async ({ template, phone, variables }: { template: Template; phone: string; variables: Record<string, string> }) => {
      const phone_clean = phone.startsWith("+") ? phone : `+${phone}`;
      const campaign = await api.post("/campaigns", {
        name: `Quick Send — ${template.name} — ${new Date().toLocaleTimeString()}`,
        numberId: selectedNumberId,
        templateId: template.id,
        type: "ONE_TIME",
        timezone: "UTC",
        rateLimit: 60,
        contacts: [{ phone: phone_clean, variables }],
      });
      await api.post(`/campaigns/${campaign.data.id}/launch`);
    },
    onSuccess: () => {
      toast.success("Message sent!");
      setQuickSendTemplate(null);
      setQuickSendPhone("");
      setQuickSendVars({});
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || "Failed to send message"),
  });

  const templates = (data?.data || []).filter((t: Template) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  // Extract {{1}}, {{2}} etc. variable placeholders from template body
  function getBodyVars(body: string): number[] {
    const matches = body.match(/\{\{(\d+)\}\}/g) || [];
    return Array.from(new Set(matches.map((m) => parseInt(m.replace(/[{}]/g, ""))))).sort((a, b) => a - b);
  }

  function openQuickSend(t: Template) {
    if (!selectedNumberId) { toast.error("Select a WhatsApp number first"); return; }
    setQuickSendTemplate(t);
    setQuickSendPhone("");
    const vars: Record<string, string> = {};
    getBodyVars(t.body).forEach((n) => { vars[String(n)] = ""; });
    setQuickSendVars(vars);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <input
        ref={headerMediaFileRef}
        type="file"
        accept="image/*,video/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && headerMediaTargetId) setHeaderMediaMutation.mutate({ id: headerMediaTargetId, file });
          e.target.value = "";
        }}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-500 text-sm mt-1">
            {selectedNumber
              ? `${selectedNumber.displayName} (${selectedNumber.phoneNumber})`
              : "Select a number from the top bar to filter templates"}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {selectedNumberId && (
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                {syncMutation.isPending ? "Syncing..." : "Sync from Meta"}
              </button>
            )}
            <Link href="/dashboard/templates/new" className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 text-sm font-medium">
              <Plus className="w-4 h-4" /> New Template
            </Link>
          </div>
        )}
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
          {canManage && (
            <Link href="/dashboard/templates/new" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> Create Template
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t: Template) => (
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
              <div className={`rounded-lg px-3 py-2 mb-2 text-xs flex items-center justify-between gap-1.5 ${
                ["IMAGE", "VIDEO", "DOCUMENT"].includes(t.headerType) && !t.headerUrl
                  ? "bg-amber-50 text-amber-700"
                  : "bg-gray-50 text-gray-500"
              }`}>
                <span><span className="font-medium">{t.headerType}</span> header</span>
                {["IMAGE", "VIDEO", "DOCUMENT"].includes(t.headerType) && (
                  canManage ? (
                    <button onClick={() => addHeaderMedia(t)} disabled={setHeaderMediaMutation.isPending} className="font-medium underline hover:no-underline disabled:opacity-50">
                      {setHeaderMediaMutation.isPending && headerMediaTargetId === t.id ? "Uploading..." : t.headerUrl ? "Change" : "⚠ Upload media"}
                    </button>
                  ) : !t.headerUrl && <span>⚠ No media set</span>
                )}
              </div>
            )}

            <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">{t.body}</p>

            {t.footer && <p className="text-xs text-gray-400 mt-2 italic">{t.footer}</p>}
            {t.buttons && Array.isArray(t.buttons) && t.buttons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {t.buttons.map((b, i) => (
                  <span key={i} className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-600">{b.text}</span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
              <span className="text-xs text-gray-400">{t.lastUsedAt ? `Used ${formatRelativeTime(t.lastUsedAt)}` : "Never used"}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {t.status === "APPROVED" && (
                  <button
                    onClick={() => openQuickSend(t)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors font-medium"
                    title="Send to a contact"
                  >
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                )}
                {canManage && (
                  <button
                    onClick={() => { if (confirm("Delete template?")) deleteMutation.mutate(t.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── QUICK SEND MODAL ── */}
      {quickSendTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">Send Template</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{quickSendTemplate.name}</p>
              </div>
              <button onClick={() => setQuickSendTemplate(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  value={quickSendPhone}
                  onChange={(e) => setQuickSendPhone(e.target.value)}
                  placeholder="+923001234567"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-xs text-gray-400 mt-0.5">Include country code (e.g. +92 for Pakistan)</p>
              </div>

              {getBodyVars(quickSendTemplate.body).map((n) => (
                <div key={n}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Variable {`{{${n}}`}
                  </label>
                  <input
                    value={quickSendVars[String(n)] || ""}
                    onChange={(e) => setQuickSendVars((prev) => ({ ...prev, [String(n)]: e.target.value }))}
                    placeholder={`Value for {{${n}}}`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}

              {/* Preview */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1.5">Preview</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {quickSendTemplate.body.replace(/\{\{(\d+)\}\}/g, (_, n) => quickSendVars[n] || `{{${n}}}`)}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setQuickSendTemplate(null)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  disabled={!quickSendPhone || quickSendMutation.isPending}
                  onClick={() => quickSendMutation.mutate({ template: quickSendTemplate, phone: quickSendPhone, variables: quickSendVars })}
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {quickSendMutation.isPending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <RoleGuard minRole="AGENT">
      <TemplatesPageContent />
    </RoleGuard>
  );
}
