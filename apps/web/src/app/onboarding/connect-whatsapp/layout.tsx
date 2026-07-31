import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ConnectWhatsAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.workspaceId) redirect("/auth/login");

  return <div className="min-h-screen bg-[#F7FAF8]">{children}</div>;
}
