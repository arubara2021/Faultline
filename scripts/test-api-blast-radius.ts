// scripts/test-api-blast-radius.ts

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
  let pool: Pool | null = null;
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    await pool.query(
      `DELETE FROM blast_radius_results WHERE incident_id IN (SELECT id FROM incidents WHERE started_at > NOW() - INTERVAL '5 minutes')`
    );
    await pool.query(
      `DELETE FROM incidents WHERE started_at > NOW() - INTERVAL '5 minutes'`
    );
    await pool.query(
      `DELETE FROM failure_events WHERE id NOT IN (SELECT root_failure_event_id FROM incidents)`
    );
    await pool.query(`DELETE FROM services WHERE owner_team = 'unknown'`);
    await pool.query(
      `UPDATE services SET health_status = 'down' WHERE name = 'postgres-primary'`
    );
    console.log("  ✓ Database state reset");
  } catch (error) {
    console.error("  ✗ Reset failed:", (error as Error).message);
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch {}
    }
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Test POST /api/blast-radius");
  console.log("═══════════════════════════════════════════");

  console.log("\n── Resetting database state ──");
  await resetDatabaseState();

  console.log("\n── By Service Name ──");

  try {
    const response = await fetch(`${BASE_URL}/api/blast-radius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceName: "postgres-primary" }),
    });

    assert("Status is 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Response has success field", body.success === true);

    const { failedService, downstream, upstream, fixPriorities, summary } = body.data;

    assert("failedService name is postgres-primary", failedService.name === "postgres-primary");
    assert("failedService has id", typeof failedService.id === "string");

    assert("Downstream is an array", Array.isArray(downstream));
    assert("Downstream count is 13+", downstream.length >= 13, `got ${downstream.length}`);

    const depth1 = downstream.filter((d: { depth: number }) => d.depth === 1);
    const depth2 = downstream.filter((d: { depth: number }) => d.depth === 2);

    assert("Depth 1 count is 7+", depth1.length >= 7, `got ${depth1.length}`);
    assert("Depth 2 count is 5+", depth2.length >= 5, `got ${depth2.length}`);

    const d1Names = depth1.map((d: { serviceName: string }) => d.serviceName);
    assert("Depth 1 has fraud-detector", d1Names.includes("fraud-detector"));
    assert("Depth 1 has product-catalog", d1Names.includes("product-catalog"));
    assert("Depth 1 has user-service", d1Names.includes("user-service"));
    assert("Depth 1 has billing-worker", d1Names.includes("billing-worker"));
    assert("Depth 1 has inventory-service", d1Names.includes("inventory-service"));
    assert("Depth 1 has analytics-collector", d1Names.includes("analytics-collector"));
    assert("Depth 1 has notification-service", d1Names.includes("notification-service"));

    const d2Names = depth2.map((d: { serviceName: string }) => d.serviceName);
    assert("Depth 2 has checkout-api", d2Names.includes("checkout-api"));
    assert("Depth 2 has signup-flow", d2Names.includes("signup-flow"));
    assert("Depth 2 has cart-service", d2Names.includes("cart-service"));
    assert("Depth 2 has api-gateway", d2Names.includes("api-gateway"));

    const cf = downstream.filter((d: { isCustomerFacing: boolean }) => d.isCustomerFacing);
    assert("Customer-facing count is 4+", cf.length >= 4, `got ${cf.length}`);
    const cfNames = cf.map((d: { serviceName: string }) => d.serviceName);
    assert("Customer-facing has product-catalog", cfNames.includes("product-catalog"));
    assert("Customer-facing has checkout-api", cfNames.includes("checkout-api"));
    assert("Customer-facing has signup-flow", cfNames.includes("signup-flow"));

    const first = downstream[0];
    assert("Entry has serviceName", typeof first.serviceName === "string");
    assert("Entry has serviceId", typeof first.serviceId === "string");
    assert("Entry has depth", typeof first.depth === "number");
    assert("Entry has classification", typeof first.classification === "string");
    assert("Entry has ownerTeam", typeof first.ownerTeam === "string");
    assert("Entry has dependencyType", typeof first.dependencyType === "string");
    assert("Entry has isCustomerFacing", typeof first.isCustomerFacing === "boolean");
    assert("Entry has revenuePerMinCents", typeof first.revenuePerMinCents === "number");
    assert("Entry has path", Array.isArray(first.path));

    assert("Upstream is an array", Array.isArray(upstream));

    assert("fixPriorities is an array", Array.isArray(fixPriorities));
    assert("fixPriorities is empty for root cause", fixPriorities.length === 0, `got ${fixPriorities.length}`);

    assert("Summary has totalAffected", typeof summary.totalAffected === "number");
    assert("Summary totalAffected is 14+", summary.totalAffected >= 14, `got ${summary.totalAffected}`);
    assert("Summary has downstreamCount", typeof summary.downstreamCount === "number");
    assert("Summary has customerFacingCount", typeof summary.customerFacingCount === "number");
    assert("Summary has maxDepth >= 2", summary.maxDepth >= 2, `got ${summary.maxDepth}`);
    assert("Summary has totalRevenuePerMinCents", typeof summary.totalRevenuePerMinCents === "number");
    assert("Summary has totalRevenuePerMinDollars", typeof summary.totalRevenuePerMinDollars === "number");
    assert("Summary has depthBreakdown", summary.depthBreakdown !== undefined);
    assert("Depth breakdown depth1 >= 7", summary.depthBreakdown.depth1 >= 7, `got ${summary.depthBreakdown.depth1}`);
    assert("Depth breakdown depth2 >= 5", summary.depthBreakdown.depth2 >= 5, `got ${summary.depthBreakdown.depth2}`);

    console.log("\n── Response Preview ──");
    console.log(`  Failed: ${failedService.name}`);
    console.log(`  Downstream: ${summary.downstreamCount}`);
    console.log(`  Customer-facing: ${summary.customerFacingCount}`);
    console.log(`  Revenue: $$$${summary.totalRevenuePerMinDollars.toFixed(2)}/min`);
    console.log(`  Max depth: ${summary.maxDepth}`);
    console.log(`  Fix priorities: ${fixPriorities.length}`);

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── By Incident ID ──");

  try {
    const listRes = await fetch(`${BASE_URL}/api/incidents`);
    const listBody = await listRes.json();
    const incidentId = listBody.data?.active?.id;

    assert("Got incident ID", !!incidentId);

    if (!incidentId) {
      assert("By incident returns 200", false, "no incident ID");
    } else {
      const response = await fetch(`${BASE_URL}/api/blast-radius`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });

      assert("By incident returns 200", response.status === 200, `got ${response.status}`);

      const body = await response.json();
      assert("By incident has success", body.success === true);
      assert("By incident has failedService", body.data.failedService !== undefined);
      assert("By incident has downstream", Array.isArray(body.data.downstream));
      assert("By incident has upstream", Array.isArray(body.data.upstream));
      assert("By incident has fixPriorities", Array.isArray(body.data.fixPriorities));
      assert("By incident has summary", body.data.summary !== undefined);
      assert("By incident has message", typeof body.data.message === "string");
    }
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Non-existent Service ──");

  try {
    const response = await fetch(`${BASE_URL}/api/blast-radius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceName: "does-not-exist-service" }),
    });

    assert("Non-existent returns 404", response.status === 404, `got ${response.status}`);
    const body = await response.json();
    assert("Non-existent has success false", body.success === false);
    assert("Non-existent has error message", typeof body.message === "string");
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Invalid UUID ──");

  try {
    const response = await fetch(`${BASE_URL}/api/blast-radius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: "not-a-uuid" }),
    });

    assert("Invalid UUID returns 400", response.status === 400, `got ${response.status}`);
    const body = await response.json();
    assert("Invalid UUID has success false", body.success === false);
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── No Parameters ──");

  try {
    const response = await fetch(`${BASE_URL}/api/blast-radius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert("No params returns 400", response.status === 400, `got ${response.status}`);
    const body = await response.json();
    assert("No params has success false", body.success === false);
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Invalid JSON ──");

  try {
    const response = await fetch(`${BASE_URL}/api/blast-radius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    assert("Invalid JSON returns 400", response.status === 400, `got ${response.status}`);
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
