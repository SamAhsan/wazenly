"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle, XCircle, AlertTriangle, Mail, Server, UserX, Shield } from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { RoleGuard } from "@/components/layout/role-guard";

interface Diagnostics {
  smtp: { configured: boolean; verified: boolean; error?: string };
  queues: { name: string; waiting: number; active: number; failed: number; delayed: number }[];
  emails: { sentLast24h: number; failedLast24h: number; recentFailures: { id: string; to: string; subject: string; error?: string; createdAt: string }[] };
  invitations: { pending: { id: string; email: string; role: string; expires: string }[]; expiredCount: number };
  unverifiedMembers: string[];
  roleBreakdown: Record<string, number>;
  permissionMatrix: Record<string, string[]>;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </span>
  );
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
        <p className="text-gray-500 text-sm mt-1">System health for your workspace — visible to owners only</p>
      </div>

      {/* SMTP */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Email (SMTP)</h2>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill ok={data.smtp.configured} label={data.smtp.configured ? "Configured" : "Not configured"} />
          <StatusPill ok={data.smtp.verified} label={data.smtp.verified ? "Connection verified" : "Connection failed"} />
        </div>
        {data.smtp.error && <p className="text-xs text-red-500 mt-2">{data.smtp.error}</p>}
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-400">Sent (24h)</p>
            <p className="font-semibold text-gray-900">{data.emails.sentLast24h}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-400">Failed (24h)</p>
            <p className="font-semibold text-gray-900">{data.emails.failedLast24h}</p>
          </div>
        </div>
        {data.emails.recentFailures.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent failures</p>
            <div className="space-y-1.5">
              {data.emails.recentFailures.map((f) => (
                <div key={f.id} className="text-xs p-2 bg-red-50 rounded-lg text-red-700">
                  <span className="font-medium">{f.to}</span> — {f.subject} {f.error && `(${f.error})`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Queues */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Background Queues</h2>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-400 border-b border-gray-100"><th className="text-left py-2">Queue</th><th className="text-right py-2">Waiting</th><th className="text-right py-2">Active</th><th className="text-right py-2">Delayed</th><th className="text-right py-2">Failed</th></tr></thead>
          <tbody>
            {data.queues.map((q) => (
              <tr key={q.name} className="border-b border-gray-50">
                <td className="py-2 font-medium text-gray-700">{q.name}</td>
                <td className="py-2 text-right">{q.waiting}</td>
                <td className="py-2 text-right">{q.active}</td>
                <td className="py-2 text-right">{q.delayed}</td>
                <td className={`py-2 text-right ${q.failed > 0 ? "text-red-600 font-semibold" : ""}`}>{q.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
