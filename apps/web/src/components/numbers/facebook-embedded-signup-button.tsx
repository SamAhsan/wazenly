"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Facebook } from "lucide-react";

export interface EmbeddedSignupResult {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
}

interface WaEmbeddedSignupMessage {
  type: "WA_EMBEDDED_SIGNUP";
  event: "FINISH" | "CANCEL" | "ERROR";
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    business_id?: string;
  };
}

function isWaEmbeddedSignupMessage(data: unknown): data is WaEmbeddedSignupMessage {
  return !!data && typeof data === "object" && (data as { type?: unknown }).type === "WA_EMBEDDED_SIGNUP";
}

interface Props {
  appId: string;
  configId: string;
  apiVersion: string;
  label?: string;
  disabled?: boolean;
  onSuccess: (result: EmbeddedSignupResult) => void;
  onCancel?: () => void;
  onError?: (message: string) => void;
}

// Meta's Embedded Signup returns two pieces of data asynchronously and
// independently: FB.login()'s own callback carries the OAuth `code`, while a
// separate window.postMessage stream (type WA_EMBEDDED_SIGNUP) carries the
// waba_id/phone_number_id/business_id the customer picked in the popup. Both
// must arrive before onSuccess can fire, in either order.
export function FacebookEmbeddedSignupButton({ appId, configId, apiVersion, label = "Connect with Facebook", disabled, onSuccess, onCancel, onError }: Props) {
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const signupDataRef = useRef<{ wabaId: string; phoneNumberId: string; businessId?: string } | null>(null);
  const codeRef = useRef<string | null>(null);

  const tryFinish = useCallback(() => {
    if (codeRef.current && signupDataRef.current) {
      onSuccess({ code: codeRef.current, ...signupDataRef.current });
      setLoading(false);
      codeRef.current = null;
      signupDataRef.current = null;
    }
  }, [onSuccess]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!isWaEmbeddedSignupMessage(data)) return;

        if (data.event === "FINISH" && data.data?.waba_id && data.data?.phone_number_id) {
          signupDataRef.current = {
            wabaId: data.data.waba_id,
            phoneNumberId: data.data.phone_number_id,
            businessId: data.data.business_id,
          };
          tryFinish();
        } else if (data.event === "CANCEL") {
          setLoading(false);
          onCancel?.();
        } else if (data.event === "ERROR") {
          setLoading(false);
          onError?.("Facebook reported an error during signup.");
        }
      } catch {
        // Not JSON / not ours — ignore
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [tryFinish, onCancel, onError]);

  const handleClick = () => {
    if (!window.FB) {
      onError?.("Facebook SDK not loaded yet. Try again in a moment.");
      return;
    }
    setLoading(true);
    codeRef.current = null;
    signupDataRef.current = null;

    window.FB.login(
      (response) => {
        if (response.authResponse?.code) {
          codeRef.current = response.authResponse.code;
          tryFinish();
        } else {
          setLoading(false);
          onCancel?.();
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { sessionInfoVersion: "3" },
      }
    );
  };

  return (
    <>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="lazyOnload"
        onReady={() => {
          window.fbAsyncInit = () => {
            window.FB!.init({ appId, version: apiVersion, xfbml: false, autoLogAppEvents: true });
            setSdkReady(true);
          };
          if (window.FB) window.fbAsyncInit();
        }}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading || !sdkReady}
        className="flex items-center justify-center gap-2 bg-[#1877F2] text-white px-4 py-2.5 rounded-lg hover:bg-[#166fe5] transition-colors text-sm font-medium disabled:opacity-60"
      >
        <Facebook className="w-4 h-4" />
        {loading ? "Connecting..." : !sdkReady ? "Loading..." : label}
      </button>
    </>
  );
}
