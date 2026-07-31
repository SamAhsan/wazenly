"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Users as UsersIcon, Loader2, Ban, CheckCircle2, LogOut, ShieldPlus, ShieldMinus } from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { SuperAdminGuard } from "@/components/layout/super-admin-guard";
import { useInfiniteScrollTrigger } from "@/hooks/useInfiniteScrollTrigger";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: string | null;
  suspendedAt: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  _count: { workspaceMembers: number };
}

function UsersPageContent() {
  const [search, setSearch] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const qc = useQueryClient();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["super-admin-users", search],
    queryFn: ({ pageParam }) =>
      api.get("/super-admin/users", { params: { q: search || undefined, page: pageParam, limit: 20 } }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    placeholderData: (prev) => prev,
  });

  const users: UserRow[] = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const loadMoreRef = useInfiniteScrollTrigger(() => fetchNextPage(), !!hasNextPage && !isFetchingNextPage);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["super-admin-users"] });

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/super-admin/users/${id}/suspend`, { reason }),
    onSuccess: () => { toast.success("User suspended"); invalidate(); setSuspendTarget(null); setSuspendReason(""); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error || "Failed"),
  });
  const activateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/users/${id}/activate`),
    onSuccess: () => { toast.success("User activated"); invalidate(); },
  });
  const forceLogoutMutation = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/users/${id}/force-logout`),
    onSuccess: () => { toast.success("User's sessions revoked"); invalidate(); },
  });
  const grantMutation = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/users/${id}/grant-super-admin`),
    onSuccess: () => { toast.success("Granted Super Admin"); invalidate(); },
  });
  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/users/${id}/revoke-super-admin`),
    onSuccess: () => { toast.success("Revoked Super Admin"); invalidate(); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error || "Failed"),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">Every user account on the platform</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {suspendTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Suspend {suspendTarget.email}?</h3>
            <p className="text-sm text-gray-500 mb-4">Blocks this user from logging in and kills their current session immediately.</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason…"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSuspendTarget(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => suspendMutation.mutate({ id: suspendTarget.id, reason: suspendReason })}
                disabled={!suspendReason.trim() || suspendMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {suspendMutation.isPending ? "Suspending..." : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UsersIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                  <th className="text-left px-5 py-3.5">User</th>
                  <th className="text-left px-5 py-3.5">Companies</th>
                  <th className="text-left px-5 py-3.5">Status</th>
                  <th className="text-left px-5 py-3.5">Joined</th>
                  <th className="text-right px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/super-admin/users/${u.id}`} className="flex items-center gap-3 group">
                        <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                          {getInitials(u.name || u.email)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 group-hover:text-primary">{u.name || u.email}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                        {u.isSuperAdmin && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-medium">Super Admin</span>}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{u._count.workspaceMembers}</td>
                    <td className="px-5 py-4">
                      {u.suspendedAt ? (
                        <span className="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Suspended</span>
                      ) : !u.emailVerified ? (
                        <span className="px-2.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Unverified</span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{formatRelativeTime(u.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {u.suspendedAt ? (
                          <button onClick={() => activateMutation.mutate(u.id)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Activate">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => setSuspendTarget(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Suspend">
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => forceLogoutMutation.mutate(u.id)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Force logout">
                          <LogOut className="w-4 h-4" />
                        </button>
                        {u.isSuperAdmin ? (
                          <button onClick={() => revokeMutation.mutate(u.id)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Revoke Super Admin">
                            <ShieldMinus className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => grantMutation.mutate(u.id)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Grant Super Admin">
                            <ShieldPlus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div ref={loadMoreRef} className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400 flex items-center justify-center gap-2">
            {isFetchingNextPage ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading more...</> : `Showing ${users.length} of ${total} users`}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminUsersPage() {
  return (
    <SuperAdminGuard>
      <UsersPageContent />
    </SuperAdminGuard>
  );
}
