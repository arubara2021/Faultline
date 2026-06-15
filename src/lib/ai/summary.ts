// ═══════════════════════════════════════════
// 10. src/lib/ai/summary.ts
// ═══════════════════════════════════════════

import { config } from "../config";
import type { BlastRadiusEntry, UpstreamCandidate } from "../types";

export interface IncidentSummaryInput {
  incident: {
    id: string;
    startedAt: Date;
    resolvedAt: Date | null;
    affectedServiceCount: number;
    maxDepth: number;
  };
  rootCause: {
    serviceName: string;
    failureType: string;
    severity: string;
    signalDetails: Record<string, unknown> | null;
  };
  blastRadius: Array<{
    serviceName: string;
    depth: number;
    classification: string;
    ownerTeam: string;
    dependencyType: string;
    isCustomerFacing: boolean;
    revenuePerMinCents: number;
  }>;
  upstreamCandidates: UpstreamCandidate[];
  revenueImpact: {
    totalRevenuePerMinCents: number;
    minutesElapsed: number;
    totalAccumulatedImpactCents: number;
  };
}

export interface IncidentSummaryOutput {
  headline: string;
  whatHappened: string;
  rootCauseAnalysis: string;
  blastRadiusSummary: string;
  revenueImpactSummary: string;
  fixPriority: string;
  fullSummary: string;
}

function describeFailureType(failureType: string): string {
  switch (failureType) {
    case "health_check":
      return "health check failures";
    case "error_spike":
      return "elevated error rates";
    case "latency_degradation":
      return "latency degradation";
    default:
      return failureType;
  }
}

function describeSeverity(severity: string): string {
  switch (severity) {
    case "down":
      return "unavailable";
    case "degraded":
      return "experiencing degraded performance";
    default:
      return severity;
  }
}

function interpretSignalDetails(
  details: Record<string, unknown> | null
): string {
  if (!details) return "";

  const parts: string[] = [];

  if (details.connection_pool === "exhausted") {
    const active = details.active_connections;
    const max = details.max_connections;
    if (active !== undefined && max !== undefined) {
      parts.push(
        `Connection pool exhausted (${active}/${max} active connections)`
      );
    } else {
      parts.push("Connection pool exhausted");
    }
  }

  if (typeof details.multiplier === "string") {
    parts.push(`latency at ${details.multiplier} above threshold`);
  }

  if (typeof details.avg_query_time === "string") {
    parts.push(`average query time: ${details.avg_query_time}`);
  }

  if (
    details.current_rate !== undefined &&
    details.baseline !== undefined
  ) {
    parts.push(
      `error rate at ${Number(details.current_rate).toFixed(4)} vs baseline ${Number(details.baseline).toFixed(4)}`
    );
  }

  if (details.reachable === false) {
    parts.push("service unreachable");
  }

  if (details.previous_status && details.current_status) {
    parts.push(
      `status changed from ${details.previous_status} to ${details.current_status}`
    );
  }

  return parts.join("; ");
}

function rankSummaryFixPriorities(
  upstreamCandidates: UpstreamCandidate[],
  blastRadius: IncidentSummaryInput["blastRadius"]
): Array<{ serviceName: string; reason: string; score: number }> {
  const rankings: Array<{
    serviceName: string;
    reason: string;
    score: number;
  }> = [];

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

    const sharedDependents = blastRadius.filter(
      (b) => b.depth === 1 && b.dependencyType !== "http_call"
    ).length;
    score += sharedDependents * config.fixPriority.sharedDependentMultiplier;
    if (sharedDependents > config.fixPriority.sharedDependentThreshold) {
      reasons.push(
        `shared dependency for ${sharedDependents} affected services`
      );
    }

    rankings.push({
      serviceName: candidate.serviceName,
      reason: reasons.join(", "),
      score,
    });
  }

  rankings.sort((a, b) => b.score - a.score);
  return rankings;
}

function formatElapsedMinutes(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded > 60) {
    return `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
  }
  return `${rounded}m`;
}

export function generateIncidentSummary(
  input: IncidentSummaryInput
): IncidentSummaryOutput {
  const {
    incident,
    rootCause,
    blastRadius,
    upstreamCandidates,
    revenueImpact,
  } = input;

  const customerFacing = blastRadius.filter((b) => b.isCustomerFacing);
  const depth1 = blastRadius.filter((b) => b.depth === 1);
  const depth2 = blastRadius.filter((b) => b.depth === 2);
  const depth3Plus = blastRadius.filter((b) => b.depth >= 3);

  const elapsedLabel = formatElapsedMinutes(revenueImpact.minutesElapsed);
  const revenuePerMin = (revenueImpact.totalRevenuePerMinCents / 100).toFixed(
    2
  );
  const totalImpact = (
    revenueImpact.totalAccumulatedImpactCents / 100
  ).toFixed(2);
  const totalAffected = blastRadius.length + 1;
  const statusLabel = incident.resolvedAt ? "resolved" : "active";
  const severityTag = rootCause.severity === "down" ? "CRITICAL" : "WARNING";
  const signalInterpretation = interpretSignalDetails(rootCause.signalDetails);

  const headline = `${severityTag}: ${rootCause.serviceName} — ${describeFailureType(rootCause.failureType)} affecting ${totalAffected} services`;

  const whatHappened = [
    `${rootCause.serviceName} is ${describeSeverity(rootCause.severity)}.`,
    `Failure type: ${rootCause.failureType}.`,
    signalInterpretation ? `Signal: ${signalInterpretation}.` : "",
    `Incident has been ${statusLabel} for ${elapsedLabel}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const rootCauseAnalysis = (() => {
    if (upstreamCandidates.length === 0) {
      return `${rootCause.serviceName} appears to be the root cause. No degraded upstream dependencies were found, suggesting the issue originates within this service.`;
    }

    const rankings = rankSummaryFixPriorities(upstreamCandidates, blastRadius);
    const topCandidate = rankings[0];

    if (topCandidate) {
      return `The most likely upstream cause is ${topCandidate.serviceName} (${topCandidate.reason}). Upstream traversal found ${upstreamCandidates.length} degraded or down dependencies.`;
    }

    return `Upstream analysis found ${upstreamCandidates.length} potentially contributing services.`;
  })();

  const topCustomerFacing = [...customerFacing]
    .sort((a, b) => b.revenuePerMinCents - a.revenuePerMinCents)
    .slice(0, config.summary.maxCustomerFacingHighlights);

  const blastRadiusSummary = [
    `${totalAffected} total services affected across ${incident.maxDepth} dependency levels.`,
    `${depth1.length} direct dependents at depth 1, ${depth2.length} at depth 2${depth3Plus.length > 0 ? `, ${depth3Plus.length} at depth 3+` : ""}.`,
    `${customerFacing.length} customer-facing services impacted.`,
    topCustomerFacing.length > 0
      ? `Most impacted: ${topCustomerFacing.map((s) => `${s.serviceName} ($${(s.revenuePerMinCents / 100).toFixed(0)}/min)`).join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const revenueImpactSummary = [
    `Estimated revenue loss: $${revenuePerMin}/min.`,
    `Total accumulated impact: $${totalImpact} over {elapsedLabel}.`,
    customerFacing.length > 0
      ? `${customerFacing.length} customer-facing services are losing revenue: ${customerFacing.map((s) => s.serviceName).join(", ")}.`
      : "No customer-facing services are directly affected.",
  ].join(" ");

  const fixPriorities = rankSummaryFixPriorities(
    upstreamCandidates,
    blastRadius
  );

  const fixPriority = (() => {
    if (fixPriorities.length === 0) {
      const signalHint = signalInterpretation
        ? ` Signal indicates: ${signalInterpretation}.`
        : "";
      return `Investigate ${rootCause.serviceName} directly. No upstream candidates identified — the root cause likely lies within this service.${signalHint}`;
    }

    const top3 = fixPriorities.slice(0, 3);
    return [
      "Recommended fix priority:",
      ...top3.map(
        (p, i) => `${i + 1}. ${p.serviceName} — ${p.reason}`
      ),
    ].join(" ");
  })();

  const fullSummary = [
    whatHappened,
    rootCauseAnalysis,
    blastRadiusSummary,
    revenueImpactSummary,
    fixPriority,
  ].join(" ");

  return {
    headline,
    whatHappened,
    rootCauseAnalysis,
    blastRadiusSummary,
    revenueImpactSummary,
    fixPriority,
    fullSummary,
  };
}
