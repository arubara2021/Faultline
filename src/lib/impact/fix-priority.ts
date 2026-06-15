// ═══════════════════════════════════════════
// 8. src/lib/impact/fix-priority.ts
// ═══════════════════════════════════════════

import { db } from "../db";
import { dependencies, services } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { config } from "../config";
import type { UpstreamCandidate, FixPriority } from "../types";

export async function computeFixPriorities(
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

export async function getFixPrioritySummary(
  failedServiceId: string,
  upstreamCandidates: UpstreamCandidate[]
): Promise<string> {
  const rankings = await computeFixPriorities(
    failedServiceId,
    upstreamCandidates
  );

  if (rankings.length === 0) {
    const [svc] = await db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.id, failedServiceId))
      .limit(1);

    const name = svc?.name ?? "the failed service";
    return `Investigate ${name} directly. No upstream candidates identified — the root cause likely lies within this service.`;
  }

  const top3 = rankings.slice(0, 3);
  const lines = top3.map(
    (r, i) =>
      `${i + 1}. ${r.serviceName} (score: ${r.score}) — ${r.reasons.join(", ")}`
  );

  return ["Recommended fix priority:", ...lines].join("\n");
}
