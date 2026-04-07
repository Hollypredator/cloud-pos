"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { hydrateQuerySnapshots } from "@/lib/pos/snapshot-cache";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      });

      hydrateQuerySnapshots(client);
      return client;
    },
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
