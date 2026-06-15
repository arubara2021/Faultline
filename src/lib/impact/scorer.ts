// ═══════════════════════════════════════════
// 7. src/lib/impact/scorer.ts
// ═══════════════════════════════════════════

import { db } from "../db";
import {
  incidents,
  blastRadiusResults,
  services,
  currentTrafficSnapshots,
  failureEvents,
  dependencies,
} from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { traverseUpstream } from "../graph/traversal";
import { config } from "../config";
import type { UpstreamCandidate, FixPriority } from "../types";

export interface RevenueImpactResult {
  incidentId: string;
  totalRevenuePerMinCents: number;
  minutesElapsed: number;
  totalAccumulatedImpactCents: number;
  affectedCustomerFacingServices: Array<{
    serviceName: string;
    serviceId: string;
    depth: number;
    revenuePerMinCents: number;
    avgRequestsPerMin: number;
    conversionRate: number;
    avgOrderValueCents: number;
  }>;
  fixPriorities: FixPriority[];
}

export async function rankFixPriorities(
  failedServiceId: string,
  upstreamCandidates: UpstreamCandidate[]
): Promise<FixPriority[]> {
  if (upstreamCandidates.length === 0) return [];

  const sharedDependentCounts = new Map<string, number>();

  for (const candidate of upstreamCandidates) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dependencies)
      .where(
        and(
          eq(dependencies.targetServiceId, candidate.serviceId),
          sql`${dependencies.confidenceScore} >= ${config.minConfidenceScore}`
        )
      );

    sharedDependentCounts.set(candidate.serviceId, row?.count ?? 0);
  }

  const rankings: FixPriority[] = [];

  for (const candidate of upstreamCandidates) {
    let score = 0;
    const reasons: string[] = [];

    if (candidate.healthStatus === "down") {
      score += config.fixPriority.downWeight;
      reasons.push("currently down");
    } else if (candidate.healthStatus === "degraded") {
      score += config.fixPriority.degradedWeight;
      reasons.push("currently degraded");
    }

    const depthBonus = Math.max(
      0,
      config.fixPriority.maxDepthBonus -
        candidate.depth * config.fixPriority.depthDecay
    );
    score += depthBonus;
    if (candidate.depth === 1) {
      reasons.push("direct upstream dependency");
    }

    const sharedDeps = sharedDependentCounts.get(candidate.serviceId) ?? 0;
    score += sharedDeps * config.fixPriority.sharedDependentMultiplier;
    if (sharedDeps > config.fixPriority.sharedDependentThreshold) {
      reasons.push(`shared dependency for ${sharedDeps} services`);
    }

    rankings.push({
      serviceName: candidate.serviceName,
      serviceId: candidate.serviceId,
      healthStatus: candidate.healthStatus,
      depth: candidate.depth,
      score,
      reasons,
    });
  }

  rankings.sort((a, b) => b.score - a.score);
  return rankings;
}

export async function calculateRevenueImpact(
  incidentId: string
): Promise<RevenueImpactResult> {
  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1);

  if (!incident) {
    throw new Error(`Incident not found: ${incidentId}`);
  }

  if (incident.resolvedAt) {
    const totalImpact = incident.totalRevenueImpactCents ?? 0;
    const elapsed =
      (incident.resolvedAt.getTime() - incident.startedAt.getTime()) /
      (1000 * 60);

    return {
      incidentId,
      totalRevenuePerMinCents: 0,
      minutesElapsed: Math.round(elapsed * 100) / 100,
      totalAccumulatedImpactCents: totalImpact,
      affectedCustomerFacingServices: [],
      fixPriorities: [],
    };
  }

  const affectedServices = await db
    .select({
      serviceName: services.name,
      serviceId: services.id,
      depth: blastRadiusResults.depth,
      revenuePerMinCents: currentTrafficSnapshots.revenuePerMinCents,
      avgRequestsPerMin: currentTrafficSnapshots.avgRequestsPerMin,
      conversionRate: currentTrafficSnapshots.conversionRate,
      avgOrderValueCents: currentTrafficSnapshots.avgOrderValueCents,
    })
    .from(blastRadiusResults)
    .innerJoin(
      services,
      eq(blastRadiusResults.affectedServiceId, services.id)
    )
    .innerJoin(
      currentTrafficSnapshots,
      eq(services.id, currentTrafficSnapshots.serviceId)
    )
    .where(
      and(
        eq(blastRadiusResults.incidentId, incidentId),
        eq(services.classification, "customer-facing")
      )
    )
    .orderBy(blastRadiusResults.depth);

  const totalRevenuePerMin = affectedServices.reduce(
    (sum, svc) => sum + (svc.revenuePerMinCents ?? 0),
    0
  );

  const now = new Date();
  const minutesElapsed =
    (now.getTime() - incident.startedAt.getTime()) / (1000 * 60);
  const totalAccumulatedImpact = Math.round(
    totalRevenuePerMin * minutesElapsed
  );

  await db
    .update(incidents)
    .set({ totalRevenueImpactCents: totalAccumulatedImpact })
    .where(eq(incidents.id, incidentId));

  let fixPriorities: FixPriority[] = [];

  try {
    const [rootFailure] = await db
      .select()
      .from(failureEvents)
      .where(eq(failureEvents.id, incident.rootFailureEventId))
      .limit(1);

    if (rootFailure) {
      const upstreamCandidates = await traverseUpstream(
        rootFailure.serviceId
      );
      fixPriorities = await rankFixPriorities(
        rootFailure.serviceId,
        upstreamCandidates
      );
    }
  } catch (error) {
    console.error("[SCORER] Failed to compute fix priorities:", error);
  }

  return {
    incidentId,
    totalRevenuePerMinCents: totalRevenuePerMin,
    minutesElapsed: Math.round(minutesElapsed * 100) / 100,
    totalAccumulatedImpactCents: totalAccumulatedImpact,
    affectedCustomerFacingServices: affectedServices.map((svc) => ({
      serviceName: svc.serviceName,
      serviceId: svc.serviceId,
      depth: svc.depth,
      revenuePerMinCents: svc.revenuePerMinCents ?? 0,
      avgRequestsPerMin: parseFloat(svc.avgRequestsPerMin ?? "0"),
      conversionRate: parseFloat(svc.conversionRate ?? "0"),
      avgOrderValueCents: svc.avgOrderValueCents ?? 0,
    })),
    fixPriorities,
  };
}

export async function getActiveIncidentImpact(): Promise<RevenueImpactResult | null> {
  const [activeIncident] = await db
    .select()
    .from(incidents)
    .where(sql`${incidents.resolvedAt} IS NULL`)
    .orderBy(sql`${incidents.startedAt} DESC`)
    .limit(1);

  if (!activeIncident) return null;

  return calculateRevenueImpact(activeIncident.id);
}

export function formatCurrency(cents: number): string {
  const dollars = cents / 100;

  if (dollars >= 1_000_000) {
    return `$$$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (dollars >= 1_000) {
    return `$${(dollars / 1_000).toFixed(1)}K`;
  }
  return `$${dollars.toFixed(2)}`;
}
