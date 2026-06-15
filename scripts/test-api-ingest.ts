// ═══════════════════════════════════════════
// 24. scripts/test-api-ingest.ts
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

async function cleanupTestService() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await pool.query(
      `DELETE FROM current_traffic_snapshots WHERE service_id IN (SELECT id FROM services WHERE name = 'test-new-service')`
    );
    await pool.query(
      `DELETE FROM health_signals WHERE service_id IN (SELECT id FROM services WHERE name = 'test-new-service')`
    );
    await pool.query(
      `DELETE FROM dependencies WHERE source_service_id IN (SELECT id FROM services WHERE name = 'test-new-service') OR target_service_id IN (SELECT id FROM services WHERE name = 'test-new-service')`
    );
    await pool.query(
      `DELETE FROM services WHERE name = 'test-new-service'`
    );
    console.log("  ✓ Cleaned up test-new-service");
  } catch (error) {
    console.error("  ✗ Cleanup failed:", (error as Error).message);
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Test POST /api/ingest");
  console.log("═══════════════════════════════════════════");

  console.log("\n── Valid Single Payload ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "api-gateway",
        target: "checkout-api",
        type: "http_call",
        frequency: 2500,
        latency: 44.5,
      }),
    });

    assert("Status is 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Response has success field", body.success === true);
    assert("Response has inserted or updated count", body.data.inserted + body.data.updated >= 1);
    assert("No errors", body.data.errors.length === 0, `errors: ${JSON.stringify(body.data.errors)}`);

    console.log(`  Action: ${body.data.inserted > 0 ? "inserted" : "updated"}`);

  } catch (error) {
    console.error("  Request failed:", error);
    failed++;
  }

  console.log("\n── Valid Batch Payload ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          source: "cart-service",
          target: "inventory-service",
          type: "http_call",
          frequency: 3600,
          latency: 32.1,
        },
        {
          source: "payment-service",
          target: "postgres-primary",
          type: "database_access",
          frequency: 3600,
          latency: 8.2,
        },
      ]),
    });

    assert("Batch status is 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Batch has success field", body.success === true);
    assert("Batch totalProcessed is 2", body.data.totalProcessed === 2, `got ${body.data.totalProcessed}`);

  } catch (error) {
    console.error("  Request failed:", error);
    failed++;
  }

  console.log("\n── Missing Required Fields ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "api-gateway",
      }),
    });

    assert("Missing fields returns 400", response.status === 400, `got ${response.status}`);

    const body = await response.json();
    assert("Missing fields has success false", body.success === false);
    assert("Missing fields has error message", typeof body.message === "string");

  } catch (error) {
    console.error("  Request failed:", error);
    failed++;
  }

  console.log("\n── Invalid Dependency Type ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "api-gateway",
        target: "checkout-api",
        type: "invalid_type",
        frequency: 100,
        latency: 50,
      }),
    });

    assert("Invalid type returns 400", response.status === 400, `got ${response.status}`);

    const body = await response.json();
    assert("Invalid type has success false", body.success === false);

  } catch (error) {
    console.error("  Request failed:", error);
    failed++;
  }

  console.log("\n── Empty Body ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });

    assert("Invalid JSON returns 400", response.status === 400, `got ${response.status}`);

    const body = await response.json();
    assert("Invalid JSON has success false", body.success === false);

  } catch (error) {
    console.error("  Request failed:", error);
    failed++;
  }

  console.log("\n── Negative Frequency ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "api-gateway",
        target: "checkout-api",
        type: "http_call",
        frequency: -100,
        latency: 50,
      }),
    });

    assert("Negative frequency returns 400", response.status === 400, `got ${response.status}`);

  } catch (error) {
    console.error("  Request failed:", error);
    failed++;
  }

  console.log("\n── Empty Batch ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });

    assert("Empty batch returns 400", response.status === 400, `got ${response.status}`);

  } catch (error) {
    console.error("  Request failed:", error);
    failed++;
  }

  console.log("\n── New Service Auto-Creation ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "test-new-service",
        target: "api-gateway",
        type: "http_call",
        frequency: 50,
        latency: 100,
      }),
    });

    assert("New service ingest returns 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("New service created", body.data.inserted === 1, `got ${body.data.inserted}`);

  } catch (error) {
    console.error("  Request failed:", error);
    failed++;
  }

  console.log("\n── Self-Dependency ──");

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "api-gateway",
        target: "api-gateway",
        type: "http_call",
        frequency: 100,
        latency: 50,
      }),
    });

    assert("Self-dependency handled", response.status >= 400 || (await response.clone().json()).data?.errors?.length > 0);

  } catch (error) {
    console.error("  Request failed:", error);
    failed++;
  }

  console.log("\n── Cleaning up test data ──");
  await cleanupTestService();

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════");

  process.exit(failed > 0 ? 1 : 0);
}

main();
