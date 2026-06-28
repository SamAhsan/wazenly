"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Users, Upload, Search, Trash2, UserCheck, UserX, List, X, Check, FileText, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime, getInitials } from "@/lib/utils";

type Contact = {
  id: string; name: string; email?: string; phone: string; tags: string[];
  listMemberships: { list: { id: string; name: string } }[];
  lastMessaged: string | null; optedOut: boolean;
};
type ContactList = { id: string; name: string; description?: string; _count?: { members: number } };

// Normalise phone: strip spaces/dashes, ensure starts with +
function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, "");
  if (!p.startsWith("+")) p = "+" + p;
  return p;
}

function isValidPhone(p: string): boolean {
  return /^\+\d{7,15}$/.test(p);
}

type CsvRow = Record<string, string>;

export default function ContactsPage() {
  const [tab, setTab] = useState<"contacts" | "lists">("contacts");
  const [search, setSearch] = useState("");
  const [optedOutFilter, setOptedOutFilter] = useState<boolean | undefined>();
  const [showAdd, setShowAdd] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [activeList, setActiveList] = useState<ContactList | null>(null);
  const [showAddToList, setShowAddToList] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  // CSV import modal state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvListName, setCsvListName] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", search, optedOutFilter],
    queryFn: () => api.get("/contacts", { params: { q: search || undefined, optedOut: optedOutFilter } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: lists = [] } = useQuery<ContactList[]>({
    queryKey: ["contact-lists"],
    queryFn: () => api.get("/contacts/lists/all").then((r) => r.data),
  });

  const { data: listContacts, isLoading: listContactsLoading } = useQuery({
    queryKey: ["contacts", "list", activeList?.id],
    queryFn: () => api.get("/contacts", { params: { listId: activeList!.id, limit: 200 } }).then((r) => r.data),
    enabled: !!activeList,
  });

  const { register: regContact, handleSubmit: hsContact, reset: resetContact } = useForm<{ name: string; phone: string; email?: string }>();
  const { register: regList, handleSubmit: hsList, reset: resetList } = useForm<{ name: string; description?: string }>();

  const addContact = useMutation({
    mutationFn: (d: { name: string; phone: string; email?: string }) => {
      const payload: { name: string; phone: string; email?: string } = { name: d.name, phone: d.phone };
      if (d.email) payload.email = d.email;
      return api.post("/contacts", payload);
    },
    onSuccess: () => { toast.success("Contact added"); qc.invalidateQueries({ queryKey: ["contacts"] }); setShowAdd(false); resetContact(); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error || "Failed"),
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => { toast.success("Contact deleted"); qc.invalidateQueries({ queryKey: ["contacts"] }); },
  });

  const importContacts = useMutation({
    mutationFn: async ({ file, listId }: { file: File; listId: string }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("deduplicate", "true");
      form.append("listId", listId);
      return api.post("/contacts/import", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: (r) => {
      toast.success(`Import started — ${r.data.totalRows} rows queued`);
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contact-lists"] });
      setShowCsvModal(false);
      setCsvFile(null);
      setCsvRows([]);
      setCsvListName("");
    },
    onError: () => toast.error("Import failed"),
  });

  const createList = useMutation({
    mutationFn: (d: { name: string; description?: string }) => api.post("/contacts/lists", d),
    onSuccess: () => { toast.success("List created"); qc.invalidateQueries({ queryKey: ["contact-lists"] }); setShowCreateList(false); resetList(); },
    onError: () => toast.error("Failed to create list"),
  });

  const addToList = useMutation({
    mutationFn: ({ listId, contactIds }: { listId: string; contactIds: string[] }) =>
      api.post(`/contacts/lists/${listId}/members`, { contactIds }),
    onSuccess: () => {
      toast.success(`Added ${selectedContacts.length} contact(s) to list`);
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contact-lists"] });
      qc.invalidateQueries({ queryKey: ["contacts", "list", activeList?.id] });
      setShowAddToList(false);
      setSelectedContacts([]);
    },
    onError: () => toast.error("Failed to add contacts"),
  });

  const contacts: Contact[] = data?.data || [];
  const listContactsData: Contact[] = listContacts?.data || [];

  // Parse CSV file client-side and open the naming modal
  function handleCsvFileSelect(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { toast.error("CSV file is empty or has no data rows"); return; }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
      const rows: CsvRow[] = [];
      const errs: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
        const row: CsvRow = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });

        const rawPhone = row.phone || row.phonenumber || row["phone number"] || row.mobile || "";
        if (!rawPhone) { errs.push(`Row ${i}: missing phone number — skipped`); continue; }

        const phone = normalizePhone(rawPhone);
        if (!isValidPhone(phone)) { errs.push(`Row ${i}: invalid phone "${rawPhone}" — will be skipped`); continue; }

        row._phone_normalized = phone;
        if (!row.name) row.name = phone; // fallback name
        rows.push(row);
      }

      setCsvRows(rows);
      setCsvErrors(errs);
      setCsvFile(file);
      setCsvListName(file.name.replace(/\.csv$/i, "").replace(/[_-]/g, " "));
      setShowCsvModal(true);
    };
    reader.readAsText(file);
  }

  async function confirmCsvImport() {
    if (!csvListName.trim()) { toast.error("Please enter a list name"); return; }
    if (!csvFile) return;

    // First create the list, then import
    try {
      const listRes = await api.post("/contacts/lists", { name: csvListName.trim() });
      importContacts.mutate({ file: csvFile, listId: listRes.data.id });
    } catch {
      toast.error("Failed to create list");
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.total || 0} total contacts · {lists.length} lists</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleCsvFileSelect(e.target.files[0]);
                e.target.value = ""; // reset so same file can be re-selected
              }
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          {tab === "contacts" && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          )}
          {tab === "lists" && (
            <button
              onClick={() => setShowCreateList(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New List
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {[{ key: "contacts", label: "All Contacts", icon: Users }, { key: "lists", label: "Lists", icon: List }].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key as "contacts" | "lists"); setActiveList(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── CONTACTS TAB ── */}
      {tab === "contacts" && (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, email..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {[{ label: "All", value: undefined }, { label: "Active", value: false }, { label: "Opted Out", value: true }].map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setOptedOutFilter(value as boolean | undefined)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${optedOutFilter === value ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {!isLoading && contacts.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No contacts yet</h3>
              <p className="text-gray-500 text-sm">Import a CSV or add contacts manually.</p>
            </div>
          )}

          {contacts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                    <th className="text-left px-5 py-3.5">Contact</th>
                    <th className="text-left px-5 py-3.5">Phone</th>
                    <th className="text-left px-5 py-3.5">Lists</th>
                    <th className="text-left px-5 py-3.5">Last Messaged</th>
                    <th className="text-left px-5 py-3.5">Status</th>
                    <th className="text-right px-5 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">
                            {getInitials(c.name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{c.name}</p>
                            {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-mono text-gray-600">{c.phone}</td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {c.listMemberships.length > 0
                          ? c.listMemberships.map((m) => m.list.name).join(", ")
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400">{c.lastMessaged ? formatRelativeTime(c.lastMessaged) : "Never"}</td>
                      <td className="px-5 py-4">
                        {c.optedOut
                          ? <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><UserX className="w-3.5 h-3.5" /> Opted Out</span>
                          : <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><UserCheck className="w-3.5 h-3.5" /> Active</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { if (confirm("Delete contact?")) deleteContact.mutate(c.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data?.total > contacts.length && (
                <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
                  Showing {contacts.length} of {data.total} contacts
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── LISTS TAB ── */}
      {tab === "lists" && !activeList && (
        <>
          {lists.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <List className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No lists yet</h3>
              <p className="text-gray-500 text-sm mb-4">Create a list to group contacts for campaigns.</p>
              <button
                onClick={() => setShowCreateList(true)}
                className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Create First List
              </button>
            </div>
          )}
          {lists.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActiveList(l)}
                  className="text-left p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                      <List className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-2xl font-bold text-gray-900">{l._count?.members || 0}</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{l.name}</p>
                  {l.description && <p className="text-xs text-gray-400 mt-1 truncate">{l.description}</p>}
                  <p className="text-xs text-gray-400 mt-2">{l._count?.members || 0} contacts</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── LIST DETAIL VIEW ── */}
      {tab === "lists" && activeList && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setActiveList(null)} className="text-sm text-gray-400 hover:text-gray-700">← All Lists</button>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900">{activeList.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{listContacts?.total || 0} contacts in this list</p>
            <button
              onClick={() => setShowAddToList(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600"
            >
              <Plus className="w-4 h-4" /> Add Contacts to List
            </button>
          </div>

          {listContactsLoading && <p className="text-sm text-gray-400 py-8 text-center">Loading...</p>}

          {!listContactsLoading && listContactsData.length === 0 && (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No contacts in this list yet.</p>
              <button onClick={() => setShowAddToList(true)} className="mt-3 text-sm text-primary hover:underline">Add contacts</button>
            </div>
          )}

          {listContactsData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                    <th className="text-left px-5 py-3.5">Contact</th>
                    <th className="text-left px-5 py-3.5">Phone</th>
                    <th className="text-left px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {listContactsData.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs font-semibold">
                            {getInitials(c.name)}
                          </div>
                          <p className="text-sm font-medium text-gray-900">{c.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-600">{c.phone}</td>
                      <td className="px-5 py-3">
                        {c.optedOut
                          ? <span className="text-xs text-red-500">Opted Out</span>
                          : <span className="text-xs text-green-600">Active</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── CSV IMPORT MODAL ── */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Import Contacts</h2>
                  <p className="text-xs text-gray-400">{csvRows.length} valid contacts found</p>
                </div>
              </div>
              <button onClick={() => { setShowCsvModal(false); setCsvFile(null); setCsvRows([]); }}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* List name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">List Name *</label>
              <input
                value={csvListName}
                onChange={(e) => setCsvListName(e.target.value)}
                placeholder="e.g. January Leads"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-gray-400 mt-0.5">All contacts from this CSV will be added to this list.</p>
            </div>

            {/* Errors */}
            {csvErrors.length > 0 && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-800">{csvErrors.length} row{csvErrors.length !== 1 ? "s" : ""} will be skipped</p>
                </div>
                <div className="max-h-20 overflow-y-auto space-y-0.5">
                  {csvErrors.map((e, i) => (
                    <p key={i} className="text-xs text-amber-700">{e}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            {csvRows.length > 0 && (
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-gray-500 mb-2">Preview (first 5 rows)</p>
                <div className="overflow-auto max-h-52 rounded-lg border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Phone (Normalized)</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-3 py-2 text-gray-800">{row.name || "—"}</td>
                          <td className="px-3 py-2 font-mono text-gray-700">{row._phone_normalized || row.phone}</td>
                          <td className="px-3 py-2 text-gray-500">{row.email || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvRows.length > 5 && (
                    <p className="px-3 py-2 text-xs text-gray-400 bg-gray-50">...and {csvRows.length - 5} more</p>
                  )}
                </div>
              </div>
            )}

            {csvRows.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">No valid contacts found</p>
                  <p className="text-xs text-gray-400 mt-1">Make sure your CSV has a "phone" column with valid numbers including country code.</p>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => { setShowCsvModal(false); setCsvFile(null); setCsvRows([]); }}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                disabled={csvRows.length === 0 || !csvListName.trim() || importContacts.isPending}
                onClick={confirmCsvImport}
                className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {importContacts.isPending ? "Importing..." : `Import ${csvRows.length} Contact${csvRows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD CONTACT MODAL ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Add Contact</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <form onSubmit={hsContact((d) => addContact.mutate(d))} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input {...regContact("name")} required placeholder="John Smith"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (with country code)</label>
                <input {...regContact("phone")} required placeholder="+923001234567"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400 font-normal">(optional)</span></label>
                <input {...regContact("email")} placeholder="john@example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={addContact.isPending} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-70">
                  {addContact.isPending ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE LIST MODAL ── */}
      {showCreateList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">New Contact List</h2>
              <button onClick={() => setShowCreateList(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <form onSubmit={hsList((d) => createList.mutate(d))} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">List Name *</label>
                <input {...regList("name")} required placeholder="e.g. Test Recipients"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <input {...regList("description")} placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowCreateList(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={createList.isPending} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-70">
                  {createList.isPending ? "Creating..." : "Create List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD CONTACTS TO LIST MODAL ── */}
      {showAddToList && activeList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Add to "{activeList.name}"</h2>
              <button onClick={() => { setShowAddToList(false); setSelectedContacts([]); }}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 mb-4">
              {contacts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">
                  No contacts yet. <button onClick={() => { setShowAddToList(false); setShowAdd(true); }} className="text-primary">Add one first</button>.
                </p>
              )}
              {contacts.map((c) => {
                const alreadyIn = c.listMemberships.some((m) => m.list.id === activeList.id);
                const selected = selectedContacts.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${alreadyIn ? "opacity-40 cursor-not-allowed" : selected ? "bg-primary/5 border border-primary/30" : "hover:bg-gray-50 border border-transparent"}`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${selected && !alreadyIn ? "bg-primary border-primary" : "border-gray-300"}`}>
                      {selected && !alreadyIn && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={selected} disabled={alreadyIn}
                      onChange={(e) => {
                        if (alreadyIn) return;
                        setSelectedContacts((prev) => e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id));
                      }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                    </div>
                    {alreadyIn && <span className="text-xs text-gray-400 flex-shrink-0">Already in list</span>}
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{selectedContacts.length} selected</span>
              <div className="flex gap-2">
                <button onClick={() => { setShowAddToList(false); setSelectedContacts([]); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
                <button
                  disabled={selectedContacts.length === 0 || addToList.isPending}
                  onClick={() => addToList.mutate({ listId: activeList.id, contactIds: selectedContacts })}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {addToList.isPending ? "Adding..." : `Add ${selectedContacts.length || ""} Contact${selectedContacts.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
