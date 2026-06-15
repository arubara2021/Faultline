// ═══════════════════════════════════════════
// 8. scripts/test-api-incidents.ts
// ═══════════════════════════════════════════

import "dotenv/config";

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

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Test GET /api/incidents");
  console.log("═══════════════════════════════════════════");

  let activeId: string | undefined;

  console.log("\n── GET /api/incidents ──");

  try {
    const response = await fetch(`${BASE_URL}/api/incidents`);
    assert("Status is 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Response has success field", body.success === true);
    assert("Response has data field", body.data !== undefined);

    assert("Has active field", body.data.active !== undefined || body.data.active === null);
    assert("active is not null", body.data.active !== null);

    if (body.data.active) {
      activeId = body.data.active.id;
      assert("active has id", typeof body.data.active.id === "string");
      assert("active has startedAt", typeof body.data.active.startedAt === "string");
      assert("active has rootFailureEventId", typeof body.data.active.rootFailureEventId === "string");
      assert("active has affectedServiceCount", typeof body.data.active.affectedServiceCount === "number");
      assert("active has maxDepth", typeof body.data.active.maxDepth === "number");
      assert("active resolvedAt is null", body.data.active.resolvedAt === null);
    }

    assert("Has activeCount", typeof body.data.activeCount === "number");
    assert("activeCount is 1+", body.data.activeCount >= 1, `got ${body.data.activeCount}`);
    assert("Has resolvedCount", typeof body.data.resolvedCount === "number");

    assert("Has incidents array", Array.isArray(body.data.incidents));
    assert("incidents has entries", body.data.incidents.length > 0, `got ${body.data.incidents.length}`);
    assert("incidents includes active", body.data.incidents.some((i: { id: string }) => i.id === activeId));

    const first = body.data.incidents[0];
    assert("Incident has id", typeof first.id === "string");
    assert("Incident has startedAt", typeof first.startedAt === "string");
    assert("Incident has rootFailureEventId", typeof first.rootFailureEventId === "string");
    assert("Incident has affectedServiceCount", typeof first.affectedServiceCount === "number");
    assert("Incident has maxDepth", typeof first.maxDepth === "number");

  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── GET /api/incidents/[id] (via active) ──");

  if (!activeId) {
    assert("Active incident ID available", false, "no active incident");
  } else {
    try {
      const response = await fetch(`${BASE_URL}/api/incidents/${activeId}`);
      assert("Detail returns 200", response.status === 200, `got ${response.status}`);

      const body = await response.json();
      assert("Detail has success", body.success === true);
      assert("Detail has incident", body.data.incident !== undefined);
      assert("Detail has rootCause", body.data.rootCause !== undefined);
      assert("Detail has blastRadius", Array.isArray(body.data.blastRadius));
      assert("Detail has upstreamCandidates", Array.isArray(body.data.upstreamCandidates));
      assert("Detail has revenueImpact", body.data.revenueImpact !== undefined);
      assert("Detail has customerFacingCount", typeof body.data.customerFacingCount === "number");
      assert("Detail has depthSummary", body.data.depthSummary !== undefined);
    } catch (error) {
      console.error("\nFatal error:", error);
      failed++;
    }
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
