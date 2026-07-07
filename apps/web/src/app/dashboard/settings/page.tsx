"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings, Users, Key, Webhook, Copy, Plus, Trash2, Mail, Shield } from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { RoleGuard } from "@/components/layout/role-guard";

const TABS = [
  { id: "workspace", label: "Workspace", icon: Settings },
  { id: "members", label: "Team Members", icon: Users },
  { id: "apikeys", label: "API Keys", icon: Key },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
];

function SettingsPageContent() {
  const { data: session } = useSession();
  const [tab, setTab] = useState("workspace");
  const queryClient = useQueryClient();

  // Workspace
  const { data: workspace } = useQuery({ queryKey: ["workspace"], queryFn: () => api.get("/settings/workspace").then((r) => r.data) });
  const updateWorkspaceMutation = useMutation({
    mutationFn: (d: { name?: string; timezone?: string }) => api.put("/settings/workspace", d),
    onSuccess: () => { toast.success("Workspace updated"); queryClient.invalidateQueries({ queryKey: ["workspace"] }); },
  });

  // Members
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => api.get("/settings/members").then((r) => r.data) });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("AGENT");

  // Only an Owner belongs to more than one company — let them pick which one an
  // invite goes into instead of always using whichever is currently active.
  const { data: me } = useQuery<{ workspaces: { id: string; name: string; number: { displayName: string } | null }[] }>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
  });
  const companies = me?.workspaces || [];
  const [inviteCompanyId, setInviteCompanyId] = useState<string | undefined>(undefined);
  const activeInviteCompanyId = inviteCompanyId || session?.workspaceId;

  const inviteMutation = useMutation({
    mutationFn: () =>
      api.post(
        "/settings/members/invite",
        { email: inviteEmail, role: inviteRole },
        companies.length > 1 ? { headers: { "x-workspace-id": activeInviteCompanyId } } : undefined
      ),
    onSuccess: () => {
      toast.success("Invite sent");
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Failed to send invite");
    },
  });
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/settings/members/${userId}`),
    onSuccess: () => { toast.success("Member removed"); queryClient.invalidateQueries({ queryKey: ["members"] }); },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Failed to remove member");
    },
  });
  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => api.put(`/settings/members/${userId}/role`, { role }),
    onSuccess: () => { toast.success("Role updated"); queryClient.invalidateQueries({ queryKey: ["members"] }); },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Failed to update role");
    },
  });

  // Pending invitations
  const { data: invitations = [] } = useQuery({ queryKey: ["invitations"], queryFn: () => api.get("/settings/invitations").then((r) => r.data) });
  const revokeInviteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/invitations/${id}`),
    onSuccess: () => { toast.success("Invitation revoked"); queryClient.invalidateQueries({ queryKey: ["invitations"] }); },
  });

  // API Keys
  const { data: apiKeys = [] } = useQuery({ queryKey: ["api-keys"], queryFn: () => api.get("/settings/api-keys").then((r) => r.data) });
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const createKeyMutation = useMutation({
    mutationFn: () => api.post("/settings/api-keys", { name: newKeyName }),
    onSuccess: (r) => {
      toast.success("API key created");
      setRevealedKey(r.data.key);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/api-keys/${id}`),
    onSuccess: () => { toast.success("Key revoked"); queryClient.invalidateQueries({ queryKey: ["api-keys"] }); },
  });

  // Webhooks
  const { data: webhooks = [] } = useQuery({ queryKey: ["webhooks"], queryFn: () => api.get("/settings/webhooks").then((r) => r.data) });
  const [webhookUrl, setWebhookUrl] = useState("");
  const createWebhookMutation = useMutation({
    mutationFn: () => api.post("/settings/webhooks", { url: webhookUrl, events: ["message.received", "message.delivered", "message.read", "campaign.completed"] }),
    onSuccess: () => { toast.success("Webhook added"); setWebhookUrl(""); queryClient.invalidateQueries({ queryKey: ["webhooks"] }); },
  });
  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/webhooks/${id}`),
    onSuccess: () => { toast.success("Webhook deleted"); queryClient.invalidateQueries({ queryKey: ["webhooks"] }); },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex gap-1.5 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Workspace */}
      {tab === "workspace" && workspace && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Workspace Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workspace Name</label>
              <input defaultValue={workspace.name} onBlur={(e) => updateWorkspaceMutation.mutate({ name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select defaultValue={workspace.timezone} onChange={(e) => updateWorkspaceMutation.mutate({ timezone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata"].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100">
            <h3 className="font-medium text-gray-900 mb-2">Plan</h3>
            <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <Shield className="w-8 h-8 text-primary" />
              <div>
                <p className="font-semibold text-gray-900">{workspace.plan?.name || "Free"} Plan</p>
                <p className="text-xs text-gray-500">{workspace.plan?.messageLimit?.toLocaleString()} messages/month · {workspace.plan?.numberLimit} numbers</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members */}
      {tab === "members" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Invite Team Member</h2>
            {companies.length > 1 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <select value={activeInviteCompanyId} onChange={(e) => setInviteCompanyId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.number?.displayName || c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
                {["ADMIN", "MANAGER", "AGENT", "VIEWER"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={() => inviteMutation.mutate()} disabled={!inviteEmail || inviteMutation.isPending} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                Invite
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 text-xs text-gray-500"><th className="text-left px-5 py-3">Member</th><th className="text-left px-5 py-3">Role</th><th className="text-left px-5 py-3">Joined</th><th className="text-right px-5 py-3">Actions</th></tr></thead>
              <tbody>
                {members.map((m: { id: string; user: { id: string; name?: string; email: string }; role: string; joinedAt: string | null }) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs font-semibold">
                          {getInitials(m.user.name || m.user.email)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{m.user.name || m.user.email}</p>
                          <p className="text-xs text-gray-400">{m.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {m.role !== "OWNER" && m.user.email !== session?.user?.email ? (
                        <select
                          value={m.role}
                          onChange={(e) => changeRoleMutation.mutate({ userId: m.user.id, role: e.target.value })}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {["ADMIN", "MANAGER", "AGENT", "VIEWER"].map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">{m.role}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-400">{m.joinedAt ? formatRelativeTime(m.joinedAt) : "Pending"}</td>
                    <td className="px-5 py-4 text-right">
                      {m.role !== "OWNER" && (
                        <button onClick={() => removeMemberMutation.mutate(m.user.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invitations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Pending Invitations</h3></div>
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 text-xs text-gray-500"><th className="text-left px-5 py-3">Email</th><th className="text-left px-5 py-3">Role</th><th className="text-left px-5 py-3">Expires</th><th className="text-right px-5 py-3">Actions</th></tr></thead>
                <tbody>
                  {invitations.map((inv: { id: string; email: string; role: string; expires: string }) => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-4 text-sm text-gray-900">{inv.email}</td>
                      <td className="px-5 py-4"><span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">{inv.role}</span></td>
                      <td className="px-5 py-4 text-xs text-gray-400">{formatRelativeTime(inv.expires)}</td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => revokeInviteMutation.mutate(inv.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* API Keys */}
      {tab === "apikeys" && (
        <div className="space-y-4">
          {revealedKey && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">Save this key — it won&apos;t be shown again!</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-yellow-100 rounded-lg text-xs font-mono text-yellow-900 break-all">{revealedKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(revealedKey); toast.success("Copied!"); }} className="p-2 text-yellow-700 hover:bg-yellow-200 rounded-lg">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Create API Key</h2>
            <div className="flex gap-3">
              <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name (e.g. Production)" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <button onClick={() => createKeyMutation.mutate()} disabled={!newKeyName || createKeyMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                <Plus className="w-4 h-4" /> Create
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-xs text-gray-500"><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Key</th><th className="text-left px-5 py-3">Last Used</th><th className="text-right px-5 py-3">Actions</th></tr></thead>
              <tbody>
                {apiKeys.map((k: { id: string; name: string; keyPrefix: string; lastUsedAt: string | null; requestCount: number }) => (
                  <tr key={k.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium text-gray-900">{k.name}</td>
                    <td className="px-5 py-4 font-mono text-gray-500 text-xs">{k.keyPrefix}••••••••</td>
                    <td className="px-5 py-4 text-xs text-gray-400">{k.lastUsedAt ? formatRelativeTime(k.lastUsedAt) : "Never"}</td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => { if (confirm("Revoke key?")) revokeKeyMutation.mutate(k.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {apiKeys.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No API keys yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Webhooks */}
      {tab === "webhooks" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Add Webhook Endpoint</h2>
            <div className="flex gap-3">
              <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhook" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <button onClick={() => createWebhookMutation.mutate()} disabled={!webhookUrl || createWebhookMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Subscribed events: message.received, message.delivered, message.read, campaign.completed</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-xs text-gray-500"><th className="text-left px-5 py-3">URL</th><th className="text-left px-5 py-3">Events</th><th className="text-left px-5 py-3">Status</th><th className="text-right px-5 py-3">Actions</th></tr></thead>
              <tbody>
                {webhooks.map((w: { id: string; url: string; events: string[]; isActive: boolean }) => (
                  <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-4 font-mono text-xs text-gray-700 truncate max-w-xs">{w.url}</td>
                    <td className="px-5 py-4 text-xs text-gray-500">{w.events.join(", ")}</td>
                    <td className="px-5 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{w.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => deleteWebhookMutation.mutate(w.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {webhooks.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No webhooks configured</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RoleGuard minRole="ADMIN">
      <SettingsPageContent />
    </RoleGuard>
  );
}
