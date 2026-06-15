// ═══════════════════════════════════════════
// 4. scripts/test-api-summary.ts
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
      `UPDATE incidents SET resolved_at = NULL, resolution_notes = NULL WHERE resolved_at IS NOT NULL`
    );
    const { rows } = await pool.query(
      `SELECT root_failure_event_id FROM incidents WHERE resolved_at IS NULL LIMIT 1`
    );
    if (rows.length > 0) {
      await pool.query(
        `UPDATE failure_events SET resolved_at = NULL WHERE id = $1`,
        [rows[0].root_failure_event_id]
      );
    }
    console.log("  ✓ Database state reset");
  } catch (error) {
    console.error("  ✗ Reset failed:", (error as Error).message);
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Test POST /api/summary");
  console.log("═══════════════════════════════════════════");

  console.log("\n── Resetting database state ──");
  await resetDatabaseState();

  let incidentId: string | undefined;

  try {
    const listRes = await fetch(`${BASE_URL}/api/incidents`);
    const listBody = await listRes.json();
    incidentId = listBody.data?.active?.id;
    assert("Got seeded incident ID", !!incidentId);
  } catch (error) {
    assert("Got seeded incident ID", false, (error as Error).message);
  }

  if (!incidentId) {
    console.error("\n  Cannot continue — no active incident.");
    console.log("\n═══════════════════════════════════════════");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log("═══════════════════════════════════════════");
    process.exit(failed > 0 ? 1 : 0);
  }

  console.log("\n── Valid Summary Request ──");

  try {
    const response = await fetch(`${BASE_URL}/api/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentId }),
    });

    assert("Status is 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Response has success field", body.success === true);

    const data = body.data;

    assert("Incident has id", data.incident.id === incidentId);
    assert("Incident has status", typeof data.incident.status === "string");
    assert("Incident has startedAt", typeof data.incident.startedAt === "string");
    assert("Incident has minutesElapsed", typeof data.incident.minutesElapsed === "number");
    assert("Incident minutesElapsed > 0", data.incident.minutesElapsed > 0);

    assert("Root cause has serviceName", typeof data.rootCause.serviceName === "string");
    assert("Root cause has failureType", typeof data.rootCause.failureType === "string");
    assert("Root cause has severity", typeof data.rootCause.severity === "string");
    assert("Root cause has signalDetails", data.rootCause.signalDetails !== null);
    assert("Signal details has connection_pool", data.rootCause.signalDetails.connection_pool !== undefined);
    assert("Signal details has multiplier", data.rootCause.signalDetails.multiplier !== undefined);

    assert("Impact has totalServicesAffected", typeof data.impact.totalServicesAffected === "number");
    assert("Impact has customerFacingAffected", typeof data.impact.customerFacingAffected === "number");
    assert("Impact has revenuePerMinCents", typeof data.impact.revenuePerMinCents === "number");
    assert("Impact has revenuePerMinDollars", typeof data.impact.revenuePerMinDollars === "number");
    assert("Impact has totalAccumulatedImpactCents", typeof data.impact.totalAccumulatedImpactCents === "number");
    assert("Impact has totalAccumulatedImpactDollars", typeof data.impact.totalAccumulatedImpactDollars === "number");
    assert("Impact totalServicesAffected is 13+", data.impact.totalServicesAffected >= 13, `got ${data.impact.totalServicesAffected}`);
    assert("Impact customerFacingAffected is 3+", data.impact.customerFacingAffected >= 3, `got ${data.impact.customerFacingAffected}`);
    assert("Impact revenuePerMinCents > 0", data.impact.revenuePerMinCents > 0);

    assert("Cascade has depth1 array", Array.isArray(data.cascade.depth1));
    assert("Cascade has depth2 array", Array.isArray(data.cascade.depth2));
    assert("Cascade has depth3Plus array", Array.isArray(data.cascade.depth3Plus));
    assert("Depth1 count is 7+", data.cascade.depth1.length >= 7, `got ${data.cascade.depth1.length}`);
    assert("Depth2 count is 5+", data.cascade.depth2.length >= 5, `got ${data.cascade.depth2.length}`);
    assert("Depth3Plus count is 0", data.cascade.depth3Plus.length === 0, `got ${data.cascade.depth3Plus.length}`);

    assert("AI object exists", data.ai !== undefined);
    assert("AI has headline", typeof data.ai.headline === "string");
    assert("AI headline is non-empty", data.ai.headline.length > 0);
    assert("AI has whatHappened", typeof data.ai.whatHappened === "string");
    assert("AI whatHappened is non-empty", data.ai.whatHappened.length > 0);
    assert("AI has rootCauseAnalysis", typeof data.ai.rootCauseAnalysis === "string");
    assert("AI rootCauseAnalysis is non-empty", data.ai.rootCauseAnalysis.length > 0);
    assert("AI has blastRadiusSummary", typeof data.ai.blastRadiusSummary === "string");
    assert("AI blastRadiusSummary is non-empty", data.ai.blastRadiusSummary.length > 0);
    assert("AI has revenueImpactSummary", typeof data.ai.revenueImpactSummary === "string");
    assert("AI revenueImpactSummary is non-empty", data.ai.revenueImpactSummary.length > 0);
    assert("AI has fixPriority", typeof data.ai.fixPriority === "string");
    assert("AI fixPriority is non-empty", data.ai.fixPriority.length > 0);

    assert("Headline mentions postgres-primary", data.ai.headline.includes("postgres-primary"));
    assert("whatHappened mentions latency", data.ai.whatHappened.toLowerCase().includes("latency"));
    assert("blastRadiusSummary mentions services", data.ai.blastRadiusSummary.toLowerCase().includes("service"));
    assert(
      "revenueImpactSummary mentions revenue or $",
      data.ai.revenueImpactSummary.toLowerCase().includes("revenue") || data.ai.revenueImpactSummary.includes("$")
    );

    assert("Summary is a string", typeof data.summary === "string");
    assert("Summary is reasonable length", data.summary.length > 100, `got ${data.summary.length} chars`);

    assert("Upstream candidates is an array", Array.isArray(data.upstreamCandidates));

    console.log("\n── AI Summary Sections ──");
    console.log(`  Headline: ${data.ai.headline}`);
    console.log(`  What happened: ${data.ai.whatHappened.slice(0, 150)}...`);
    console.log(`  Root cause: ${data.ai.rootCauseAnalysis.slice(0, 150)}...`);
    console.log(`  Fix priority: ${data.ai.fixPriority.slice(0, 150)}...`);

    console.log("\n── Impact Numbers ──");
    console.log(`  Services affected: ${data.impact.totalServicesAffected}`);
    console.log(`  Customer-facing: ${data.impact.customerFacingAffected}`);
    console.log(`  Revenue: $${(data.impact.revenuePerMinCents / 100).toFixed(2)}/min`);
    console.log(`  Total impact: $${data.impact.totalAccumulatedImpactDollars.toFixed(2)}`);
    console.log(`  Duration: ${data.incident.minutesElapsed} minutes`);
    console.log(`  Cascade: ${data.cascade.depth1.length} → ${data.cascade.depth2.length} → ${data.cascade.depth3Plus.length}`);

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Non-existent Incident ──");

  try {
    const response = await fetch(`${BASE_URL}/api/summary`, {
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

  console.log("\n── Invalid UUID ──");

  try {
    const response = await fetch(`${BASE_URL}/api/summary`, {
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

  console.log("\n── Missing Incident ID ──");

  try {
    const response = await fetch(`${BASE_URL}/api/summary`, {
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
    const response = await fetch(`${BASE_URL}/api/summary`, {
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
