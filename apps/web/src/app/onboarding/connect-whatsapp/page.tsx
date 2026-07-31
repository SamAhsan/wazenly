"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Facebook, Loader2, MessageCircle } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useFacebookSdk } from "@/hooks/useFacebookSdk";

interface WaEmbeddedSignupMessage {
  type: "WA_EMBEDDED_SIGNUP";
  event: "FINISH" | "CANCEL" | "ERROR";
  data?: { phone_number_id?: string; waba_id?: string; business_id?: string };
}

function isWaEmbeddedSignupMessage(data: unknown): data is WaEmbeddedSignupMessage {
  return !!data && typeof data === "object" && (data as { type?: unknown }).type === "WA_EMBEDDED_SIGNUP";
}

export default function ConnectWhatsAppPage() {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [fbConfig, setFbConfig] = useState<{ configured: boolean; appId: string | null; configId: string | null; apiVersion: string } | null>(null);
  const sdkReady = useFacebookSdk(fbConfig?.configured ? fbConfig.appId : null, fbConfig?.apiVersion || "v18.0");

  // App A's Embedded Signup returns two pieces of data asynchronously and
  // independently: FB.login()'s own callback carries the OAuth `code`, while
  // a separate window.postMessage stream (type WA_EMBEDDED_SIGNUP) carries
  // the waba_id/phone_number_id/business_id the user picked in the popup.
  // Both must arrive before we call the backend, in either order.
  const codeRef = useRef<string | null>(null);
  const signupDataRef = useRef<{ wabaId: string; phoneNumberId: string; businessId?: string } | null>(null);

  // If the workspace already has a number (e.g. this page got revisited),
  // there's nothing to do here — skip straight to the dashboard.
  const { data: numbers, isLoading: checkingNumbers } = useQuery({
    queryKey: ["numbers"],
    queryFn: () => api.get("/numbers").then((r) => r.data),
  });
  useEffect(() => {
    if (numbers && numbers.length > 0) router.replace("/dashboard/onboarding");
  }, [numbers, router]);

  useEffect(() => {
    api.get("/auth/facebook-config").then((r) => setFbConfig(r.data)).catch(() => {});
  }, []);

  const finishConnect = useCallback(async () => {
    if (!codeRef.current || !signupDataRef.current) return;
    const code = codeRef.current;
    const signupData = signupDataRef.current;
    codeRef.current = null;
    signupDataRef.current = null;
    try {
      await api.post("/numbers/connect-embedded-signup", {
        code,
        wabaId: signupData.wabaId,
        phoneNumberId: signupData.phoneNumberId,
        businessId: signupData.businessId,
      });
      toast.success("WhatsApp number connected!");
      router.push("/dashboard/onboarding");
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Could not connect the number. Please try again.";
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  }, [router]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!isWaEmbeddedSignupMessage(data)) return;
        if (data.event === "FINISH" && data.data?.waba_id && data.data?.phone_number_id) {
          signupDataRef.current = { wabaId: data.data.waba_id, phoneNumberId: data.data.phone_number_id, businessId: data.data.business_id };
          if (codeRef.current) void finishConnect();
        } else if (data.event === "CANCEL" || data.event === "ERROR") {
          setConnecting(false);
        }
      } catch {
        // Not JSON / not ours — ignore
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [finishConnect]);

  function handleConnect() {
    if (!window.FB) {
      toast.error("Facebook SDK not loaded yet. Try again in a moment.");
      return;
    }
    setConnecting(true);
    codeRef.current = null;
    signupDataRef.current = null;
    window.FB.login(
      (response) => {
        if (!response.authResponse?.code) {
          setConnecting(false);
          return;
        }
        codeRef.current = response.authResponse.code;
        if (signupDataRef.current) void finishConnect();
      },
      {
        config_id: fbConfig!.configId!,
        response_type: "code",
        override_default_response_type: true,
        extras: { version: "v4" },
      }
    );
  }

  if (checkingNumbers || (numbers && numbers.length > 0)) return null;

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center max-w-md w-full">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Connect your WhatsApp number</h1>
        <p className="text-gray-500 text-sm mb-6">
          You&apos;re signed in. One more step — connect a WhatsApp Business number through Meta to start sending and receiving messages.
        </p>

        {fbConfig?.configured ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting || !sdkReady}
            className="w-full flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#166fe5] text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-60"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Facebook className="w-4 h-4" />}
            {connecting ? "Connecting..." : !sdkReady ? "Loading..." : "Connect with Facebook"}
          </button>
        ) : (
          <p className="text-sm text-red-500">WhatsApp Embedded Signup isn&apos;t configured yet. Contact your administrator.</p>
        )}

        <Link href="/dashboard" className="block text-xs text-gray-400 hover:text-gray-600 mt-4">
          Skip for now
        </Link>
      </div>
    </div>
  );
}
