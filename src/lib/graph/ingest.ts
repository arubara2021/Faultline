// ═══════════════════════════════════════════
// 6. src/lib/graph/ingest.ts
// ═══════════════════════════════════════════

import { db } from "../db";
import { services, dependencies, currentTrafficSnapshots } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { calculateConfidence } from "./confidence";
import type { IngestPayload } from "../types";

type ConnectionLike = typeof db;

async function ensureServiceExists(
  name: string,
  conn: ConnectionLike
): Promise<string> {
  const [existing] = await conn
    .select({ id: services.id })
    .from(services)
    .where(eq(services.name, name))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await conn
    .insert(services)
    .values({
      name,
      ownerTeam: "unknown",
      classification: "internal",
      healthStatus: "healthy",
    })
    .returning({ id: services.id });

  return created.id;
}

async function upsertDependency(
  sourceId: string,
  targetId: string,
  payload: IngestPayload,
  conn: ConnectionLike
): Promise<{ action: "inserted" | "updated"; edgeId: string }> {
  const [existing] = await conn
    .select()
    .from(dependencies)
    .where(
      and(
        eq(dependencies.sourceServiceId, sourceId),
        eq(dependencies.targetServiceId, targetId),
        eq(dependencies.dependencyType, payload.type)
      )
    )
    .limit(1);

  const recencyWeight = 1.0;
  const consistency = 0.9;
  const newScore = calculateConfidence(
    payload.frequency,
    payload.frequency * 1.1,
    consistency,
    recencyWeight
  );

  if (existing) {
    await conn
      .update(dependencies)
      .set({
        observedFrequency: payload.frequency.toFixed(2),
        observedLatencyMs: payload.latency.toFixed(2),
        confidenceScore: Math.max(
          newScore,
          parseFloat(existing.confidenceScore ?? "0")
        ).toFixed(3),
        lastObservedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dependencies.id, existing.id));

    return { action: "updated", edgeId: existing.id };
  }

  const [newEdge] = await conn
    .insert(dependencies)
    .values({
      sourceServiceId: sourceId,
      targetServiceId: targetId,
      dependencyType: payload.type,
      observedFrequency: payload.frequency.toFixed(2),
      observedLatencyMs: payload.latency.toFixed(2),
      confidenceScore: newScore.toFixed(3),
      lastObservedAt: new Date(),
    })
    .returning({ id: dependencies.id });

  return { action: "inserted", edgeId: newEdge.id };
}

async function upsertTrafficSnapshot(
  sourceId: string,
  frequency: number,
  conn: ConnectionLike
): Promise<void> {
  const [existingSnapshot] = await conn
    .select()
    .from(currentTrafficSnapshots)
    .where(eq(currentTrafficSnapshots.serviceId, sourceId))
    .limit(1);

  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (existingSnapshot) {
    await conn
      .update(currentTrafficSnapshots)
      .set({
        avgRequestsPerMin: frequency.toFixed(2),
        recalculatedAt: now,
      })
      .where(eq(currentTrafficSnapshots.serviceId, sourceId));
  } else {
    await conn.insert(currentTrafficSnapshots).values({
      serviceId: sourceId,
      avgRequestsPerMin: frequency.toFixed(2),
      conversionRate: "0",
      avgOrderValueCents: 0,
      revenuePerMinCents: 0,
      snapshotWindowStart: windowStart,
      snapshotWindowEnd: now,
    });
  }
}

export async function ingestDependencySummary(
  payload: IngestPayload,
  conn: ConnectionLike = db
): Promise<{ action: "inserted" | "updated"; edgeId: string }> {
  const sourceId = await ensureServiceExists(payload.source, conn);
  const targetId = await ensureServiceExists(payload.target, conn);

  if (sourceId === targetId) {
    throw new Error(
      `Self-dependency detected: ${payload.source} -> ${payload.target}`
    );
  }

  const result = await upsertDependency(sourceId, targetId, payload, conn);
  await upsertTrafficSnapshot(sourceId, payload.frequency, conn);

  return result;
}

export async function ingestBatch(
  payloads: IngestPayload[]
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const payload of payloads) {
    try {
      const result = await db.transaction(async (tx) => {
        return await ingestDependencySummary(payload, tx as unknown as typeof db);
      });
      if (result.action === "inserted") inserted++;
      else updated++;
    } catch (error) {
      errors.push(
        `${payload.source} -> ${payload.target}: ${(error as Error).message}`
      );
    }
  }

  return { inserted, updated, errors };
}
