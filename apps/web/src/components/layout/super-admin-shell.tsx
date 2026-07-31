"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, Phone, Users, BarChart3, Activity, ArrowLeftCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/super-admin", label: "Overview", icon: LayoutDashboard },
  { href: "/super-admin/companies", label: "Companies", icon: Building2 },
  { href: "/super-admin/numbers", label: "WhatsApp Numbers", icon: Phone },
  { href: "/super-admin/users", label: "Users", icon: Users },
  { href: "/super-admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/super-admin/system-health", label: "System Health", icon: Activity },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-sidebar flex-col border-r border-sidebar-border">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-sidebar-border flex-shrink-0">
          <Image src="/logo-mark.png" alt="Wazenly" width={38} height={38} className="flex-shrink-0" />
          <div>
            <span className="text-white font-bold text-lg tracking-tight block leading-tight">WAZENLY</span>
            <span className="text-amber-400 text-[11px] font-semibold tracking-wide">SUPER ADMIN</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/super-admin" ? pathname === "/super-admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive ? "bg-primary text-white" : "text-slate-400 hover:bg-sidebar-accent hover:text-white"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border flex-shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-sidebar-accent hover:text-white transition-all"
          >
            <ArrowLeftCircle className="w-4 h-4 flex-shrink-0" />
            Exit to my workspace
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
