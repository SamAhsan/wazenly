"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, Building2, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime, statusColor } from "@/lib/utils";
import { SuperAdminGuard } from "@/components/layout/super-admin-guard";
import { useInfiniteScrollTrigger } from "@/hooks/useInfiniteScrollTrigger";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  plan: string | null;
  number: { displayName: string; phoneNumber: string; status: string } | null;
  contactsCount: number;
  campaignsCount: number;
  templatesCount: number;
  usersCount: number;
  lastActivity: string;
}

const STATUS_FILTERS = [
  { label: "All", value: undefined },
  { label: "Active", value: "ACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Deleted", value: "DELETED" },
];

function CompaniesPageContent() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["super-admin-companies", search, statusFilter],
    queryFn: ({ pageParam }) =>
      api.get("/super-admin/companies", { params: { q: search || undefined, status: statusFilter, page: pageParam, limit: 20 } }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    placeholderData: (prev) => prev,
  });

  const companies: Company[] = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const loadMoreRef = useInfiniteScrollTrigger(() => fetchNextPage(), !!hasNextPage && !isFetchingNextPage);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
        <p className="text-gray-500 text-sm mt-1">Every customer workspace on the platform</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === f.value ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No companies found</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                  <th className="text-left px-5 py-3.5">Company</th>
                  <th className="text-left px-5 py-3.5">Plan</th>
                  <th className="text-left px-5 py-3.5">Number</th>
                  <th className="text-right px-5 py-3.5">Contacts</th>
                  <th className="text-right px-5 py-3.5">Campaigns</th>
                  <th className="text-right px-5 py-3.5">Templates</th>
                  <th className="text-right px-5 py-3.5">Users</th>
                  <th className="text-left px-5 py-3.5">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/super-admin/companies/${c.id}`} className="flex items-center gap-3 group">
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 group-hover:text-primary">{c.name}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium mt-0.5 ${statusColor(c.status)}`}>{c.status}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{c.plan || "—"}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 font-mono">{c.number?.phoneNumber || "—"}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 text-right">{c.contactsCount}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 text-right">{c.campaignsCount}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 text-right">{c.templatesCount}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 text-right">{c.usersCount}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{formatRelativeTime(c.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div ref={loadMoreRef} className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400 flex items-center justify-center gap-2">
            {isFetchingNextPage ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading more...</> : `Showing ${companies.length} of ${total} companies`}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminCompaniesPage() {
  return (
    <SuperAdminGuard>
      <CompaniesPageContent />
    </SuperAdminGuard>
  );
}
