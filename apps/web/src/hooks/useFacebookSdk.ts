"use client";

import { useEffect, useState } from "react";

let sdkPromise: Promise<void> | null = null;

function loadSdk(appId: string, apiVersion: string): Promise<void> {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve) => {
      window.fbAsyncInit = () => {
        window.FB!.init({ appId, version: apiVersion, xfbml: false, autoLogAppEvents: true });
        resolve();
      };
      if (window.FB) {
        window.fbAsyncInit();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      document.body.appendChild(script);
    });
  }
  return sdkPromise;
}

// Shared by the login page's Facebook button and the WhatsApp Embedded Signup
// button -- both need window.FB initialized with the same appId/apiVersion
// before calling FB.login(), and the SDK script should only ever load once
// per page regardless of how many callers ask for it.
export function useFacebookSdk(appId: string | null, apiVersion: string): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!appId) return;
    let cancelled = false;
    loadSdk(appId, apiVersion).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [appId, apiVersion]);

  return ready;
}
