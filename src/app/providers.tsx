"use client";

import { SWRConfig } from "swr";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        shouldRetryOnError: true,
        errorRetryCount: 3,
        dedupingInterval: 3000,
        refreshInterval: 0,
      }}
    >
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </SWRConfig>
  );
}