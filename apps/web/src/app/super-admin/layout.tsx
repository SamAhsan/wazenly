import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SuperAdminShell } from "@/components/layout/super-admin-shell";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.isSuperAdmin) redirect("/dashboard/403");

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
