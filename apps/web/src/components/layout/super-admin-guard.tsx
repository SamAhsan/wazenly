"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const authorized = !!session?.isSuperAdmin;

  useEffect(() => {
    if (status === "authenticated" && !authorized) router.replace("/dashboard/403");
  }, [status, authorized, router]);

  if (status === "loading" || !authorized) return null;
  return <>{children}</>;
}
