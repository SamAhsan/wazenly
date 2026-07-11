"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import api from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Image src="/logo-mark.png" alt="Wazenly" width={40} height={40} />
            <span className="text-2xl font-bold text-white tracking-tight">WAZENLY</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-5">If an account exists for {email}, you&apos;ll receive a password reset link.</p>
              <Link href="/auth/login" className="text-primary hover:underline text-sm font-medium">Back to sign in</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Reset password</h2>
              <p className="text-gray-500 text-sm mb-5">Enter your email and we&apos;ll send a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
                <button type="submit" disabled={loading} className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600 disabled:opacity-70">
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
              <Link href="/auth/login" className="flex items-center justify-center gap-1 mt-5 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
