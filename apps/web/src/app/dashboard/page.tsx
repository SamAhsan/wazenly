"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatNumber, pct } from "@/lib/utils";
import { MessageSquare, Megaphone, Users, TrendingUp, TrendingDown, BarChart3, CheckCircle2, BookOpen, Phone } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useSelectedNumber } from "@/contexts/number-context";

function StatCard({ title, value, change, icon: Icon, color }: {
  title: string; value: string | number; change?: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {change >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
          <span className={`text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
            {change >= 0 ? "+" : ""}{change}% vs last period
          </span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { selectedNumberId } = useSelectedNumber();

  const { data: overview } = useQuery({
    queryKey: ["analytics-overview", selectedNumberId],
    queryFn: () => api.get("/analytics/overview", { params: selectedNumberId ? { numberId: selectedNumberId } : {} }).then((r) => r.data),
  });

  const { data: daily } = useQuery({
    queryKey: ["analytics-daily", selectedNumberId],
    queryFn: () => api.get("/analytics/daily", { params: selectedNumberId ? { numberId: selectedNumberId } : {} }).then((r) => r.data),
  });

  const { data: campaigns } = useQuery({
    queryKey: ["analytics-campaigns", selectedNumberId],
    queryFn: () => api.get("/analytics/campaigns", { params: selectedNumberId ? { numberId: selectedNumberId } : {} }).then((r) => r.data),
  });

  // Onboarding checklist
  const { data: numbers } = useQuery({
    queryKey: ["numbers"],
    queryFn: () => api.get("/numbers").then((r) => r.data),
  });

  const hasNumber = numbers && numbers.length > 0;
  const hasCampaign = overview?.activeCampaigns > 0 || campaigns?.length > 0;
  const onboardingDone = hasNumber && overview?.messagesSent > 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back! Here&apos;s what&apos;s happening.</p>
      </div>

      {/* Onboarding checklist */}
      {!onboardingDone && (
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Get started with WAZENLY
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { done: hasNumber, label: "Connect a number", href: "/dashboard/numbers", icon: Phone },
              { done: false, label: "Create a template", href: "/dashboard/templates", icon: BookOpen },
              { done: overview?.newContacts > 0, label: "Import contacts", href: "/dashboard/contacts", icon: Users },
              { done: hasCampaign, label: "Launch first campaign", href: "/dashboard/campaigns", icon: Megaphone },
            ].map(({ done, label, href, icon: Icon }) => (
              <Link key={label} href={href} className={`flex items-center gap-2.5 p-3 rounded-lg border text-sm font-medium transition-all ${done ? "bg-white border-green-200 text-green-700" : "bg-white border-gray-200 text-gray-700 hover:border-primary hover:text-primary"}`}>
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${done ? "text-green-500" : "text-gray-300"}`} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Messages Sent" value={formatNumber(overview?.messagesSent || 0)} change={overview?.sentChange} icon={MessageSquare} color="bg-blue-50 text-blue-600" />
        <StatCard title="Delivery Rate" value={`${overview?.deliveryRate || 0}%`} icon={BarChart3} color="bg-green-50 text-green-600" />
        <StatCard title="Read Rate" value={`${overview?.readRate || 0}%`} icon={TrendingUp} color="bg-purple-50 text-purple-600" />
        <StatCard title="Active Campaigns" value={overview?.activeCampaigns || 0} icon={Megaphone} color="bg-orange-50 text-orange-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Messages Sent (Last 30 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={daily || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v.toLocaleString(), "Messages"]} />
              <Line type="monotone" dataKey="messagesSent" stroke="#25D366" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="delivered" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-primary" /> Sent</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-blue-500" /> Delivered</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: "New Campaign", href: "/dashboard/campaigns/new", color: "bg-primary text-white hover:bg-primary-600" },
              { label: "Import Contacts", href: "/dashboard/contacts?import=true", color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
              { label: "Create Template", href: "/dashboard/templates/new", color: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
              { label: "Connect Number", href: "/dashboard/numbers", color: "bg-orange-50 text-orange-700 hover:bg-orange-100" },
            ].map(({ label, href, color }) => (
              <Link key={label} href={href} className={`block w-full text-center py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${color}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Top campaigns */}
      {campaigns?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Campaigns</h3>
            <Link href="/dashboard/campaigns" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 font-medium border-b border-gray-50">
                <th className="text-left px-5 py-3">Campaign</th>
                <th className="text-right px-5 py-3">Sent</th>
                <th className="text-right px-5 py-3">Delivered</th>
                <th className="text-right px-5 py-3">Read Rate</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.slice(0, 5).map((c: { id: string; name: string; sentCount: number; deliveredCount: number; readRate: number; status: string }) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-5 py-3.5 text-sm text-right text-gray-600">{formatNumber(c.sentCount)}</td>
                  <td className="px-5 py-3.5 text-sm text-right text-gray-600">{pct(c.deliveredCount, c.sentCount)}</td>
                  <td className="px-5 py-3.5 text-sm text-right font-medium text-gray-900">{c.readRate}%</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.status === "COMPLETED" ? "bg-green-100 text-green-700" : c.status === "RUNNING" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
