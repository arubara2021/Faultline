// ═══════════════════════════════════════════
// 2. src/lib/detection/error-detector.ts
// ═══════════════════════════════════════════

import { db } from "../db";
import {
  services,
  healthSignals,
  failureEvents,
  incidents,
  blastRadiusResults,
} from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { config } from "../config";
import { traverseDownstream } from "../graph/traversal";

interface ErrorRateCheckResult {
  checked: number;
  breached: number;
  failures: string[];
}

async function getLatestErrorSignals(): Promise<Map<string, number>> {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (service_id)
      service_id, metric_value
    FROM health_signals
    WHERE signal_type = 'error_rate'
    ORDER BY service_id, recorded_at DESC
  `);

  const map = new Map<string, number>();
  for (const row of result.rows as Array<Record<string, unknown>>) {
    const value = parseFloat(row.metric_value as string);
    if (!isNaN(value)) {
      map.set(row.service_id as string, value);
    }
  }
  return map;
}

async function getErrorRateBaselines(): Promise<Map<string, number>> {
  const result = await db.execute(sql`
    SELECT service_id, AVG(metric_value::numeric) AS avg_error_rate
    FROM health_signals
    WHERE signal_type = 'error_rate'
      AND recorded_at >= NOW() - INTERVAL '7 days'
    GROUP BY service_id
  `);

  const map = new Map<string, number>();
  for (const row of result.rows as Array<Record<string, unknown>>) {
    const rate = parseFloat(row.avg_error_rate as string);
    if (!isNaN(rate)) {
      map.set(row.service_id as string, rate);
    }
  }
  return map;
}

async function createErrorSpikeIncident(
  serviceId: string,
  serviceName: string,
  currentRate: number,
  baseline: number,
  threshold: number
): Promise<void> {
  const blastRadius = await traverseDownstream(serviceId);
  const totalRevenue = blastRadius
    .filter((entry) => entry.isCustomerFacing)
    .reduce((sum, entry) => sum + entry.revenuePerMinCents, 0);

  await db.transaction(async (tx) => {
    await tx
      .update(services)
      .set({ healthStatus: "degraded", updatedAt: new Date() })
      .where(eq(services.id, serviceId));

    const [failureEvent] = await tx
      .insert(failureEvents)
      .values({
        serviceId,
        failureType: "error_spike",
        severity: "degraded",
        signalDetails: {
          current_rate: currentRate,
          baseline,
          threshold,
          multiplier: `${config.errorRateMultiplier}x`,
        },
      })
      .returning();

    const [incident] = await tx
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
      await tx.insert(blastRadiusResults).values(
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
  });

  console.log(
    `[ERROR-DETECTOR] ${serviceName}: error rate ${currentRate.toFixed(4)} exceeds threshold ${threshold.toFixed(4)}`
  );
}

export async function checkErrorRates(): Promise<ErrorRateCheckResult> {
  try {
    const allServices = await db
      .select({
        id: services.id,
        name: services.name,
        healthStatus: services.healthStatus,
      })
      .from(services);

    const latestSignalMap = await getLatestErrorSignals();
    const baselineMap = await getErrorRateBaselines();

    let breached = 0;
    const failures: string[] = [];
    const signalInserts: Array<{
      serviceId: string;
      signalType: string;
      metricValue: string;
      thresholdValue: string;
      isBreach: boolean;
    }> = [];

    for (const svc of allServices) {
      const currentRate = latestSignalMap.get(svc.id);
      if (currentRate === undefined) continue;

      const baseline = baselineMap.get(svc.id) ?? currentRate;
      const effectiveThreshold = baseline * config.errorRateMultiplier;
      const isBreach = currentRate > effectiveThreshold;

      signalInserts.push({
        serviceId: svc.id,
        signalType: "error_rate",
        metricValue: currentRate.toFixed(4),
        thresholdValue: effectiveThreshold.toFixed(4),
        isBreach,
      });

      if (isBreach) {
        breached++;
        failures.push(svc.name);
      }
    }

    if (signalInserts.length > 0) {
      await db.insert(healthSignals).values(signalInserts);
    }

    for (const svc of allServices) {
      if (!failures.includes(svc.name)) continue;
      if (svc.healthStatus !== "healthy") continue;

      const currentRate = latestSignalMap.get(svc.id) ?? 0;
      const baseline = baselineMap.get(svc.id) ?? currentRate;
      const effectiveThreshold = baseline * config.errorRateMultiplier;

      await createErrorSpikeIncident(
        svc.id,
        svc.name,
        currentRate,
        baseline,
        effectiveThreshold
      );
    }

    return { checked: allServices.length, breached, failures };
  } catch (error) {
    console.error("[ERROR-DETECTOR] Error rate check failed:", error);
    throw new Error("Error rate check failed");
  }
}
