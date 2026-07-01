"use client";

import { useSession, signOut } from "next-auth/react";
import { Bell, ChevronDown, LogOut, Settings, User, Phone, CheckCircle, Menu } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useSelectedNumber } from "@/contexts/number-context";

type WhatsAppNumber = { id: string; displayName: string; phoneNumber: string; status: string };

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [numberMenuOpen, setNumberMenuOpen] = useState(false);
  const { selectedNumber, setSelectedNumberId, setNumbers } = useSelectedNumber();

  const { data: numbers = [] } = useQuery<WhatsAppNumber[]>({
    queryKey: ["numbers"],
    queryFn: () => api.get("/numbers").then((r) => r.data),
  });

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

      {/* Number selector */}
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

      <div className="flex items-center gap-3">
        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

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
