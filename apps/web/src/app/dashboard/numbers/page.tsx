"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Phone, Trash2, RefreshCw, Wifi, WifiOff, Clock, ExternalLink, Pencil, Copy, Webhook, ShieldCheck, Zap } from "lucide-react";
import api from "@/lib/api";
import { statusColor, formatRelativeTime } from "@/lib/utils";
import { RoleGuard } from "@/components/layout/role-guard";

function useSyncTemplates() {
  return useMutation({
    mutationFn: (numberId: string) => api.post("/templates/sync", { numberId }),
    onSuccess: (r) => toast.success(r.data.message || "Templates synced"),
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || "Failed to sync templates"),
  });
}

function useRefreshStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (numberId: string) => api.post(`/numbers/${numberId}/refresh-status`),
    onSuccess: () => {
      toast.success("Status refreshed from Meta");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || "Failed to refresh status"),
  });
}

function useActivateNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (numberId: string) => api.post(`/numbers/${numberId}/activate`),
    onSuccess: () => {
      toast.success("Number activated");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || "Failed to activate number"),
  });
}

function qualityColor(rating: string | null): string {
  const map: Record<string, string> = {
    GREEN: "bg-green-100 text-green-700",
    YELLOW: "bg-yellow-100 text-yellow-700",
    RED: "bg-red-100 text-red-700",
  };
  return map[rating || ""] || "bg-gray-100 text-gray-500";
}

const numberSchema = z.object({
  phoneNumberId: z.string().min(1, "Required"),
  wabaId: z.string().min(1, "Required"),
  accessToken: z.string().min(10, "Required"),
});
type NumberForm = z.infer<typeof numberSchema>;

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Phone className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No numbers connected</h3>
      <p className="text-gray-500 text-sm max-w-sm mx-auto">Connect your WhatsApp Business number to start sending messages.</p>
    </div>
  );
}

function NumbersPageContent() {
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ phoneNumberId: "", wabaId: "", accessToken: "" });
  const [leavingCompany, setLeavingCompany] = useState(false);
  const queryClient = useQueryClient();
  const { data: session, update } = useSession();
  const syncMutation = useSyncTemplates();
  const refreshStatusMutation = useRefreshStatus();
  const activateMutation = useActivateNumber();

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ["numbers"],
    queryFn: () => api.get("/numbers").then((r) => r.data),
    // A number's connectivity/quality can change on Meta's side at any time
    // (disconnected, restricted); poll so that shows up without a manual
    // page reload, same pattern as the background health check (every 30min).
    refetchInterval: 30000,
  });

  const { data: webhookInfo } = useQuery({
    queryKey: ["webhook-info"],
    queryFn: () => api.get("/settings/webhook-info").then((r) => r.data),
  });

  const copy = (value: string) => { navigator.clipboard.writeText(value); toast.success("Copied!"); };

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NumberForm>({
    resolver: zodResolver(numberSchema),
  });

  const addMutation = useMutation({
    mutationFn: (data: NumberForm) => api.post("/numbers", data),
    onSuccess: () => {
      toast.success("Number connected successfully!");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
      setShowForm(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || "Failed to connect number"),
  });

  // Deleting a number now deletes the entire company (see the backend
  // comment on DELETE /api/numbers/:id) -- the session's current workspaceId
  // no longer exists afterward, so every other API call would start failing
  // until it's pointed somewhere valid. Switch to another company the user
  // belongs to if one exists; otherwise there's nothing left to switch to,
  // so sign out and send them to create a fresh one.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/numbers/${id}`),
    onSuccess: async () => {
      toast.success("Company removed");
      setDeleteId(null);
      setLeavingCompany(true);
      try {
        const { data } = await api.get("/auth/me");
        const nextWorkspace = data.workspaces?.[0];
        if (nextWorkspace) {
          const { data: switched } = await api.post(`/workspaces/${nextWorkspace.id}/switch`);
          await update({ accessToken: switched.token, workspaceId: switched.workspaceId, role: switched.role });
          window.location.href = "/dashboard";
        } else {
          await signOut({ callbackUrl: "/auth/register" });
        }
      } catch {
        window.location.href = "/auth/login";
      }
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || "Failed to delete company");
      setDeleteId(null);
    },
  });

  const editMutation = useMutation({
    mutationFn: (data: { phoneNumberId?: string; wabaId?: string; accessToken?: string }) =>
      api.put(`/numbers/${editId}`, data),
    onSuccess: () => {
      toast.success("Number updated");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
      setEditId(null);
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast.error(err.response?.data?.error || "Failed to update number"),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phone Numbers</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your connected WhatsApp Business numbers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Connect Number
        </button>
      </div>

      {/* Webhook info — same URL/token for every number, paste into Meta's App Dashboard */}
      {webhookInfo && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Webhook className="w-4 h-4 text-gray-400" /> Webhook config for Meta (same for every number)
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Callback URL</label>
              <div className="flex items-center gap-1.5">
                <input readOnly value={webhookInfo.webhookUrl} className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-700" />
                <button onClick={() => copy(webhookInfo.webhookUrl)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg" title="Copy">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Verify Token</label>
              <div className="flex items-center gap-1.5">
                <input readOnly value={webhookInfo.verifyToken || "Not configured"} className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-700" />
                {webhookInfo.verifyToken && (
                  <button onClick={() => copy(webhookInfo.verifyToken)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg" title="Copy">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connect form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Connect WhatsApp Number</h2>
            <p className="text-sm text-gray-500 mb-5">Enter your Meta Developer credentials to connect a number.</p>

            <p className="text-xs text-gray-400 -mt-3 mb-1">Business name and phone number will be auto-detected from Meta.</p>
            <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
              {[
                { name: "phoneNumberId", label: "Phone Number ID", placeholder: "1234567890" },
                { name: "wabaId", label: "WhatsApp Business Account ID", placeholder: "9876543210" },
                { name: "accessToken", label: "Access Token", placeholder: "EAAxxxx..." },
              ].map(({ name, label, placeholder }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    {...register(name as keyof NumberForm)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                    type={name === "accessToken" ? "password" : "text"}
                  />
                  {errors[name as keyof NumberForm] && (
                    <p className="text-red-500 text-xs mt-0.5">{errors[name as keyof NumberForm]?.message}</p>
                  )}
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); reset(); }} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={addMutation.isPending} className="flex-1 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-70">
                  {addMutation.isPending ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit credentials modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Edit Number Credentials</h2>
            <p className="text-sm text-gray-500 mb-5">Update the Phone Number ID, WABA ID, or Access Token. Leave blank to keep the current value.</p>
            <div className="space-y-4">
              {[
                { key: "phoneNumberId", label: "Phone Number ID", placeholder: "Current value hidden" },
                { key: "wabaId", label: "WhatsApp Business Account ID", placeholder: "Current value hidden" },
                { key: "accessToken", label: "Access Token", placeholder: "Enter new token (leave blank to keep)" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    value={editData[key as keyof typeof editData]}
                    onChange={(e) => setEditData((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    type={key === "accessToken" ? "password" : "text"}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setEditId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const data: { phoneNumberId?: string; wabaId?: string; accessToken?: string } = {};
                  if (editData.phoneNumberId) data.phoneNumberId = editData.phoneNumberId;
                  if (editData.wabaId) data.wabaId = editData.wabaId;
                  if (editData.accessToken) data.accessToken = editData.accessToken;
                  editMutation.mutate(data);
                }}
                disabled={editMutation.isPending}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-70"
              >
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-2">Delete this company?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This removes the number and permanently deletes this entire company — all campaigns, contacts, conversations, templates, and team members. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-70">
                {deleteMutation.isPending ? "Deleting..." : "Delete Company"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shown after a successful delete while we switch to another company or sign out */}
      {leavingCompany && (
        <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
          <p className="text-sm text-gray-500">Redirecting…</p>
        </div>
      )}

      {/* Numbers table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 skeleton rounded-xl" />)}
        </div>
      ) : numbers.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                <th className="text-left px-5 py-3.5">Number</th>
                <th className="text-left px-5 py-3.5">WABA ID</th>
                <th className="text-left px-5 py-3.5">Status</th>
                <th className="text-left px-5 py-3.5">Quality</th>
                <th className="text-left px-5 py-3.5">Verification</th>
                <th className="text-left px-5 py-3.5">Tier</th>
                <th className="text-left px-5 py-3.5">Last Checked</th>
                <th className="text-right px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((n: { id: string; displayName: string; phoneNumber: string; phoneNumberId: string; wabaId: string; status: string; tier: string; createdAt: string; qualityRating: string | null; wabaVerificationStatus: string | null; metaMessagingLimitTier: string | null; lastHealthCheckAt: string | null }) => (
                <tr key={n.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Phone className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{n.displayName}</p>
                        <p className="text-xs text-gray-500 font-mono">{n.phoneNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-gray-500">{n.wabaId}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(n.status)}`}>
                      {n.status === "CONNECTED" ? <Wifi className="w-3 h-3" /> : n.status === "DISCONNECTED" ? <WifiOff className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {n.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${qualityColor(n.qualityRating)}`}>
                      {n.qualityRating || "Unknown"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{n.wabaVerificationStatus || "Unknown"}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{(n.metaMessagingLimitTier || n.tier).replace(/_/g, " ")}</td>
                  <td className="px-5 py-4 text-sm text-gray-500">{n.lastHealthCheckAt ? formatRelativeTime(n.lastHealthCheckAt) : "Never"}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {n.status === "PENDING" && (
                        <button
                          onClick={() => activateMutation.mutate(n.id)}
                          disabled={activateMutation.isPending}
                          className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Activate — register this number for messaging with Meta"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => refreshStatusMutation.mutate(n.id)}
                        disabled={refreshStatusMutation.isPending}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh status from Meta"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => syncMutation.mutate(n.id)}
                        disabled={syncMutation.isPending}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Sync templates from Meta"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                      </button>
                      <a href={`https://business.facebook.com/wa/manage/phone-numbers/?waba_id=${n.wabaId}`} target="_blank" rel="noreferrer"
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Open in Meta">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => { setEditId(n.id); setEditData({ phoneNumberId: n.phoneNumberId, wabaId: n.wabaId, accessToken: "" }); }}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit credentials"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {session?.role === "OWNER" && (
                        <button onClick={() => setDeleteId(n.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete company">
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

export default function NumbersPage() {
  return (
    <RoleGuard minRole="MANAGER">
      <NumbersPageContent />
    </RoleGuard>
  );
}
