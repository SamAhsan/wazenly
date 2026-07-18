"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Users, Upload, Search, Trash2, List, X, Check, Send, ShieldOff, RotateCcw, Download } from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime, getInitials, statusColor } from "@/lib/utils";
import { useSelectedNumber } from "@/contexts/number-context";
import { RoleGuard } from "@/components/layout/role-guard";
import { ImportWizard } from "@/components/contacts/ImportWizard";

const CONTACT_STATUSES = ["ACTIVE", "UNSUBSCRIBED", "BLACKLISTED", "INVALID", "DORMANT", "FAILED_DELIVERY"];
const REPLY_INTENTS = ["INTERESTED", "NOT_INTERESTED", "UNKNOWN"];

type Contact = {
  id: string; name: string; email?: string; phone: string; tags: string[];
  listMemberships: { list: { id: string; name: string } }[];
  lastMessaged: string | null; optedOut: boolean;
  status: string; statusReason?: string | null; engagementScore: number;
  replyIntent: string; replyIntentSample?: string | null;
};
type ContactList = { id: string; name: string; description?: string; _count?: { members: number } };
type Template = { id: string; name: string; body: string; category: string; language: string };

function getBodyVars(body: string): number[] {
  const matches = body.match(/\{\{(\d+)\}\}/g) || [];
  return Array.from(new Set(matches.map((m) => parseInt(m.replace(/[{}]/g, ""))))).sort((a, b) => a - b);
}

function ContactsPageContent() {
  const [tab, setTab] = useState<"contacts" | "lists">("contacts");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [replyIntentFilter, setReplyIntentFilter] = useState<string | undefined>();
  const [blacklistTarget, setBlacklistTarget] = useState<Contact | null>(null);
  const [blacklistReason, setBlacklistReason] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [activeList, setActiveList] = useState<ContactList | null>(null);
  const [showAddToList, setShowAddToList] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const [showImportWizard, setShowImportWizard] = useState(false);

  // Send template state
  const [sendContact, setSendContact] = useState<Contact | null>(null);
  const [sendTemplateId, setSendTemplateId] = useState("");
  const [sendVars, setSendVars] = useState<Record<string, string>>({});

  const { selectedNumberId } = useSelectedNumber();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", search, statusFilter, replyIntentFilter, selectedNumberId],
    queryFn: () => api.get("/contacts", { params: { q: search || undefined, status: statusFilter, replyIntent: replyIntentFilter, numberId: selectedNumberId } }).then((r) => r.data),
    placeholderData: (prev) => prev,
    enabled: !!selectedNumberId,
    // Status changes (unsubscribed, Meta delivery restrictions, etc.) land via
    // a background webhook worker, not a user action in this tab -- poll so
    // they show up without a manual refresh.
    refetchInterval: 5000,
  });

  const { data: lists = [] } = useQuery<ContactList[]>({
    queryKey: ["contact-lists", selectedNumberId],
    queryFn: () => api.get("/contacts/lists/all", { params: { numberId: selectedNumberId } }).then((r) => r.data),
    enabled: !!selectedNumberId,
  });

  const { data: listContacts, isLoading: listContactsLoading } = useQuery({
    queryKey: ["contacts", "list", activeList?.id],
    queryFn: () => api.get("/contacts", { params: { listId: activeList!.id, limit: 200 } }).then((r) => r.data),
    enabled: !!activeList,
    refetchInterval: 5000,
  });

  const { data: approvedTemplates = [] } = useQuery<Template[]>({
    queryKey: ["templates-approved", selectedNumberId],
    queryFn: () => api.get("/templates", { params: { status: "APPROVED", numberId: selectedNumberId } }).then((r) => r.data.data || []),
    enabled: !!selectedNumberId,
  });

  const { register: regContact, handleSubmit: hsContact, reset: resetContact } = useForm<{ name: string; phone: string; email?: string }>();
  const { register: regList, handleSubmit: hsList, reset: resetList } = useForm<{ name: string; description?: string }>();

  const addContact = useMutation({
    mutationFn: (d: { name: string; phone: string; email?: string }) => {
      const payload: { numberId: string | null; name: string; phone: string; email?: string } = { numberId: selectedNumberId, name: d.name, phone: d.phone };
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

  const blacklistContact = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/contacts/${id}/blacklist`, { reason: reason || undefined }),
    onSuccess: () => {
      toast.success("Contact blacklisted");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setBlacklistTarget(null);
      setBlacklistReason("");
    },
    onError: () => toast.error("Failed to blacklist contact"),
  });

  const reactivateContact = useMutation({
    mutationFn: (id: string) => api.post(`/contacts/${id}/reactivate`),
    onSuccess: () => { toast.success("Contact reactivated"); qc.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: () => toast.error("Failed to reactivate contact"),
  });

  const createList = useMutation({
    mutationFn: (d: { name: string; description?: string }) => api.post("/contacts/lists", { ...d, numberId: selectedNumberId }),
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

  const sendMutation = useMutation({
    mutationFn: async ({ contact, templateId, variables }: { contact: Contact; templateId: string; variables: Record<string, string> }) => {
      const campaign = await api.post("/campaigns", {
        name: `Quick Send — ${contact.name} — ${new Date().toLocaleTimeString()}`,
        numberId: selectedNumberId,
        templateId,
        type: "ONE_TIME",
        timezone: "UTC",
        rateLimit: 60,
        contacts: [{ phone: contact.phone, variables }],
      });
      await api.post(`/campaigns/${campaign.data.id}/launch`);
    },
    onSuccess: () => {
      toast.success("Message sent!");
      setSendContact(null);
      setSendTemplateId("");
      setSendVars({});
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || "Failed to send message"),
  });

  const contacts: Contact[] = data?.data || [];
  const listContactsData: Contact[] = listContacts?.data || [];

  const [exporting, setExporting] = useState(false);
  async function exportContacts() {
    setExporting(true);
    try {
      const res = await api.get("/contacts/export", {
        params: { q: search || undefined, status: statusFilter, replyIntent: replyIntentFilter, numberId: selectedNumberId },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contacts-export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export contacts");
    } finally {
      setExporting(false);
    }
  }

  function openSendModal(c: Contact) {
    if (!selectedNumberId) { toast.error("Select a WhatsApp number from the top bar first"); return; }
    setSendContact(c);
    setSendTemplateId("");
    setSendVars({});
  }

  function selectTemplate(id: string) {
    setSendTemplateId(id);
    const tpl = approvedTemplates.find((t) => t.id === id);
    if (tpl) {
      const vars: Record<string, string> = {};
      getBodyVars(tpl.body).forEach((n) => { vars[String(n)] = ""; });
      setSendVars(vars);
    } else {
      setSendVars({});
    }
  }

  const selectedSendTemplate = approvedTemplates.find((t) => t.id === sendTemplateId);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-1">
            {selectedNumberId
              ? `${data?.total || 0} total contacts · ${lists.length} lists`
              : "Select a number from the top bar to view its contacts"}
          </p>
        </div>
        {selectedNumberId && (
          <div className="flex gap-2">
            {tab === "contacts" && (
              <button
                onClick={exportContacts}
                disabled={exporting}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-70"
              >
                <Download className="w-4 h-4" /> {exporting ? "Exporting..." : "Export"}
              </button>
            )}
            <button
              onClick={() => setShowImportWizard(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" /> Import
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
        )}
      </div>

      {!selectedNumberId && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No number selected</h3>
          <p className="text-gray-500 text-sm">Contacts belong to a specific WhatsApp number — pick one from the top bar to continue.</p>
        </div>
      )}

      {/* Tabs */}
      {selectedNumberId && (
      <>
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
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setStatusFilter(undefined)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === undefined ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                All
              </button>
              {CONTACT_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === s ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
            <select
              value={replyIntentFilter || ""}
              onChange={(e) => setReplyIntentFilter(e.target.value || undefined)}
              title="Filter by reply intent"
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Any Reply Intent</option>
              {REPLY_INTENTS.map((r) => (
                <option key={r} value={r}>{r.replace("_", " ")}</option>
              ))}
            </select>
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
              <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                    <th className="text-left px-5 py-3.5">Contact</th>
                    <th className="text-left px-5 py-3.5">Phone</th>
                    <th className="text-left px-5 py-3.5">Lists</th>
                    <th className="text-left px-5 py-3.5">Last Messaged</th>
                    <th className="text-left px-5 py-3.5">Status</th>
                    <th className="text-left px-5 py-3.5">Reply Intent</th>
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
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(c.status)}`} title={c.statusReason || undefined}>
                          {c.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(c.replyIntent)}`}
                          title={c.replyIntentSample ? `"${c.replyIntentSample}"` : "No reply classified yet"}
                        >
                          {c.replyIntent.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {c.status === "ACTIVE" && (
                            <button
                              onClick={() => openSendModal(c)}
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Send template"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {c.status === "BLACKLISTED" ? (
                            <button
                              onClick={() => reactivateContact.mutate(c.id)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Reactivate"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setBlacklistTarget(c)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Blacklist"
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          )}
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
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(c.status)}`}>{c.status.replace("_", " ")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      </>
      )}

      {/* ── SEND TEMPLATE MODAL ── */}
      {sendContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">Send Template</h2>
                <p className="text-xs text-gray-400 mt-0.5">{sendContact.name} · {sendContact.phone}</p>
              </div>
              <button onClick={() => setSendContact(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template *</label>
                {approvedTemplates.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center">No approved templates for the selected number.</p>
                ) : (
                  <select
                    value={sendTemplateId}
                    onChange={(e) => selectTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select a template...</option>
                    {approvedTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {selectedSendTemplate && getBodyVars(selectedSendTemplate.body).map((n) => (
                <div key={n}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Variable {`{{${n}}}`}</label>
                  <input
                    value={sendVars[String(n)] || ""}
                    onChange={(e) => setSendVars((prev) => ({ ...prev, [String(n)]: e.target.value }))}
                    placeholder={`Value for {{${n}}}`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}

              {selectedSendTemplate && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1.5">Preview</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedSendTemplate.body.replace(/\{\{(\d+)\}\}/g, (_, n) => sendVars[n] || `{{${n}}}`)}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSendContact(null)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  disabled={!sendTemplateId || sendMutation.isPending}
                  onClick={() => sendMutation.mutate({ contact: sendContact, templateId: sendTemplateId, variables: sendVars })}
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendMutation.isPending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BLACKLIST MODAL ── */}
      {blacklistTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">Blacklist Contact</h2>
                <p className="text-xs text-gray-400 mt-0.5">{blacklistTarget.name} · {blacklistTarget.phone}</p>
              </div>
              <button onClick={() => { setBlacklistTarget(null); setBlacklistReason(""); }}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">This contact will be excluded from all future campaigns until reactivated.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                placeholder="e.g. Repeated complaints, invalid number..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <button type="button" onClick={() => { setBlacklistTarget(null); setBlacklistReason(""); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button
                disabled={blacklistContact.isPending}
                onClick={() => blacklistContact.mutate({ id: blacklistTarget.id, reason: blacklistReason })}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-70"
              >
                {blacklistContact.isPending ? "Blacklisting..." : "Blacklist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT WIZARD ── */}
      {showImportWizard && selectedNumberId && (
        <ImportWizard
          numberId={selectedNumberId}
          onClose={() => setShowImportWizard(false)}
          onImported={() => {
            qc.invalidateQueries({ queryKey: ["contacts"] });
            qc.invalidateQueries({ queryKey: ["contact-lists"] });
          }}
        />
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
              <h2 className="font-bold text-gray-900">Add to &quot;{activeList.name}&quot;</h2>
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

export default function ContactsPage() {
  return (
    <RoleGuard minRole="AGENT">
      <ContactsPageContent />
    </RoleGuard>
  );
}
