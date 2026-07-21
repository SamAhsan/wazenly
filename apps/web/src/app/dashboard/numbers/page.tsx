"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Phone, Trash2, RefreshCw, Wifi, WifiOff, Clock, ExternalLink, Pencil, Copy, Webhook,
  Facebook, ShieldCheck, PowerOff, BadgeInfo,
} from "lucide-react";
import api from "@/lib/api";
import { statusColor, formatRelativeTime, formatDateTime } from "@/lib/utils";
import { RoleGuard } from "@/components/layout/role-guard";
import { FacebookEmbeddedSignupButton, EmbeddedSignupResult } from "@/components/numbers/facebook-embedded-signup-button";

interface WhatsAppNumber {
  id: string;
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  status: string;
  tier: string;
  createdAt: string;
  metaBusinessId: string | null;
  businessName: string | null;
  wabaVerificationStatus: string | null;
  qualityRating: string | null;
  metaMessagingLimitTier: string | null;
  connectionMethod: "MANUAL" | "EMBEDDED_SIGNUP";
  tokenExpiresAt: string | null;
  webhookSubscribed: boolean;
  lastSyncAt: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

function useSyncTemplates() {
  return useMutation({
    mutationFn: (numberId: string) => api.post("/templates/sync", { numberId }),
    onSuccess: (r) => toast.success(r.data.message || "Templates synced"),
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || "Failed to sync templates"),
  });
}

const numberSchema = z.object({
  phoneNumberId: z.string().min(1, "Required"),
  wabaId: z.string().min(1, "Required"),
  accessToken: z.string().min(10, "Required"),
});
type NumberForm = z.infer<typeof numberSchema>;

function qualityColor(rating: string | null): string {
  const map: Record<string, string> = {
    GREEN: "bg-green-100 text-green-700",
    YELLOW: "bg-yellow-100 text-yellow-700",
    RED: "bg-red-100 text-red-700",
  };
  return map[rating || ""] || "bg-gray-100 text-gray-500";
}

function verificationColor(status: string | null): string {
  const map: Record<string, string> = {
    APPROVED: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  return map[status || ""] || "bg-gray-100 text-gray-500";
}

function tokenExpiryStyle(expiresAt: string | null): string {
  if (!expiresAt) return "text-gray-400";
  const daysLeft = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysLeft <= 0) return "text-red-600 font-medium";
  if (daysLeft <= 7) return "text-yellow-600 font-medium";
  return "text-gray-600";
}

function EmptyState({
  configured, appId, configId, apiVersion, onFbSuccess, onFbError, onManualClick,
}: {
  configured: boolean;
  appId: string | null;
  configId: string | null;
  apiVersion: string;
  onFbSuccess: (r: EmbeddedSignupResult) => void;
  onFbError: (msg: string) => void;
  onManualClick: () => void;
}) {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Phone className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No numbers connected</h3>
      <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">Connect your WhatsApp Business number to start sending messages.</p>
      <div className="flex flex-col items-center gap-3">
        {configured && appId && configId ? (
          <FacebookEmbeddedSignupButton
            appId={appId}
            configId={configId}
            apiVersion={apiVersion}
            onSuccess={onFbSuccess}
            onError={onFbError}
          />
        ) : null}
        <button
          onClick={onManualClick}
          className={configured ? "text-sm text-gray-500 hover:text-primary underline" : "flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"}
        >
          {configured ? "Connect manually instead" : "Connect Number"}
        </button>
      </div>
    </div>
  );
}

function NumbersPageContent() {
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ phoneNumberId: "", wabaId: "", accessToken: "" });
  const queryClient = useQueryClient();
  const syncMutation = useSyncTemplates();

  const { data: numbers = [], isLoading } = useQuery<WhatsAppNumber[]>({
    queryKey: ["numbers"],
    queryFn: () => api.get("/numbers").then((r) => r.data),
  });

  const { data: webhookInfo } = useQuery({
    queryKey: ["webhook-info"],
    queryFn: () => api.get("/settings/webhook-info").then((r) => r.data),
  });

  const { data: signupConfig } = useQuery({
    queryKey: ["embedded-signup-config"],
    queryFn: () => api.get("/embedded-signup/config").then((r) => r.data),
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

  const callbackMutation = useMutation({
    mutationFn: (data: EmbeddedSignupResult) =>
      api.post("/embedded-signup/callback", { code: data.code, wabaId: data.wabaId, phoneNumberId: data.phoneNumberId, businessId: data.businessId }),
    onSuccess: () => {
      toast.success("Number connected via Facebook!");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || "Facebook connect failed"),
  });

  const reconnectMutation = useMutation({
    mutationFn: ({ numberId, data }: { numberId: string; data: EmbeddedSignupResult }) =>
      api.post(`/embedded-signup/reconnect/${numberId}`, { code: data.code, wabaId: data.wabaId, phoneNumberId: data.phoneNumberId, businessId: data.businessId }),
    onSuccess: () => {
      toast.success("Number reconnected!");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || "Reconnect failed"),
  });

  const refreshStatusMutation = useMutation({
    mutationFn: (id: string) => api.post(`/numbers/${id}/refresh-status`),
    onSuccess: () => {
      toast.success("Status refreshed");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || "Failed to refresh status"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/numbers/${id}/disconnect`),
    onSuccess: () => {
      toast.success("Number disconnected — history kept, you can reconnect anytime");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
      setDisconnectId(null);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || "Failed to disconnect"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/numbers/${id}`),
    onSuccess: () => {
      toast.success("Number removed");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
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
        {numbers.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Connect Number
          </button>
        )}
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

      {/* Disconnect confirmation (soft — keeps history) */}
      {disconnectId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-2">Disconnect number?</h3>
            <p className="text-sm text-gray-500 mb-5">This stops the number from sending or receiving messages. Contacts, conversations, campaigns and templates are all kept — you can reconnect anytime.</p>
            <div className="flex gap-3">
              <button onClick={() => setDisconnectId(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={() => disconnectMutation.mutate(disconnectId)} disabled={disconnectMutation.isPending} className="flex-1 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 disabled:opacity-70">
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation (hard — wipes all history) */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-2">Permanently delete number?</h3>
            <p className="text-sm text-gray-500 mb-5">This permanently deletes the number along with all its contacts, conversations, messages, campaigns and templates. This cannot be undone — use Disconnect instead if you just want to pause it.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-70">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Numbers */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 skeleton rounded-xl" />)}
        </div>
      ) : numbers.length === 0 ? (
        <EmptyState
          configured={!!signupConfig?.configured}
          appId={signupConfig?.appId ?? null}
          configId={signupConfig?.configId ?? null}
          apiVersion={signupConfig?.apiVersion || "v18.0"}
          onFbSuccess={(r) => callbackMutation.mutate(r)}
          onFbError={(msg) => toast.error(msg)}
          onManualClick={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-4">
          {numbers.map((n) => (
            <div key={n.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{n.businessName || n.displayName}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(n.status)}`}>
                        {n.status === "CONNECTED" ? <Wifi className="w-3 h-3" /> : n.status === "DISCONNECTED" ? <WifiOff className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {n.status}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                        {n.connectionMethod === "EMBEDDED_SIGNUP" ? <Facebook className="w-3 h-3" /> : <BadgeInfo className="w-3 h-3" />}
                        {n.connectionMethod === "EMBEDDED_SIGNUP" ? "Facebook" : "Manual"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{n.phoneNumber}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => syncMutation.mutate(n.id)}
                    disabled={syncMutation.isPending}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Sync templates from Meta"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => refreshStatusMutation.mutate(n.id)}
                    disabled={refreshStatusMutation.isPending}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Refresh status from Meta"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                  <a href={`https://business.facebook.com/wa/manage/phone-numbers/?waba_id=${n.wabaId}`} target="_blank" rel="noreferrer"
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Open in Meta">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => { setEditId(n.id); setEditData({ phoneNumberId: n.phoneNumberId, wabaId: n.wabaId, accessToken: "" }); }}
                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Edit credentials manually"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDisconnectId(n.id)}
                    className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                    title="Disconnect (keeps history)"
                  >
                    <PowerOff className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-x-6 gap-y-3 mt-4 pt-4 border-t border-gray-50 text-xs">
                <div>
                  <p className="text-gray-400 mb-0.5">WABA ID</p>
                  <p className="font-mono text-gray-700">{n.wabaId}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Phone Number ID</p>
                  <p className="font-mono text-gray-700">{n.phoneNumberId}</p>
                </div>
                {n.metaBusinessId && (
                  <div>
                    <p className="text-gray-400 mb-0.5">Business ID</p>
                    <p className="font-mono text-gray-700">{n.metaBusinessId}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-400 mb-0.5">Verification</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${verificationColor(n.wabaVerificationStatus)}`}>
                    {n.wabaVerificationStatus || "Unknown"}
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Quality Rating</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${qualityColor(n.qualityRating)}`}>
                    {n.qualityRating || "Unknown"}
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Messaging Tier</p>
                  <p className="text-gray-700">{n.metaMessagingLimitTier?.replace(/_/g, " ") || n.tier.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Webhook</p>
                  <p className="text-gray-700">{n.webhookSubscribed ? "Subscribed" : "Not subscribed"}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Token Expires</p>
                  <p className={tokenExpiryStyle(n.tokenExpiresAt)}>{n.tokenExpiresAt ? formatDateTime(n.tokenExpiresAt) : "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Last Synced</p>
                  <p className="text-gray-700">{n.lastSyncAt ? formatRelativeTime(n.lastSyncAt) : "Never"}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Connected</p>
                  <p className="text-gray-700">{formatRelativeTime(n.connectedAt || n.createdAt)}</p>
                </div>
              </div>

              {signupConfig?.configured && signupConfig.appId && signupConfig.configId && (
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between flex-wrap gap-3">
                  <FacebookEmbeddedSignupButton
                    appId={signupConfig.appId}
                    configId={signupConfig.configId}
                    apiVersion={signupConfig.apiVersion || "v18.0"}
                    label="Reconnect"
                    onSuccess={(r) => reconnectMutation.mutate({ numberId: n.id, data: r })}
                    onError={(msg) => toast.error(msg)}
                  />
                  <button onClick={() => setDeleteId(n.id)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete permanently
                  </button>
                </div>
              )}
              {!(signupConfig?.configured && signupConfig.appId && signupConfig.configId) && (
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-end">
                  <button onClick={() => setDeleteId(n.id)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete permanently
                  </button>
                </div>
              )}
            </div>
          ))}
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
