"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { MS_PER_SECOND } from "@/lib/time";

// Job data only changes when a crawl lands, so a short window avoids
// refetching on every remount without hiding a fresh crawl for long.
const STALE_TIME_SECONDS = 30;
const STALE_TIME_MS = STALE_TIME_SECONDS * MS_PER_SECOND;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME_MS,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
