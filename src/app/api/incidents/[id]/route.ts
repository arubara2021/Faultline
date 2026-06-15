// ═══════════════════════════════════════════
// 2. src/app/api/incidents/[id]/route.ts
// ═══════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import {
  incidents,
  failureEvents,
  services,
  blastRadiusResults,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { traverseUpstream } from "@/lib/graph/traversal";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(
  status: number,
  error: string,
  message: string
): NextResponse {
  return NextResponse.json({ success: false, error, message }, { status });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return errorResponse(
        400,
        "INVALID_UUID",
        "Incident ID must be a valid UUID"
      );
    }

    const [incident] = await withDbRetry(() =>
      db.select().from(incidents).where(eq(incidents.id, id)).limit(1)
    );

    if (!incident) {
      return errorResponse(404, "NOT_FOUND", "Incident not found");
    }

    const [rootFailure] = await withDbRetry(() =>
      db
        .select()
        .from(failureEvents)
        .where(eq(failureEvents.id, incident.rootFailureEventId))
        .limit(1)
    );

    if (!rootFailure) {
      return errorResponse(
        404,
        "ROOT_CAUSE_NOT_FOUND",
        "Root failure event not found"
      );
    }

    const [failedService] = await withDbRetry(() =>
      db
        .select()
        .from(services)
        .where(eq(services.id, rootFailure.serviceId))
        .limit(1)
    );

    if (!failedService) {
      return errorResponse(
        404,
        "SERVICE_NOT_FOUND",
        "Failed service not found"
      );
    }

    const [blastResults, allServices, upstreamCandidates] =
      await withDbRetry(() =>
        Promise.all([
          db
            .select()
            .from(blastRadiusResults)
            .where(eq(blastRadiusResults.incidentId, incident.id)),
          db.select().from(services),
          traverseUpstream(rootFailure.serviceId),
        ])
      );

    const serviceMap = new Map(allServices.map((s) => [s.id, s]));

    const blastRadius = blastResults
      .map((br) => {
        const svc = serviceMap.get(br.affectedServiceId);
        return {
          serviceId: br.affectedServiceId,
          serviceName: svc?.name ?? "unknown",
          depth: br.depth,
          classification: svc?.classification ?? "unknown",
          ownerTeam: svc?.ownerTeam ?? "unknown",
          dependencyType: br.dependencyType,
          isCustomerFacing: br.isCustomerFacing,
          revenuePerMinCents: Number(br.revenuePerMinCents) || 0,
          dependencyPath: br.dependencyPath ?? [],
        };
      })
      .sort((a, b) => a.depth - b.depth);

    const customerFacing = blastRadius.filter((b) => b.isCustomerFacing);
    const totalRevenuePerMinCents = customerFacing.reduce(
      (sum, b) => sum + b.revenuePerMinCents,
      0
    );

    const depthSummary = {
      depth1: blastRadius.filter((b) => b.depth === 1).length,
      depth2: blastRadius.filter((b) => b.depth === 2).length,
      depth3Plus: blastRadius.filter((b) => b.depth >= 3).length,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          incident: {
            id: incident.id,
            startedAt: incident.startedAt,
            resolvedAt: incident.resolvedAt,
            affectedServiceCount: incident.affectedServiceCount,
            maxDepth: incident.maxDepth,
          },
          rootCause: {
            serviceId: rootFailure.serviceId,
            serviceName: failedService.name,
            failureType: rootFailure.failureType,
            severity: rootFailure.severity,
            signalDetails: rootFailure.signalDetails,
            detectedAt: rootFailure.detectedAt,
          },
          blastRadius,
          upstreamCandidates,
          revenueImpact: {
            totalRevenuePerMinCents,
          },
          customerFacingCount: customerFacing.length,
          depthSummary,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] GET /api/incidents/[id] failed:", error);
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to fetch incident details"
    );
  }
}
