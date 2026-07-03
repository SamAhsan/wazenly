"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";

// sessionStorage, not localStorage — this must stay scoped to one browser tab.
// localStorage is shared across every tab of the origin, so logging into a
// second account in another tab would silently redirect this tab's API
// requests to that other workspace.
function WorkspaceSyncer() {
  const { data: session } = useSession();
  useEffect(() => {
    if (session?.workspaceId) {
      sessionStorage.setItem("workspaceId", session.workspaceId);
    }
  }, [session?.workspaceId]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
  }));

  return (
    <SessionProvider>
      <WorkspaceSyncer />
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
