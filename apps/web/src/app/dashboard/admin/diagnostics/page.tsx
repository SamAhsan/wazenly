"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, UserX, Shield } from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { RoleGuard } from "@/components/layout/role-guard";

interface Diagnostics {
  invitations: { pending: { id: string; email: string; role: string; expires: string }[]; expiredCount: number };
  unverifiedMembers: string[];
  roleBreakdown: Record<string, number>;
  permissionMatrix: Record<string, string[]>;
}

function DiagnosticsPageContent() {
  const { data, isLoading } = useQuery<Diagnostics>({
    queryKey: ["admin-diagnostics"],
    queryFn: () => api.get("/admin/diagnostics").then((r) => r.data),
    refetchInterval: 30000,
  });

  if (isLoading || !data) return <div className="p-6 text-gray-400 text-sm">Loading diagnostics…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Diagnostics</h1>
        <p className="text-gray-500 text-sm mt-1">Workspace health for your company — visible to owners only. Platform-wide system health lives in the Super Admin dashboard.</p>
      </div>

      {/* Invitations */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Invitations</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">{data.invitations.pending.length} pending · {data.invitations.expiredCount} expired</p>
        {data.invitations.pending.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
            <span className="text-gray-700">{inv.email} <span className="text-gray-400">({inv.role})</span></span>
            <span className="text-xs text-gray-400">expires {formatRelativeTime(inv.expires)}</span>
          </div>
        ))}
      </div>

      {/* Unverified members */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <UserX className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Unverified Members ({data.unverifiedMembers.length})</h2>
        </div>
        {data.unverifiedMembers.length === 0 ? (
          <p className="text-sm text-gray-400">All members have verified their email.</p>
        ) : (
          <p className="text-sm text-gray-600">{data.unverifiedMembers.join(", ")}</p>
        )}
      </div>

      {/* Role breakdown + permission matrix */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Roles &amp; Permissions</h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(data.roleBreakdown).map(([role, count]) => (
            <span key={role} className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700">{role}: {count}</span>
          ))}
        </div>
        <div className="space-y-2">
          {Object.entries(data.permissionMatrix).map(([role, perms]) => (
            <div key={role} className="text-sm">
              <span className="font-semibold text-gray-900">{role}</span>
              <span className="text-gray-500"> — {perms.join(", ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <RoleGuard minRole="OWNER">
      <DiagnosticsPageContent />
    </RoleGuard>
  );
}
