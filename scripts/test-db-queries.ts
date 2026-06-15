import "dotenv/config";
import { db } from "../src/lib/db";
import {
  services,
  dependencies,
  healthSignals,
  currentTrafficSnapshots,
  failureEvents,
  incidents,
  blastRadiusResults,
} from "../src/lib/db/schema";
import { sql } from "drizzle-orm";

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

async function testServices() {
  console.log("\n── Services Table ──");

  const all = await db.select().from(services);
  assert("Services count is 14", all.length === 14, `got ${all.length}`);

  const customerFacing = all.filter((s) => s.classification === "customer-facing");
  assert("Customer-facing count is 4", customerFacing.length === 4, `got ${customerFacing.length}`);

  const internal = all.filter((s) => s.classification === "internal");
  assert("Internal count is 9", internal.length === 9, `got ${internal.length}`);

  const infra = all.filter((s) => s.classification === "infrastructure");
  assert("Infrastructure count is 1", infra.length === 1, `got ${infra.length}`);

  const healthy = all.filter((s) => s.healthStatus === "healthy");
  assert("Healthy count is 13", healthy.length === 13, `got ${healthy.length}`);

  const down = all.filter((s) => s.healthStatus === "down");
  assert("Down count is 1", down.length === 1, `got ${down.length}`);

  const pgPrimary = all.find((s) => s.name === "postgres-primary");
  assert("postgres-primary exists", !!pgPrimary);
  assert("postgres-primary is down", pgPrimary?.healthStatus === "down", `got ${pgPrimary?.healthStatus}`);
  assert("postgres-primary is infrastructure", pgPrimary?.classification === "infrastructure");

  const checkout = all.find((s) => s.name === "checkout-api");
  assert("checkout-api exists", !!checkout);
  assert("checkout-api is customer-facing", checkout?.classification === "customer-facing");
}

async function testDependencies() {
  console.log("\n── Dependencies Table ──");

  const all = await db.select().from(dependencies);
  assert("Dependencies count is 22", all.length === 22, `got ${all.length}`);

  const httpCalls = all.filter((d) => d.dependencyType === "http_call");
  assert("HTTP calls count is 14", httpCalls.length === 14, `got ${httpCalls.length}`);

  const dbAccess = all.filter((d) => d.dependencyType === "database_access");
  assert("Database access count is 7", dbAccess.length === 7, `got ${dbAccess.length}`);

  const mq = all.filter((d) => d.dependencyType === "message_queue");
  assert("Message queue count is 1", mq.length === 1, `got ${mq.length}`);

  const selfDeps = all.filter((d) => d.sourceServiceId === d.targetServiceId);
  assert("No self-dependencies", selfDeps.length === 0);

  const highConfidence = all.filter((d) => parseFloat(d.confidenceScore) >= 0.8);
  assert("High confidence deps >= 10", highConfidence.length >= 10, `got ${highConfidence.length}`);

  const allAboveThreshold = all.filter((d) => parseFloat(d.confidenceScore) >= 0.3);
  assert("All deps at or above confidence threshold 0.3", allAboveThreshold.length === all.length, `got ${allAboveThreshold.length} of ${all.length}`);
}

async function testHealthSignals() {
  console.log("\n── Health Signals Table ──");

  const all = await db.select().from(healthSignals);
  assert("Health signals count is 42", all.length === 42, `got ${all.length}`);

  const breaches = all.filter((s) => s.isBreach === true);
  assert("Breaches count is 2", breaches.length === 2, `got ${breaches.length}`);

  const breachTypes = breaches.map((b) => b.signalType).sort();
  assert("Breach has latency_p95", breachTypes.includes("latency_p95"));
  assert("Breach has health_check", breachTypes.includes("health_check"));

  const perService = new Map<string, number>();
  for (const s of all) {
    perService.set(s.serviceId, (perService.get(s.serviceId) ?? 0) + 1);
  }
  const allHaveThree = [...perService.values()].every((v) => v === 3);
  assert("Each service has exactly 3 signals", allHaveThree);
}

async function testTrafficSnapshots() {
  console.log("\n── Current Traffic Snapshots Table ──");

  const all = await db.select().from(currentTrafficSnapshots);
  assert("Traffic snapshots count is 14", all.length === 14, `got ${all.length}`);

  const checkout = all.find((s) => s.avgRequestsPerMin === "2400.00");
  assert("Checkout snapshot exists", !!checkout);
  assert("Checkout has revenue > 0", (checkout?.revenuePerMinCents ?? 0) > 0);

  const totalRevenue = all.reduce((sum, s) => sum + (s.revenuePerMinCents ?? 0), 0);
  assert("Total revenue per min > 0", totalRevenue > 0, `got ${totalRevenue}`);
}

async function testFailureEvents() {
  console.log("\n── Failure Events Table ──");

  const all = await db.select().from(failureEvents);
  assert("Failure events count is 1", all.length === 1, `got ${all.length}`);

  const evt = all[0];
  assert("Failure type is latency_degradation", evt.failureType === "latency_degradation");
  assert("Severity is down", evt.severity === "down");
  assert("Signal details exist", evt.signalDetails !== null);
  assert("Not resolved", evt.resolvedAt === null);

  const details = evt.signalDetails as Record<string, unknown>;
  assert("Has connection_pool field", details?.connection_pool === "exhausted");
  assert("Has multiplier field", typeof details?.multiplier === "string");
}

async function testIncidents() {
  console.log("\n── Incidents Table ──");

  const all = await db.select().from(incidents);
  assert("Incidents count is 1", all.length === 1, `got ${all.length}`);

  const inc = all[0];
  assert("Incident is active (not resolved)", inc.resolvedAt === null);
  assert("Affected service count is 13", inc.affectedServiceCount === 13, `got ${inc.affectedServiceCount}`);
  assert("Max depth is 2", inc.maxDepth === 2, `got ${inc.maxDepth}`);
  assert("Revenue impact > 0", (inc.totalRevenueImpactCents ?? 0) > 0);
}

async function testBlastRadius() {
  console.log("\n── Blast Radius Results Table ──");

  const all = await db.select().from(blastRadiusResults);
  assert("Blast radius count is 12", all.length === 12, `got ${all.length}`);

  const depth1 = all.filter((b) => b.depth === 1);
  const depth2 = all.filter((b) => b.depth === 2);
  assert("Depth 1 count is 7", depth1.length === 7, `got ${depth1.length}`);
  assert("Depth 2 count is 5", depth2.length === 5, `got ${depth2.length}`);

  const customerFacing = all.filter((b) => b.isCustomerFacing);
  assert("Customer-facing affected is 3", customerFacing.length === 3, `got ${customerFacing.length}`);

  const totalRevenue = customerFacing.reduce((sum, b) => sum + (Number(b.revenuePerMinCents) || 0), 0);
  assert("Customer-facing revenue > 0", totalRevenue > 0, `got ${totalRevenue}`);

  const uniqueServices = new Set(all.map((b) => b.affectedServiceId));
  assert("No duplicate services in blast radius", uniqueServices.size === all.length);

  const depth1Entry = all.find((b) => b.depth === 1);
  assert("Depth 1 entries exist", depth1Entry !== undefined);
}

async function testCascadeDeletion() {
  console.log("\n── Cascade Deletion (Dry Run) ──");

  const svc = await db.select().from(services).limit(1);
  assert("Can read services for cascade test", svc.length > 0);

  const depCount = await db.execute(sql`SELECT COUNT(*) as count FROM dependencies`);
  const count = Number((depCount.rows[0] as Record<string, unknown>).count);
  assert("Dependencies table has rows", count > 0, `got ${count}`);

  const brrCount = await db.execute(sql`SELECT COUNT(*) as count FROM blast_radius_results`);
  const brrVal = Number((brrCount.rows[0] as Record<string, unknown>).count);
  assert("Blast radius results table has rows", brrVal > 0, `got ${brrVal}`);
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Database Query Tests");
  console.log("═══════════════════════════════════════════");

  try {
    await testServices();
    await testDependencies();
    await testHealthSignals();
    await testTrafficSnapshots();
    await testFailureEvents();
    await testIncidents();
    await testBlastRadius();
    await testCascadeDeletion();
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
