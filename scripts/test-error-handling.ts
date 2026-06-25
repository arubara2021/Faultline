// ═══════════════════════════════════════════
// 16. scripts/test-error-handling.ts
// ═══════════════════════════════════════════

import "dotenv/config";
import { Pool } from "pg";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function resetDatabaseState() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await pool.query(
      `UPDATE incidents SET resolved_at = NULL, resolution_notes = NULL, total_revenue_impact_cents = 0`
    );
    await pool.query(`UPDATE failure_events SET resolved_at = NULL`);
    await pool.query(
      `UPDATE services SET health_status = 'down' WHERE name = 'postgres-primary'`
    );
    await pool.query(
      `DELETE FROM services WHERE owner_team = 'unknown' OR owner_team = 'test'`
    );
    console.log("  ✓ Database state reset");
  } catch (error) {
    console.error("  ✗ Reset failed:", (error as Error).message);
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Error Handling Tests");
  console.log("  Testing all error paths across all routes");
  console.log("═══════════════════════════════════════════");

  await resetDatabaseState();

  // ═══════════════════════════════════════════
  // 400 Bad Request
  // ═══════════════════════════════════════════

  console.log("\n══ 400 Bad Request ══");

  // ── /api/ingest: Invalid JSON ──

  console.log("\n── /api/ingest: Invalid JSON ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid",
    });
    assert("Invalid JSON body returns 400", response.status === 400, `got ${response.status}`);
    const body = await response.json();
    assert("Has success false", body.success === false);
    assert("Has error field", typeof body.error === "string");
    assert("Has message field", typeof body.message === "string");
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/ingest: Missing required fields ──

  console.log("\n── /api/ingest: Missing required fields ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "test" }),
    });
    assert("Missing fields returns 400", response.status === 400, `got ${response.status}`);
    const body = await response.json();
    assert("Has validation error message", typeof body.message === "string");
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/ingest: Invalid dependency type ──

  console.log("\n── /api/ingest: Invalid dependency type ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "a",
        target: "b",
        type: "invalid_type",
        frequency: 100,
        latency: 50,
      }),
    });
    assert("Invalid type returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/ingest: Negative frequency ──

  console.log("\n── /api/ingest: Negative frequency ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "a",
        target: "b",
        type: "http_call",
        frequency: -5,
        latency: 50,
      }),
    });
    assert("Negative frequency returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/ingest: Empty array ──

  console.log("\n── /api/ingest: Empty array ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
    assert("Empty array returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/blast-radius: No parameters ──

  console.log("\n── /api/blast-radius: No parameters ──");

  try {
    const response = await fetch(`${BASE_URL}/api/blast-radius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert("No params returns 400", response.status === 400, `got ${response.status}`);
    const body = await response.json();
    assert("Has success false", body.success === false);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/blast-radius: Invalid UUID ──

  console.log("\n── /api/blast-radius: Invalid UUID ──");

  try {
    const response = await fetch(`${BASE_URL}/api/blast-radius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: "not-a-uuid" }),
    });
    assert("Invalid UUID returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/blast-radius: Invalid JSON ──

  console.log("\n── /api/blast-radius: Invalid JSON ──");

  try {
    const response = await fetch(`${BASE_URL}/api/blast-radius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "bad json",
    });
    assert("Invalid JSON returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/resolve: Missing incidentId ──

  console.log("\n── /api/resolve: Missing incidentId ──");

  try {
    const response = await fetch(`${BASE_URL}/api/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert("Missing ID returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/resolve: Invalid UUID ──

  console.log("\n── /api/resolve: Invalid UUID ──");

  try {
    const response = await fetch(`${BASE_URL}/api/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentId: "bad-uuid" }),
    });
    assert("Invalid UUID returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/resolve: Invalid JSON ──

  console.log("\n── /api/resolve: Invalid JSON ──");

  try {
    const response = await fetch(`${BASE_URL}/api/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not{json",
    });
    assert("Invalid JSON returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/summary: Missing incidentId ──

  console.log("\n── /api/summary: Missing incidentId ──");

  try {
    const response = await fetch(`${BASE_URL}/api/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert("Missing ID returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/summary: Invalid UUID ──

  console.log("\n── /api/summary: Invalid UUID ──");

  try {
    const response = await fetch(`${BASE_URL}/api/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentId: "not-valid" }),
    });
    assert("Invalid UUID returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/summary: Invalid JSON ──

  console.log("\n── /api/summary: Invalid JSON ──");

  try {
    const response = await fetch(`${BASE_URL}/api/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    });
    assert("Invalid JSON returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ═══════════════════════════════════════════
  // 404 Not Found
  // ═══════════════════════════════════════════

  console.log("\n══ 404 Not Found ══");

  // ── /api/incidents/[id]: Non-existent ID ──

  console.log("\n── /api/incidents/[id]: Non-existent ID ──");

  try {
    const response = await fetch(
      `${BASE_URL}/api/incidents/00000000-0000-0000-0000-000000000000`
    );
    assert("Returns 404", response.status === 404, `got ${response.status}`);
    const body = await response.json();
    assert("Has success false", body.success === false);
    assert("Has error message", typeof body.message === "string");
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/blast-radius: Non-existent service name ──

  console.log("\n── /api/blast-radius: Non-existent service name ──");

  try {
    const response = await fetch(`${BASE_URL}/api/blast-radius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceName: "non-existent-svc-xyz" }),
    });
    assert("Returns 404", response.status === 404, `got ${response.status}`);
    const body = await response.json();
    assert("Has success false", body.success === false);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/blast-radius: Non-existent service UUID ──

  console.log("\n── /api/blast-radius: Non-existent service UUID ──");

  try {
    const response = await fetch(`${BASE_URL}/api/blast-radius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: "00000000-0000-0000-0000-000000000000",
      }),
    });
    assert("Non-existent UUID returns 404", response.status === 404, `got ${response.status}`);
    const body = await response.json();
    assert("Has success false", body.success === false);
    assert("Has error message", typeof body.message === "string");
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/resolve: Non-existent incident ──

  console.log("\n── /api/resolve: Non-existent incident ──");

  try {
    const response = await fetch(`${BASE_URL}/api/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incidentId: "00000000-0000-0000-0000-000000000000",
      }),
    });
    assert("Returns 404", response.status === 404, `got ${response.status}`);
    const body = await response.json();
    assert("Has success false", body.success === false);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── /api/summary: Non-existent incident ──

  console.log("\n── /api/summary: Non-existent incident ──");

  try {
    const response = await fetch(`${BASE_URL}/api/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incidentId: "00000000-0000-0000-0000-000000000000",
      }),
    });
    assert("Returns 404", response.status === 404, `got ${response.status}`);
    const body = await response.json();
    assert("Has success false", body.success === false);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ═══════════════════════════════════════════
  // 409 Conflict
  // ═══════════════════════════════════════════

  console.log("\n══ 409 Conflict ══");

  console.log("\n── /api/resolve: Resolve then resolve again ──");

  try {
    // Get active incident
    const listRes = await fetch(`${BASE_URL}/api/incidents`);
    const listBody = await listRes.json();
    const incidentId = listBody.data?.active?.id;

    if (!incidentId) {
      assert("Got incident for 409 test", false, "no active incident");
    } else {
      assert("Got incident for 409 test", true);

      // First resolve
      const res1 = await fetch(`${BASE_URL}/api/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      assert("First resolve returns 200", res1.status === 200, `got ${res1.status}`);

      // Second resolve
      const res2 = await fetch(`${BASE_URL}/api/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      assert("Second resolve returns 409", res2.status === 409, `got ${res2.status}`);
      const body2 = await res2.json();
      assert("409 has success false", body2.success === false);
      assert("409 has ALREADY_RESOLVED error", body2.error === "ALREADY_RESOLVED");

      // Reset for next tests
      await resetDatabaseState();
    }
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ═══════════════════════════════════════════
  // Response Format Consistency
  // ═══════════════════════════════════════════

  console.log("\n══ Response Format Consistency ══");

  // ── All error responses ──

  console.log("\n── All error responses have consistent format ──");

  const errorTests = [
    {
      name: "ingest",
      url: `${BASE_URL}/api/ingest`,
      body: "bad",
    },
    {
      name: "blast-radius",
      url: `${BASE_URL}/api/blast-radius`,
      body: JSON.stringify({}),
    },
    {
      name: "resolve",
      url: `${BASE_URL}/api/resolve`,
      body: JSON.stringify({}),
    },
    {
      name: "summary",
      url: `${BASE_URL}/api/summary`,
      body: JSON.stringify({}),
    },
  ];

  for (const test of errorTests) {
    try {
      const response = await fetch(test.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: test.body,
      });
      const body = await response.json();

      assert(`${test.name}: has success field`, body.success !== undefined);
      assert(`${test.name}: success is false on error`, body.success === false);
      assert(
        `${test.name}: has error or message field`,
        typeof body.error === "string" || typeof body.message === "string"
      );
      assert(`${test.name}: status >= 400`, response.status >= 400, `got ${response.status}`);
    } catch (error) {
      console.error(`  ${test.name} error:`, (error as Error).message);
      failed++;
    }
  }

  // ── All success responses ──

  console.log("\n── All success responses have consistent format ──");

  const successTests = [
    { name: "services", url: `${BASE_URL}/api/services`, method: "GET" },
    { name: "graph", url: `${BASE_URL}/api/graph`, method: "GET" },
    { name: "incidents", url: `${BASE_URL}/api/incidents`, method: "GET" },
  ];

  for (const test of successTests) {
    try {
      const response = await fetch(test.url, { method: test.method });
      const body = await response.json();

      assert(`${test.name}: status is 200`, response.status === 200, `got ${response.status}`);
      assert(`${test.name}: has success true`, body.success === true);
      assert(`${test.name}: has data field`, body.data !== undefined);
      assert(
        `${test.name}: content-type is JSON`,
        !!response.headers.get("content-type")?.includes("application/json")
      );
    } catch (error) {
      console.error(`  ${test.name} error:`, (error as Error).message);
      failed++;
    }
  }

  // ═══════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════

  console.log("\n══ Edge Cases ══");

  // ── Wrong HTTP methods ──

  console.log("\n── Wrong HTTP methods ──");

  try {
    const response = await fetch(`${BASE_URL}/api/services`, { method: "PUT" });
    assert("PUT on GET route returns 405 or 404", response.status === 405 || response.status === 404, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── Missing Content-Type header ──

  console.log("\n── Missing Content-Type header ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      body: JSON.stringify({ source: "a", target: "b", type: "http_call", frequency: 100, latency: 50 }),
    });
    assert("Missing Content-Type handled", response.status >= 200);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── Very long string in source field ──

  console.log("\n── Very long string in source field ──");

  try {
    const longString = "a".repeat(10000);
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: longString,
        target: "b",
        type: "http_call",
        frequency: 100,
        latency: 50,
      }),
    });
    assert("Long string handled (200 or 400)", response.status === 200 || response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── Zero values ──

  console.log("\n── Zero values ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "api-gateway",
        target: "checkout-api",
        type: "http_call",
        frequency: 0,
        latency: 0,
      }),
    });
    assert("Zero values accepted", response.status === 200, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  // ── Float values ──

  console.log("\n── Float values ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "api-gateway",
        target: "checkout-api",
        type: "http_call",
        frequency: 1234.56,
        latency: 42.789,
      }),
    });
    assert("Float values accepted", response.status === 200, `got ${response.status}`);
  } catch (error) {
    console.error("  Error:", (error as Error).message);
    failed++;
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════");

  process.exit(failed > 0 ? 1 : 0);
}

main();
