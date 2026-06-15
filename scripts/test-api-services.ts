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
  console.log("  Faultline — Test GET /api/services");
  console.log("═══════════════════════════════════════════");

  try {
    const response = await fetch(`${BASE_URL}/api/services`);
    assert("Status is 200", response.status === 200, `got ${response.status}`);

    const contentType = response.headers.get("content-type");
    assert("Content-Type is JSON", contentType?.includes("application/json"));

    const body = await response.json();
    assert("Response has success field", body.success === true);
    assert("Response has data field", body.data !== undefined);

    const { services, summary } = body.data;

    assert("Services is an array", Array.isArray(services));
    assert("Services count is 14", services.length === 14, `got ${services.length}`);

    const first = services[0];
    assert("Service has id", typeof first.id === "string");
    assert("Service has name", typeof first.name === "string");
    assert("Service has ownerTeam", typeof first.ownerTeam === "string");
    assert("Service has classification", typeof first.classification === "string");
    assert("Service has healthStatus", typeof first.healthStatus === "string");

    assert("Summary has total", summary.total === 14);
    assert("Summary has healthy count", summary.healthy >= 0);
    assert("Summary has degraded count", summary.degraded >= 0);
    assert("Summary has down count", summary.down >= 0);
    assert("Summary counts add up", summary.healthy + summary.degraded + summary.down + summary.unknown === 14);

    const sorted = [...services].sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
    assert("Services are sorted by name", services[0].name === sorted[0].name);

    console.log("\n── Response Preview ──");
    console.log(`  Services: ${summary.total}`);
    console.log(`  Healthy: ${summary.healthy}, Degraded: ${summary.degraded}, Down: ${summary.down}`);

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
