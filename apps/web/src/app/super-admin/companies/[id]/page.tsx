"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Building2, Users, Megaphone, FileText, MessageSquare, Phone,
  Ban, CheckCircle2, Trash2, RotateCcw, Eye, ArrowLeft,
} from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime, formatDate, statusColor } from "@/lib/utils";
import { SuperAdminGuard } from "@/components/layout/super-admin-guard";
import { MetricCard } from "@/components/analytics/metric-card";
import Link from "next/link";

interface CompanyDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  plan: { name: string } | null;
  subscription: { status: string } | null;
  numbers: { id: string; displayName: string; phoneNumber: string; phoneNumberId: string; wabaId: string; status: string; tier: string }[];
  members: { id: string; role: string; joinedAt: string | null; user: { id: string; email: string; name: string | null; suspendedAt: string | null; emailVerified: string | null } }[];
  _count: { contacts: number; campaigns: number; templates: number; conversations: number };
  auditLog: { id: string; action: string; metadata: unknown; createdAt: string; actor: { email: string; name: string | null } }[];
}

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function CompanyDetailContent() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: session, update } = useSession();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);

  const { data: company, isLoading } = useQuery<CompanyDetail>({
    queryKey: ["super-admin-company", id],
    queryFn: () => api.get(`/super-admin/companies/${id}`).then((r) => r.data),
  });

  const suspendMutation = useMutation({
    mutationFn: (reason: string) => api.post(`/super-admin/companies/${id}/suspend`, { reason }),
    onSuccess: () => {
      toast.success("Company suspended");
      qc.invalidateQueries({ queryKey: ["super-admin-company", id] });
      setSuspendOpen(false);
      setSuspendReason("");
    },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error || "Failed to suspend"),
  });

  const activateMutation = useMutation({
    mutationFn: () => api.post(`/super-admin/companies/${id}/activate`),
    onSuccess: () => {
      toast.success("Company activated");
      qc.invalidateQueries({ queryKey: ["super-admin-company", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/super-admin/companies/${id}`),
    onSuccess: () => {
      toast.success("Company deleted (soft)");
      qc.invalidateQueries({ queryKey: ["super-admin-company", id] });
      setDeleteOpen(false);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => api.post(`/super-admin/companies/${id}/restore`),
    onSuccess: () => {
      toast.success("Company restored");
      qc.invalidateQueries({ queryKey: ["super-admin-company", id] });
    },
  });

  async function impersonate(mode: "READ_ONLY" | "FULL") {
    try {
      const { data } = await api.post(`/super-admin/companies/${id}/impersonate`, { mode });
      // Cache the Super Admin's own token/workspace/role before swapping, then
      // swap into the impersonation session -- mirrors CompanySwitcher's
      // pattern in topbar.tsx. All three are needed to restore properly on exit.
      await update({
        superAdminAccessToken: session?.accessToken,
        superAdminWorkspaceId: session?.workspaceId,
        superAdminRole: session?.role,
        accessToken: data.token,
        workspaceId: data.workspaceId,
        role: data.role,
        impersonating: { workspaceId: data.workspaceId, companyName: data.companyName, mode: data.mode },
      });
      window.location.href = "/dashboard";
    } catch {
      toast.error("Failed to start impersonation");
    }
  }

  if (isLoading || !company) return <div className="p-6 text-gray-400 text-sm">Loading company…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Link href="/super-admin/companies" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Companies
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(company.status)}`}>{company.status}</span>
            </div>
            <p className="text-sm text-gray-500">{company.slug} · Created {formatDate(company.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setImpersonateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600"
          >
            <Eye className="w-4 h-4" /> View as Company
          </button>
          {company.status === "SUSPENDED" ? (
            <button onClick={() => activateMutation.mutate()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <CheckCircle2 className="w-4 h-4" /> Activate
            </button>
          ) : company.status === "ACTIVE" ? (
            <button onClick={() => setSuspendOpen(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-yellow-50 hover:border-yellow-200 hover:text-yellow-700">
              <Ban className="w-4 h-4" /> Suspend
            </button>
          ) : null}
          {company.status === "DELETED" ? (
            <button onClick={() => restoreMutation.mutate()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <RotateCcw className="w-4 h-4" /> Restore
            </button>
          ) : (
            <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-red-600 rounded-lg text-sm hover:bg-red-50">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      </div>

      {company.suspendedReason && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <span className="font-medium">Suspended</span> {company.suspendedAt && formatRelativeTime(company.suspendedAt)} — {company.suspendedReason}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Contacts" value={String(company._count.contacts)} icon={Users} color="bg-blue-50 text-blue-600" />
        <MetricCard title="Campaigns" value={String(company._count.campaigns)} icon={Megaphone} color="bg-purple-50 text-purple-600" />
        <MetricCard title="Templates" value={String(company._count.templates)} icon={FileText} color="bg-green-50 text-green-600" />
        <MetricCard title="Conversations" value={String(company._count.conversations)} icon={MessageSquare} color="bg-blue-50 text-blue-600" />
      </div>

      {/* Number */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Phone className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">WhatsApp Number</h2>
        </div>
        {company.numbers.length === 0 ? (
          <p className="text-sm text-gray-400">No number connected.</p>
        ) : (
          company.numbers.map((n) => (
            <div key={n.id} className="grid sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-gray-400">Display Name</p><p className="text-gray-900">{n.displayName}</p></div>
              <div><p className="text-xs text-gray-400">Phone Number</p><p className="text-gray-900 font-mono">{n.phoneNumber}</p></div>
              <div><p className="text-xs text-gray-400">Status</p><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(n.status)}`}>{n.status}</span></div>
              <div><p className="text-xs text-gray-400">WABA ID</p><p className="text-gray-700 font-mono text-xs">{n.wabaId}</p></div>
              <div><p className="text-xs text-gray-400">Phone Number ID</p><p className="text-gray-700 font-mono text-xs">{n.phoneNumberId}</p></div>
              <div><p className="text-xs text-gray-400">Tier</p><p className="text-gray-700">{n.tier.replace("_", " ")}</p></div>
            </div>
          ))
        )}
      </div>

      {/* Members */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
          <Users className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Users ({company.members.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-500 border-b border-gray-100"><th className="text-left px-5 py-2.5">Name</th><th className="text-left px-5 py-2.5">Email</th><th className="text-left px-5 py-2.5">Role</th><th className="text-left px-5 py-2.5">Joined</th><th className="text-left px-5 py-2.5">Status</th></tr></thead>
          <tbody>
            {company.members.map((m) => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3 text-gray-900">{m.user.name || "—"}</td>
                <td className="px-5 py-3 text-gray-600">{m.user.email}</td>
                <td className="px-5 py-3"><span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-700">{m.role}</span></td>
                <td className="px-5 py-3 text-gray-500">{m.joinedAt ? formatRelativeTime(m.joinedAt) : "Pending"}</td>
                <td className="px-5 py-3">{m.user.suspendedAt ? <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Suspended</span> : <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit log */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Recent Super Admin Activity</h2>
        {company.auditLog.length === 0 ? (
          <p className="text-sm text-gray-400">No actions recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {company.auditLog.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-700"><span className="font-medium">{log.actor.name || log.actor.email}</span> — {humanizeAction(log.action)}</span>
                <span className="text-xs text-gray-400">{formatRelativeTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suspend modal */}
      {suspendOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Suspend {company.name}?</h3>
            <p className="text-sm text-gray-500 mb-4">This immediately blocks every user in this company from using Wazenly. A reason is required.</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension…"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSuspendOpen(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => suspendMutation.mutate(suspendReason)}
                disabled={!suspendReason.trim() || suspendMutation.isPending}
                className="flex-1 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 disabled:opacity-50"
              >
                {suspendMutation.isPending ? "Suspending..." : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete {company.name}?</h3>
            <p className="text-sm text-gray-500 mb-5">This is a soft delete — the company disappears from the default list but all data is kept and can be restored anytime.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteOpen(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impersonate modal */}
      {impersonateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">View as {company.name}</h3>
            <p className="text-sm text-gray-500 mb-5">Choose access level. Both are limited to 60 minutes.</p>
            <div className="space-y-2">
              <button onClick={() => impersonate("READ_ONLY")} className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5">
                <p className="text-sm font-medium text-gray-900">Read-only</p>
                <p className="text-xs text-gray-500">Browse everything, cannot send messages or make changes.</p>
              </button>
              <button onClick={() => impersonate("FULL")} className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5">
                <p className="text-sm font-medium text-gray-900">Full access</p>
                <p className="text-xs text-gray-500">Act as the company Owner for hands-on support.</p>
              </button>
            </div>
            <button onClick={() => setImpersonateOpen(false)} className="w-full mt-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminCompanyDetailPage() {
  return (
    <SuperAdminGuard>
      <CompanyDetailContent />
    </SuperAdminGuard>
  );
}
