"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { api, links } from "./client.ts";

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  // Polling drives everything, so refetching on focus as well would double
  // the traffic for nothing.
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }),
  );
  const [trpcClient] = useState(() => api.createClient({ links: links() }));

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}
