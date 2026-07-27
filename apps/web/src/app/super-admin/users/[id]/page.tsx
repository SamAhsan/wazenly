"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Ban, CheckCircle2, LogOut, ShieldPlus, ShieldMinus } from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime, formatDate, getInitials } from "@/lib/utils";
import { SuperAdminGuard } from "@/components/layout/super-admin-guard";

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  emailVerified: string | null;
  suspendedAt: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  workspaceMembers: { id: string; role: string; joinedAt: string | null; workspace: { id: string; name: string; slug: string; status: string } }[];
  auditLog: { id: string; action: string; createdAt: string; actor: { email: string; name: string | null } }[];
}

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function UserDetailContent() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  const { data: user, isLoading } = useQuery<UserDetail>({
    queryKey: ["super-admin-user", id],
    queryFn: () => api.get(`/super-admin/users/${id}`).then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["super-admin-user", id] });

  const suspendMutation = useMutation({
    mutationFn: (reason: string) => api.post(`/super-admin/users/${id}/suspend`, { reason }),
    onSuccess: () => { toast.success("User suspended"); invalidate(); setSuspendOpen(false); setSuspendReason(""); },
  });
  const activateMutation = useMutation({
    mutationFn: () => api.post(`/super-admin/users/${id}/activate`),
    onSuccess: () => { toast.success("User activated"); invalidate(); },
  });
  const forceLogoutMutation = useMutation({
    mutationFn: () => api.post(`/super-admin/users/${id}/force-logout`),
    onSuccess: () => { toast.success("Sessions revoked"); invalidate(); },
  });
  const grantMutation = useMutation({
    mutationFn: () => api.post(`/super-admin/users/${id}/grant-super-admin`),
    onSuccess: () => { toast.success("Granted Super Admin"); invalidate(); },
  });
  const revokeMutation = useMutation({
    mutationFn: () => api.post(`/super-admin/users/${id}/revoke-super-admin`),
    onSuccess: () => { toast.success("Revoked Super Admin"); invalidate(); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error || "Failed"),
  });

  if (isLoading || !user) return <div className="p-6 text-gray-400 text-sm">Loading user…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/super-admin/users" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
            {getInitials(user.name || user.email)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{user.name || user.email}</h1>
              {user.isSuperAdmin && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Super Admin</span>}
              {user.suspendedAt && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Suspended</span>}
            </div>
            <p className="text-sm text-gray-500">{user.email} · Joined {formatDate(user.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {user.suspendedAt ? (
            <button onClick={() => activateMutation.mutate()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <CheckCircle2 className="w-4 h-4" /> Activate
            </button>
          ) : (
            <button onClick={() => setSuspendOpen(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-red-50 hover:border-red-200 hover:text-red-700">
              <Ban className="w-4 h-4" /> Suspend
            </button>
          )}
          <button onClick={() => forceLogoutMutation.mutate()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            <LogOut className="w-4 h-4" /> Force Logout
          </button>
          {user.isSuperAdmin ? (
            <button onClick={() => revokeMutation.mutate()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-amber-50">
              <ShieldMinus className="w-4 h-4" /> Revoke Super Admin
            </button>
          ) : (
            <button onClick={() => grantMutation.mutate()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-amber-50">
              <ShieldPlus className="w-4 h-4" /> Grant Super Admin
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Company Memberships ({user.workspaceMembers.length})</h2>
        </div>
        {user.workspaceMembers.length === 0 ? (
          <p className="text-sm text-gray-400 p-5">Not a member of any company.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 border-b border-gray-100"><th className="text-left px-5 py-2.5">Company</th><th className="text-left px-5 py-2.5">Role</th><th className="text-left px-5 py-2.5">Status</th><th className="text-left px-5 py-2.5">Joined</th></tr></thead>
            <tbody>
              {user.workspaceMembers.map((m) => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3"><Link href={`/super-admin/companies/${m.workspace.id}`} className="text-gray-900 hover:text-primary font-medium">{m.workspace.name}</Link></td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-700">{m.role}</span></td>
                  <td className="px-5 py-3 text-gray-500">{m.workspace.status}</td>
                  <td className="px-5 py-3 text-gray-500">{m.joinedAt ? formatRelativeTime(m.joinedAt) : "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Recent Super Admin Activity</h2>
        {user.auditLog.length === 0 ? (
          <p className="text-sm text-gray-400">No actions recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {user.auditLog.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-700"><span className="font-medium">{log.actor.name || log.actor.email}</span> — {humanizeAction(log.action)}</span>
                <span className="text-xs text-gray-400">{formatRelativeTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {suspendOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Suspend {user.email}?</h3>
            <p className="text-sm text-gray-500 mb-4">Blocks this user from logging in and kills their current session immediately.</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason…"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSuspendOpen(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => suspendMutation.mutate(suspendReason)}
                disabled={!suspendReason.trim() || suspendMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {suspendMutation.isPending ? "Suspending..." : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminUserDetailPage() {
  return (
    <SuperAdminGuard>
      <UserDetailContent />
    </SuperAdminGuard>
  );
}
