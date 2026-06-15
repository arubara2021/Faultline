// ═══════════════════════════════════════════
// 3. src/lib/detection/failure-injector.ts
// ═══════════════════════════════════════════

import { db } from "../db";
import {
  services,
  failureEvents,
  incidents,
  blastRadiusResults,
  healthSignals,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { traverseDownstream, invalidateGraphCache } from "../graph/traversal";
import { v4 as uuidv4 } from "uuid";

export async function resetForSimulation(): Promise<void> {
  await db.delete(blastRadiusResults);
  await db.delete(incidents);
  await db.delete(failureEvents);
  await db
    .update(services)
    .set({ healthStatus: "healthy", updatedAt: new Date() });
  await db.update(healthSignals).set({ isBreach: false });
  invalidateGraphCache();
}

export async function simulateFailure(serviceName: string) {
  const [svc] = await db
    .select()
    .from(services)
    .where(eq(services.name, serviceName))
    .limit(1);

  if (!svc) {
    throw new Error(`Service not found: ${serviceName}`);
  }

  const now = new Date();

  const failureEventId = uuidv4();
  await db.insert(failureEvents).values({
    id: failureEventId,
    serviceId: svc.id,
    failureType: "latency_degradation",
    severity: "down",
    signalDetails: {
      source: "simulation",
      simulatedAt: now.toISOString(),
    },
  });

  await Promise.all([
    db
      .update(services)
      .set({ healthStatus: "down", updatedAt: now })
      .where(eq(services.id, svc.id)),
    db
      .update(healthSignals)
      .set({ isBreach: true })
      .where(eq(healthSignals.serviceId, svc.id)),
  ]);

  invalidateGraphCache();

  const downstream = await traverseDownstream(svc.id);

  const customerFacing = downstream.filter((d) => d.isCustomerFacing);
  const totalRevenuePerMinCents = customerFacing.reduce(
    (sum, d) => sum + d.revenuePerMinCents,
    0
  );
  const totalRevenuePerMinDollars = totalRevenuePerMinCents / 100;
  const cascadeDepth =
    downstream.length > 0
      ? Math.max(...downstream.map((d) => d.depth))
      : 0;

  const incidentId = uuidv4();
  await db.insert(incidents).values({
    id: incidentId,
    rootFailureEventId: failureEventId,
    startedAt: now,
    resolvedAt: null,
    totalRevenueImpactCents: 0,
    affectedServiceCount: downstream.length,
    maxDepth: cascadeDepth,
    resolutionNotes: null,
  });

  if (downstream.length > 0) {
    await db.insert(blastRadiusResults).values(
      downstream.map((entry) => ({
        incidentId,
        affectedServiceId: entry.serviceId,
        depth: entry.depth,
        dependencyPath: entry.path,
        dependencyType: entry.dependencyType,
        isCustomerFacing: entry.isCustomerFacing,
        revenuePerMinCents: entry.revenuePerMinCents,
      }))
    );
  }

  const affectedServices = downstream.map((entry) => ({
    name: entry.serviceName,
    depth: entry.depth,
    classification: entry.classification,
    isCustomerFacing: entry.isCustomerFacing,
    revenuePerMinCents: entry.revenuePerMinCents,
  }));

  return {
    incidentId,
    failureEventId,
    failedService: serviceName,
    blastRadiusCount: downstream.length,
    totalRevenuePerMinCents,
    totalRevenuePerMinDollars,
    cascadeDepth,
    customerFacingAffected: customerFacing.length,
    affectedServices,
    message: `Failure simulated for ${serviceName}: ${downstream.length} services affected, $$$${totalRevenuePerMinDollars.toFixed(2)}/min at risk`,
  };
}
