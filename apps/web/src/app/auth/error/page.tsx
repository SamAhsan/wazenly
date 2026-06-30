"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageCircle, AlertCircle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The sign in link has expired or has already been used.",
  OAuthSignin: "Could not sign in with this provider.",
  OAuthCallback: "Could not complete sign in. Please try again.",
  OAuthCreateAccount: "Could not create account with this provider.",
  EmailCreateAccount: "Could not create account with this email.",
  Callback: "There was a problem during sign in.",
  Default: "An unexpected error occurred during sign in.",
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";
  const message = ERROR_MESSAGES[error] || ERROR_MESSAGES.Default;

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-red-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in failed</h2>
      <p className="text-gray-500 text-sm mb-6">{message}</p>
      <Link
        href="/auth/login"
        className="inline-block bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600"
      >
        Back to sign in
      </Link>
    </div>
  );
}

export default function AuthErrorPage() {
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
        <Suspense fallback={<div className="bg-white rounded-2xl shadow-2xl p-8 text-center text-gray-400">Loading…</div>}>
          <AuthErrorContent />
        </Suspense>
      </div>
    </div>
  );
}
