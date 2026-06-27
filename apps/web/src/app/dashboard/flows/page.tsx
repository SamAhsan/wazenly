"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Workflow, Play, Pause, Trash2, Edit } from "lucide-react";
import api from "@/lib/api";
import { statusColor, formatRelativeTime } from "@/lib/utils";

export default function FlowsPage() {
  const queryClient = useQueryClient();

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.get("/flows").then((r) => r.data),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/flows/${id}/activate`),
    onSuccess: () => { toast.success("Flow activated"); queryClient.invalidateQueries({ queryKey: ["flows"] }); },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/flows/${id}/deactivate`),
    onSuccess: () => { toast.success("Flow deactivated"); queryClient.invalidateQueries({ queryKey: ["flows"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/flows/${id}`),
    onSuccess: () => { toast.success("Flow deleted"); queryClient.invalidateQueries({ queryKey: ["flows"] }); },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chatbot Flows</h1>
          <p className="text-gray-500 text-sm mt-1">Build automated conversation flows with the visual builder</p>
        </div>
        <Link href="/dashboard/flows/new" className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Flow
        </Link>
      </div>

      {!isLoading && flows.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Workflow className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No flows yet</h3>
          <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">
            Build visual conversation flows to automate responses based on keywords, user inputs, and conditions.
          </p>
          <Link href="/dashboard/flows/new" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Create Flow
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {flows.map((f: { id: string; name: string; description?: string; status: string; updatedAt: string; _count?: { nodes: number }; number?: { displayName: string } }) => (
          <div key={f.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 group hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Workflow className="w-5 h-5 text-primary" />
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(f.status)}`}>{f.status}</span>
            </div>

            <h3 className="font-semibold text-gray-900 mb-1">{f.name}</h3>
            {f.description && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{f.description}</p>}

            <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
              <span>{f._count?.nodes || 0} nodes</span>
              {f.number && <span>· {f.number.displayName}</span>}
              <span>· {formatRelativeTime(f.updatedAt)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/dashboard/flows/${f.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50">
                <Edit className="w-3.5 h-3.5" /> Edit
              </Link>
              {f.status !== "ACTIVE" ? (
                <button onClick={() => activateMutation.mutate(f.id)} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                  <Play className="w-3.5 h-3.5" /> Activate
                </button>
              ) : (
                <button onClick={() => deactivateMutation.mutate(f.id)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50">
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              )}
              <button onClick={() => { if (confirm("Delete flow?")) deleteMutation.mutate(f.id); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
