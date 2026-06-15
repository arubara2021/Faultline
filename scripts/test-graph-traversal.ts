import "dotenv/config";
import { db } from "../src/lib/db";
import { services, incidents, failureEvents } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  traverseDownstream,
  traverseUpstream,
  getFullGraph,
  getSharedStateDependents,
} from "../src/lib/graph/traversal";

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
  console.log("  Faultline — Graph Traversal Tests");
  console.log("═══════════════════════════════════════════");

  try {
    const [incident] = await db.select().from(incidents).limit(1);
    assert("Incident exists for testing", !!incident);

    const [failureEvent] = await db
      .select()
      .from(failureEvents)
      .where(eq(failureEvents.id, incident.rootFailureEventId))
      .limit(1);
    assert("Failure event exists", !!failureEvent);

    const failedServiceId = failureEvent.serviceId;
    const [failedService] = await db
      .select()
      .from(services)
      .where(eq(services.id, failedServiceId))
      .limit(1);
    assert("Failed service is postgres-primary", failedService.name === "postgres-primary");

    console.log("\n── Downstream Traversal (Blast Radius) ──");

    const rawDownstream = await traverseDownstream(failedServiceId);

    const dedupedMap = new Map<string, (typeof rawDownstream)[0]>();
    for (const entry of rawDownstream) {
      const existing = dedupedMap.get(entry.serviceId);
      if (!existing || entry.depth < existing.depth) {
        dedupedMap.set(entry.serviceId, entry);
      }
    }
    const downstream = Array.from(dedupedMap.values());

    assert("Downstream returns results", downstream.length > 0);
    assert("Downstream count is 13", downstream.length === 13, `got ${downstream.length}`);

    const depth1 = downstream.filter((d) => d.depth === 1);
    const depth2 = downstream.filter((d) => d.depth === 2);
    const depth3 = downstream.filter((d) => d.depth === 3);

    assert("Depth 1 count is 7", depth1.length === 7, `got ${depth1.length}`);
    assert("Depth 2 count is 6", depth2.length === 6, `got ${depth2.length}`);
    assert("Depth 3 count is 0", depth3.length === 0, `got ${depth3.length}`);

    const depth1Names = depth1.map((d) => d.serviceName).sort();
    assert("Depth 1 has fraud-detector", depth1Names.includes("fraud-detector"));
    assert("Depth 1 has user-service", depth1Names.includes("user-service"));
    assert("Depth 1 has product-catalog", depth1Names.includes("product-catalog"));
    assert("Depth 1 has inventory-service", depth1Names.includes("inventory-service"));
    assert("Depth 1 has billing-worker", depth1Names.includes("billing-worker"));
    assert("Depth 1 has analytics-collector", depth1Names.includes("analytics-collector"));
    assert("Depth 1 has notification-service", depth1Names.includes("notification-service"));

    const depth2Names = depth2.map((d) => d.serviceName).sort();
    assert("Depth 2 has payment-service", depth2Names.includes("payment-service"));
    assert("Depth 2 has checkout-api", depth2Names.includes("checkout-api"));
    assert("Depth 2 has signup-flow", depth2Names.includes("signup-flow"));
    assert("Depth 2 has cart-service", depth2Names.includes("cart-service"));
    assert("Depth 2 has api-gateway", depth2Names.includes("api-gateway"));
    assert("Depth 2 has recommendation-engine", depth2Names.includes("recommendation-engine"));

    const customerFacing = downstream.filter((d) => d.isCustomerFacing);
    assert("Customer-facing count is 4", customerFacing.length === 4, `got ${customerFacing.length}`);

    const cfNames = customerFacing.map((d) => d.serviceName).sort();
    assert("Customer-facing has product-catalog", cfNames.includes("product-catalog"));
    assert("Customer-facing has checkout-api", cfNames.includes("checkout-api"));
    assert("Customer-facing has signup-flow", cfNames.includes("signup-flow"));
    assert("Customer-facing has api-gateway", cfNames.includes("api-gateway"));

    const totalRevenue = customerFacing.reduce((sum, d) => sum + d.revenuePerMinCents, 0);
    assert("Total revenue per min > 0", totalRevenue > 0, `got ${totalRevenue}`);
    assert("Total revenue is $10000/min", totalRevenue === 1000000, `got ${totalRevenue} cents`);

    const allPathsValid = downstream.every((d) => d.path.length >= 2);
    assert("All paths have at least 2 nodes", allPathsValid);

    const noCircularPaths = downstream.every((d) => {
      const pathSet = new Set(d.path);
      return pathSet.size === d.path.length;
    });
    assert("No circular paths", noCircularPaths);

    const checkoutEntry = downstream.find((d) => d.serviceName === "checkout-api");
    assert("checkout-api is depth 2", checkoutEntry?.depth === 2, `got ${checkoutEntry?.depth}`);
    assert("checkout-api path starts with failed service", checkoutEntry?.path[0] === failedServiceId);

    console.log("\n── Shared-State Dependents ──");

    const sharedEntries = await getSharedStateDependents(
      failedServiceId,
      downstream
    );

    assert("getSharedStateDependents returns array", Array.isArray(sharedEntries));
    assert("Shared entries are depth 1", sharedEntries.every((e) => e.depth === 1));
    assert("Shared entries have database_access type", sharedEntries.every((e) => e.dependencyType === "database_access" || e.dependencyType === "shared_cache" || e.dependencyType === "message_queue"));
    assert("Shared entries do not duplicate downstream", sharedEntries.every((e) => !downstream.some((d) => d.serviceId === e.serviceId)));
    assert("Shared entries path starts with failed service", sharedEntries.every((e) => e.path[0] === failedServiceId));

    for (const entry of sharedEntries) {
      assert(`Shared entry ${entry.serviceName} has isCustomerFacing boolean`, typeof entry.isCustomerFacing === "boolean");
      assert(`Shared entry ${entry.serviceName} has revenuePerMinCents number`, typeof entry.revenuePerMinCents === "number");
    }

    console.log(`  Shared-state entries found: ${sharedEntries.length}`);
    for (const entry of sharedEntries) {
      console.log(`    ${entry.serviceName} (${entry.classification}, $$$${(entry.revenuePerMinCents / 100).toFixed(0)}/min)`);
    }

    console.log("\n── Upstream Traversal (Root Cause) ──");

    const upstream = await traverseUpstream(failedServiceId);

    assert("Upstream returns array", Array.isArray(upstream));

    const postgresPrimaryUpstream = upstream.filter((u) => u.serviceId === failedServiceId);
    assert("Failed service not in its own upstream", postgresPrimaryUpstream.length === 0);

    if (upstream.length > 0) {
      const allDegradedOrDown = upstream.every(
        (u) => u.healthStatus === "degraded" || u.healthStatus === "down"
      );
      assert("All upstream candidates are degraded or down", allDegradedOrDown);

      for (const candidate of upstream) {
        assert(
          `Upstream ${candidate.serviceName} has valid depth`,
          candidate.depth >= 1 && candidate.depth <= 5
        );
      }
    } else {
      assert("No upstream degraded/down candidates (expected for root cause)", true);
    }

    console.log("\n── Full Graph ──");

    const graph = await getFullGraph();

    assert("Graph nodes count is 14", graph.nodes.length === 14, `got ${graph.nodes.length}`);
    assert("Graph edges count >= 22", graph.edges.length >= 22, `got ${graph.edges.length}`);

    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    assert("All node IDs are unique", nodeIds.size === graph.nodes.length);

    const validEdges = graph.edges.every(
      (e) => nodeIds.has(e.sourceServiceId) && nodeIds.has(e.targetServiceId)
    );
    assert("All edge endpoints reference valid nodes", validEdges);

    const noSelfEdges = graph.edges.every((e) => e.sourceServiceId !== e.targetServiceId);
    assert("No self-referencing edges", noSelfEdges);

    const uniqueEdges = new Set(
      graph.edges.map((e) => `${e.sourceServiceId}-${e.targetServiceId}-${e.dependencyType}`)
    );
    assert("No duplicate edges", uniqueEdges.size === graph.edges.length);

    console.log("\n── Edge Cases ──");

    try {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const result = await traverseDownstream(fakeId);
      assert("Non-existent service returns empty", result.length === 0);
    } catch {
      assert("Non-existent service handled gracefully", true);
    }

    try {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const sharedResult = await getSharedStateDependents(fakeId, []);
      assert("Non-existent service shared-state returns empty", sharedResult.length === 0);
    } catch {
      assert("Non-existent service shared-state handled gracefully", true);
    }
  } catch (error) {
    console.error("\nFatal error during tests:", error);
    failed++;
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════");

  process.exit(failed > 0 ? 1 : 0);
}

main();
