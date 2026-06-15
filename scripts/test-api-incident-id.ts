// ═══════════════════════════════════════════
// 9. scripts/test-api-incident-id.ts
// ═══════════════════════════════════════════

import "dotenv/config";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ {name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Test GET /api/incidents/[id]");
  console.log("═══════════════════════════════════════════");

  // ── Get the active incident ID from the list endpoint ──

  let incidentId: string | undefined;

  console.log("\n── Valid Incident ID ──");

  try {
    const listRes = await fetch(`${BASE_URL}/api/incidents`);
    const listBody = await listRes.json();
    incidentId = listBody.data?.active?.id;
    assert("Got incident ID from /api/incidents", !!incidentId);
  } catch (error) {
    assert("Got incident ID from /api/incidents", false, (error as Error).message);
  }

  if (!incidentId) {
    console.error("\n  Cannot continue — no active incident found.");
    console.log("\n═══════════════════════════════════════════");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log("═══════════════════════════════════════════");
    process.exit(failed > 0 ? 1 : 0);
  }

  // ── Fetch the detail endpoint ──

  try {
    const response = await fetch(`${BASE_URL}/api/incidents/${incidentId}`);
    assert("Status is 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Response has success field", body.success === true);
    assert("Response has data field", body.data !== undefined);

    // incident object
    assert("Has incident object", body.data.incident !== undefined);
    assert(
      "Incident id matches",
      body.data.incident?.id === incidentId
    );
    assert(
      "Incident has startedAt",
      typeof body.data.incident?.startedAt === "string"
    );
    assert(
      "Incident has affectedServiceCount",
      typeof body.data.incident?.affectedServiceCount === "number"
    );
    assert(
      "Incident affectedServiceCount > 0",
      body.data.incident?.affectedServiceCount > 0
    );
    assert(
      "Incident has maxDepth",
      typeof body.data.incident?.maxDepth === "number"
    );

    // root cause
    assert("Has rootCause", body.data.rootCause !== undefined);
    assert(
      "rootCause has serviceName",
      typeof body.data.rootCause?.serviceName === "string"
    );
    assert(
      "rootCause serviceName is postgres-primary",
      body.data.rootCause?.serviceName === "postgres-primary"
    );
    assert(
      "rootCause has failureType",
      typeof body.data.rootCause?.failureType === "string"
    );
    assert(
      "rootCause has severity",
      typeof body.data.rootCause?.severity === "string"
    );
    assert(
      "rootCause has signalDetails",
      body.data.rootCause?.signalDetails !== null
    );

    // blast radius
    assert("Has blastRadius array", Array.isArray(body.data.blastRadius));
    assert("blastRadius has entries", body.data.blastRadius.length > 0, `got ${body.data.blastRadius.length}`);
    const firstBr = body.data.blastRadius[0];
    assert("blastRadius entry has serviceName", typeof firstBr?.serviceName === "string");
    assert("blastRadius entry has depth", typeof firstBr?.depth === "number");
    assert("blastRadius entry has classification", typeof firstBr?.classification === "string");
    assert("blastRadius entry has ownerTeam", typeof firstBr?.ownerTeam === "string");
    assert("blastRadius entry has isCustomerFacing", typeof firstBr?.isCustomerFacing === "boolean");
    assert("blastRadius entry has revenuePerMinCents", typeof firstBr?.revenuePerMinCents === "number");

    // upstreamCandidates
    assert("Has upstreamCandidates", Array.isArray(body.data.upstreamCandidates));

    // revenue impact
    assert("Has revenueImpact", body.data.revenueImpact !== undefined);
    assert("revenueImpact has totalRevenuePerMinCents", typeof body.data.revenueImpact?.totalRevenuePerMinCents === "number");

    // customer-facing
    assert("Has customerFacingCount", typeof body.data.customerFacingCount === "number");
    assert("customerFacingCount > 0", body.data.customerFacingCount > 0, `got ${body.data.customerFacingCount}`);

    // depth summary
    assert("Has depthSummary", body.data.depthSummary !== undefined);
    assert("depthSummary has depth1", typeof body.data.depthSummary?.depth1 === "number");
    assert("depthSummary has depth2", typeof body.data.depthSummary?.depth2 === "number");
    assert("depthSummary has depth3Plus", typeof body.data.depthSummary?.depth3Plus === "number");

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  // ── Invalid UUID ──

  console.log("\n── Invalid UUID ──");
  try {
    const response = await fetch(`${BASE_URL}/api/incidents/not-a-uuid`);
    assert("Invalid UUID returns 400", response.status === 400, `got ${response.status}`);
    const body = await response.json();
    assert("Has success false", body.success === false);
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  // ── Non-existent ID ──

  console.log("\n── Non-existent ID ──");
  try {
    const response = await fetch(
      `${BASE_URL}/api/incidents/00000000-0000-0000-0000-000000000000`
    );
    assert("Non-existent returns 404", response.status === 404, `got ${response.status}`);
    const body = await response.json();
    assert("Has success false", body.success === false);
    assert("Has error message", typeof body.message === "string");
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════");

  process.exit(failed > 0 ? 1 : 0);
}

main();
