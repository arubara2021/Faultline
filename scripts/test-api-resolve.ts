// ═══════════════════════════════════════════
// 7. scripts/test-api-resolve.ts
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

async function resetForResolve() {
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
    console.log("  ✓ Database reset for resolve tests");
  } catch (error) {
    console.error("  ✗ Reset failed:", (error as Error).message);
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Test POST /api/resolve");
  console.log("═══════════════════════════════════════════");

  console.log("\n── Resetting database ──");
  await resetForResolve();

  let incidentId: string | undefined;

  try {
    const listRes = await fetch(`${BASE_URL}/api/incidents`);
    const listBody = await listRes.json();
    incidentId = listBody.data?.active?.id;
    assert("Got active incident ID", !!incidentId);
  } catch (error) {
    assert("Got active incident ID", false, (error as Error).message);
  }

  console.log("\n── Resolve Active Incident ──");

  if (!incidentId) {
    assert("Resolve active incident", false, "no incident ID available");
  } else {
    try {
      const response = await fetch(`${BASE_URL}/api/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });

      assert("Resolve returns 200", response.status === 200, `got ${response.status}`);

      const body = await response.json();
      assert("Resolve has success field", body.success === true);

      const data = body.data;
      assert("Has incidentId", data.incidentId === incidentId);
      assert("Has resolvedAt", typeof data.resolvedAt === "string");
      assert("Has durationMinutes", typeof data.durationMinutes === "number");
      assert("durationMinutes >= 0", data.durationMinutes >= 0);
      assert("Has durationFormatted", typeof data.durationFormatted === "string");
      assert("durationFormatted contains m", data.durationFormatted.includes("m"));
      assert("Has affectedServiceCount", typeof data.affectedServiceCount === "number");
      assert("affectedServiceCount > 0", data.affectedServiceCount > 0, `got ${data.affectedServiceCount}`);
      assert("Has totalRevenueImpactCents", typeof data.totalRevenueImpactCents === "number");
      assert("Has totalRevenueImpactDollars", typeof data.totalRevenueImpactDollars === "number");
      assert("totalRevenueImpactDollars matches cents", data.totalRevenueImpactDollars === Math.round(data.totalRevenueImpactCents / 100 * 100) / 100);
      assert("Has message", typeof data.message === "string");
      assert("Message mentions incident ID", data.message.includes(incidentId));
      assert("Message mentions resolved", data.message.toLowerCase().includes("resolved"));

      console.log("\n── Resolve Results ──");
      console.log(`  Incident: ${data.incidentId}`);
      console.log(`  Duration: ${data.durationFormatted}`);
      console.log(`  Affected: ${data.affectedServiceCount} services`);
      console.log(`  Impact: $$$${data.totalRevenueImpactDollars.toFixed(2)}`);

    } catch (error) {
      console.error("\nFatal error:", error);
      failed++;
    }
  }

  console.log("\n── Double Resolve (409 Conflict) ──");

  if (!incidentId) {
    assert("Double resolve", false, "no incident ID available");
  } else {
    try {
      const response = await fetch(`${BASE_URL}/api/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });

      assert("Double resolve returns 409", response.status === 409, `got ${response.status}`);

      const body = await response.json();
      assert("Double resolve has success false", body.success === false);
      assert("Double resolve error is ALREADY_RESOLVED", body.error === "ALREADY_RESOLVED");
      assert("Double resolve has message", typeof body.message === "string");

    } catch (error) {
      console.error("\nFatal error:", error);
      failed++;
    }
  }

  console.log("\n── Invalid Incident ID ──");

  try {
    const response = await fetch(`${BASE_URL}/api/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentId: "not-a-uuid" }),
    });

    assert("Invalid UUID returns 400", response.status === 400, `got ${response.status}`);
    const body = await response.json();
    assert("Invalid UUID has success false", body.success === false);
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Non-existent Incident ID ──");

  try {
    const response = await fetch(`${BASE_URL}/api/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentId: "00000000-0000-0000-0000-000000000000" }),
    });

    assert("Non-existent returns 404", response.status === 404, `got ${response.status}`);
    const body = await response.json();
    assert("Non-existent has success false", body.success === false);
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Missing Incident ID ──");

  try {
    const response = await fetch(`${BASE_URL}/api/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert("Missing ID returns 400", response.status === 400, `got ${response.status}`);
    const body = await response.json();
    assert("Missing ID has success false", body.success === false);
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Invalid JSON ──");

  try {
    const response = await fetch(`${BASE_URL}/api/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    assert("Invalid JSON returns 400", response.status === 400, `got ${response.status}`);
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Resetting for next tests ──");
  await resetForResolve();

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
