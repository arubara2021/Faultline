import { NextResponse } from "next/server";
import { flagStaleEdges, removePermanentlyStaleEdges } from "@/lib/graph/stale";
import { recalculateConfidenceScores } from "@/lib/graph/confidence";
import { refreshTrafficSnapshots } from "@/lib/impact/snapshot-refresh";

export async function POST() {
  try {
    const staleResult = await flagStaleEdges();
    const removed = await removePermanentlyStaleEdges();

    const [confidenceUpdated, snapshotResults] = await Promise.all([
      recalculateConfidenceScores(),
      refreshTrafficSnapshots(),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          staleEdges: {
            flagged: staleResult.length,
            removed,
          },
          confidence: {
            updated: confidenceUpdated,
          },
          snapshots: {
            refreshed: snapshotResults.length,
            services: snapshotResults.map((s) => ({
              name: s.serviceName,
              revenuePerMinCents: s.revenuePerMinCents,
              recalculated: s.recalculated,
            })),
          },
        },
        message: `Reconciliation complete: ${staleResult.length} stale edges flagged, ${removed} removed, ${confidenceUpdated} confidence scores updated, ${snapshotResults.length} snapshots refreshed`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] POST /api/reconcile failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Reconciliation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
