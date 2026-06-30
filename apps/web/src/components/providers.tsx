"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";

function WorkspaceSyncer() {
  const { data: session } = useSession();
  useEffect(() => {
    if (session?.workspaceId) {
      localStorage.setItem("workspaceId", session.workspaceId);
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
