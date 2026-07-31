"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, Phone, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime, statusColor } from "@/lib/utils";
import { SuperAdminGuard } from "@/components/layout/super-admin-guard";
import { useInfiniteScrollTrigger } from "@/hooks/useInfiniteScrollTrigger";

interface NumberRow {
  id: string;
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  status: string;
  tier: string;
  createdAt: string;
  workspace: { id: string; name: string; slug: string; status: string };
}

function NumbersPageContent() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["super-admin-numbers", search, statusFilter],
    queryFn: ({ pageParam }) =>
      api.get("/super-admin/numbers", { params: { q: search || undefined, status: statusFilter, page: pageParam, limit: 20 } }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    placeholderData: (prev) => prev,
  });

  const numbers: NumberRow[] = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const loadMoreRef = useInfiniteScrollTrigger(() => fetchNextPage(), !!hasNextPage && !isFetchingNextPage);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Numbers</h1>
        <p className="text-gray-500 text-sm mt-1">Every connected number across every company</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search numbers…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={statusFilter || ""}
          onChange={(e) => setStatusFilter(e.target.value || undefined)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All statuses</option>
          <option value="CONNECTED">Connected</option>
          <option value="DISCONNECTED">Disconnected</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No numbers found</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                  <th className="text-left px-5 py-3.5">Number</th>
                  <th className="text-left px-5 py-3.5">Company</th>
                  <th className="text-left px-5 py-3.5">Status</th>
                  <th className="text-left px-5 py-3.5">Tier</th>
                  <th className="text-left px-5 py-3.5">Connected</th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((n) => (
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
                    <td className="px-5 py-4">
                      <Link href={`/super-admin/companies/${n.workspace.id}`} className="text-sm text-gray-700 hover:text-primary">{n.workspace.name}</Link>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(n.status)}`}>{n.status}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{n.tier.replace("_", " ")}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{formatRelativeTime(n.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div ref={loadMoreRef} className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400 flex items-center justify-center gap-2">
            {isFetchingNextPage ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading more...</> : `Showing ${numbers.length} of ${total} numbers`}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminNumbersPage() {
  return (
    <SuperAdminGuard>
      <NumbersPageContent />
    </SuperAdminGuard>
  );
}
