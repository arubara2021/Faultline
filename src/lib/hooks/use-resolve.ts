

"use client";

import useSWRMutation from "swr/mutation";
import type { ApiResponse } from "@/lib/types";

interface ResolveResult {
  incidentId: string;
  resolvedAt: string;
  durationMinutes: number;
  durationFormatted: string;
  affectedServiceCount: number;
  totalRevenueImpactCents: number;
  totalRevenueImpactDollars: number;
  message: string;
}

async function resolveFetcher(
  url: string,
  { arg }: { arg: { incidentId: string } }
): Promise<ResolveResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  const body: ApiResponse<ResolveResult> = await res.json();

  if (!body.success || !body.data) {
    throw new Error(body.message ?? "Failed to resolve incident");
  }

  return body.data;
}

export function useResolve() {
  return useSWRMutation("/api/resolve", resolveFetcher);
}
