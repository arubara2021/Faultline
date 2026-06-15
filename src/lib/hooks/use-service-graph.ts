// ═══════════════════════════════════════════
// 19. src/lib/hooks/use-service-graph.ts
// ═══════════════════════════════════════════

"use client";

import useSWR from "swr";
import { config } from "@/lib/config";
import type { ApiResponse, GraphNode, GraphEdge } from "@/lib/types";

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    nodeCount: number;
    edgeCount: number;
  };
}

async function graphFetcher(url: string): Promise<GraphData> {
  const res = await fetch(url);
  const body: ApiResponse<GraphData> = await res.json();

  if (!body.success || !body.data) {
    throw new Error(body.message ?? "Failed to fetch dependency graph");
  }

  return body.data;
}

export function useServiceGraph() {
  return useSWR("/api/graph", graphFetcher, {
    refreshInterval: config.swr.graph,
    revalidateOnFocus: false,
  });
}
  