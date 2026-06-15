// src/app/api/ingest/route.ts

import { NextRequest, NextResponse } from "next/server";
import { ingestDependencySummary, ingestBatch } from "@/lib/graph/ingest";
import type { IngestPayload } from "@/lib/types";

const VALID_DEPENDENCY_TYPES = new Set([
  "http_call",
  "database_access",
  "message_queue",
  "shared_cache",
  "dns",
  "configuration",
]);

function validatePayload(
  payload: unknown,
  index?: number
): { valid: boolean; errors: string[] } {
  const prefix = index !== undefined ? `Item ${index}: ` : "";

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: [`${prefix}payload must be an object`] };
  }

  const p = payload as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof p.source !== "string" || p.source.length === 0) {
    errors.push(`${prefix}source is required and must be a non-empty string`);
  }

  if (typeof p.target !== "string" || p.target.length === 0) {
    errors.push(`${prefix}target is required and must be a non-empty string`);
  }

  if (typeof p.type !== "string" || p.type.length === 0) {
    errors.push(`${prefix}type is required and must be a non-empty string`);
  } else if (!VALID_DEPENDENCY_TYPES.has(p.type)) {
    errors.push(
      `${prefix}type must be one of: ${Array.from(VALID_DEPENDENCY_TYPES).join(", ")}`
    );
  }

  if (typeof p.frequency !== "number" || p.frequency < 0) {
    errors.push(`${prefix}frequency must be a non-negative number`);
  }

  if (typeof p.latency !== "number" || p.latency < 0) {
    errors.push(`${prefix}latency must be a non-negative number`);
  }

  return { valid: errors.length === 0, errors };
}

function toPayload(body: Record<string, unknown>): IngestPayload {
  return {
    source: body.source as string,
    target: body.target as string,
    type: body.type as string,
    frequency: body.frequency as number,
    latency: body.latency as number,
    timestamp: body.timestamp as string | undefined,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    const text = await request.text();
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Empty request body",
          message: "Request body must not be empty",
        },
        { status: 400 }
      );
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON",
        message: "Request body must be valid JSON",
      },
      { status: 400 }
    );
  }

  try {
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Empty batch",
            message: "Batch must contain at least one payload",
          },
          { status: 400 }
        );
      }

      const allErrors: string[] = [];
      const validPayloads: IngestPayload[] = [];

      for (let i = 0; i < body.length; i++) {
        const validation = validatePayload(body[i], i);
        if (validation.valid) {
          validPayloads.push(toPayload(body[i] as Record<string, unknown>));
        } else {
          allErrors.push(...validation.errors);
        }
      }

      if (validPayloads.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "No valid payloads",
            message: allErrors.join("; "),
            details: allErrors,
          },
          { status: 400 }
        );
      }

      const result = await ingestBatch(validPayloads);

      return NextResponse.json({
        success: true,
        data: {
          inserted: result.inserted,
          updated: result.updated,
          totalProcessed: result.inserted + result.updated,
          errors: [...allErrors, ...result.errors],
        },
      });
    }

    const validation = validatePayload(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          message: validation.errors.join("; "),
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const payload = toPayload(body as Record<string, unknown>);
    const result = await ingestDependencySummary(payload);

    return NextResponse.json({
      success: true,
      data: {
        inserted: result.action === "inserted" ? 1 : 0,
        updated: result.action === "updated" ? 1 : 0,
        totalProcessed: 1,
        action: result.action,
        edgeId: result.edgeId,
        errors: [],
      },
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes("Self-dependency")) {
      return NextResponse.json(
        {
          success: false,
          error: "Self-dependency detected",
          message,
        },
        { status: 400 }
      );
    }

    console.error("[API] POST /api/ingest failed:", error);
    return NextResponse.json(
      { success: false, error: "Ingestion failed" },
      { status: 500 }
    );
  }
}
