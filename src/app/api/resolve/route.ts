// ═══════════════════════════════════════════
// 4. src/app/api/resolve/route.ts
// ═══════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import {
  incidents,
  failureEvents,
  services,
  blastRadiusResults,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { invalidateGraphCache } from "@/lib/graph/traversal";

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
      db
        .select()
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1)
    );

    if (!incident) {
      return err(404, "NOT_FOUND", "Incident not found");
    }

    if (incident.resolvedAt) {
      return err(409, "ALREADY_RESOLVED", "Incident already resolved");
    }

    const now = new Date();
    const startedAt = new Date(incident.startedAt);
    const durationMs = Math.max(0, now.getTime() - startedAt.getTime());
    const durationMinutes =
      Math.round((durationMs / 60000) * 100) / 100;

    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const durationFormatted =
      hours > 0
        ? `${hours}h ${minutes}m ${seconds}s`
        : `${minutes}m ${seconds}s`;

    const blastResults = await withDbRetry(() =>
      db
        .select()
        .from(blastRadiusResults)
        .where(eq(blastRadiusResults.incidentId, incidentId))
    );

    const revenuePerMinCents = blastResults
      .filter((b) => b.isCustomerFacing)
      .reduce((sum, b) => sum + Number(b.revenuePerMinCents), 0);

    const totalRevenueImpactCents = Math.round(
      revenuePerMinCents * durationMinutes
    );
    const totalRevenueImpactDollars =
      Math.round((totalRevenueImpactCents / 100) * 100) / 100;

    await withDbRetry(() =>
      db
        .update(incidents)
        .set({
          resolvedAt: now,
          totalRevenueImpactCents,
          resolutionNotes: `Resolved via API after ${durationFormatted}`,
        })
        .where(eq(incidents.id, incidentId))
    );

    await withDbRetry(() =>
      db
        .update(failureEvents)
        .set({ resolvedAt: now })
        .where(eq(failureEvents.id, incident.rootFailureEventId))
    );

    const affectedServiceIds = new Set(
      blastResults.map((b) => b.affectedServiceId)
    );

    const [rootFailure] = await withDbRetry(() =>
      db
        .select()
        .from(failureEvents)
        .where(eq(failureEvents.id, incident.rootFailureEventId))
        .limit(1)
    );

    if (rootFailure) {
      affectedServiceIds.add(rootFailure.serviceId);
    }

    const serviceIdsArray = [...affectedServiceIds];
    if (serviceIdsArray.length > 0) {
      await withDbRetry(() =>
        db
          .update(services)
          .set({ healthStatus: "healthy", updatedAt: now })
          .where(inArray(services.id, serviceIdsArray))
      );
    }

    invalidateGraphCache();

    return NextResponse.json(
      {
        success: true,
        data: {
          incidentId,
          resolvedAt: now.toISOString(),
          durationMinutes,
          durationFormatted,
          affectedServiceCount: serviceIdsArray.length,
          totalRevenueImpactCents,
          totalRevenueImpactDollars,
          message: `Incident ${incidentId} resolved after ${durationFormatted}. Impact: $${totalRevenueImpactDollars.toFixed(2)}`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] POST /api/resolve failed:", error);
    return err(500, "INTERNAL_ERROR", "Failed to resolve incident");
  }
}
