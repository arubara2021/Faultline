"use client";

import useSWR from "swr";
import type { ApiResponse } from "@/lib/types";

export interface IncidentSummaryData {
  incident: {
    id: string;
    status: "active" | "resolved";
    startedAt: string;
    minutesElapsed: number;
  };
  rootCause: {
    serviceName: string;
    failureType: string;
    severity: string;
    signalDetails: Record<string, unknown> | null;
  };
  impact: {
    totalServicesAffected: number;
    customerFacingAffected: number;
    revenuePerMinCents: number;
    revenuePerMinDollars: number;
    totalAccumulatedImpactCents: number;
    totalAccumulatedImpactDollars: number;
  };
  cascade: {
    depth1: string[];
    depth2: string[];
    depth3Plus: string[];
  };
  ai: {
    headline: string;
    whatHappened: string;
    rootCauseAnalysis: string;
    blastRadiusSummary: string;
    revenueImpactSummary: string;
    fixPriority: string;
  };
  summary: string;
  upstreamCandidates: Array<{
    serviceName: string;
    serviceId: string;
    healthStatus: string;
    depth: number;
    path: string[];
  }>;
}

async function summaryFetcher(
  url: string,
  incidentId: string
): Promise<IncidentSummaryData> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incidentId }),
  });
  const body: ApiResponse<IncidentSummaryData> = await res.json();
  if (!body.success || !body.data) {
    throw new Error(body.message ?? "Failed to generate summary");
  }
  return body.data;
}

/** Fetches the AI-generated incident summary for a given incident id. */
export function useIncidentSummary(incidentId: string | null) {
  return useSWR(
    incidentId ? ["/api/summary", incidentId] : null,
    ([url, id]) => summaryFetcher(url, id),
    { revalidateOnFocus: false, refreshInterval: 15_000 }
  );
}
