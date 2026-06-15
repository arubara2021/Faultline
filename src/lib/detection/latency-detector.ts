// ═══════════════════════════════════════════
// 4. src/lib/detection/latency-detector.ts
// ═══════════════════════════════════════════

import { db } from "@/lib/db";
import {
  healthSignals,
  services,
  failureEvents,
  incidents,
  blastRadiusResults,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { traverseDownstream } from "../graph/traversal";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(name: string, fn: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(
        `[LATENCY-DETECTOR] ${name} failed (attempt ${attempt}/${MAX_RETRIES}):`,
        (error as Error).message
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}

interface LatencyResult {
  serviceId: string;
  serviceName: string;
  latestLatency: number;
  threshold: number;
  multiplier: number;
  isDegraded: boolean;
}

interface LatencySignalRow {
  service_id: string;
  metric_value: string;
  threshold_value: string | null;
  is_breach: boolean;
}

async function getLatestLatencySignals(): Promise<
  Map<string, LatencySignalRow>
> {
  const result = await withRetry("load latest latency signals", () =>
    db.execute(sql`
      SELECT DISTINCT ON (service_id)
        service_id, metric_value, threshold_value, is_breach
      FROM health_signals
      WHERE signal_type = 'latency_p95'
      ORDER BY service_id, recorded_at DESC
    `)
  );

  const map = new Map<string, LatencySignalRow>();
  for (const row of result.rows as Array<Record<string, unknown>>) {
    map.set(row.service_id as string, {
      service_id: row.service_id as string,
      metric_value: row.metric_value as string,
      threshold_value: row.threshold_value as string | null,
      is_breach: row.is_breach as boolean,
    });
  }
  return map;
}

async function hasExistingDegradedIncident(
  serviceId: string
): Promise<boolean> {
  const existing = await withRetry(
    `check existing incident for ${serviceId}`,
    () =>
      db
        .select()
        .from(incidents)
        .innerJoin(
          failureEvents,
          eq(incidents.rootFailureEventId, failureEvents.id)
        )
        .where(
          and(
            eq(failureEvents.serviceId, serviceId),
            eq(failureEvents.severity, "degraded"),
            sql`${incidents.resolvedAt} IS NULL`
          )
        )
        .limit(1)
  );

  return existing.length > 0;
}

async function createLatencyDegradationIncident(
  serviceId: string,
  serviceName: string,
  signal: LatencySignalRow,
  multiplier: number
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
        failureType: "latency_degradation",
        severity: "degraded",
        signalDetails: {
          metric_value: signal.metric_value,
          threshold_value: signal.threshold_value,
          multiplier: multiplier.toFixed(2),
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
    `[LATENCY-DETECTOR] ${serviceName}: latency degraded (${multiplier.toFixed(2)}x threshold)`
  );
}

export async function checkLatencyDegradation(): Promise<{
  checked: number;
  degraded: number;
  services: LatencyResult[];
}> {
  const allServices = await withRetry("load services", () =>
    db.select().from(services)
  );

  const signalMap = await getLatestLatencySignals();
  const results: LatencyResult[] = [];
  let degradedCount = 0;

  for (const svc of allServices) {
    const signal = signalMap.get(svc.id);
    if (!signal) continue;

    const metricValue = parseFloat(signal.metric_value);
    const thresholdValue = parseFloat(signal.threshold_value ?? "0");

    if (isNaN(metricValue) || isNaN(thresholdValue) || thresholdValue === 0)
      continue;

    const multiplier = metricValue / thresholdValue;
    const isDegraded = signal.is_breach === true || multiplier >= 2.0;

    if (isDegraded) {
      degradedCount++;

      const alreadyTracked = await hasExistingDegradedIncident(svc.id);

      if (!alreadyTracked) {
        await createLatencyDegradationIncident(
          svc.id,
          svc.name,
          signal,
          multiplier
        );
      }
    }

    results.push({
      serviceId: svc.id,
      serviceName: svc.name,
      latestLatency: metricValue,
      threshold: thresholdValue,
      multiplier,
      isDegraded,
    });
  }

  return { checked: allServices.length, degraded: degradedCount, services: results };
}
