"use client";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import type { ApiResponse, SimulateResult } from "@/lib/types";

interface SimulateTarget {
  id: string;
  name: string;
  classification: string;
  ownerTeam: string;
}

interface SimulateTargetsData {
  services: SimulateTarget[];
  defaultTarget: string;
  usage: Record<string, unknown>;
}

async function targetsFetcher(url: string): Promise<SimulateTargetsData> {
  const res = await fetch(url);
  const body: ApiResponse<SimulateTargetsData> = await res.json();
  if (!body.success || !body.data) {
    throw new Error(body.message ?? "Failed to load simulation targets");
  }
  return body.data;
}

/** Lists services that can be used as a failure-injection target. */
export function useSimulateTargets() {
  return useSWR("/api/simulate", targetsFetcher, {
    revalidateOnFocus: false,
  });
}

async function simulateFetcher(
  url: string,
  { arg }: { arg: { serviceName: string; reset?: boolean } }
): Promise<SimulateResult & { message: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  const body: ApiResponse<SimulateResult & { message: string }> =
    await res.json();
  if (!body.success || !body.data) {
    throw new Error(body.message ?? "Failed to simulate failure");
  }
  return body.data;
}

/** Injects a failure for the given service and triggers cascade detection. */
export function useSimulate() {
  return useSWRMutation("/api/simulate", simulateFetcher);
}
