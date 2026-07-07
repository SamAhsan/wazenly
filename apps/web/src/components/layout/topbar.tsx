"use client";

import { useSession, signOut } from "next-auth/react";
import { Bell, ChevronDown, LogOut, Settings, User, Phone, CheckCircle, Menu, Building2 } from "lucide-react";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import { toast } from "sonner";
import api from "@/lib/api";
import { useSelectedNumber } from "@/contexts/number-context";

type WhatsAppNumber = { id: string; displayName: string; phoneNumber: string; status: string };
type CompanyMembership = {
  id: string;
  name: string;
  role: string;
  number: { id: string; displayName: string; phoneNumber: string; status: string } | null;
};

// Owner-only: shown instead of the plain number display when the account belongs to
// more than one company. Switching reissues a token scoped to the chosen company and
// hard-reloads, so every page, cached query, and the WebSocket connection start clean.
function CompanySwitcher({ companies, currentWorkspaceId }: { companies: CompanyMembership[]; currentWorkspaceId?: string }) {
  const { update } = useSession();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const current = companies.find((c) => c.id === currentWorkspaceId) || companies[0];

  async function switchTo(companyId: string) {
    if (companyId === currentWorkspaceId) { setOpen(false); return; }
    setSwitching(true);
    try {
      const { data } = await api.post(`/workspaces/${companyId}/switch`);
      await update({ accessToken: data.token, workspaceId: data.workspaceId, role: data.role });
      window.location.href = "/dashboard";
    } catch {
      toast.error("Failed to switch company");
      setSwitching(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-60"
      >
        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
          <Building2 className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs text-gray-400 leading-none">Active Company</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5 leading-none">
            {switching ? "Switching…" : current?.number?.displayName || current?.name || "—"}
          </p>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
            <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Switch Company</p>
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => switchTo(c.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors ${c.id === currentWorkspaceId ? "bg-primary/5" : ""}`}
              >
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.number?.displayName || c.name}</p>
                  <p className="text-xs text-gray-500">{c.number?.phoneNumber || "No number connected"}</p>
                </div>
                {c.id === currentWorkspaceId && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
type Notification = { id: string; type: string; title: string; message: string; link?: string; readAt: string | null; createdAt: string };

function NotificationBell() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => api.get("/notifications/unread-count").then((r) => r.data.count as number),
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data),
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  useEffect(() => {
    if (!session?.accessToken) return;
    const socket: Socket = io(process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:4000", {
      auth: { token: session.accessToken },
    });
    socket.on("notification:new", () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    });
    return () => { socket.disconnect(); };
  }, [session?.accessToken, queryClient]);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
        <Bell className="w-5 h-5" />
        {!!unread && unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-20 max-h-96 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              {!!unread && unread > 0 && (
                <button onClick={() => markAllReadMutation.mutate()} className="text-xs text-primary font-medium hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No notifications yet</p>
              )}
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "#"}
                  onClick={() => { if (!n.readAt) markReadMutation.mutate(n.id); setOpen(false); }}
                  className={`block px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${!n.readAt ? "bg-primary/5" : ""}`}
                >
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [numberMenuOpen, setNumberMenuOpen] = useState(false);
  const { selectedNumber, setSelectedNumberId, setNumbers } = useSelectedNumber();

  const { data: numbers = [] } = useQuery<WhatsAppNumber[]>({
    queryKey: ["numbers"],
    queryFn: () => api.get("/numbers").then((r) => r.data),
  });

  // Only ever has more than one entry for the account Owner — everyone else is invited
  // into exactly one company and should never know others exist.
  const { data: me } = useQuery<{ workspaces: CompanyMembership[] }>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
    enabled: !!session?.accessToken,
  });
  const companies = me?.workspaces || [];

  // Feed numbers into context so other components can use them
  useEffect(() => {
    if (numbers.length > 0) setNumbers(numbers);
  }, [numbers, setNumbers]);

  const connectedNumbers = numbers.filter((n) => n.status === "CONNECTED");

  // Auto-select first number if nothing is selected yet
  useEffect(() => {
    if (connectedNumbers.length > 0 && !selectedNumber) {
      setSelectedNumberId(connectedNumbers[0].id);
    }
  }, [connectedNumbers, selectedNumber, setSelectedNumberId]);

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Company selector (Owner with multiple companies) or plain number display */}
      {companies.length > 1 ? (
        <CompanySwitcher companies={companies} currentWorkspaceId={session?.workspaceId} />
      ) : (
      <div className="relative">
        {connectedNumbers.length > 0 ? (
          <button
            onClick={() => connectedNumbers.length > 1 && setNumberMenuOpen(!numberMenuOpen)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 transition-colors ${connectedNumbers.length > 1 ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"}`}
          >
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Phone className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs text-gray-400 leading-none">Active Number</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5 leading-none">
                {selectedNumber?.displayName || "—"}{" "}
                <span className="text-xs font-normal text-gray-400">{selectedNumber?.phoneNumber}</span>
              </p>
            </div>
            {connectedNumbers.length > 1 && <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 rounded-lg">
            <Phone className="w-4 h-4 text-gray-300" />
            <span className="text-sm text-gray-400 hidden sm:block">No number connected</span>
          </div>
        )}

        {numberMenuOpen && connectedNumbers.length > 1 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setNumberMenuOpen(false)} />
            <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
              <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Switch Number</p>
              {connectedNumbers.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setSelectedNumberId(n.id); setNumberMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors ${n.id === selectedNumber?.id ? "bg-primary/5" : ""}`}
                >
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{n.displayName}</p>
                    <p className="text-xs text-gray-500">{n.phoneNumber}</p>
                  </div>
                  {n.id === selectedNumber?.id && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      )}

      <div className="flex items-center gap-3">
        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {getInitials(session?.user?.name || session?.user?.email || "U")}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-gray-900 leading-none">{session?.user?.name || "User"}</p>
              <p className="text-xs text-gray-500 mt-0.5">{session?.user?.email}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
                <a href="/dashboard/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                  <User className="w-4 h-4 text-gray-400" /> Profile & Settings
                </a>
                <a href="/dashboard/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                  <Settings className="w-4 h-4 text-gray-400" /> Settings
                </a>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
