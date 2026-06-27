"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Phone, Trash2, RefreshCw, Wifi, WifiOff, Clock, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import { statusColor, formatRelativeTime } from "@/lib/utils";

const numberSchema = z.object({
  phoneNumberId: z.string().min(1, "Required"),
  wabaId: z.string().min(1, "Required"),
  accessToken: z.string().min(10, "Required"),
});
type NumberForm = z.infer<typeof numberSchema>;

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Phone className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No numbers connected</h3>
      <p className="text-gray-500 text-sm max-w-sm mx-auto">Connect your WhatsApp Business number to start sending messages.</p>
    </div>
  );
}

export default function NumbersPage() {
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ["numbers"],
    queryFn: () => api.get("/numbers").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NumberForm>({
    resolver: zodResolver(numberSchema),
  });

  const addMutation = useMutation({
    mutationFn: (data: NumberForm) => api.post("/numbers", data),
    onSuccess: () => {
      toast.success("Number connected successfully!");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
      setShowForm(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || "Failed to connect number"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/numbers/${id}`),
    onSuccess: () => {
      toast.success("Number removed");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
      setDeleteId(null);
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phone Numbers</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your connected WhatsApp Business numbers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Connect Number
        </button>
      </div>

      {/* Connect form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Connect WhatsApp Number</h2>
            <p className="text-sm text-gray-500 mb-5">Enter your Meta Developer credentials to connect a number.</p>

            <p className="text-xs text-gray-400 -mt-3 mb-1">Business name and phone number will be auto-detected from Meta.</p>
            <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
              {[
                { name: "phoneNumberId", label: "Phone Number ID", placeholder: "1234567890" },
                { name: "wabaId", label: "WhatsApp Business Account ID", placeholder: "9876543210" },
                { name: "accessToken", label: "Access Token", placeholder: "EAAxxxx..." },
              ].map(({ name, label, placeholder }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    {...register(name as keyof NumberForm)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                    type={name === "accessToken" ? "password" : "text"}
                  />
                  {errors[name as keyof NumberForm] && (
                    <p className="text-red-500 text-xs mt-0.5">{errors[name as keyof NumberForm]?.message}</p>
                  )}
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); reset(); }} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={addMutation.isPending} className="flex-1 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-70">
                  {addMutation.isPending ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-2">Delete number?</h3>
            <p className="text-sm text-gray-500 mb-5">This will disconnect the number and stop all active campaigns. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-70">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Numbers table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 skeleton rounded-xl" />)}
        </div>
      ) : numbers.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                <th className="text-left px-5 py-3.5">Number</th>
                <th className="text-left px-5 py-3.5">WABA ID</th>
                <th className="text-left px-5 py-3.5">Status</th>
                <th className="text-left px-5 py-3.5">Tier</th>
                <th className="text-left px-5 py-3.5">Created</th>
                <th className="text-right px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((n: { id: string; displayName: string; phoneNumber: string; phoneNumberId: string; wabaId: string; status: string; tier: string; createdAt: string }) => (
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
                  <td className="px-5 py-4 text-xs font-mono text-gray-500">{n.wabaId}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(n.status)}`}>
                      {n.status === "CONNECTED" ? <Wifi className="w-3 h-3" /> : n.status === "DISCONNECTED" ? <WifiOff className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {n.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{n.tier.replace("_", " ")}</td>
                  <td className="px-5 py-4 text-sm text-gray-500">{formatRelativeTime(n.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Sync templates">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <a href={`https://business.facebook.com/wa/manage/phone-numbers/?waba_id=${n.wabaId}`} target="_blank" rel="noreferrer"
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Open in Meta">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button onClick={() => setDeleteId(n.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
