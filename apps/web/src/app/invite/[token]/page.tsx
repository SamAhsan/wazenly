"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import api from "@/lib/api";

interface InvitationPreview {
  email: string;
  role: string;
  workspaceName: string;
  inviterName: string;
  expired: boolean;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/invitations/${token}`)
      .then((r) => setPreview(r.data))
      .catch(() => setLoadError(true));
  }, [token]);

  useEffect(() => {
    // acceptError guards against retrying forever: NextAuth's SessionProvider refetches
    // the session on window focus, which hands us a new `session` object on every
    // focus and would otherwise re-fire this effect and re-attempt a doomed request.
    if (status !== "authenticated" || !preview || preview.expired || accepting || acceptError) return;
    if (session?.user?.email?.toLowerCase() !== preview.email.toLowerCase()) return;

    setAccepting(true);
    api
      .post(`/invitations/${token}/accept`)
      .then((r) => {
        sessionStorage.setItem("workspaceId", r.data.workspace.id);
        toast.success(`You've joined ${preview.workspaceName}`);
        router.push("/dashboard");
      })
      .catch((err) => {
        setAcceptError(err.response?.data?.error || "Failed to accept invitation.");
        setAccepting(false);
      });
  }, [status, session, preview, token, accepting, acceptError, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">WAZENLY</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          {loadError && (
            <p className="text-red-600 font-medium">This invitation link is invalid.</p>
          )}
          {!loadError && !preview && <p className="text-gray-500 text-sm">Loading invitation…</p>}
          {preview?.expired && (
            <p className="text-red-600 font-medium">This invitation has expired or was already used.</p>
          )}
          {preview && !preview.expired && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Join {preview.workspaceName}</h2>
              <p className="text-gray-500 text-sm mb-6">
                {preview.inviterName} invited you to join <strong>{preview.workspaceName}</strong> as a <strong>{preview.role}</strong>.
              </p>

              {status === "authenticated" && acceptError && (
                <div className="space-y-3">
                  <p className="text-red-600 text-sm">{acceptError}</p>
                  <Link
                    href={`/auth/login?invite=${token}`}
                    className="block w-full bg-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600"
                  >
                    Log in again
                  </Link>
                </div>
              )}

              {status === "authenticated" && !acceptError && session?.user?.email?.toLowerCase() === preview.email.toLowerCase() && (
                <p className="text-gray-500 text-sm">{accepting ? "Joining workspace…" : "Signing you in…"}</p>
              )}

              {status === "authenticated" && !acceptError && session?.user?.email?.toLowerCase() !== preview.email.toLowerCase() && (
                <p className="text-amber-600 text-sm">
                  You&apos;re signed in as {session?.user?.email}, but this invite was sent to {preview.email}. Sign out and try again.
                </p>
              )}

              {status === "unauthenticated" && (
                <div className="space-y-2">
                  <Link
                    href={`/auth/login?invite=${token}`}
                    className="block w-full bg-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600"
                  >
                    Log in to accept
                  </Link>
                  <Link
                    href={`/auth/register?invite=${token}`}
                    className="block w-full border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50"
                  >
                    Create account to accept
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
