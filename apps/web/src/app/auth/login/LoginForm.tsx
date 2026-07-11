"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { ChatPreview } from "@/components/marketing/ChatPreview";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const destination = inviteToken ? `/invite/${inviteToken}` : "/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error === "EMAIL_NOT_VERIFIED") {
        toast.error("Please verify your email before signing in.", {
          action: { label: "Resend email", onClick: () => router.push("/auth/resend-verification") },
        });
      } else if (result?.error) {
        toast.error("Invalid email or password. Please try again.");
      } else {
        toast.success("Welcome back!");
        router.push(destination);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: brand panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0f1117] items-center justify-center p-12 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-20 w-[30rem] h-[30rem] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[24rem] h-[24rem] rounded-full bg-blue-500/5 blur-[120px]" />
        </div>

        <div className="relative max-w-md">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Link href="/" className="flex items-center gap-2.5 mb-10">
              <Image src="/logo-mark.png" alt="Wazenly" width={32} height={32} />
              <span className="text-xl font-bold text-white tracking-tight">WAZENLY</span>
            </Link>
            <h2 className="text-3xl font-bold text-white tracking-tight leading-tight text-balance">
              Business messaging, run like an enterprise.
            </h2>
            <p className="mt-4 text-white/50 leading-relaxed">
              Campaigns, a shared team inbox, automation, and analytics — all on the official WhatsApp Business API.
            </p>
            <div className="mt-6 flex items-center gap-2 text-white/40 text-sm">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Enterprise-grade security, on official Meta infrastructure
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-12"
          >
            <ChatPreview />
          </motion.div>
        </div>
      </div>

      {/* Right: form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 neu-surface">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
            <Image src="/logo-mark.png" alt="Wazenly" width={32} height={32} />
            <span className="text-xl font-bold text-gray-900 tracking-tight">WAZENLY</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1.5">{inviteToken ? "Accept your invitation" : "Welcome back"}</h1>
          <p className="text-sm text-gray-500 mb-8">{inviteToken ? "Sign in to continue accepting your invite." : "Sign in to your Wazenly workspace."}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                {...register("email")}
                type="email"
                placeholder="you@company.com"
                className="neu-input w-full px-4 py-3 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="neu-input w-full px-4 py-3 pr-10 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input {...register("remember")} type="checkbox" className="w-4 h-4 rounded accent-primary" />
              Remember me
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-600 text-white font-semibold py-3 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Sign In"}
            </button>
          </form>

          {inviteToken ? (
            <p className="text-center text-sm text-gray-500 mt-8">
              Don&apos;t have an account yet?{" "}
              <Link href={`/auth/register?invite=${inviteToken}`} className="text-primary font-medium hover:underline">Create one to accept your invite</Link>
            </p>
          ) : (
            <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
              Don&apos;t have an account? Please contact the Wazenly administrator to request access.
              Public self-registration is not available.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading…</div>}>
      <LoginFormInner />
    </Suspense>
  );
}
