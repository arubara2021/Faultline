// ═══════════════════════════════════════════
// 2. src/lib/graph/traversal.ts
// ═══════════════════════════════════════════

import { db } from "../db";
import {
  services,
  dependencies,
  currentTrafficSnapshots,
} from "../db/schema";

interface ServiceInfo {
  id: string;
  name: string;
  classification: string;
  ownerTeam: string;
  healthStatus: string;
}

interface AdjacencyEntry {
  serviceId: string;
  depType: string;
}

export interface DownstreamEntry {
  serviceName: string;
  serviceId: string;
  depth: number;
  classification: string;
  ownerTeam: string;
  dependencyType: string;
  isCustomerFacing: boolean;
  revenuePerMinCents: number;
  path: string[];
}

export interface UpstreamEntry {
  serviceName: string;
  serviceId: string;
  healthStatus: string;
  depth: number;
  path: string[];
}

interface GraphCache {
  services: Map<string, ServiceInfo>;
  downstream: Map<string, AdjacencyEntry[]>;
  upstream: Map<string, AdjacencyEntry[]>;
  snapshots: Map<string, number>;
  rawDeps: Array<{
    id: string;
    sourceServiceId: string;
    targetServiceId: string;
    dependencyType: string;
    confidenceScore: string;
  }>;
  loadedAt: number;
}

let graphCache: GraphCache | null = null;
const CACHE_TTL_MS = 2000;

async function loadGraph(): Promise<GraphCache> {
  const now = Date.now();
  if (graphCache && now - graphCache.loadedAt < CACHE_TTL_MS) {
    return graphCache;
  }

  const [allServices, allDeps, allSnapshots] = await Promise.all([
    db
      .select({
        id: services.id,
        name: services.name,
        classification: services.classification,
        ownerTeam: services.ownerTeam,
        healthStatus: services.healthStatus,
      })
      .from(services),
    db
      .select({
        id: dependencies.id,
        sourceServiceId: dependencies.sourceServiceId,
        targetServiceId: dependencies.targetServiceId,
        dependencyType: dependencies.dependencyType,
        confidenceScore: dependencies.confidenceScore,
      })
      .from(dependencies),
    db
      .select({
        serviceId: currentTrafficSnapshots.serviceId,
        revenuePerMinCents: currentTrafficSnapshots.revenuePerMinCents,
      })
      .from(currentTrafficSnapshots),
  ]);

  const serviceMap = new Map<string, ServiceInfo>();
  for (const s of allServices) {
    serviceMap.set(s.id, {
      id: s.id,
      name: s.name,
      classification: s.classification,
      ownerTeam: s.ownerTeam,
      healthStatus: s.healthStatus,
    });
  }

  const snapshotMap = new Map<string, number>();
  for (const s of allSnapshots) {
    snapshotMap.set(s.serviceId, Number(s.revenuePerMinCents) || 0);
  }

  const downstreamAdj = new Map<string, AdjacencyEntry[]>();
  const upstreamAdj = new Map<string, AdjacencyEntry[]>();

  for (const dep of allDeps) {
    if (!downstreamAdj.has(dep.targetServiceId)) {
      downstreamAdj.set(dep.targetServiceId, []);
    }
    downstreamAdj.get(dep.targetServiceId)!.push({
      serviceId: dep.sourceServiceId,
      depType: dep.dependencyType,
    });

    if (!upstreamAdj.has(dep.sourceServiceId)) {
      upstreamAdj.set(dep.sourceServiceId, []);
    }
    upstreamAdj.get(dep.sourceServiceId)!.push({
      serviceId: dep.targetServiceId,
      depType: dep.dependencyType,
    });
  }

  graphCache = {
    services: serviceMap,
    downstream: downstreamAdj,
    upstream: upstreamAdj,
    snapshots: snapshotMap,
    rawDeps: allDeps.map((d) => ({
      id: d.id,
      sourceServiceId: d.sourceServiceId,
      targetServiceId: d.targetServiceId,
      dependencyType: d.dependencyType,
      confidenceScore: d.confidenceScore ?? "0.000",
    })),
    loadedAt: now,
  };

  return graphCache;
}

export function invalidateGraphCache(): void {
  graphCache = null;
}

function reconstructPath(
  parentMap: Map<string, string>,
  targetId: string,
  rootId: string
): string[] {
  const path: string[] = [targetId];
  let current = targetId;
  while (current !== rootId && parentMap.has(current)) {
    current = parentMap.get(current)!;
    path.unshift(current);
  }
  if (path[0] !== rootId) {
    path.unshift(rootId);
  }
  return path;
}

export async function traverseDownstream(
  rootServiceId: string
): Promise<DownstreamEntry[]> {
  const graph = await loadGraph();

  const visited = new Set<string>([rootServiceId]);
  const parentMap = new Map<string, string>();
  const edgeTypeMap = new Map<string, string>();
  const depthMap = new Map<string, number>([[rootServiceId, 0]]);
  const queue: string[] = [rootServiceId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depthMap.get(current)!;
    const dependents = graph.downstream.get(current) ?? [];

    for (const dep of dependents) {
      if (!visited.has(dep.serviceId)) {
        visited.add(dep.serviceId);
        parentMap.set(dep.serviceId, current);
        edgeTypeMap.set(dep.serviceId, dep.depType);
        depthMap.set(dep.serviceId, currentDepth + 1);
        queue.push(dep.serviceId);
      }
    }
  }

  const results: DownstreamEntry[] = [];

  for (const [serviceId, depth] of depthMap) {
    if (serviceId === rootServiceId) continue;

    const svc = graph.services.get(serviceId);
    if (!svc) continue;

    results.push({
      serviceName: svc.name,
      serviceId,
      depth,
      classification: svc.classification,
      ownerTeam: svc.ownerTeam,
      dependencyType: edgeTypeMap.get(serviceId) ?? "unknown",
      isCustomerFacing: svc.classification === "customer-facing",
      revenuePerMinCents: graph.snapshots.get(serviceId) ?? 0,
      path: reconstructPath(parentMap, serviceId, rootServiceId),
    });
  }

  results.sort((a, b) => a.depth - b.depth || a.serviceName.localeCompare(b.serviceName));
  return results;
}

export async function traverseUpstream(
  rootServiceId: string
): Promise<UpstreamEntry[]> {
  const graph = await loadGraph();

  const visited = new Set<string>([rootServiceId]);
  const parentMap = new Map<string, string>();
  const depthMap = new Map<string, number>([[rootServiceId, 0]]);
  const queue: string[] = [rootServiceId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depthMap.get(current)!;
    const deps = graph.upstream.get(current) ?? [];

    for (const dep of deps) {
      if (!visited.has(dep.serviceId)) {
        visited.add(dep.serviceId);
        parentMap.set(dep.serviceId, current);
        depthMap.set(dep.serviceId, currentDepth + 1);
        queue.push(dep.serviceId);
      }
    }
  }

  const results: UpstreamEntry[] = [];

  for (const [serviceId, depth] of depthMap) {
    if (serviceId === rootServiceId) continue;

    const svc = graph.services.get(serviceId);
    if (!svc) continue;

    results.push({
      serviceName: svc.name,
      serviceId,
      healthStatus: svc.healthStatus,
      depth,
      path: reconstructPath(parentMap, serviceId, rootServiceId),
    });
  }

  results.sort((a, b) => a.depth - b.depth);
  return results;
}

export async function getSharedStateDependents(
  failedServiceId: string,
  downstreamEntries: DownstreamEntry[]
): Promise<DownstreamEntry[]> {
  const graph = await loadGraph();

  const downstreamIds = new Set(downstreamEntries.map((e) => e.serviceId));
  downstreamIds.add(failedServiceId);

  const sharedStateTargets = new Set<string>();
  for (const dep of graph.rawDeps) {
    if (
      dep.sourceServiceId === failedServiceId &&
      dep.dependencyType === "database_access"
    ) {
      sharedStateTargets.add(dep.targetServiceId);
    }
  }

  if (sharedStateTargets.size === 0) return [];

  const results: DownstreamEntry[] = [];

  for (const dep of graph.rawDeps) {
    if (
      dep.dependencyType === "database_access" &&
      sharedStateTargets.has(dep.targetServiceId) &&
      !downstreamIds.has(dep.sourceServiceId) &&
      dep.sourceServiceId !== failedServiceId
    ) {
      const svc = graph.services.get(dep.sourceServiceId);
      if (!svc) continue;

      results.push({
        serviceName: svc.name,
        serviceId: svc.id,
        depth: 1,
        classification: svc.classification,
        ownerTeam: svc.ownerTeam,
        dependencyType: dep.dependencyType,
        isCustomerFacing: svc.classification === "customer-facing",
        revenuePerMinCents: graph.snapshots.get(svc.id) ?? 0,
        path: [failedServiceId, dep.targetServiceId, svc.id],
      });
    }
  }

  return results;
}

export async function getFullGraph() {
  const graph = await loadGraph();

  const nodes = Array.from(graph.services.values()).map((svc) => ({
    id: svc.id,
    name: svc.name,
    classification: svc.classification,
    healthStatus: svc.healthStatus,
    ownerTeam: svc.ownerTeam,
  }));

  const edges = graph.rawDeps.map((dep) => ({
    id: dep.id,
    sourceServiceId: dep.sourceServiceId,
    targetServiceId: dep.targetServiceId,
    dependencyType: dep.dependencyType,
    confidenceScore: dep.confidenceScore,
  }));

  return {
    nodes,
    edges,
    meta: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
  };
}
