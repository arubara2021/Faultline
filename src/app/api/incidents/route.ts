import { NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import {
  incidents,
  failureEvents,
  services,
  blastRadiusResults,
  currentTrafficSnapshots,
} from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";

export async function GET() {
  try {
    const allIncidents = await withDbRetry(() =>
      db.select().from(incidents).orderBy(desc(incidents.startedAt))
    );

    const active = allIncidents.find((i) => !i.resolvedAt) ?? null;
    const activeCount = allIncidents.filter((i) => !i.resolvedAt).length;
    const resolvedCount = allIncidents.filter((i) => !!i.resolvedAt).length;

    let enrichedActive: any = active;

    if (active) {
      const [rootFailure] = await withDbRetry(() =>
        db
          .select()
          .from(failureEvents)
          .where(eq(failureEvents.id, active.rootFailureEventId))
          .limit(1)
      );

      let rootServiceName = "unknown";
      let failureType = "unknown";
      let severity = "unknown";

      if (rootFailure) {
        failureType = rootFailure.failureType;
        severity = rootFailure.severity;

        const [failedService] = await withDbRetry(() =>
          db
            .select()
            .from(services)
            .where(eq(services.id, rootFailure.serviceId))
            .limit(1)
        );

        if (failedService) {
          rootServiceName = failedService.name;
        }
      }

      const affectedServices = await withDbRetry(() =>
        db
          .select({
            revenuePerMinCents: currentTrafficSnapshots.revenuePerMinCents,
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
              eq(blastRadiusResults.incidentId, active.id),
              eq(services.classification, "customer-facing")
            )
          )
      );

      const totalRevenuePerMin = affectedServices.reduce(
        (sum, svc) => sum + (svc.revenuePerMinCents ?? 0),
        0
      );

      const now = new Date();
      const startedAt = new Date(active.startedAt);
      const minutesElapsed =
        (now.getTime() - startedAt.getTime()) / (1000 * 60);
      const totalAccumulatedImpact = Math.round(
        totalRevenuePerMin * minutesElapsed
      );

      enrichedActive = {
        ...active,
        rootServiceName,
        failureType,
        severity,
        totalRevenueImpactCents: totalAccumulatedImpact,
      };
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          active: enrichedActive,
          activeCount,
          resolvedCount,
          incidents: allIncidents,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] GET /api/incidents failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Failed to fetch incidents",
      },
      { status: 500 }
    );
  }
}