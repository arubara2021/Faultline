// ═══════════════════════════════════════════
// 17. src/lib/hooks/use-incident.ts
// ═══════════════════════════════════════════

"use client";

import useSWR from "swr";
import { config } from "@/lib/config";
import type { ApiResponse } from "@/lib/types";

interface IncidentListItem {
  id: string;
  rootFailureEventId: string;
  startedAt: string;
  resolvedAt: string | null;
  totalRevenueImpactCents: number;
  affectedServiceCount: number;
  maxDepth: number;
  resolutionNotes: string | null;
  failureType: string;
  severity: string;
  rootServiceName: string;
  rootServiceId: string;
}

interface IncidentsData {
  active: IncidentListItem | null;
  activeCount: number;
  resolvedCount: number;
  incidents: IncidentListItem[];
}

interface IncidentDetailBlastEntry {
  serviceId: string;
  serviceName: string;
  depth: number;
  classification: string;
  ownerTeam: string;
  dependencyType: string | null;
  isCustomerFacing: boolean;
  revenuePerMinCents: number;
  dependencyPath: string[];
}

interface IncidentDetailRootCause {
  serviceId: string;
  serviceName: string;
  failureType: string;
  severity: string;
  signalDetails: Record<string, unknown> | null;
  detectedAt: string;
}

interface IncidentDetailUpstream {
  serviceName: string;
  serviceId: string;
  healthStatus: string;
  depth: number;
  path: string[];
}

interface IncidentDetailData {
  incident: {
    id: string;
    startedAt: string;
    resolvedAt: string | null;
    affectedServiceCount: number;
    maxDepth: number;
  };
  rootCause: IncidentDetailRootCause;
  blastRadius: IncidentDetailBlastEntry[];
  upstreamCandidates: IncidentDetailUpstream[];
  revenueImpact: {
    totalRevenuePerMinCents: number;
  };
  customerFacingCount: number;
  depthSummary: {
    depth1: number;
    depth2: number;
    depth3Plus: number;
  };
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body: ApiResponse<T> = await res.json();

  if (!body.success || !body.data) {
    throw new Error(body.message ?? `Failed to fetch ${url}`);
  }

  return body.data;
}

export function useIncidents() {
  return useSWR("/api/incidents", (url) => fetcher<IncidentsData>(url), {
    refreshInterval: config.swr.incident,
    revalidateOnFocus: false,
  });
}

export function useIncident(id: string | null) {
  const url = id ? `/api/incidents/${id}` : null;

  return useSWR(
    url,
    (u) => fetcher<IncidentDetailData>(u),
    {
      refreshInterval: config.swr.incident,
      revalidateOnFocus: false,
    }
  );
}
