"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import api from "@/lib/api";

interface TemplateForm {
  name: string;
  category: string;
  language: string;
  numberId: string;
  headerType: string;
  headerText?: string;
  body: string;
  footer?: string;
}

interface Button {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const [buttons, setButtons] = useState<Button[]>([]);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<TemplateForm>({ defaultValues: { language: "en", headerType: "NONE", category: "MARKETING" } });

  const headerType = watch("headerType");
  const body = watch("body") || "";
  const headerText = watch("headerText") || "";

  const { data: numbers = [] } = useQuery({ queryKey: ["numbers"], queryFn: () => api.get("/numbers").then((r) => r.data) });

  const createMutation = useMutation({
    mutationFn: (d: TemplateForm & { buttons?: Button[] }) => api.post("/templates", d),
    onSuccess: () => { toast.success("Template submitted for Meta approval"); router.push("/dashboard/templates"); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error || "Failed to create template"),
  });

  const addButton = () => setButtons([...buttons, { type: "QUICK_REPLY", text: "" }]);
  const removeButton = (i: number) => setButtons(buttons.filter((_, idx) => idx !== i));
  const updateButton = (i: number, field: keyof Button, value: string) => {
    setButtons(buttons.map((b, idx) => idx === i ? { ...b, [field]: value } : b));
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ChevronLeft className="w-4 h-4" /> Back to Templates
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Message Template</h1>

      <form onSubmit={handleSubmit((d) => createMutation.mutate({ ...d, buttons }))} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <input {...register("name", { required: true, pattern: /^[a-z0-9_]+$/ })} placeholder="welcome_message" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
              {errors.name && <p className="text-red-500 text-xs mt-0.5">Lowercase letters, numbers, underscores only</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select {...register("category")} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["MARKETING", "UTILITY", "AUTHENTICATION"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select {...register("language")} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
                {[{ code: "en", label: "English" }, { code: "es", label: "Spanish" }, { code: "fr", label: "French" }, { code: "ar", label: "Arabic" }, { code: "ur", label: "Urdu" }].map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number *</label>
              <select {...register("numberId", { required: true })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Select...</option>
                {numbers.filter((n: { status: string }) => n.status === "CONNECTED").map((n: { id: string; displayName: string; phoneNumber: string }) => (
                  <option key={n.id} value={n.id}>{n.displayName} ({n.phoneNumber})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Template Content</h2>

          {/* Header */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Header</label>
            <select {...register("headerType")} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none mb-2">
              {["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {headerType === "TEXT" && (
              <input {...register("headerText")} placeholder="Header text (max 60 chars)" maxLength={60} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            )}
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Body *</label>
              <span className="text-xs text-gray-400">{body.length}/1024</span>
            </div>
            <textarea {...register("body", { required: true })} rows={5} placeholder="Your message body. Use {{1}}, {{2}} for variables." maxLength={1024} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>

          {/* Footer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Footer (optional)</label>
            <input {...register("footer")} placeholder="e.g. Reply STOP to unsubscribe" maxLength={60} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Buttons (optional)</label>
              {buttons.length < 3 && (
                <button type="button" onClick={addButton} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add button
                </button>
              )}
            </div>
            {buttons.map((btn, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <select value={btn.type} onChange={(e) => updateButton(i, "type", e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
                  {["QUICK_REPLY", "URL", "PHONE_NUMBER"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
                <input value={btn.text} onChange={(e) => updateButton(i, "text", e.target.value)} placeholder="Button text" className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none" />
                {btn.type === "URL" && <input value={btn.url || ""} onChange={(e) => updateButton(i, "url", e.target.value)} placeholder="https://..." className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none" />}
                {btn.type === "PHONE_NUMBER" && <input value={btn.phone_number || ""} onChange={(e) => updateButton(i, "phone_number", e.target.value)} placeholder="+1555..." className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none" />}
                <button type="button" onClick={() => removeButton(i)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Preview</h2>
          <div className="bg-[#ECE5DD] rounded-xl p-4 max-w-xs mx-auto">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {headerText && <div className="bg-gray-50 px-4 py-3 font-semibold text-sm border-b">{headerText}</div>}
              {headerType !== "NONE" && headerType !== "TEXT" && <div className="bg-gray-100 h-24 flex items-center justify-center text-xs text-gray-400 border-b">{headerType}</div>}
              <div className="px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{body}</div>
              {buttons.map((b, i) => (
                <div key={i} className="border-t px-4 py-2.5 text-center text-sm text-blue-600 font-medium">{b.text || `Button ${i + 1}`}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={createMutation.isPending} className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-70">
            {createMutation.isPending ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      </form>
    </div>
  );
}
