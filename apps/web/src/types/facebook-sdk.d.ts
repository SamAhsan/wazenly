export {};

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (params: { appId: string; version: string; autoLogAppEvents?: boolean; xfbml?: boolean }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string }; status?: string }) => void,
        options: {
          config_id: string;
          response_type: "code";
          override_default_response_type: true;
          extras?: { setup?: object; featureType?: string; sessionInfoVersion?: string };
        }
      ) => void;
    };
  }
}
