// ═══════════════════════════════════════════
// 7. src/app/api/simulate/route.ts
// ═══════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { services } from "@/lib/db/schema";
import {
  resetForSimulation,
  simulateFailure,
} from "@/lib/detection/failure-injector";

function errorResponse(
  status: number,
  error: string,
  message: string
): NextResponse {
  return NextResponse.json({ success: false, error, message }, { status });
}

function checkDemoMode(): NextResponse | null {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return errorResponse(
      403,
      "FORBIDDEN",
      "Simulation is only available in demo mode"
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const demoCheck = checkDemoMode();
    if (demoCheck) return demoCheck;

    let body: Record<string, unknown> = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      body = {};
    }

    const serviceName =
      typeof body.serviceName === "string"
        ? body.serviceName
        : "postgres-primary";

    const shouldReset = body.reset !== false;

    if (shouldReset) {
      await resetForSimulation();
    }

    const result = await simulateFailure(serviceName);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...result,
          message:
            result.message ??
            `Failure simulated for ${serviceName}`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] POST /api/simulate failed:", error);

    if (
      error instanceof Error &&
      error.message.includes("Service not found")
    ) {
      return errorResponse(
        404,
        "SERVICE_NOT_FOUND",
        error.message
      );
    }

    return errorResponse(
      500,
      "SIMULATION_FAILED",
      error instanceof Error
        ? error.message
        : "Failed to simulate failure"
    );
  }
}

export async function GET() {
  try {
    const demoCheck = checkDemoMode();
    if (demoCheck) return demoCheck;

    const allServices = await db
      .select({
        id: services.id,
        name: services.name,
        classification: services.classification,
        ownerTeam: services.ownerTeam,
      })
      .from(services);

    return NextResponse.json(
      {
        success: true,
        data: {
          services: allServices,
          defaultTarget: "postgres-primary",
          usage: {
            simulate:
              'POST /api/simulate { serviceName: "postgres-primary" }',
            reset:
              'POST /api/simulate { serviceName: "postgres-primary", reset: true }',
            availableTargets: allServices.map((s) => s.name),
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] GET /api/simulate failed:", error);
    return errorResponse(
      500,
      "SIMULATION_FAILED",
      "Failed to list simulation targets"
    );
  }
}
