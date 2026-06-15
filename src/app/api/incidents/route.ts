// ═══════════════════════════════════════════
// 1. src/app/api/incidents/route.ts
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { incidents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const allIncidents = await withDbRetry(() =>
      db.select().from(incidents).orderBy(desc(incidents.startedAt))
    );

    const active = allIncidents.find((i) => !i.resolvedAt) ?? null;
    const activeCount = allIncidents.filter((i) => !i.resolvedAt).length;
    const resolvedCount = allIncidents.filter((i) => !!i.resolvedAt).length;

    return NextResponse.json(
      {
        success: true,
        data: {
          active,
          activeCount,
          resolvedCount,
          incidents: allIncidents,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] GET /api/incidents failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Failed to fetch incidents",
      },
      { status: 500 }
    );
  }
}
