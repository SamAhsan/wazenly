"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, X, Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import api from "@/lib/api";

function normalizePhone(raw: string): string {
  let p = (raw || "").replace(/[\s\-().]/g, "");
  if (!p.startsWith("+")) p = "+" + p;
  return p;
}

function isValidPhone(p: string): boolean {
  return /^\+\d{7,15}$/.test(p);
}

type Mapping = { name: string; phone: string; email: string; tags: string };
type ImportSummary = { total: number; imported: number; duplicates: number; invalidNumbers: number; otherErrors: number };

const MAPPING_FIELDS: { key: keyof Mapping; label: string; required: boolean; guesses: string[] }[] = [
  { key: "phone", label: "WhatsApp Number", required: true, guesses: ["phone", "whatsapp", "mobile", "number", "cell"] },
  { key: "name", label: "Name", required: false, guesses: ["name", "customer", "contact"] },
  { key: "email", label: "Email", required: false, guesses: ["email", "mail"] },
  { key: "tags", label: "Tags", required: false, guesses: ["tag", "label", "segment"] },
];

function guessMapping(columns: string[]): Mapping {
  const mapping: Mapping = { name: "", phone: "", email: "", tags: "" };
  for (const field of MAPPING_FIELDS) {
    const match = columns.find((c) => field.guesses.some((g) => c.toLowerCase().includes(g)));
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

function mappingStorageKey(columns: string[]): string {
  return `wazenly:import-mapping:${[...columns].sort().join("|")}`;
}

export function ImportWizard({ numberId, onClose, onImported }: { numberId: string; onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [mapping, setMapping] = useState<Mapping>({ name: "", phone: "", email: "", tags: "" });

  const [listName, setListName] = useState("");
  const [deduplicate, setDeduplicate] = useState(true);

  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      toast.error("Please upload a .csv or .xlsx file");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/contacts/import/parse", form, { headers: { "Content-Type": "multipart/form-data" } });
      setColumns(data.columns);
      setRows(data.rows);
      setTruncated(data.truncated);

      const remembered = localStorage.getItem(mappingStorageKey(data.columns));
      setMapping(remembered ? JSON.parse(remembered) : guessMapping(data.columns));
      setListName(file.name.replace(/\.(csv|xlsx)$/i, "").replace(/[_-]/g, " "));
      setStep(2);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Couldn't read that file");
    } finally {
      setUploading(false);
    }
  }

  // Validation + duplicate detection over the full parsed dataset, using the current mapping
  const validated = rows.map((row) => {
    const rawPhone = mapping.phone ? row[mapping.phone] || "" : "";
    const phone = normalizePhone(rawPhone);
    return { row, phone, valid: !!rawPhone && isValidPhone(phone) };
  });
  const seenPhones = new Set<string>();
  const withDuplicateFlag = validated.map((v) => {
    const isDup = v.valid && seenPhones.has(v.phone);
    if (v.valid) seenPhones.add(v.phone);
    return { ...v, isDup };
  });
  const validCount = withDuplicateFlag.filter((v) => v.valid && !v.isDup).length;
  const invalidCount = withDuplicateFlag.filter((v) => !v.valid).length;
  const duplicateCount = withDuplicateFlag.filter((v) => v.isDup).length;

  async function confirmImport() {
    if (!listName.trim()) { toast.error("Enter a list name"); return; }
    if (!mapping.phone) { toast.error("Map the WhatsApp Number column"); return; }

    localStorage.setItem(mappingStorageKey(columns), JSON.stringify(mapping));
    setImporting(true);
    setImportError(null);
    setStep(4);
    try {
      const { data } = await api.post("/contacts/import", {
        numberId,
        mapping,
        rows,
        listName: listName.trim(),
        deduplicate,
      });
      await pollStatus(data.jobId);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setImportError(e.response?.data?.error || "Import failed to start");
      setImporting(false);
    }
  }

  async function pollStatus(jobId: string) {
    for (let i = 0; i < 120; i++) {
      const { data } = await api.get(`/contacts/import/${jobId}/status`);
      if (data.state === "completed") {
        setSummary(data.result);
        setImporting(false);
        onImported();
        return;
      }
      if (data.state === "failed") {
        setImportError(data.failedReason || "Import failed");
        setImporting(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    setImportError("Import is taking longer than expected — check back in Contacts shortly.");
    setImporting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Import Contacts</h2>
              <p className="text-xs text-gray-400">Step {step} of 4</p>
            </div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Step 1 — Upload */}
        {step === 1 && (
          <div
            className="flex-1 flex items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
            <div className="text-center">
              {uploading ? (
                <Loader2 className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
              ) : (
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              )}
              <p className="text-sm font-medium text-gray-700">{uploading ? "Reading file..." : "Click or drag a file here"}</p>
              <p className="text-xs text-gray-400 mt-1">CSV or XLSX — any column layout, you'll map it next</p>
            </div>
          </div>
        )}

        {/* Step 2 — Column mapping */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <p className="text-sm text-gray-500">Found {rows.length} row{rows.length !== 1 ? "s" : ""} with {columns.length} columns. Tell us which column is which.</p>
            {MAPPING_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={mapping[field.key]}
                  onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">{field.required ? "Select a column..." : "— Not mapped —"}</option>
                  {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
            {truncated && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> File has more rows than the import limit — only the first rows were read.</p>
            )}
          </div>
        )}

        {/* Step 3 — Preview + validation */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">List Name *</label>
              <input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="e.g. January Leads"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} className="rounded" />
              Skip duplicate phone numbers within this file
            </label>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 rounded-lg px-3 py-2 text-center">
                <p className="text-lg font-bold text-green-700">{validCount}</p>
                <p className="text-xs text-green-600">Valid</p>
              </div>
              <div className="bg-amber-50 rounded-lg px-3 py-2 text-center">
                <p className="text-lg font-bold text-amber-700">{duplicateCount}</p>
                <p className="text-xs text-amber-600">Duplicates</p>
              </div>
              <div className="bg-red-50 rounded-lg px-3 py-2 text-center">
                <p className="text-lg font-bold text-red-700">{invalidCount}</p>
                <p className="text-xs text-red-600">Invalid Numbers</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Preview (first 10 rows)</p>
              <div className="overflow-auto max-h-64 rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Phone</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withDuplicateFlag.slice(0, 10).map((v, i) => (
                      <tr key={i} className={`border-b border-gray-50 ${!v.valid ? "bg-red-50/50" : v.isDup ? "bg-amber-50/50" : ""}`}>
                        <td className="px-3 py-2 text-gray-800">{mapping.name ? v.row[mapping.name] || "—" : "—"}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">{v.phone}</td>
                        <td className="px-3 py-2 text-gray-500">{mapping.email ? v.row[mapping.email] || "—" : "—"}</td>
                        <td className="px-3 py-2">
                          {!v.valid ? <span className="text-red-600">Invalid</span> : v.isDup ? <span className="text-amber-600">Duplicate</span> : <span className="text-green-600">OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Import + summary */}
        {step === 4 && (
          <div className="flex-1 flex items-center justify-center py-8">
            {importing && (
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-sm font-medium text-gray-700">Importing contacts...</p>
              </div>
            )}
            {!importing && summary && (
              <div className="text-center w-full">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-base font-semibold text-gray-900 mb-4">Import complete</p>
                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
                  <div className="bg-gray-50 rounded-lg px-3 py-2"><p className="text-lg font-bold text-gray-900">{summary.imported}</p><p className="text-xs text-gray-500">Imported</p></div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2"><p className="text-lg font-bold text-gray-900">{summary.duplicates}</p><p className="text-xs text-gray-500">Duplicates skipped</p></div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2"><p className="text-lg font-bold text-gray-900">{summary.invalidNumbers}</p><p className="text-xs text-gray-500">Invalid numbers</p></div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2"><p className="text-lg font-bold text-gray-900">{summary.total}</p><p className="text-xs text-gray-500">Total rows</p></div>
                </div>
                {summary.otherErrors > 0 && (
                  <p className="text-xs text-amber-600 mt-3">{summary.otherErrors} row{summary.otherErrors !== 1 ? "s" : ""} failed for other reasons.</p>
                )}
              </div>
            )}
            {!importing && importError && (
              <div className="text-center">
                <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">{importError}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {step !== 1 && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
            {step < 4 && (
              <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">
                Back
              </button>
            )}
            {step === 2 && (
              <button
                disabled={!mapping.phone}
                onClick={() => setStep(3)}
                className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Next: Preview
              </button>
            )}
            {step === 3 && (
              <button
                disabled={validCount === 0 || !listName.trim()}
                onClick={confirmImport}
                className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Import {validCount + duplicateCount} Contact{validCount + duplicateCount !== 1 ? "s" : ""}
              </button>
            )}
            {step === 4 && !importing && (
              <button onClick={onClose} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium">
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
