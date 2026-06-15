// ═══════════════════════════════════════════
// 30. src/lib/graph/confidence.ts
// ═══════════════════════════════════════════

import { db } from "../db";
import { dependencies } from "../db/schema";
import { sql } from "drizzle-orm";
import { config } from "../config";

export function calculateConfidence(
  observedFrequency: number,
  expectedFrequency: number,
  consistencyRatio: number,
  recencyWeight: number
): number {
  if (expectedFrequency === 0) return 0;

  const raw =
    (observedFrequency / expectedFrequency) *
    consistencyRatio *
    recencyWeight;

  return Math.max(0, Math.min(1, raw));
}

export function getRecencyWeight(lastObservedAt: Date): number {
  const now = new Date();
  const hoursSinceLastSeen =
    (now.getTime() - lastObservedAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastSeen <= 1) return 1.0;
  if (hoursSinceLastSeen <= 6) return 0.9;
  if (hoursSinceLastSeen <= 24) return 0.75;
  if (hoursSinceLastSeen <= 72) return 0.5;
  if (hoursSinceLastSeen <= 168) return 0.25;
  return 0.1;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recalculateConfidenceScores(): Promise<number> {
  try {
    const allDeps = await db.select().from(dependencies);

    if (allDeps.length === 0) return 0;

    const now = Date.now();
    const cases: string[] = [];
    const ids: string[] = [];

    for (const dep of allDeps) {
      const recencyWeight = getRecencyWeight(dep.lastObservedAt);
      const observed = parseFloat(dep.observedFrequency ?? "0");
      const expected = observed > 0 ? observed * 1.1 : 1;
      const daysSinceObserved =
        (now - dep.lastObservedAt.getTime()) / (1000 * 60 * 60 * 24);
      const consistency = daysSinceObserved <= 7 ? 0.9 : 0.5;

      const newScore = calculateConfidence(
        observed,
        expected,
        consistency,
        recencyWeight
      );

      const oldScore = parseFloat(dep.confidenceScore ?? "0");

      if (Math.abs(newScore - oldScore) > 0.001) {
        if (!UUID_RE.test(dep.id)) {
          console.warn(`[CONFIDENCE] Skipping invalid UUID: ${dep.id}`);
          continue;
        }
        ids.push(dep.id);
        cases.push(`WHEN '${dep.id}' THEN ${newScore.toFixed(3)}`);
      }
    }

    if (ids.length === 0) {
      return 0;
    }

    const idList = ids.map((id) => `'${id}'`).join(",");

    await db.execute(sql`
      UPDATE dependencies
      SET confidence_score = CASE id
        ${sql.raw(cases.join("\n        "))}
      END,
      updated_at = NOW()
      WHERE id IN (${sql.raw(idList)})
    `);

    return ids.length;
  } catch (error) {
    console.error("[CONFIDENCE] Recalculation failed:", error);
    throw new Error("Failed to recalculate confidence scores");
  }
}
