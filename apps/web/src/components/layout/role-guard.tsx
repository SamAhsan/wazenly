"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { hasMinRole, type Role } from "@/lib/permissions";

export function RoleGuard({ minRole, children }: { minRole: Role; children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const authorized = hasMinRole(session?.role, minRole);

  useEffect(() => {
    if (status === "authenticated" && !authorized) router.replace("/dashboard/403");
  }, [status, authorized, router]);

  if (status === "loading" || !authorized) return null;
  return <>{children}</>;
}
