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

  if (details.current_rate !== undefined && details.baseline !== undefined) {
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

function buildBedrockPrompt(input: IncidentSummaryInput): string {
  const {
    incident,
    rootCause,
    blastRadius,
    upstreamCandidates,
    revenueImpact,
  } = input;

  const customerFacing = blastRadius.filter((b) => b.isCustomerFacing);
  const totalAffected = blastRadius.length + 1;
  const elapsedLabel = formatElapsedMinutes(revenueImpact.minutesElapsed);
  const revenuePerMin = (revenueImpact.totalRevenuePerMinCents / 100).toFixed(2);
  const totalImpact = (revenueImpact.totalAccumulatedImpactCents / 100).toFixed(2);
  const signalInterpretation = interpretSignalDetails(rootCause.signalDetails);
  const statusLabel = incident.resolvedAt ? "resolved" : "active";

  const blastByDepth = blastRadius.reduce(
    (acc, b) => {
      acc[b.depth] = (acc[b.depth] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>
  );

  const topRevenueServices = [...blastRadius]
    .filter((b) => b.isCustomerFacing)
    .sort((a, b) => b.revenuePerMinCents - a.revenuePerMinCents)
    .slice(0, 5)
    .map((b) => `  - ${b.serviceName}: $${(b.revenuePerMinCents / 100).toFixed(0)}/min (depth {b.depth}, team: ${b.ownerTeam})`)
    .join("\n");

  const upstreamList = upstreamCandidates
    .map((u) => `  - ${u.serviceName} (depth ${u.depth}, status: ${u.healthStatus})`)
    .join("\n");

  const depthBreakdown = Object.entries(blastByDepth)
    .map(([d, c]) => `depth ${d}: ${c} services`)
    .join(", ");

  return `You are an SRE incident analysis AI. Given the following incident data, generate a structured JSON summary.

INCIDENT DATA:
- Incident ID: ${incident.id}
- Status: ${statusLabel}
- Duration: ${elapsedLabel}
- Started: ${new Date(incident.startedAt).toISOString()}
- Total services affected: ${totalAffected} (1 root cause service + ${blastRadius.length} downstream)
  - Root cause service: ${rootCause.serviceName} (counted as 1)
  - Downstream blast radius: ${blastRadius.length} services
  - Customer-facing services impacted: ${customerFacing.length}
- Max dependency depth: ${incident.maxDepth}

ROOT CAUSE SERVICE:
- Service: ${rootCause.serviceName}
- Failure type: ${rootCause.failureType}
- Severity: ${rootCause.severity}
${signalInterpretation ? `- Signal details: ${signalInterpretation}` : ""}

BLAST RADIUS (downstream only, does NOT include root cause):
- By depth: ${depthBreakdown}
- Customer-facing services impacted: ${customerFacing.length}
${topRevenueServices ? `- Top revenue-impacting services:\n${topRevenueServices}` : "- No customer-facing services directly impacted"}

UPSTREAM CANDIDATES:
${upstreamList || "  No upstream candidates found"}

REVENUE IMPACT:
- Revenue loss rate: $$$${revenuePerMin}/min
- Total accumulated impact: $${totalImpact} over {elapsedLabel}

IMPORTANT: When writing the headline and whatHappened sections, use the exact total count of ${totalAffected} services. Do NOT invent or guess a different number. The root cause service "${rootCause.serviceName}" plus ${blastRadius.length} downstream services equals exactly ${totalAffected} total.

Respond with ONLY a valid JSON object (no markdown, no code fences) with these exact keys:
{
  "headline": "One-line severity + service + failure type + exact affected count (e.g., affecting ${totalAffected} services)",
  "whatHappened": "2-3 sentence description of what happened",
  "rootCauseAnalysis": "2-3 sentence root cause analysis with upstream reasoning",
  "blastRadiusSummary": "2-3 sentence blast radius breakdown by depth and customer impact",
  "revenueImpactSummary": "2-3 sentence revenue impact with specific numbers",
  "fixPriority": "1-3 sentence recommended fix priority with ranked actions"
}`;
}

function parseNovaResponse(raw: string): IncidentSummaryOutput | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```/, "");
    }

    const parsed = JSON.parse(cleaned);

    if (
      typeof parsed.headline === "string" &&
      typeof parsed.whatHappened === "string" &&
      typeof parsed.rootCauseAnalysis === "string" &&
      typeof parsed.blastRadiusSummary === "string" &&
      typeof parsed.revenueImpactSummary === "string" &&
      typeof parsed.fixPriority === "string"
    ) {
      const whatHappened = cleanAIText(parsed.whatHappened);
      const rootCauseAnalysis = cleanAIText(parsed.rootCauseAnalysis);
      const blastRadiusSummary = cleanAIText(parsed.blastRadiusSummary);
      const revenueImpactSummary = cleanAIText(parsed.revenueImpactSummary);
      const fixPriority = cleanAIText(parsed.fixPriority);

      return {
        headline: parsed.headline.replace(/\*\*/g, ""),
        whatHappened,
        rootCauseAnalysis,
        blastRadiusSummary,
        revenueImpactSummary,
        fixPriority,
        fullSummary: [
          whatHappened,
          rootCauseAnalysis,
          blastRadiusSummary,
          revenueImpactSummary,
          fixPriority,
        ].join(" "),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function formatDollarsInText(text: string): string {
  return text.replace(/\$[\d,]+\.?\d*/g, (match) => {
    const num = parseFloat(match.replace(/[$,]/g, ""));
    if (isNaN(num)) return match;
    if (num >= 1_000_000) return `$$$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}k`;
    return `$${num.toFixed(0)}`;
  });
}

function cleanAIText(text: string): string {
  let cleaned = text.replace(/\*\*/g, "");
  cleaned = cleaned.replace(/^[-*]\s+/gm, "");
  cleaned = formatDollarsInText(cleaned);
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

async function summarizeWithBedrock(
  input: IncidentSummaryInput
): Promise<IncidentSummaryOutput | null> {
  if (!config.bedrock.enabled) return null;

  const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK!;
  const { region, modelId, timeoutMs, maxTokens, temperature } = config.bedrock;

  const prompt = buildBedrockPrompt(input);

  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;

  let body: string;
  if (modelId.includes("nova")) {
    body = JSON.stringify({
      inferenceConfig: { max_new_tokens: maxTokens, temperature },
      messages: [{ role: "user", content: [{ text: prompt }] }],
    });
  } else if (modelId.includes("anthropic") || modelId.includes("claude")) {
    body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "user", content: prompt }],
    });
  } else if (modelId.includes("mistral")) {
    body = JSON.stringify({
      prompt,
      max_tokens: maxTokens,
      temperature,
    });
  } else {
    body = JSON.stringify({
      inferenceConfig: { max_new_tokens: maxTokens, temperature },
      messages: [{ role: "user", content: [{ text: prompt }] }],
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();

    let text = "";

    if (modelId.includes("nova")) {
      text = data?.output?.message?.content?.[0]?.text ?? "";
    } else if (modelId.includes("anthropic") || modelId.includes("claude")) {
      text = data?.content?.[0]?.text ?? "";
    } else if (modelId.includes("mistral")) {
      text = data?.outputs?.[0]?.text ?? "";
    } else {
      text =
        data?.output?.message?.content?.[0]?.text ??
        data?.content?.[0]?.text ??
        data?.outputs?.[0]?.text ??
        "";
    }

    if (!text) return null;

    return parseNovaResponse(text);
  } catch {
    return null;
  }
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

  const headline = customerFacing.length > 0
    ? `${severityTag}: ${rootCause.serviceName} — ${describeFailureType(rootCause.failureType)} affecting ${customerFacing.length} customer-facing ${customerFacing.length === 1 ? "service" : "services"}`
    : `${severityTag}: ${rootCause.serviceName} — ${describeFailureType(rootCause.failureType)} affecting ${totalAffected} services`;

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
    `Total accumulated impact: $${totalImpact} over ${elapsedLabel}.`,
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

function fixHeadlineCount(
  output: IncidentSummaryOutput,
  blastRadiusLength: number
): IncidentSummaryOutput {
  const totalAffected = blastRadiusLength + 1;

  let headline = output.headline;
  headline = headline.replace(
    /affecting \d+ services?/i,
    "affecting " + totalAffected + " services"
  );

  let whatHappened = output.whatHappened;
  whatHappened = whatHappened.replace(
    /affected a total of \d+ services?/i,
    "affected a total of " + totalAffected + " services"
  );
  whatHappened = whatHappened.replace(
    /\d+ downstream services?/i,
    blastRadiusLength + " downstream services"
  );
  whatHappened = whatHappened.replace(
    /cascading impact on \d+ downstream services?/i,
    "cascading impact on " + blastRadiusLength + " downstream services"
  );
  whatHappened = whatHappened.replace(
    /cascading effect on \d+ downstream services?/i,
    "cascading effect on " + blastRadiusLength + " downstream services"
  );
  whatHappened = whatHappened.replace(
    /cascading failures across \d+ downstream services?/i,
    "cascading failures across " + blastRadiusLength + " downstream services"
  );

  const fullSummary = [
    whatHappened,
    output.rootCauseAnalysis,
    output.blastRadiusSummary,
    output.revenueImpactSummary,
    output.fixPriority,
  ].join(" ");

  return {
    ...output,
    headline,
    whatHappened,
    fullSummary,
  };
}

export async function generateAISummary(
  input: IncidentSummaryInput
): Promise<IncidentSummaryOutput> {
  const bedrockResult = await summarizeWithBedrock(input);
  if (bedrockResult) {
    return fixHeadlineCount(bedrockResult, input.blastRadius.length);
  }
  return generateIncidentSummary(input);
}