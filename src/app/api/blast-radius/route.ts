// ═══════════════════════════════════════════
// 3. src/app/api/blast-radius/route.ts
// ═══════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { services, incidents, failureEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  traverseDownstream,
  traverseUpstream,
} from "@/lib/graph/traversal";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(
  status: number,
  error: string,
  message: string
): NextResponse {
  return NextResponse.json({ success: false, error, message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_JSON", "Invalid JSON body");
    }

    const { serviceName, serviceId, incidentId } = body as {
      serviceName?: string;
      serviceId?: string;
      incidentId?: string;
    };

    let failedServiceId: string | null = null;
    let failedServiceName: string | null = null;
    let message: string | undefined;

    if (incidentId) {
      if (!UUID_RE.test(incidentId)) {
        return errorResponse(
          400,
          "INVALID_UUID",
          "Invalid incident ID format"
        );
      }

      const [incident] = await withDbRetry(() =>
        db
          .select()
          .from(incidents)
          .where(eq(incidents.id, incidentId))
          .limit(1)
      );

      if (!incident) {
        return errorResponse(404, "NOT_FOUND", "Incident not found");
      }

      const [failure] = await withDbRetry(() =>
        db
          .select()
          .from(failureEvents)
          .where(eq(failureEvents.id, incident.rootFailureEventId))
          .limit(1)
      );

      if (!failure) {
        return errorResponse(
          404,
          "ROOT_CAUSE_NOT_FOUND",
          "Root failure event not found"
        );
      }

      failedServiceId = failure.serviceId;

      const [svc] = await withDbRetry(() =>
        db
          .select()
          .from(services)
          .where(eq(services.id, failedServiceId!))
          .limit(1)
      );

      failedServiceName = svc?.name ?? "unknown";
    } else if (serviceId) {
      if (!UUID_RE.test(serviceId)) {
        return errorResponse(
          400,
          "INVALID_UUID",
          "Invalid service ID format"
        );
      }

      const [svc] = await withDbRetry(() =>
        db
          .select()
          .from(services)
          .where(eq(services.id, serviceId))
          .limit(1)
      );

      if (!svc) {
        return errorResponse(404, "NOT_FOUND", "Service not found");
      }

      failedServiceId = svc.id;
      failedServiceName = svc.name;
    } else if (serviceName) {
      const [svc] = await withDbRetry(() =>
        db
          .select()
          .from(services)
          .where(eq(services.name, serviceName))
          .limit(1)
      );

      if (!svc) {
        return errorResponse(404, "NOT_FOUND", "Service not found");
      }

      failedServiceId = svc.id;
      failedServiceName = svc.name;
    } else {
      return errorResponse(
        400,
        "MISSING_PARAMS",
        "Provide serviceName, serviceId, or incidentId"
      );
    }

    const downstream = await withDbRetry(() =>
      traverseDownstream(failedServiceId!)
    );

    const upstream = await withDbRetry(() =>
      traverseUpstream(failedServiceId!)
    );

    const fixPriorities = upstream
      .filter(
        (u) => u.healthStatus === "down" || u.healthStatus === "degraded"
      )
      .map((u) => ({
        serviceName: u.serviceName,
        serviceId: u.serviceId,
        healthStatus: u.healthStatus,
        depth: u.depth,
        score:
          u.healthStatus === "down"
            ? 100 - u.depth * 10
            : 50 - u.depth * 10,
        reasons: [
          u.healthStatus === "down"
            ? "Service is down"
            : "Service is degraded",
          `Depth ${u.depth} from failure`,
        ],
      }))
      .sort((a, b) => b.score - a.score);

    const customerFacing = downstream.filter((d) => d.isCustomerFacing);
    const totalRevenuePerMinCents = customerFacing.reduce(
      (sum, d) => sum + d.revenuePerMinCents,
      0
    );

    const summary = {
      totalAffected: downstream.length + 1,
      downstreamCount: downstream.length,
      customerFacingCount: customerFacing.length,
      maxDepth:
        downstream.length > 0
          ? Math.max(...downstream.map((d) => d.depth))
          : 0,
      totalRevenuePerMinCents,
      totalRevenuePerMinDollars: totalRevenuePerMinCents / 100,
      depthBreakdown: {
        depth1: downstream.filter((d) => d.depth === 1).length,
        depth2: downstream.filter((d) => d.depth === 2).length,
        depth3Plus: downstream.filter((d) => d.depth >= 3).length,
      },
    };

    if (incidentId) {
      message = `Blast radius for incident ${incidentId}: ${summary.downstreamCount} services affected`;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          failedService: { id: failedServiceId, name: failedServiceName },
          downstream,
          upstream,
          fixPriorities,
          summary,
          ...(message !== undefined ? { message } : {}),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] POST /api/blast-radius failed:", error);
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to compute blast radius"
    );
  }
}
