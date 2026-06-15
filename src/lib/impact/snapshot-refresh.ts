// ═══════════════════════════════════════════
// 9. src/lib/impact/snapshot-refresh.ts
// ═══════════════════════════════════════════

import { db } from "../db";
import { services, currentTrafficSnapshots } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export interface SnapshotResult {
  serviceId: string;
  serviceName: string;
  avgRequestsPerMin: number;
  conversionRate: number;
  avgOrderValueCents: number;
  revenuePerMinCents: number;
  recalculated: boolean;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidUUID(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new Error(`Invalid UUID: ${id}`);
  }
}

export async function refreshTrafficSnapshots(): Promise<SnapshotResult[]> {
  const [allServices, allSnapshots] = await Promise.all([
    db
      .select({
        id: services.id,
        name: services.name,
        classification: services.classification,
      })
      .from(services),
    db.select().from(currentTrafficSnapshots),
  ]);

  const snapshotMap = new Map(
    allSnapshots.map((snap) => [snap.serviceId, snap])
  );

  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const results: SnapshotResult[] = [];
  const updateIds: string[] = [];
  const updateRevenueMap = new Map<string, number>();
  const insertValues: Array<{
    serviceId: string;
    avgRequestsPerMin: string;
    conversionRate: string;
    avgOrderValueCents: number;
    revenuePerMinCents: number;
    snapshotWindowStart: Date;
    snapshotWindowEnd: Date;
  }> = [];

  for (const svc of allServices) {
    const existing = snapshotMap.get(svc.id);

    const avgRequests = parseFloat(existing?.avgRequestsPerMin ?? "0");
    const conversionRate = parseFloat(existing?.conversionRate ?? "0");
    const avgOrderValue = existing?.avgOrderValueCents ?? 0;
    const currentRevenue = Number(existing?.revenuePerMinCents ?? 0);

    let revenuePerMin: number;
    if (conversionRate > 0 && avgOrderValue > 0) {
      revenuePerMin = Math.round(
        avgRequests * conversionRate * avgOrderValue
      );
    } else {
      revenuePerMin = currentRevenue;
    }

    if (existing) {
      updateIds.push(svc.id);
      updateRevenueMap.set(svc.id, revenuePerMin);
    } else {
      insertValues.push({
        serviceId: svc.id,
        avgRequestsPerMin: "0",
        conversionRate: "0",
        avgOrderValueCents: 0,
        revenuePerMinCents: 0,
        snapshotWindowStart: windowStart,
        snapshotWindowEnd: now,
      });
    }

    results.push({
      serviceId: svc.id,
      serviceName: svc.name,
      avgRequestsPerMin: avgRequests,
      conversionRate,
      avgOrderValueCents: avgOrderValue,
      revenuePerMinCents: revenuePerMin,
      recalculated: true,
    });
  }

  if (updateIds.length > 0) {
    for (const id of updateIds) {
      assertValidUUID(id);
    }

    const cases: string[] = [];
    for (const id of updateIds) {
      const rev = updateRevenueMap.get(id) ?? 0;
      cases.push(`WHEN '${id}' THEN ${Number(rev)}`);
    }
    const idList = updateIds.map((id) => `'${id}'`).join(",");

    await db.execute(sql`
      UPDATE current_traffic_snapshots
      SET revenue_per_min_cents = CASE service_id
        ${sql.raw(cases.join("\n          "))}
      END,
      snapshot_window_start = ${windowStart.toISOString()}::timestamptz,
      snapshot_window_end = ${now.toISOString()}::timestamptz,
      recalculated_at = NOW()
      WHERE service_id IN (${sql.raw(idList)})
    `);
  }

  if (insertValues.length > 0) {
    await db.insert(currentTrafficSnapshots).values(insertValues);
  }

  return results;
}

export async function updateSnapshotFromIngest(
  serviceId: string,
  observedFrequency: number
): Promise<void> {
  const [existing] = await db
    .select()
    .from(currentTrafficSnapshots)
    .where(eq(currentTrafficSnapshots.serviceId, serviceId))
    .limit(1);

  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (existing) {
    const currentAvg = parseFloat(existing.avgRequestsPerMin ?? "0");
    const smoothedAvg =
      currentAvg > 0
        ? currentAvg * 0.7 + observedFrequency * 0.3
        : observedFrequency;

    const conversionRate = parseFloat(existing.conversionRate ?? "0");
    const avgOrderValue = existing.avgOrderValueCents ?? 0;
    const revenuePerMin =
      conversionRate > 0 && avgOrderValue > 0
        ? Math.round(smoothedAvg * conversionRate * avgOrderValue)
        : existing.revenuePerMinCents ?? 0;

    await db
      .update(currentTrafficSnapshots)
      .set({
        avgRequestsPerMin: smoothedAvg.toFixed(2),
        revenuePerMinCents: revenuePerMin,
        snapshotWindowStart: windowStart,
        snapshotWindowEnd: now,
        recalculatedAt: now,
      })
      .where(eq(currentTrafficSnapshots.serviceId, serviceId));
  } else {
    await db.insert(currentTrafficSnapshots).values({
      serviceId,
      avgRequestsPerMin: observedFrequency.toFixed(2),
      conversionRate: "0",
      avgOrderValueCents: 0,
      revenuePerMinCents: 0,
      snapshotWindowStart: windowStart,
      snapshotWindowEnd: now,
    });
  }
}

export async function getSnapshotForService(
  serviceId: string
): Promise<{
  avgRequestsPerMin: number;
  conversionRate: number;
  avgOrderValueCents: number;
  revenuePerMinCents: number;
  snapshotWindowStart: Date;
  snapshotWindowEnd: Date;
  recalculatedAt: Date;
} | null> {
  const [snapshot] = await db
    .select()
    .from(currentTrafficSnapshots)
    .where(eq(currentTrafficSnapshots.serviceId, serviceId))
    .limit(1);

  if (!snapshot) return null;

  return {
    avgRequestsPerMin: parseFloat(snapshot.avgRequestsPerMin ?? "0"),
    conversionRate: parseFloat(snapshot.conversionRate ?? "0"),
    avgOrderValueCents: snapshot.avgOrderValueCents ?? 0,
    revenuePerMinCents: snapshot.revenuePerMinCents ?? 0,
    snapshotWindowStart: snapshot.snapshotWindowStart,
    snapshotWindowEnd: snapshot.snapshotWindowEnd,
    recalculatedAt: snapshot.recalculatedAt,
  };
}
