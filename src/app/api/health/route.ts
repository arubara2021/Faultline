// ═══════════════════════════════════════════
// 5. src/app/api/health/route.ts
// ═══════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { services, healthSignals } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { invalidateGraphCache } from "@/lib/graph/traversal";

export const dynamic = "force-dynamic";

function err(status: number, error: string, message: string) {
  return NextResponse.json({ success: false, error, message }, { status });
}

export async function GET() {
  try {
    const all = await db
      .select()
      .from(services)
      .orderBy(services.name);

    const summary = {
      total: all.length,
      healthy: all.filter((s) => s.healthStatus === "healthy").length,
      degraded: all.filter((s) => s.healthStatus === "degraded").length,
      down: all.filter((s) => s.healthStatus === "down").length,
      unknown: all.filter((s) => s.healthStatus === "unknown").length,
    };

    return NextResponse.json(
      { success: true, data: { services: all, summary } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] GET /api/health failed:", error);
    return err(500, "INTERNAL_ERROR", "Failed to fetch health status");
  }
}

async function handleInjectFailure(serviceName: string) {
  const { simulateFailure } = await import(
    "@/lib/detection/failure-injector"
  );
  const result = await simulateFailure(serviceName);

  return NextResponse.json(
    {
      success: true,
      data: {
        incidentId: result.incidentId,
        failureEventId: result.failureEventId,
        blastRadiusCount: result.blastRadiusCount,
        totalRevenuePerMinCents: result.totalRevenuePerMinCents,
        service: serviceName,
        message:
          result.message ??
          `Failure injected for {serviceName}: ${result.blastRadiusCount} services affected, $$$${(result.totalRevenuePerMinCents / 100).toFixed(2)}/min at risk`,
      },
    },
    { status: 200 }
  );
}

async function handleProbe(serviceName: string) {
  const [svc] = await db
    .select()
    .from(services)
    .where(eq(services.name, serviceName))
    .limit(1);

  if (!svc) {
    return err(404, "NOT_FOUND", `Service not found: ${serviceName}`);
  }

  const signals = await db
    .select()
    .from(healthSignals)
    .where(eq(healthSignals.serviceId, svc.id));

  return NextResponse.json(
    {
      success: true,
      data: {
        service: serviceName,
        status: svc.healthStatus,
        signals,
      },
    },
    { status: 200 }
  );
}

async function handleHealthCheckCycle() {
  const [allServices, allSignals] = await Promise.all([
    db.select().from(services),
    db.select().from(healthSignals),
  ]);

  const signalMap = new Map<string, typeof allSignals>();
  for (const sig of allSignals) {
    const arr = signalMap.get(sig.serviceId) ?? [];
    arr.push(sig);
    signalMap.set(sig.serviceId, arr);
  }

  const results: Array<{
    serviceId: string;
    serviceName: string;
    previousStatus: string;
    currentStatus: string;
    changed: boolean;
  }> = [];

  const toHealthyIds: string[] = [];
  const toDegradedIds: string[] = [];
  const toDownIds: string[] = [];

  let statusChanges = 0;
  let errorRateBreached = 0;
  let latencyDegraded = 0;
  let totalFailuresDetected = 0;

  for (const svc of allServices) {
    const sigs = signalMap.get(svc.id) ?? [];
    let newStatus = "healthy";

    const hcSig = sigs.find((s) => s.signalType === "health_check");
    const erSig = sigs.find((s) => s.signalType === "error_rate");
    const ltSig = sigs.find((s) => s.signalType === "latency_p95");

    if (hcSig?.isBreach) {
      newStatus = "down";
      totalFailuresDetected++;
    }
    if (erSig?.isBreach) {
      errorRateBreached++;
      if (newStatus !== "down") newStatus = "down";
      totalFailuresDetected++;
    }
    if (ltSig?.isBreach) {
      latencyDegraded++;
      if (newStatus === "healthy") newStatus = "degraded";
      totalFailuresDetected++;
    }

    const changed = svc.healthStatus !== newStatus;
    if (changed) {
      statusChanges++;
      if (newStatus === "healthy") toHealthyIds.push(svc.id);
      else if (newStatus === "degraded") toDegradedIds.push(svc.id);
      else if (newStatus === "down") toDownIds.push(svc.id);
    }

    results.push({
      serviceId: svc.id,
      serviceName: svc.name,
      previousStatus: svc.healthStatus,
      currentStatus: newStatus,
      changed,
    });
  }

  const now = new Date();

  await db
    .update(services)
    .set({ lastHealthCheckAt: now, updatedAt: now });

  const statusUpdates: Promise<unknown>[] = [];
  if (toHealthyIds.length > 0) {
    statusUpdates.push(
      db
        .update(services)
        .set({ healthStatus: "healthy" })
        .where(inArray(services.id, toHealthyIds))
    );
  }
  if (toDegradedIds.length > 0) {
    statusUpdates.push(
      db
        .update(services)
        .set({ healthStatus: "degraded" })
        .where(inArray(services.id, toDegradedIds))
    );
  }
  if (toDownIds.length > 0) {
    statusUpdates.push(
      db
        .update(services)
        .set({ healthStatus: "down" })
        .where(inArray(services.id, toDownIds))
    );
  }

  if (statusUpdates.length > 0) {
    await Promise.all(statusUpdates);
  }

  invalidateGraphCache();

  return NextResponse.json(
    {
      success: true,
      data: {
        healthCheck: {
          total: allServices.length,
          statusChanges,
          results,
        },
        errorRates: {
          checked: allServices.length,
          breached: errorRateBreached,
        },
        latency: {
          checked: allServices.length,
          degraded: latencyDegraded,
        },
        summary: {
          totalServices: allServices.length,
          totalFailuresDetected,
        },
      },
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return err(400, "INVALID_JSON", "Invalid JSON body");
    }

    const serviceName =
      typeof body.service === "string" ? body.service : null;
    const injectFailure = body.injectFailure === true;

    if (serviceName && injectFailure) {
      return await handleInjectFailure(serviceName);
    }

    if (serviceName) {
      return await handleProbe(serviceName);
    }

    return await handleHealthCheckCycle();
  } catch (error) {
    console.error("[API] POST /api/health failed:", error);
    return err(500, "INTERNAL_ERROR", "Failed to process health request");
  }
}
