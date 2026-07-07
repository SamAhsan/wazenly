"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import api from "@/lib/api";

function VerifyEmailContent() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    api
      .post("/auth/verify-email", { token: params.token })
      .then(() => {
        setStatus("success");
        // Carry the invite token forward so login lands on /invite/[token] and
        // actually completes joining the workspace, instead of a plain dashboard
        // redirect that leaves the account with no workspace at all.
        const loginUrl = inviteToken ? `/auth/login?invite=${inviteToken}` : "/auth/login";
        setTimeout(() => router.push(loginUrl), 2500);
      })
      .catch(() => setStatus("error"));
  }, [params.token, inviteToken, router]);

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
          {status === "loading" && <p className="text-gray-500 text-sm">Verifying your email…</p>}
          {status === "success" && (
            <>
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Email verified!</h2>
              <p className="text-gray-500 text-sm">Redirecting you to sign in…</p>
            </>
          )}
          {status === "error" && (
            <>
              <p className="text-red-600 font-medium mb-4">This verification link is invalid or has expired.</p>
              <Link href="/auth/resend-verification" className="text-primary hover:underline text-sm font-medium">
                Request a new verification email
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
