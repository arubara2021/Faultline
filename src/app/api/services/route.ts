// ═══════════════════════════════════════════
// 25. src/app/api/services/route.ts
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { services } from "@/lib/db/schema";

export async function GET() {
  try {
    const allServices = await withDbRetry(() =>
      db
        .select({
          id: services.id,
          name: services.name,
          ownerTeam: services.ownerTeam,
          classification: services.classification,
          healthStatus: services.healthStatus,
          lastHealthCheckAt: services.lastHealthCheckAt,
          createdAt: services.createdAt,
          updatedAt: services.updatedAt,
        })
        .from(services)
        .orderBy(services.name)
    );

    const summary = {
      total: allServices.length,
      healthy: allServices.filter((s) => s.healthStatus === "healthy").length,
      degraded: allServices.filter((s) => s.healthStatus === "degraded").length,
      down: allServices.filter((s) => s.healthStatus === "down").length,
      unknown: allServices.filter((s) => s.healthStatus === "unknown").length,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          services: allServices,
          summary,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] GET /api/services failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "SERVICES_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Failed to fetch services",
      },
      { status: 500 }
    );
  }
}
