"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Check, Rocket, Users } from "lucide-react";
import api from "@/lib/api";
import { useSelectedNumber } from "@/contexts/number-context";

const STEPS = ["Basic Info", "Audience", "Template", "Schedule", "Review"];

interface CampaignDraft {
  name: string;
  description?: string;
  numberId: string;
  type: "ONE_TIME" | "RECURRING";
  templateId?: string;
  contactListIds?: string[];
  scheduledAt?: string;
  timezone: string;
  rateLimit: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const { selectedNumberId } = useSelectedNumber();
  const [draft, setDraft] = useState<Partial<CampaignDraft>>({
    type: "ONE_TIME",
    timezone: "UTC",
    rateLimit: 60,
  });

  // Pre-select number from context
  useEffect(() => {
    if (selectedNumberId && !draft.numberId) {
      setDraft((prev) => ({ ...prev, numberId: selectedNumberId }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNumberId]);

  const { data: numbers = [] } = useQuery({
    queryKey: ["numbers"],
    queryFn: () => api.get("/numbers").then((r) => r.data),
  });
  const { data: lists = [] } = useQuery({
    queryKey: ["contact-lists"],
    queryFn: () => api.get("/contacts/lists/all").then((r) => r.data),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["templates", draft.numberId],
    queryFn: () =>
      api.get("/templates", { params: { status: "APPROVED", numberId: draft.numberId } }).then((r) => r.data.data || []),
    enabled: !!draft.numberId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<CampaignDraft>) => {
      const campaign = await api.post("/campaigns", {
        name: data.name,
        description: data.description,
        numberId: data.numberId,
        templateId: data.templateId,
        type: data.type,
        timezone: data.timezone,
        rateLimit: data.rateLimit,
        scheduledAt: data.scheduledAt,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
        contactListIds: data.contactListIds,
      });
      await api.post(`/campaigns/${campaign.data.id}/launch`);
      return campaign.data;
    },
    onSuccess: () => {
      toast.success("Campaign launched!");
      router.push("/dashboard/campaigns");
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || "Failed to create campaign"),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (data: Partial<CampaignDraft>) =>
      api.post("/campaigns", {
        name: data.name,
        description: data.description,
        numberId: data.numberId,
        templateId: data.templateId,
        type: data.type || "ONE_TIME",
        timezone: data.timezone || "UTC",
        rateLimit: data.rateLimit || 60,
        contactListIds: data.contactListIds,
      }),
    onSuccess: () => { toast.success("Saved as draft"); router.push("/dashboard/campaigns"); },
  });

  function update(fields: Partial<CampaignDraft>) {
    setDraft((prev) => ({ ...prev, ...fields }));
  }

  const isValid = (s: number) => {
    if (s === 0) return !!(draft.name && draft.numberId);
    if (s === 1) return !!(draft.contactListIds?.length);
    if (s === 2) return !!(draft.templateId);
    return true;
  };

  const selectedNumber = numbers.find((n: { id: string }) => n.id === draft.numberId);
  const selectedTemplate = templates.find((t: { id: string }) => t.id === draft.templateId);
  const selectedLists = lists.filter((l: { id: string }) => draft.contactListIds?.includes(l.id));

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Campaign</h1>

      {/* Step indicators */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                i < step ? "bg-primary text-white" : i === step ? "bg-primary text-white" : "bg-gray-200 text-gray-400"
              }`}
            >
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </button>
            <span className={`ml-2 text-xs font-medium hidden sm:block ${i === step ? "text-gray-900" : "text-gray-400"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? "bg-primary" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-h-64">
        {/* Step 0: Basic Info */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Basic Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
              <input
                value={draft.name || ""}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="e.g. January Newsletter"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={draft.description || ""}
                onChange={(e) => update({ description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Number *</label>
              <select
                value={draft.numberId || ""}
                onChange={(e) => update({ numberId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select a number...</option>
                {numbers.filter((n: { status: string }) => n.status === "CONNECTED").map((n: { id: string; displayName: string; phoneNumber: string }) => (
                  <option key={n.id} value={n.id}>{n.displayName} ({n.phoneNumber})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 1: Audience */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Select Audience</h2>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl">
              <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-xs text-blue-700">Select one or more contact lists to receive this campaign. To send to a single person, use the Send button on the Contacts page.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Lists *</label>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {lists.map((l: { id: string; name: string; _count?: { members: number } }) => (
                  <label key={l.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={draft.contactListIds?.includes(l.id) || false}
                      onChange={(e) => {
                        const ids = draft.contactListIds || [];
                        update({ contactListIds: e.target.checked ? [...ids, l.id] : ids.filter((id) => id !== l.id) });
                      }}
                      className="w-4 h-4 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{l.name}</p>
                      <p className="text-xs text-gray-500">{l._count?.members || 0} contacts</p>
                    </div>
                  </label>
                ))}
                {lists.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">
                    No contact lists yet. <a href="/dashboard/contacts" className="text-primary">Create one</a>.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Template */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Select Template</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {templates.map((t: { id: string; name: string; category: string; language: string; body: string }) => (
                <label
                  key={t.id}
                  className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${draft.templateId === t.id ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <input type="radio" name="template" value={t.id} checked={draft.templateId === t.id} onChange={() => update({ templateId: t.id })} className="mt-0.5 accent-primary" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 font-mono">{t.name}</p>
                    <div className="flex gap-2 mt-1 mb-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t.category}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t.language}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{t.body}</p>
                  </div>
                </label>
              ))}
              {templates.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  No approved templates for this number.{" "}
                  <a href="/dashboard/templates/new" className="text-primary">Create one</a>.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Schedule */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Scheduling & Rate Limiting</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Send at <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="datetime-local"
                value={draft.scheduledAt || ""}
                onChange={(e) => update({ scheduledAt: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank to send immediately after launch.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Limit (messages/minute)</label>
              <select
                value={draft.rateLimit}
                onChange={(e) => update({ rateLimit: Number(e.target.value) })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {[10, 30, 60, 100, 1000].map((v) => <option key={v} value={v}>{v} msg/min</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quiet Hours Start</label>
                <input type="time" value={draft.quietHoursStart || ""} onChange={(e) => update({ quietHoursStart: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quiet Hours End</label>
                <input type="time" value={draft.quietHoursEnd || ""} onChange={(e) => update({ quietHoursEnd: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Review & Launch</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: "Campaign Name", value: draft.name },
                { label: "From Number", value: selectedNumber ? `${selectedNumber.displayName} (${selectedNumber.phoneNumber})` : "—" },
                { label: "Template", value: selectedTemplate?.name || "—" },
                {
                  label: "Audience",
                  value: selectedLists.length > 0
                    ? selectedLists.map((l: { name: string }) => l.name).join(", ")
                    : "—",
                },
                { label: "Rate Limit", value: `${draft.rateLimit} msg/min` },
                { label: "Send At", value: draft.scheduledAt ? new Date(draft.scheduledAt).toLocaleString() : "Immediately on launch" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4 py-2 border-b border-gray-50">
                  <span className="text-gray-500 w-36 flex-shrink-0">{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={() => step === 0 ? router.back() : setStep(step - 1)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? "Cancel" : "Back"}
        </button>

        <div className="flex gap-2">
          {step === 4 && (
            <button
              onClick={() => saveDraftMutation.mutate(draft)}
              disabled={saveDraftMutation.isPending}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Save Draft
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!isValid(step)}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => createMutation.mutate(draft)}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
            >
              <Rocket className="w-4 h-4" /> {createMutation.isPending ? "Launching..." : "Launch Campaign"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
