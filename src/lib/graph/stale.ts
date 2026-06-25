// ═══════════════════════════════════════════
// 6. src/lib/graph/stale.ts
// ═══════════════════════════════════════════

import { db } from "../db";
import { dependencies } from "../db/schema";
import { lt, inArray } from "drizzle-orm";
import { config } from "../config";
import { recalculateConfidenceScores } from "./confidence";
import { refreshTrafficSnapshots } from "../impact/snapshot-refresh";

const STALE_THRESHOLD_HOURS = 24;

interface StaleEdge {
  id: string;
  sourceServiceId: string;
  targetServiceId: string;
  lastObservedAt: Date | null;
}

export async function flagStaleEdges(): Promise<StaleEdge[]> {
  const staleThreshold = new Date(
    Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000
  );

  const staleDeps = await db
    .select({
      id: dependencies.id,
      sourceServiceId: dependencies.sourceServiceId,
      targetServiceId: dependencies.targetServiceId,
      lastObservedAt: dependencies.lastObservedAt,
    })
    .from(dependencies)
    .where(lt(dependencies.lastObservedAt, staleThreshold));

  return staleDeps.map((dep) => ({
    id: dep.id,
    sourceServiceId: dep.sourceServiceId,
    targetServiceId: dep.targetServiceId,
    lastObservedAt: dep.lastObservedAt,
  }));
}

export async function removePermanentlyStaleEdges(): Promise<number> {
  const permanentThresholdHours = config.staleEdgeDays * 24;
  const permanentThreshold = new Date(
    Date.now() - permanentThresholdHours * 60 * 60 * 1000
  );

  const permanentlyStale = await db
    .select({ id: dependencies.id })
    .from(dependencies)
    .where(lt(dependencies.lastObservedAt, permanentThreshold));

  if (permanentlyStale.length === 0) {
    return 0;
  }

  const staleIds = permanentlyStale.map((d) => d.id);
  await db
    .delete(dependencies)
    .where(inArray(dependencies.id, staleIds));

  return staleIds.length;
}

export async function runStaleCleanup(): Promise<{
  staleEdges: { flagged: number; removed: number };
  confidence: { updated: number };
  snapshots: {
    refreshed: number;
    services: Awaited<ReturnType<typeof refreshTrafficSnapshots>>;
  };
}> {
  const stale = await flagStaleEdges();
  const removed = await removePermanentlyStaleEdges();
  const confidenceUpdated = await recalculateConfidenceScores();
  const snapshots = await refreshTrafficSnapshots();

  return {
    staleEdges: {
      flagged: stale.length,
      removed,
    },
    confidence: {
      updated: confidenceUpdated,
    },
    snapshots: {
      refreshed: snapshots.length,
      services: snapshots,
    },
  };
}
