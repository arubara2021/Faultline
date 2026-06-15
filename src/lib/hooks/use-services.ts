// ═══════════════════════════════════════════
// 20. src/lib/hooks/use-services.ts
// ═══════════════════════════════════════════

"use client";

import useSWR from "swr";
import { config } from "@/lib/config";
import type { ApiResponse } from "@/lib/types";

interface ServiceEntry {
  id: string;
  name: string;
  ownerTeam: string;
  classification: string;
  healthStatus: string;
  lastHealthCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ServiceSummary {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
}

interface ServicesData {
  services: ServiceEntry[];
  summary: ServiceSummary;
}

async function servicesFetcher(url: string): Promise<ServicesData> {
  const res = await fetch(url);
  const body: ApiResponse<ServicesData> = await res.json();

  if (!body.success || !body.data) {
    throw new Error(body.message ?? "Failed to fetch services");
  }

  return body.data;
}

export function useServices() {
  return useSWR("/api/services", servicesFetcher, {
    refreshInterval: config.swr.services,
    revalidateOnFocus: false,
  });
}
