import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import {
  incidents,
  failureEvents,
  services,
  blastRadiusResults,
  currentTrafficSnapshots,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { traverseUpstream } from "@/lib/graph/traversal";
import {
  generateAISummary,
  type IncidentSummaryInput,
} from "@/lib/ai/summary";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function err(status: number, error: string, message: string) {
  return NextResponse.json({ success: false, error, message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return err(400, "INVALID_JSON", "Invalid JSON body");
    }

    const { incidentId } = body as { incidentId?: string };

    if (!incidentId || typeof incidentId !== "string") {
      return err(400, "MISSING_INCIDENT_ID", "incidentId is required");
    }
    if (!UUID_RE.test(incidentId)) {
      return err(400, "INVALID_UUID", "Invalid incident ID format");
    }

    const [incident] = await withDbRetry(() =>
      db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1)
    );
    if (!incident) return err(404, "NOT_FOUND", "Incident not found");

    const [rootFailure] = await withDbRetry(() =>
      db
        .select()
        .from(failureEvents)
        .where(eq(failureEvents.id, incident.rootFailureEventId))
        .limit(1)
    );
    if (!rootFailure) return err(404, "ROOT_CAUSE_NOT_FOUND", "Root failure event not found");

    const [failedService] = await withDbRetry(() =>
      db
        .select()
        .from(services)
        .where(eq(services.id, rootFailure.serviceId))
        .limit(1)
    );
    if (!failedService) return err(404, "SERVICE_NOT_FOUND", "Failed service not found");

    const [blastResults, allServices, allSnapshots, upstreamCandidates] =
      await withDbRetry(() =>
        Promise.all([
          db
            .select()
            .from(blastRadiusResults)
            .where(eq(blastRadiusResults.incidentId, incident.id)),
          db.select().from(services),
          db.select().from(currentTrafficSnapshots),
          traverseUpstream(rootFailure.serviceId),
        ])
      );

    const serviceMap = new Map(allServices.map((s) => [s.id, s]));

    const blastRadius = blastResults
      .map((br) => {
        const svc = serviceMap.get(br.affectedServiceId);
        return {
          serviceName: svc?.name ?? "unknown",
          depth: br.depth,
          classification: svc?.classification ?? "unknown",
          ownerTeam: svc?.ownerTeam ?? "unknown",
          dependencyType: br.dependencyType,
          isCustomerFacing: br.isCustomerFacing,
          revenuePerMinCents: Number(br.revenuePerMinCents) || 0,
        };
      })
      .sort((a, b) => a.depth - b.depth);

    const customerFacing = blastRadius.filter((b) => b.isCustomerFacing);
    const totalRevenuePerMinCents = customerFacing.reduce(
      (sum, b) => sum + b.revenuePerMinCents,
      0
    );
    const totalRevenuePerMinDollars = totalRevenuePerMinCents / 100;

    const now = new Date();
    const startedAt = new Date(incident.startedAt);
    const minutesElapsed =
      Math.round(((now.getTime() - startedAt.getTime()) / 60000) * 10) / 10;

    const totalAccumulatedImpactCents = Math.round(
      totalRevenuePerMinCents * minutesElapsed
    );
    const totalAccumulatedImpactDollars =
      Math.round((totalAccumulatedImpactCents / 100) * 100) / 100;

    const affectedCount = incident.affectedServiceCount ?? blastRadius.length + 1;
    const maxDepth =
      blastRadius.length > 0
        ? Math.max(...blastRadius.map((b) => b.depth))
        : 0;

    const depth1Names = blastRadius
      .filter((b) => b.depth === 1)
      .map((b) => b.serviceName);
    const depth2Names = blastRadius
      .filter((b) => b.depth === 2)
      .map((b) => b.serviceName);
    const depth3PlusNames = blastRadius
      .filter((b) => b.depth >= 3)
      .map((b) => b.serviceName);

    const serviceName = failedService.name;

    const aiInput: IncidentSummaryInput = {
      incident: {
        id: incident.id,
        startedAt: new Date(incident.startedAt),
        resolvedAt: incident.resolvedAt ? new Date(incident.resolvedAt) : null,
        affectedServiceCount: affectedCount,
        maxDepth,
      },
      rootCause: {
        serviceName,
        failureType: rootFailure.failureType,
        severity: rootFailure.severity,
        signalDetails: (rootFailure.signalDetails ?? null) as Record<
          string,
          unknown
        > | null,
      },
      blastRadius,
      upstreamCandidates,
      revenueImpact: {
        totalRevenuePerMinCents,
        minutesElapsed,
        totalAccumulatedImpactCents,
      },
    };

    const aiSummary = await generateAISummary(aiInput);

    return NextResponse.json(
      {
        success: true,
        data: {
          incident: {
            id: incident.id,
            status: incident.resolvedAt ? "resolved" : "active",
            startedAt: incident.startedAt,
            minutesElapsed,
          },
          rootCause: {
            serviceName,
            failureType: rootFailure.failureType,
            severity: rootFailure.severity,
            signalDetails: rootFailure.signalDetails,
          },
          impact: {
            totalServicesAffected: affectedCount,
            customerFacingAffected: customerFacing.length,
            revenuePerMinCents: totalRevenuePerMinCents,
            revenuePerMinDollars: totalRevenuePerMinDollars,
            totalAccumulatedImpactCents,
            totalAccumulatedImpactDollars,
          },
          cascade: {
            depth1: depth1Names,
            depth2: depth2Names,
            depth3Plus: depth3PlusNames,
          },
          ai: {
            headline: aiSummary.headline,
            whatHappened: aiSummary.whatHappened,
            rootCauseAnalysis: aiSummary.rootCauseAnalysis,
            blastRadiusSummary: aiSummary.blastRadiusSummary,
            revenueImpactSummary: aiSummary.revenueImpactSummary,
            fixPriority: aiSummary.fixPriority,
          },
          summary: aiSummary.fullSummary,
          upstreamCandidates,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] POST /api/summary failed:", error);
    return err(500, "INTERNAL_ERROR", "Failed to generate summary");
  }
}