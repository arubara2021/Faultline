// ═══════════════════════════════════════════
// 5. scripts/test-api-simulate.ts
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
    await pool.query(`DELETE FROM blast_radius_results`);
    await pool.query(`DELETE FROM incidents`);
    await pool.query(`DELETE FROM failure_events`);
    await pool.query(
      `UPDATE services SET health_status = 'healthy', updated_at = NOW()`
    );
    await pool.query(`UPDATE health_signals SET is_breach = false`);
    console.log("  ✓ Database state reset");
  } catch (error) {
    console.error("  ✗ Reset failed:", (error as Error).message);
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Test POST /api/simulate");
  console.log("═══════════════════════════════════════════");

  console.log("\n── Resetting database state ──");
  await resetDatabaseState();

  console.log("\n── GET Available Targets ──");

  try {
    const response = await fetch(`${BASE_URL}/api/simulate`);
    assert("GET returns 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("GET has success field", body.success === true);
    assert("GET has services array", Array.isArray(body.data.services));
    assert("GET services count is 14", body.data.services.length === 14, `got ${body.data.services.length}`);
    assert("GET has defaultTarget", typeof body.data.defaultTarget === "string");
    assert("GET has usage object", body.data.usage !== undefined);
    assert("Usage has simulate key", typeof body.data.usage.simulate === "string");
    assert("Usage has reset key", typeof body.data.usage.reset === "string");
    assert("Usage has availableTargets", Array.isArray(body.data.usage.availableTargets));

    if (body.data.services.length > 0) {
      const first = body.data.services[0];
      assert("Service has id", typeof first.id === "string");
      assert("Service has name", typeof first.name === "string");
      assert("Service has classification", typeof first.classification === "string");
      assert("Service has ownerTeam", typeof first.ownerTeam === "string");
    }

    console.log("\n── Available Targets ──");
    console.log(`  Default: ${body.data.defaultTarget}`);
    console.log(`  Count: ${body.data.services.length}`);

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── POST Simulate Default (postgres-primary) ──");

  try {
    const response = await fetch(`${BASE_URL}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert("Simulate returns 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Response has success field", body.success === true);

    const data = body.data;
    assert("Has incidentId", typeof data.incidentId === "string");
    assert("Has failureEventId", typeof data.failureEventId === "string");
    assert("Has failedService", typeof data.failedService === "string");
    assert("Has blastRadiusCount", typeof data.blastRadiusCount === "number");
    assert("blastRadiusCount is 13+", data.blastRadiusCount >= 13, `got ${data.blastRadiusCount}`);
    assert("Has totalRevenuePerMinCents", typeof data.totalRevenuePerMinCents === "number");
    assert("Has totalRevenuePerMinDollars", typeof data.totalRevenuePerMinDollars === "number");
    assert("totalRevenuePerMinDollars matches cents", data.totalRevenuePerMinDollars === data.totalRevenuePerMinCents / 100);
    assert("Has cascadeDepth", typeof data.cascadeDepth === "number");
    assert("cascadeDepth is 2+", data.cascadeDepth >= 2, `got ${data.cascadeDepth}`);
    assert("Has customerFacingAffected", typeof data.customerFacingAffected === "number");
    assert("customerFacingAffected is 4+", data.customerFacingAffected >= 4, `got ${data.customerFacingAffected}`);
    assert("Has affectedServices array", Array.isArray(data.affectedServices));
    assert("affectedServices count matches blastRadiusCount", data.affectedServices.length === data.blastRadiusCount);
    assert("Has message", typeof data.message === "string");
    assert("Message mentions postgres-primary", data.message.includes("postgres-primary"));

    if (data.affectedServices.length > 0) {
      const first = data.affectedServices[0];
      assert("Affected service has name", typeof first.name === "string");
      assert("Affected service has depth", typeof first.depth === "number");
      assert("Affected service has classification", typeof first.classification === "string");
      assert("Affected service has isCustomerFacing", typeof first.isCustomerFacing === "boolean");
      assert("Affected service has revenuePerMinCents", typeof first.revenuePerMinCents === "number");
    }

    const cf = data.affectedServices.filter(
      (s: { isCustomerFacing: boolean }) => s.isCustomerFacing
    );
    assert("Customer-facing services identified", cf.length > 0);
    const cfNames = cf.map((s: { name: string }) => s.name);
    assert("CF has product-catalog", cfNames.includes("product-catalog"));
    assert("CF has checkout-api", cfNames.includes("checkout-api"));
    assert("CF has signup-flow", cfNames.includes("signup-flow"));

    console.log("\n── Simulation Results ──");
    console.log(`  Failed: ${data.failedService}`);
    console.log(`  Blast radius: ${data.blastRadiusCount} services`);
    console.log(`  Cascade depth: ${data.cascadeDepth}`);
    console.log(`  Customer-facing: ${data.customerFacingAffected}`);
    console.log(`  Revenue: $${data.totalRevenuePerMinDollars.toFixed(2)}/min`);
    console.log(`  Incident: {data.incidentId}`);

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Verifying Database State After Simulation ──");

  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    assert("GET health returns 200", response.status === 200, `got ${response.status}`);
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── POST Simulate Custom Service ──");

  try {
    await resetDatabaseState();

    const response = await fetch(`${BASE_URL}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceName: "payment-service" }),
    });

    assert("Custom simulate returns 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Custom has success", body.success === true);
    assert("Custom failedService is payment-service", body.data.failedService === "payment-service");
    assert("Custom has incidentId", typeof body.data.incidentId === "string");
    assert("Custom has blastRadiusCount", typeof body.data.blastRadiusCount === "number");
    assert("Custom blastRadiusCount >= 1", body.data.blastRadiusCount >= 1, `got ${body.data.blastRadiusCount}`);

    console.log("\n── Custom Simulation Results ──");
    console.log(`  Failed: ${body.data.failedService}`);
    console.log(`  Blast radius: ${body.data.blastRadiusCount} services`);
    console.log(`  Revenue: $$$${body.data.totalRevenuePerMinDollars.toFixed(2)}/min`);

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── POST Simulate with Reset ──");

  try {
    const response = await fetch(`${BASE_URL}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });

    assert("Reset simulate returns 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Reset has success", body.success === true);
    assert("Reset failedService is postgres-primary", body.data.failedService === "postgres-primary");
    assert("Reset blastRadiusCount is 13+", body.data.blastRadiusCount >= 13, `got ${body.data.blastRadiusCount}`);

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Simulate Non-existent Service ──");

  try {
    const response = await fetch(`${BASE_URL}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceName: "does-not-exist", reset: false }),
    });

    assert("Non-existent returns 404", response.status === 404, `got ${response.status}`);
    const body = await response.json();
    assert("Non-existent has success false", body.success === false);
    assert("Non-existent has SERVICE_NOT_FOUND error", body.error === "SERVICE_NOT_FOUND");
    assert("Non-existent has error message", typeof body.message === "string");

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Simulate Invalid JSON ──");

  try {
    const response = await fetch(`${BASE_URL}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    assert("Invalid JSON still works (empty body fallback)", response.status === 200, `got ${response.status}`);
    const body = await response.json();
    assert("Falls back to default service", body.data.failedService === "postgres-primary");

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
