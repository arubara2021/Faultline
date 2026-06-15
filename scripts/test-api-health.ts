// scripts/test-api-health.ts

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

async function cleanupHealthTests() {
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
    await pool.query(
      `UPDATE services SET health_status = 'down' WHERE name = 'postgres-primary'`
    );
    await pool.query(
      `UPDATE health_signals SET is_breach = true WHERE service_id IN (SELECT id FROM services WHERE name = 'postgres-primary') AND signal_type IN ('latency_p95','health_check')`
    );
    console.log("  ✓ Cleaned up health check side effects");
  } catch (error) {
    console.error("  ✗ Cleanup failed:", (error as Error).message);
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
  console.log("  Faultline — Test POST /api/health");
  console.log("═══════════════════════════════════════════");

  console.log("\n── POST Health Check Cycle ──");

  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert("Status is 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Response has success field", body.success === true);
    assert("Response has data field", body.data !== undefined);

    assert("Has healthCheck section", body.data.healthCheck !== undefined);
    assert("healthCheck has total", typeof body.data.healthCheck.total === "number");
    assert("healthCheck total is 14+", body.data.healthCheck.total >= 14, `got ${body.data.healthCheck.total}`);
    assert("healthCheck has statusChanges", typeof body.data.healthCheck.statusChanges === "number");
    assert("healthCheck has results array", Array.isArray(body.data.healthCheck.results));

    assert("Has errorRates section", body.data.errorRates !== undefined);
    assert("errorRates has checked", typeof body.data.errorRates.checked === "number");
    assert("errorRates has breached", typeof body.data.errorRates.breached === "number");

    assert("Has latency section", body.data.latency !== undefined);
    assert("latency has checked", typeof body.data.latency.checked === "number");
    assert("latency has degraded", typeof body.data.latency.degraded === "number");

    assert("Has summary section", body.data.summary !== undefined);
    assert("summary has totalServices", body.data.summary.totalServices >= 14);
    assert("summary has totalFailuresDetected", typeof body.data.summary.totalFailuresDetected === "number");

    if (body.data.healthCheck.results.length > 0) {
      const first = body.data.healthCheck.results[0];
      assert("Result has serviceId", typeof first.serviceId === "string");
      assert("Result has serviceName", typeof first.serviceName === "string");
      assert("Result has previousStatus", typeof first.previousStatus === "string");
      assert("Result has currentStatus", typeof first.currentStatus === "string");
      assert("Result has changed", typeof first.changed === "boolean");
    }

    console.log("\n── Health Check Cycle Results ──");
    console.log(`  Total: ${body.data.healthCheck.total}`);
    console.log(`  Status changes: ${body.data.healthCheck.statusChanges}`);
    console.log(`  Error breaches: ${body.data.errorRates.breached}`);
    console.log(`  Latency degraded: ${body.data.latency.degraded}`);

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── GET Health Status ──");

  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    assert("GET returns 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("GET has success field", body.success === true);
    assert("GET has services array", Array.isArray(body.data.services));
    assert("GET services count >= 14", body.data.services.length >= 14, `got ${body.data.services.length}`);
    assert("GET has summary", body.data.summary !== undefined);
    assert("GET summary total >= 14", body.data.summary.total >= 14, `got ${body.data.summary.total}`);
    assert(
      "GET summary counts add up",
      body.data.summary.healthy + body.data.summary.degraded + body.data.summary.down === body.data.summary.total
    );

    if (body.data.services.length > 0) {
      const first = body.data.services[0];
      assert("Service has id", typeof first.id === "string");
      assert("Service has name", typeof first.name === "string");
      assert("Service has healthStatus", typeof first.healthStatus === "string");
    }

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Service Probe ──");

  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: "api-gateway" }),
    });

    assert("Probe returns 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Probe has success field", body.success === true);
    assert("Probe returns service name", body.data.service === "api-gateway");

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Inject Failure (Demo Mode) ──");

  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: "payment-service", injectFailure: true }),
    });

    assert("Inject returns 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Inject has success field", body.success === true);
    assert("Inject has incidentId", typeof body.data.incidentId === "string");
    assert("Inject has failureEventId", typeof body.data.failureEventId === "string");
    assert("Inject has blastRadiusCount", typeof body.data.blastRadiusCount === "number");
    assert("Inject has totalRevenuePerMinCents", typeof body.data.totalRevenuePerMinCents === "number");
    assert("Inject returns correct service", body.data.service === "payment-service");
    assert("Inject message mentions payment-service", body.data.message.includes("payment-service"));

    console.log("\n── Inject Results ──");
    console.log(`  Service: ${body.data.service}`);
    console.log(`  Incident: ${body.data.incidentId}`);
    console.log(`  Blast radius: ${body.data.blastRadiusCount} services`);
    console.log(`  Revenue: $${(body.data.totalRevenuePerMinCents / 100).toFixed(2)}/min`);

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Cleaning up health check side effects ──");
  await cleanupHealthTests();

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: {passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
