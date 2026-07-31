"use client";

import { useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import api from "@/lib/api";

export function ImpersonationBanner() {
  const { data: session, update } = useSession();

  if (!session?.impersonating) return null;
  const { workspaceId, companyName, mode } = session.impersonating;

  async function exit() {
    try {
      await api.post("/super-admin/impersonate/exit", { workspaceId, mode });
    } catch {
      // Best-effort audit log write -- still exit locally either way.
    }
    await update({
      accessToken: session!.superAdminAccessToken,
      workspaceId: session!.superAdminWorkspaceId,
      role: session!.superAdminRole,
      impersonating: null,
      superAdminAccessToken: null,
      superAdminWorkspaceId: null,
      superAdminRole: null,
    });
    window.location.href = "/super-admin/companies";
  }

  return (
    <div className="bg-amber-500 text-white text-sm px-4 py-2 flex items-center justify-between flex-shrink-0">
      <span>
        Viewing as <strong>{companyName}</strong> — {mode === "FULL" ? "Full access" : "Read-only"}
      </span>
      <button onClick={exit} className="flex items-center gap-1.5 font-medium hover:underline">
        <LogOut className="w-3.5 h-3.5" /> Exit
      </button>
    </div>
  );
}
