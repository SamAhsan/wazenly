"use client";

import { useState } from "react";
import { NumberProvider } from "@/contexts/number-context";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NumberProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </NumberProvider>
  );
}
