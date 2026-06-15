// ═══════════════════════════════════════════
// 3. src/lib/detection/health-checker.ts
// ═══════════════════════════════════════════

import { db } from "../db";
import {
  services,
  healthSignals,
  failureEvents,
  incidents,
  blastRadiusResults,
} from "../db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { traverseDownstream } from "../graph/traversal";

interface HealthCheckResult {
  serviceId: string;
  serviceName: string;
  previousStatus: string;
  currentStatus: string;
  changed: boolean;
}

interface ProbedService {
  svc: { id: string; name: string; healthStatus: string };
  isReachable: boolean;
  latencyMs: number;
}

interface StatusChange {
  serviceId: string;
  serviceName: string;
  previousStatus: string;
  currentStatus: "healthy" | "degraded" | "down";
  latencyMs: number;
  isReachable: boolean;
}

async function probeServices(
  allServices: Array<{ id: string; name: string; healthStatus: string }>
): Promise<ProbedService[]> {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  if (isDemoMode) {
    return allServices.map((svc) => ({
      svc,
      isReachable: svc.healthStatus !== "down",
      latencyMs:
        svc.healthStatus === "down"
          ? 0
          : Math.floor(Math.random() * 50) + 5,
    }));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const probes = await Promise.allSettled(
    allServices.map(async (svc) => {
      let isReachable = true;
      let latencyMs = 0;
      try {
        const start = Date.now();
        const response = await fetch(
          `${appUrl}/api/health?service=${svc.name}`,
          { method: "GET", signal: AbortSignal.timeout(5000) }
        );
        latencyMs = Date.now() - start;
        if (!response.ok) isReachable = false;
      } catch {
        isReachable = false;
      }
      return { svc, isReachable, latencyMs };
    })
  );

  const results: ProbedService[] = [];
  for (let i = 0; i < probes.length; i++) {
    const result = probes[i];
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      console.error(
        `[HEALTH] Failed to probe ${allServices[i].name}:`,
        result.reason
      );
    }
  }
  return results;
}

async function getRecentBreachSet(
  serviceIds: string[]
): Promise<Set<string>> {
  if (serviceIds.length === 0) return new Set();

  const recentErrorSignals = await db
    .select({
      serviceId: healthSignals.serviceId,
      isBreach: healthSignals.isBreach,
    })
    .from(healthSignals)
    .where(
      and(
        inArray(healthSignals.serviceId, serviceIds),
        eq(healthSignals.signalType, "error_rate")
      )
    )
    .orderBy(desc(healthSignals.recordedAt));

  const breachCounts = new Map<string, { total: number; breaches: number }>();
  for (const sig of recentErrorSignals) {
    const entry = breachCounts.get(sig.serviceId) ?? {
      total: 0,
      breaches: 0,
    };
    if (entry.total >= 5) continue;
    entry.total++;
    if (sig.isBreach) entry.breaches++;
    breachCounts.set(sig.serviceId, entry);
  }

  const breachSet = new Set<string>();
  for (const [serviceId, count] of breachCounts) {
    if (count.breaches >= 2) {
      breachSet.add(serviceId);
    }
  }
  return breachSet;
}

async function processStatusChanges(
  changes: StatusChange[]
): Promise<void> {
  for (const change of changes) {
    if (
      change.currentStatus === "degraded" ||
      change.currentStatus === "down"
    ) {
      await db
        .update(services)
        .set({ healthStatus: change.currentStatus, updatedAt: new Date() })
        .where(eq(services.id, change.serviceId));

      const [failureEvent] = await db
        .insert(failureEvents)
        .values({
          serviceId: change.serviceId,
          failureType: "health_check",
          severity: change.currentStatus,
          signalDetails: {
            previous_status: change.previousStatus,
            current_status: change.currentStatus,
            latency_ms: change.latencyMs,
            reachable: change.isReachable,
          },
        })
        .returning();

      const blastRadius = await traverseDownstream(change.serviceId);
      const totalRevenue = blastRadius
        .filter((entry) => entry.isCustomerFacing)
        .reduce((sum, entry) => sum + entry.revenuePerMinCents, 0);

      const [incident] = await db
        .insert(incidents)
        .values({
          rootFailureEventId: failureEvent.id,
          totalRevenueImpactCents: totalRevenue,
          affectedServiceCount: blastRadius.length + 1,
          maxDepth:
            blastRadius.length > 0
              ? Math.max(...blastRadius.map((e) => e.depth))
              : 0,
        })
        .returning();

      if (blastRadius.length > 0) {
        await db.insert(blastRadiusResults).values(
          blastRadius.map((entry) => ({
            incidentId: incident.id,
            affectedServiceId: entry.serviceId,
            depth: entry.depth,
            dependencyPath: entry.path,
            dependencyType: entry.dependencyType,
            isCustomerFacing: entry.isCustomerFacing,
            revenuePerMinCents: entry.revenuePerMinCents,
          }))
        );
      }

      console.log(
        `[HEALTH] Failure detected: ${change.serviceName} changed from ${change.previousStatus} to ${change.currentStatus}`
      );
    } else if (change.currentStatus === "healthy") {
      await db
        .update(services)
        .set({ healthStatus: "healthy", updatedAt: new Date() })
        .where(eq(services.id, change.serviceId));

      console.log(
        `[HEALTH] Recovery detected: ${change.serviceName} is now healthy`
      );
    }
  }
}

export async function pollHealthEndpoints(): Promise<HealthCheckResult[]> {
  try {
    const allServices = await db
      .select({
        id: services.id,
        name: services.name,
        healthStatus: services.healthStatus,
      })
      .from(services);

    const probedServices = await probeServices(allServices);
    const serviceIds = probedServices.map((p) => p.svc.id);
    const recentBreaches = await getRecentBreachSet(serviceIds);

    const results: HealthCheckResult[] = [];
    const signalInserts: Array<{
      serviceId: string;
      signalType: string;
      metricValue: string;
      isBreach: boolean;
    }> = [];
    const statusChanges: StatusChange[] = [];

    for (const probed of probedServices) {
      let currentStatus: "healthy" | "degraded" | "down" = "healthy";

      if (!probed.isReachable) {
        currentStatus = "down";
      } else if (recentBreaches.has(probed.svc.id)) {
        currentStatus = "degraded";
      }

      const healthValue = currentStatus === "down" ? 0 : 1;

      signalInserts.push({
        serviceId: probed.svc.id,
        signalType: "health_check",
        metricValue: healthValue.toFixed(4),
        isBreach: currentStatus === "down",
      });

      const changed = probed.svc.healthStatus !== currentStatus;

      results.push({
        serviceId: probed.svc.id,
        serviceName: probed.svc.name,
        previousStatus: probed.svc.healthStatus,
        currentStatus,
        changed,
      });

      if (changed) {
        statusChanges.push({
          serviceId: probed.svc.id,
          serviceName: probed.svc.name,
          previousStatus: probed.svc.healthStatus,
          currentStatus,
          latencyMs: probed.latencyMs,
          isReachable: probed.isReachable,
        });
      }
    }

    if (signalInserts.length > 0) {
      await db.insert(healthSignals).values(signalInserts);
    }

    if (serviceIds.length > 0) {
      await db
        .update(services)
        .set({ lastHealthCheckAt: new Date(), updatedAt: new Date() })
        .where(inArray(services.id, serviceIds));
    }

    await processStatusChanges(statusChanges);

    return results;
  } catch (error) {
    console.error("[HEALTH] Poll cycle failed:", error);
    throw new Error("Health check poll cycle failed");
  }
}

export async function injectFailure(serviceName: string): Promise<{
  incidentId: string;
  failureEventId: string;
  blastRadiusCount: number;
  totalRevenuePerMinCents: number;
}> {
  const [svc] = await db
    .select()
    .from(services)
    .where(eq(services.name, serviceName))
    .limit(1);

  if (!svc) {
    throw new Error(`Service not found: ${serviceName}`);
  }

  await db
    .update(services)
    .set({ healthStatus: "down", updatedAt: new Date() })
    .where(eq(services.id, svc.id));

  const [failureEvent] = await db
    .insert(failureEvents)
    .values({
      serviceId: svc.id,
      failureType: "latency_degradation",
      severity: "down",
      signalDetails: {
        connection_pool: "exhausted",
        active_connections: 200,
        max_connections: 200,
        avg_query_time: "450ms",
        multiplier: "2.25x",
        original_threshold: "200ms",
        injected: true,
      },
    })
    .returning();

  const blastRadius = await traverseDownstream(svc.id);
  const totalRevenue = blastRadius
    .filter((entry) => entry.isCustomerFacing)
    .reduce((sum, entry) => sum + entry.revenuePerMinCents, 0);

  const [incident] = await db
    .insert(incidents)
    .values({
      rootFailureEventId: failureEvent.id,
      totalRevenueImpactCents: totalRevenue,
      affectedServiceCount: blastRadius.length + 1,
      maxDepth:
        blastRadius.length > 0
          ? Math.max(...blastRadius.map((e) => e.depth))
          : 0,
    })
    .returning();

  if (blastRadius.length > 0) {
    await db.insert(blastRadiusResults).values(
      blastRadius.map((entry) => ({
        incidentId: incident.id,
        affectedServiceId: entry.serviceId,
        depth: entry.depth,
        dependencyPath: entry.path,
        dependencyType: entry.dependencyType,
        isCustomerFacing: entry.isCustomerFacing,
        revenuePerMinCents: entry.revenuePerMinCents,
      }))
    );
  }

  return {
    incidentId: incident.id,
    failureEventId: failureEvent.id,
    blastRadiusCount: blastRadius.length,
    totalRevenuePerMinCents: totalRevenue,
  };
}

export async function getServiceHealthStatus(): Promise<
  Array<{
    id: string;
    name: string;
    ownerTeam: string;
    classification: string;
    healthStatus: string;
    lastHealthCheckAt: Date | null;
  }>
> {
  try {
    return await db
      .select({
        id: services.id,
        name: services.name,
        ownerTeam: services.ownerTeam,
        classification: services.classification,
        healthStatus: services.healthStatus,
        lastHealthCheckAt: services.lastHealthCheckAt,
      })
      .from(services)
      .orderBy(services.name);
  } catch (error) {
    console.error("[HEALTH] Failed to get service health status:", error);
    throw new Error("Failed to fetch service health status");
  }
}
