"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, MessageSquare, Megaphone, Users, FileText,
  Workflow, Phone, BarChart3, Settings, MessageCircle, ChevronRight, X, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasMinRole, type Role } from "@/lib/permissions";

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; minRole?: Role }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone, minRole: "MANAGER" },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users, minRole: "AGENT" },
  { href: "/dashboard/templates", label: "Templates", icon: FileText, minRole: "AGENT" },
  { href: "/dashboard/flows", label: "Flows", icon: Workflow, minRole: "MANAGER" },
  { href: "/dashboard/numbers", label: "Numbers", icon: Phone, minRole: "MANAGER" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, minRole: "ADMIN" },
  { href: "/dashboard/admin/diagnostics", label: "Diagnostics", icon: Activity, minRole: "OWNER" },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const visibleNavItems = navItems.filter((item) => !item.minRole || hasMinRole(session?.role, item.minRole));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">WAZENLY</span>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1 text-slate-400 hover:text-white"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-primary text-white"
                  : "text-slate-400 hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom info */}
      <div className="p-4 border-t border-sidebar-border flex-shrink-0">
        <div className="bg-sidebar-accent rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">WhatsApp Cloud API</p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-xs text-white font-medium">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-sidebar flex-col border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile drawer — overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 w-72 bg-sidebar z-50 flex flex-col border-r border-sidebar-border lg:hidden">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}
