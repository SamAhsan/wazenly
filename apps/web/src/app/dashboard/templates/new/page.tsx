"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, Upload, FileText, Clock, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useSelectedNumber } from "@/contexts/number-context";
import { RoleGuard } from "@/components/layout/role-guard";

interface TemplateForm {
  name: string;
  category: string;
  language: string;
  numberId: string;
  headerType: string;
  headerText?: string;
  headerUrl?: string;
  headerHandle?: string;
  body: string;
  footer?: string;
}

// Meta's confirmed limits for template header samples
const MEDIA_LIMITS: Record<string, { accept: string; maxBytes: number; label: string }> = {
  IMAGE: { accept: "image/jpeg,image/png", maxBytes: 5 * 1024 * 1024, label: "JPG or PNG. Max 5 MB." },
  VIDEO: { accept: "video/mp4,video/3gpp", maxBytes: 16 * 1024 * 1024, label: "MP4 or 3GPP. Max 16 MB." },
  DOCUMENT: { accept: "application/pdf", maxBytes: 100 * 1024 * 1024, label: "PDF only. Max 100 MB." },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Button {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

function NewTemplatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = !!editId;
  const { selectedNumberId } = useSelectedNumber();
  const [buttons, setButtons] = useState<Button[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFileInfo, setMediaFileInfo] = useState<{ name: string; size: number; duration?: number } | null>(null);
  const [bodyExamples, setBodyExamples] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<TemplateForm>({
    defaultValues: { language: "en", headerType: "NONE", category: "MARKETING", numberId: selectedNumberId || "", headerUrl: "", headerHandle: "" },
  });

  const { data: existingTemplate } = useQuery({
    queryKey: ["template", editId],
    queryFn: () => api.get(`/templates/${editId}`).then((r) => r.data),
    enabled: isEditMode,
  });

  // Pre-fill the form once the existing template loads. headerHandle is
  // deliberately left blank -- Meta's upload handles are single-use, so the
  // one from the original submission can't be reused for this resubmission
  // even if the header media itself isn't changing.
  useEffect(() => {
    if (!existingTemplate) return;
    reset({
      name: existingTemplate.name,
      category: existingTemplate.category,
      language: existingTemplate.language,
      numberId: existingTemplate.numberId || "",
      headerType: existingTemplate.headerType,
      headerText: existingTemplate.headerText || "",
      headerUrl: existingTemplate.headerUrl || "",
      headerHandle: "",
      body: existingTemplate.body,
      footer: existingTemplate.footer || "",
    });
    setButtons(existingTemplate.buttons || []);
  }, [existingTemplate, reset]);

  const headerType = watch("headerType");
  const body = watch("body") || "";
  const headerText = watch("headerText") || "";
  const numberId = watch("numberId");
  // Track headerUrl/headerHandle via react-hook-form so they're always in the form data at submit time
  const headerUrl = watch("headerUrl") || "";
  const headerHandle = watch("headerHandle") || "";

  // Auto-fill numberId when context changes
  if (selectedNumberId && !numberId) setValue("numberId", selectedNumberId);

  const { data: numbers = [] } = useQuery({
    queryKey: ["numbers"],
    queryFn: () => api.get("/numbers").then((r) => r.data),
  });

  // Detect {{1}}, {{2}} etc. in body
  const bodyVarNums = Array.from(new Set((body.match(/\{\{(\d+)\}\}/g) || []).map((m) => parseInt(m.replace(/[{}]/g, ""))))).sort((a, b) => a - b);

  const createMutation = useMutation({
    mutationFn: (d: TemplateForm & { buttons?: Button[]; bodyExamples?: Record<string, string> }) =>
      isEditMode ? api.put(`/templates/${editId}`, d) : api.post("/templates", d),
    onSuccess: () => {
      toast.success(isEditMode ? "Template resubmitted for Meta approval" : "Template submitted for Meta approval");
      router.push("/dashboard/templates");
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      const msg = e.response?.data?.error || (isEditMode ? "Failed to resubmit template" : "Failed to create template");
      setSubmitError(msg);
      toast.error(msg);
    },
  });

  const addButton = () => setButtons([...buttons, { type: "QUICK_REPLY", text: "" }]);
  const removeButton = (i: number) => setButtons(buttons.filter((_, idx) => idx !== i));
  const updateButton = (i: number, field: keyof Button, value: string) => {
    setButtons(buttons.map((b, idx) => idx === i ? { ...b, [field]: value } : b));
  };

  function getVideoDuration(file: File): Promise<number | undefined> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => { resolve(video.duration); URL.revokeObjectURL(video.src); };
      video.onerror = () => resolve(undefined);
      video.src = URL.createObjectURL(file);
    });
  }

  async function handleMediaFileUpload(file: File) {
    if (!numberId) { toast.error("Select a WhatsApp number first"); return; }
    const limits = MEDIA_LIMITS[headerType];
    if (limits && file.size > limits.maxBytes) {
      toast.error(`File too large — ${limits.label}`);
      return;
    }
    setUploadingMedia(true);
    setValue("headerHandle", "");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("numberId", numberId);
      const res = await api.post("/templates/upload-media", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setValue("headerUrl", res.data.url);
      setValue("headerHandle", res.data.handle);

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setMediaPreview(e.target?.result as string);
        reader.readAsDataURL(file);
        setMediaFileInfo({ name: file.name, size: file.size });
      } else if (file.type.startsWith("video/")) {
        setMediaPreview(null);
        const duration = await getVideoDuration(file);
        setMediaFileInfo({ name: file.name, size: file.size, duration });
      } else {
        setMediaPreview(null);
        setMediaFileInfo({ name: file.name, size: file.size });
      }
      toast.success("File uploaded and sent to Meta");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string }; status?: number } };
      const msg = err?.response?.data?.error || "Upload failed";
      toast.error(msg);
    } finally {
      setUploadingMedia(false);
    }
  }

  function onSubmit(d: TemplateForm) {
    setSubmitError(null);
    if (["IMAGE", "VIDEO", "DOCUMENT"].includes(d.headerType) && !d.headerHandle) {
      toast.error("Please upload a sample file — Meta requires an example for this header type");
      return;
    }
    createMutation.mutate({
      ...d,
      buttons,
      bodyExamples: Object.keys(bodyExamples).length > 0 ? bodyExamples : undefined,
    });
  }

  const LANGUAGES = [
    { code: "en", label: "English" }, { code: "en_US", label: "English (US)" },
    { code: "es", label: "Spanish" }, { code: "fr", label: "French" },
    { code: "ar", label: "Arabic" }, { code: "ur", label: "Urdu" },
    { code: "hi", label: "Hindi" }, { code: "pt_BR", label: "Portuguese (Brazil)" },
    { code: "id", label: "Indonesian" }, { code: "tr", label: "Turkish" },
  ];

  const previewBody = body.replace(/\{\{(\d+)\}\}/g, (_, n) => bodyExamples[n] ? `*${bodyExamples[n]}*` : `{{${n}}}`);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ChevronLeft className="w-4 h-4" /> Back to Templates
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{isEditMode ? "Edit & Resubmit Template" : "Create Message Template"}</h1>
      {isEditMode && (
        <p className="text-sm text-gray-500 mb-6">
          Name and language can't be changed after creation. Editing content resets this template to Pending review.
        </p>
      )}
      {!isEditMode && <div className="mb-6" />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* ── BASIC INFO ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <input
                {...register("name", { required: true, pattern: /^[a-z0-9_]+$/ })}
                placeholder="welcome_message"
                disabled={isEditMode}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {errors.name && <p className="text-red-500 text-xs mt-0.5">Lowercase letters, numbers, underscores only</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select {...register("category")} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["MARKETING", "UTILITY", "AUTHENTICATION"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language *</label>
              <select {...register("language")} disabled={isEditMode} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none disabled:bg-gray-50 disabled:text-gray-500">
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number *</label>
              <select {...register("numberId", { required: true })} disabled={isEditMode} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-50 disabled:text-gray-500">
                <option value="">Select...</option>
                {numbers.filter((n: { status: string }) => n.status === "CONNECTED").map((n: { id: string; displayName: string; phoneNumber: string }) => (
                  <option key={n.id} value={n.id}>{n.displayName} ({n.phoneNumber})</option>
                ))}
              </select>
              {errors.numberId && <p className="text-red-500 text-xs mt-0.5">Required</p>}
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Template Content</h2>

          {/* Header */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Header Type</label>
              <select {...register("headerType")} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none mb-2">
                {["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {headerType === "TEXT" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Header Text</label>
                <input
                  {...register("headerText")}
                  placeholder="Header text (max 60 chars)"
                  maxLength={60}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}

            {(headerType === "IMAGE" || headerType === "VIDEO" || headerType === "DOCUMENT") && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{headerType} Header</span>
                  <span className="text-xs text-gray-400">— provide a sample file so Meta can review your template faster</span>
                </div>

                {isEditMode && !headerHandle && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Meta's upload handles are single-use, so you'll need to re-upload the sample file to resubmit — even if it's the same file as before.
                  </p>
                )}

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Sample {headerType === "IMAGE" ? "Image" : headerType === "VIDEO" ? "Video" : "Document"} *
                  </label>
                  <input
                    ref={mediaFileRef}
                    type="file"
                    className="hidden"
                    accept={MEDIA_LIMITS[headerType]?.accept}
                    onChange={(e) => { if (e.target.files?.[0]) handleMediaFileUpload(e.target.files[0]); }}
                  />
                  <button
                    type="button"
                    onClick={() => mediaFileRef.current?.click()}
                    disabled={uploadingMedia}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm hover:bg-gray-50 disabled:opacity-70"
                  >
                    {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingMedia ? "Uploading..." : `Choose ${headerType === "IMAGE" ? "Image" : headerType === "VIDEO" ? "Video" : "Document"}`}
                  </button>
                  <p className="text-xs text-gray-400 mt-1">{MEDIA_LIMITS[headerType]?.label} Required — Meta needs a real sample to review this template.</p>
                </div>

                {/* Image preview */}
                {mediaPreview && headerType === "IMAGE" && (
                  <div className="mt-2">
                    <img src={mediaPreview} alt="Preview" className="max-h-32 rounded-lg border border-gray-200 object-contain" />
                  </div>
                )}

                {/* Video preview: filename + duration */}
                {headerType === "VIDEO" && mediaFileInfo && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{mediaFileInfo.name}</span>
                    <span className="text-gray-300">·</span>
                    <span>{formatBytes(mediaFileInfo.size)}</span>
                    {mediaFileInfo.duration !== undefined && (
                      <>
                        <span className="text-gray-300">·</span>
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{mediaFileInfo.duration.toFixed(1)}s</span>
                      </>
                    )}
                  </div>
                )}

                {/* Document preview: filename */}
                {headerType === "DOCUMENT" && mediaFileInfo && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{mediaFileInfo.name}</span>
                    <span className="text-gray-300">·</span>
                    <span>{formatBytes(mediaFileInfo.size)}</span>
                  </div>
                )}

                {headerHandle && (
                  <p className="text-xs text-green-600">Uploaded to Meta — ready to submit.</p>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Body *</label>
              <span className="text-xs text-gray-400">{body.length}/1024</span>
            </div>
            <textarea
              {...register("body", { required: true })}
              rows={5}
              placeholder={"Your message body. Use {{1}}, {{2}} for variables.\nExample: Hello {{1}}, your order {{2}} is confirmed."}
              maxLength={1024}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-xs text-gray-400 mt-0.5">Use {"{{1}}"}, {"{{2}}"} etc. for dynamic content that changes per recipient.</p>
          </div>

          {/* Body variable examples (required by Meta for approval) */}
          {bodyVarNums.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">Variable Sample Values</p>
                <p className="text-xs text-amber-700 mt-0.5">Required by Meta for template approval. Provide realistic example values.</p>
              </div>
              {bodyVarNums.map((n) => (
                <div key={n}>
                  <label className="block text-xs font-medium text-amber-800 mb-1">{"{{" + n + "}}"} example value *</label>
                  <input
                    value={bodyExamples[String(n)] || ""}
                    onChange={(e) => setBodyExamples((prev) => ({ ...prev, [String(n)]: e.target.value }))}
                    placeholder={`e.g. ${n === 1 ? "John" : n === 2 ? "ORD-12345" : "Sample text"}`}
                    className="w-full px-3 py-2 border border-amber-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Footer <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              {...register("footer")}
              placeholder="e.g. Reply STOP to unsubscribe"
              maxLength={60}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-gray-400 mt-0.5">Max 60 characters. Common use: opt-out instructions.</p>
          </div>

          {/* Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Buttons <span className="text-gray-400 font-normal">(optional, max 3)</span></label>
              {buttons.length < 3 && (
                <button type="button" onClick={addButton} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add Button
                </button>
              )}
            </div>
            {buttons.map((btn, i) => (
              <div key={i} className="flex items-start gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={btn.type}
                      onChange={(e) => updateButton(i, "type", e.target.value)}
                      className="px-2 py-1.5 border border-gray-200 bg-white rounded-lg text-xs"
                    >
                      {["QUICK_REPLY", "URL", "PHONE_NUMBER"].map((t) => (
                        <option key={t} value={t}>{t.replace("_", " ")}</option>
                      ))}
                    </select>
                    <input
                      value={btn.text}
                      onChange={(e) => updateButton(i, "text", e.target.value)}
                      placeholder="Button label (max 25 chars)"
                      maxLength={25}
                      className="flex-1 px-2 py-1.5 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                  {btn.type === "URL" && (
                    <input
                      value={btn.url || ""}
                      onChange={(e) => updateButton(i, "url", e.target.value)}
                      placeholder="https://yoursite.com/page"
                      className="w-full px-2 py-1.5 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none"
                    />
                  )}
                  {btn.type === "PHONE_NUMBER" && (
                    <input
                      value={btn.phone_number || ""}
                      onChange={(e) => updateButton(i, "phone_number", e.target.value)}
                      placeholder="+15551234567"
                      className="w-full px-2 py-1.5 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none"
                    />
                  )}
                </div>
                <button type="button" onClick={() => removeButton(i)} className="p-1.5 text-gray-400 hover:text-red-600 mt-0.5">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── PREVIEW ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Live Preview</h2>
          <div className="bg-[#ECE5DD] rounded-xl p-4 max-w-xs mx-auto">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header preview */}
              {headerType === "TEXT" && headerText && (
                <div className="bg-gray-50 px-4 py-3 font-semibold text-sm border-b">{headerText}</div>
              )}
              {(headerType === "IMAGE") && (
                <div className="border-b overflow-hidden">
                  {(mediaPreview || headerUrl) && headerType === "IMAGE" ? (
                    <img src={mediaPreview || headerUrl} alt="Header" className="w-full h-32 object-cover" onError={() => {}} />
                  ) : (
                    <div className="h-24 flex items-center justify-center bg-gray-100 text-xs text-gray-400">IMAGE</div>
                  )}
                </div>
              )}
              {headerType === "VIDEO" && (
                <div className="h-24 bg-gray-800 flex items-center justify-center border-b">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <div className="w-0 h-0 border-t-4 border-b-4 border-l-8 border-transparent border-l-white ml-1" />
                  </div>
                </div>
              )}
              {headerType === "DOCUMENT" && (
                <div className="h-16 bg-blue-50 flex items-center gap-3 px-4 border-b">
                  <div className="w-8 h-10 bg-blue-100 rounded flex items-center justify-center text-xs text-blue-600 font-bold">PDF</div>
                  <span className="text-xs text-gray-600">Document</span>
                </div>
              )}
              {/* Body */}
              <div className="px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {previewBody || <span className="text-gray-300">Your message body will appear here</span>}
              </div>
              {/* Buttons */}
              {buttons.map((b, i) => (
                <div key={i} className="border-t px-4 py-2.5 text-center text-sm text-blue-600 font-medium">
                  {b.text || `Button ${i + 1}`}
                </div>
              ))}
            </div>
          </div>
        </div>

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              createMutation.isPending ||
              uploadingMedia ||
              (headerType === "TEXT" && !headerText) ||
              (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) && !headerHandle)
            }
            className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
          >
            {createMutation.isPending
              ? (isEditMode ? "Resubmitting..." : "Submitting...")
              : (isEditMode ? "Resubmit for Approval" : "Submit for Approval")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewTemplatePage() {
  return (
    <RoleGuard minRole="MANAGER">
      <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
        <NewTemplatePageContent />
      </Suspense>
    </RoleGuard>
  );
}
