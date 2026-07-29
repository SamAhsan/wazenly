"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { signIn, getProviders } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Eye, EyeOff, Facebook, Loader2, ShieldCheck } from "lucide-react";
import { ChatPreview } from "@/components/marketing/ChatPreview";
import { useFacebookSdk } from "@/hooks/useFacebookSdk";
import api from "@/lib/api";

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
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbConfig, setFbConfig] = useState<{ configured: boolean; appId: string | null; configId: string | null; apiVersion: string } | null>(null);
  const sdkReady = useFacebookSdk(fbConfig?.configured ? fbConfig.appId : null, fbConfig?.apiVersion || "v18.0");
  // Set once Facebook's exchange succeeds but doesn't return an email (this
  // app's Login configuration has no email scope) -- prompts an inline
  // "type your email" step instead of failing the sign-in outright.
  const [fbPendingToken, setFbPendingToken] = useState<string | null>(null);
  const [fbEmailInput, setFbEmailInput] = useState("");
  // Meta's Embedded Signup returns two pieces of data asynchronously and
  // independently: FB.login()'s own callback carries the OAuth `code`, while
  // a separate window.postMessage stream (type WA_EMBEDDED_SIGNUP) carries
  // the waba_id/phone_number_id the user picked in the popup. Both must
  // arrive before we call the backend, in either order.
  const codeRef = useRef<string | null>(null);
  const signupDataRef = useRef<{ wabaId: string; phoneNumberId: string } | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    getProviders().then((providers) => {
      if (providers?.google) setGoogleAvailable(true);
    });
    api.get("/auth/facebook-config").then((r) => setFbConfig(r.data)).catch(() => {});
  }, []);

  const facebookAvailable = !!fbConfig?.configured;

  function handleGoogleLogin() {
    setGoogleLoading(true);
    signIn("google", { callbackUrl: destination });
  }

  // Completes the sign-in once both FB.login()'s code and (if the user
  // completed the number-picker step) the WA_EMBEDDED_SIGNUP postMessage
  // data have arrived -- kept as a plain async function called from (not
  // passed as) the FB.login() callback below, since Facebook's SDK does a
  // strict type check that rejects an async function passed directly as the
  // callback ("Expression is of type asyncfunction, not function").
  const completeFacebookSignIn = useCallback(async (code: string, signupData: { wabaId: string; phoneNumberId: string } | null) => {
    try {
      const result = await signIn("facebook-sdk", {
        code,
        wabaId: signupData?.wabaId,
        phoneNumberId: signupData?.phoneNumberId,
        redirect: false,
      });
      if (result?.error?.startsWith("NEEDS_EMAIL:")) {
        setFbPendingToken(result.error.slice("NEEDS_EMAIL:".length));
        toast.info("Facebook didn't share an email with us — enter yours below to finish signing up.");
      } else if (result?.error === "NEEDS_VERIFICATION") {
        toast.success("Account created! Check your email to verify, then sign in.");
      } else if (result?.error === "EMAIL_EXISTS") {
        toast.error("An account with this email already exists. Please sign in with your password instead.");
      } else if (result?.error) {
        toast.error("Facebook sign-in failed. Please try again.");
      } else {
        toast.success("Welcome!");
        router.push("/dashboard/numbers");
      }
    } finally {
      setFbLoading(false);
    }
  }, [router]);

  // Fires once at least the code has arrived. If the postMessage step hasn't
  // landed yet (e.g. genuinely absent because the user backed out of the
  // number picker), a short grace period lets it catch up before proceeding
  // without it -- login shouldn't hang forever waiting for a signal that may
  // never come.
  const tryFinishFacebookLogin = useCallback(() => {
    if (!codeRef.current) return;
    const code = codeRef.current;
    const signupData = signupDataRef.current;
    codeRef.current = null;
    signupDataRef.current = null;
    void completeFacebookSignIn(code, signupData);
  }, [completeFacebookSignIn]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!data || data.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event === "FINISH" && data.data?.waba_id && data.data?.phone_number_id) {
          signupDataRef.current = { wabaId: data.data.waba_id, phoneNumberId: data.data.phone_number_id };
          if (codeRef.current) tryFinishFacebookLogin();
        }
      } catch {
        // Not JSON / not ours — ignore
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [tryFinishFacebookLogin]);

  async function completeWithEmail() {
    if (!fbPendingToken || !fbEmailInput) return;
    setFbLoading(true);
    try {
      const result = await signIn("facebook-sdk", { pendingToken: fbPendingToken, email: fbEmailInput, redirect: false });
      if (result?.error === "NEEDS_VERIFICATION") {
        toast.success("Account created! Check your email to verify, then sign in.");
        setFbPendingToken(null);
        setFbEmailInput("");
      } else if (result?.error === "EMAIL_EXISTS") {
        toast.error("An account with this email already exists. Please sign in with your password instead.");
      } else if (result?.error) {
        toast.error("Something went wrong. Please try again.");
      } else {
        toast.success("Welcome!");
        router.push("/dashboard/numbers");
      }
    } finally {
      setFbLoading(false);
    }
  }

  function handleFacebookLogin() {
    if (!window.FB) {
      toast.error("Facebook SDK not loaded yet. Try again in a moment.");
      return;
    }
    setFbLoading(true);
    codeRef.current = null;
    signupDataRef.current = null;
    window.FB.login(
      (response) => {
        if (!response.authResponse?.code) {
          setFbLoading(false);
          return;
        }
        codeRef.current = response.authResponse.code;
        if (signupDataRef.current) {
          tryFinishFacebookLogin();
        } else {
          // Give the WA_EMBEDDED_SIGNUP postMessage a couple seconds to catch
          // up in case it hasn't landed yet, then proceed with just the code.
          setTimeout(tryFinishFacebookLogin, 2000);
        }
      },
      {
        config_id: fbConfig!.configId!,
        response_type: "code",
        override_default_response_type: true,
        extras: { version: "v4" },
      }
    );
  }

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
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0B3D2E] items-center justify-center p-12 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-32 -left-20 w-[30rem] h-[30rem] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[24rem] h-[24rem] rounded-full bg-emerald-400/10 blur-[120px]" />
        </div>

        <div className="relative max-w-md">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Link href="/" className="flex items-center gap-2.5 mb-10">
              <Image src="/logo-mark.png" alt="Wazenly" width={40} height={40} />
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
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-[#F7FAF8]">
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
                className="flat-input w-full px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
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
                  className="flat-input w-full px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-primary/20"
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

          {(googleAvailable || (facebookAvailable && !inviteToken)) && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="space-y-3">
                {googleAvailable && (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {googleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.27-2.09 3.57-5.17 3.57-8.84z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.89-3.02c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
                        <path fill="#FBBC05" d="M5.31 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.4-2.31V6.6H1.29A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.29 5.4l4.02-3.09z" />
                        <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l4.02 3.09C6.25 6.87 8.89 4.77 12 4.77z" />
                      </svg>
                    )}
                    Continue with Google
                  </button>
                )}

                {facebookAvailable && !inviteToken && !fbPendingToken && (
                  <button
                    type="button"
                    onClick={handleFacebookLogin}
                    disabled={fbLoading || !sdkReady}
                    className="w-full flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#166fe5] text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-60"
                  >
                    <Facebook className="w-4 h-4" /> {fbLoading ? "Connecting..." : !sdkReady ? "Loading..." : "Continue with Facebook"}
                  </button>
                )}

                {fbPendingToken && (
                  <div className="p-3 border border-gray-200 rounded-xl space-y-2">
                    <p className="text-xs text-gray-500">Facebook didn&apos;t share an email with us. Enter yours to finish signing up:</p>
                    <input
                      type="email"
                      value={fbEmailInput}
                      onChange={(e) => setFbEmailInput(e.target.value)}
                      placeholder="you@company.com"
                      className="flat-input w-full px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={completeWithEmail}
                      disabled={fbLoading || !fbEmailInput}
                      className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-60"
                    >
                      {fbLoading ? "Continuing..." : "Continue"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {inviteToken ? (
            <p className="text-center text-sm text-gray-500 mt-8">
              Don&apos;t have an account yet?{" "}
              <Link href={`/auth/register?invite=${inviteToken}`} className="text-primary font-medium hover:underline">Create one to accept your invite</Link>
            </p>
          ) : googleAvailable || facebookAvailable ? (
            <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
              Don&apos;t have an account? Signing in above creates one automatically.
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
