// ═══════════════════════════════════════════
// 21. scripts/seed.ts
// ═══════════════════════════════════════════

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  services,
  dependencies,
  healthSignals,
  currentTrafficSnapshots,
  failureEvents,
  incidents,
  blastRadiusResults,
} from "../src/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function main() {
  console.log("Seeding Faultline database...\n");

  console.log("Clearing existing data...");
  await db.delete(blastRadiusResults);
  await db.delete(incidents);
  await db.delete(failureEvents);
  await db.delete(currentTrafficSnapshots);
  await db.delete(healthSignals);
  await db.delete(dependencies);
  await db.delete(services);
  console.log("Done.\n");

  const svcIds = {
    apiGateway: uuidv4(),
    checkoutApi: uuidv4(),
    signupFlow: uuidv4(),
    productCatalog: uuidv4(),
    cartService: uuidv4(),
    paymentService: uuidv4(),
    billingWorker: uuidv4(),
    fraudDetector: uuidv4(),
    userService: uuidv4(),
    notificationService: uuidv4(),
    inventoryService: uuidv4(),
    recommendationEngine: uuidv4(),
    analyticsCollector: uuidv4(),
    postgresPrimary: uuidv4(),
  };

  console.log("Inserting services...");
  await db.insert(services).values([
    {
      id: svcIds.apiGateway,
      name: "api-gateway",
      ownerTeam: "platform",
      classification: "customer-facing",
      healthStatus: "healthy",
    },
    {
      id: svcIds.checkoutApi,
      name: "checkout-api",
      ownerTeam: "payments",
      classification: "customer-facing",
      healthStatus: "healthy",
    },
    {
      id: svcIds.signupFlow,
      name: "signup-flow",
      ownerTeam: "growth",
      classification: "customer-facing",
      healthStatus: "healthy",
    },
    {
      id: svcIds.productCatalog,
      name: "product-catalog",
      ownerTeam: "catalog",
      classification: "customer-facing",
      healthStatus: "healthy",
    },
    {
      id: svcIds.cartService,
      name: "cart-service",
      ownerTeam: "checkout",
      classification: "internal",
      healthStatus: "healthy",
    },
    {
      id: svcIds.paymentService,
      name: "payment-service",
      ownerTeam: "payments",
      classification: "internal",
      healthStatus: "healthy",
    },
    {
      id: svcIds.billingWorker,
      name: "billing-worker",
      ownerTeam: "payments",
      classification: "internal",
      healthStatus: "healthy",
    },
    {
      id: svcIds.fraudDetector,
      name: "fraud-detector",
      ownerTeam: "risk",
      classification: "internal",
      healthStatus: "healthy",
    },
    {
      id: svcIds.userService,
      name: "user-service",
      ownerTeam: "accounts",
      classification: "internal",
      healthStatus: "healthy",
    },
    {
      id: svcIds.notificationService,
      name: "notification-service",
      ownerTeam: "comms",
      classification: "internal",
      healthStatus: "healthy",
    },
    {
      id: svcIds.inventoryService,
      name: "inventory-service",
      ownerTeam: "fulfillment",
      classification: "internal",
      healthStatus: "healthy",
    },
    {
      id: svcIds.recommendationEngine,
      name: "recommendation-engine",
      ownerTeam: "ml-platform",
      classification: "internal",
      healthStatus: "healthy",
    },
    {
      id: svcIds.analyticsCollector,
      name: "analytics-collector",
      ownerTeam: "data",
      classification: "internal",
      healthStatus: "healthy",
    },
    {
      id: svcIds.postgresPrimary,
      name: "postgres-primary",
      ownerTeam: "infrastructure",
      classification: "infrastructure",
      healthStatus: "down",
    },
  ]);
  console.log("  14 services inserted.");

  console.log("Inserting dependencies...");
  const depValues = [
    { src: svcIds.apiGateway, tgt: svcIds.checkoutApi, type: "http_call" as const, conf: "0.950" },
    { src: svcIds.apiGateway, tgt: svcIds.signupFlow, type: "http_call" as const, conf: "0.950" },
    { src: svcIds.apiGateway, tgt: svcIds.productCatalog, type: "http_call" as const, conf: "0.920" },
    { src: svcIds.apiGateway, tgt: svcIds.cartService, type: "http_call" as const, conf: "0.940" },
    { src: svcIds.checkoutApi, tgt: svcIds.paymentService, type: "http_call" as const, conf: "0.960" },
    { src: svcIds.checkoutApi, tgt: svcIds.cartService, type: "http_call" as const, conf: "0.930" },
    { src: svcIds.checkoutApi, tgt: svcIds.fraudDetector, type: "http_call" as const, conf: "0.900" },
    { src: svcIds.signupFlow, tgt: svcIds.userService, type: "http_call" as const, conf: "0.940" },
    { src: svcIds.signupFlow, tgt: svcIds.fraudDetector, type: "http_call" as const, conf: "0.880" },
    { src: svcIds.cartService, tgt: svcIds.productCatalog, type: "http_call" as const, conf: "0.910" },
    { src: svcIds.cartService, tgt: svcIds.inventoryService, type: "http_call" as const, conf: "0.890" },
    { src: svcIds.paymentService, tgt: svcIds.fraudDetector, type: "http_call" as const, conf: "0.920" },
    { src: svcIds.paymentService, tgt: svcIds.billingWorker, type: "http_call" as const, conf: "0.900" },
    { src: svcIds.paymentService, tgt: svcIds.notificationService, type: "http_call" as const, conf: "0.850" },
    { src: svcIds.fraudDetector, tgt: svcIds.postgresPrimary, type: "database_access" as const, conf: "0.980" },
    { src: svcIds.userService, tgt: svcIds.postgresPrimary, type: "database_access" as const, conf: "0.970" },
    { src: svcIds.productCatalog, tgt: svcIds.postgresPrimary, type: "database_access" as const, conf: "0.960" },
    { src: svcIds.inventoryService, tgt: svcIds.postgresPrimary, type: "database_access" as const, conf: "0.950" },
    { src: svcIds.billingWorker, tgt: svcIds.postgresPrimary, type: "database_access" as const, conf: "0.930" },
    { src: svcIds.analyticsCollector, tgt: svcIds.postgresPrimary, type: "database_access" as const, conf: "0.910" },
    { src: svcIds.notificationService, tgt: svcIds.postgresPrimary, type: "database_access" as const, conf: "0.880" },
    { src: svcIds.recommendationEngine, tgt: svcIds.analyticsCollector, type: "message_queue" as const, conf: "0.350" },
  ];

  const depRecords = depValues.map((d) => ({
    sourceServiceId: d.src,
    targetServiceId: d.tgt,
    dependencyType: d.type,
    confidenceScore: d.conf,
    lastObservedAt: new Date(),
  }));

  await db.insert(dependencies).values(depRecords);
  console.log(`  ${depRecords.length} dependencies inserted.`);

  console.log("Inserting health signals...");
  const allServiceIds = Object.values(svcIds);
  const signalTypes = ["error_rate", "latency_p95", "health_check"] as const;

  const signalRecords: Array<{
    serviceId: string;
    signalType: string;
    metricValue: string;
    thresholdValue: string;
    isBreach: boolean;
  }> = [];

  for (const svcId of allServiceIds) {
    for (const signalType of signalTypes) {
      let metric = "0.0100";
      let threshold = "0.0500";
      let breach = false;

      if (svcId === svcIds.postgresPrimary) {
        if (signalType === "latency_p95") {
          metric = "450.0000";
          threshold = "200.0000";
          breach = true;
        } else if (signalType === "health_check") {
          metric = "0.0000";
          threshold = "1.0000";
          breach = true;
        } else {
          metric = "0.0200";
          threshold = "0.0500";
          breach = false;
        }
      }

      signalRecords.push({
        serviceId: svcId,
        signalType,
        metricValue: metric,
        thresholdValue: threshold,
        isBreach: breach,
      });
    }
  }

  await db.insert(healthSignals).values(signalRecords);
  console.log(`  ${signalRecords.length} health signals inserted.`);

  console.log("Inserting traffic snapshots...");
  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const trafficRecords = [
    { serviceId: svcIds.apiGateway, avgRequestsPerMin: "12000.00", revenuePerMinCents: 200000 },
    { serviceId: svcIds.checkoutApi, avgRequestsPerMin: "2400.00", revenuePerMinCents: 320000 },
    { serviceId: svcIds.signupFlow, avgRequestsPerMin: "800.00", revenuePerMinCents: 80000 },
    { serviceId: svcIds.productCatalog, avgRequestsPerMin: "8500.00", revenuePerMinCents: 400000 },
    { serviceId: svcIds.cartService, avgRequestsPerMin: "3600.00", revenuePerMinCents: 0 },
    { serviceId: svcIds.paymentService, avgRequestsPerMin: "2400.00", revenuePerMinCents: 0 },
    { serviceId: svcIds.billingWorker, avgRequestsPerMin: "120.00", revenuePerMinCents: 0 },
    { serviceId: svcIds.fraudDetector, avgRequestsPerMin: "2400.00", revenuePerMinCents: 0 },
    { serviceId: svcIds.userService, avgRequestsPerMin: "4200.00", revenuePerMinCents: 0 },
    { serviceId: svcIds.notificationService, avgRequestsPerMin: "600.00", revenuePerMinCents: 0 },
    { serviceId: svcIds.inventoryService, avgRequestsPerMin: "3100.00", revenuePerMinCents: 0 },
    { serviceId: svcIds.recommendationEngine, avgRequestsPerMin: "5000.00", revenuePerMinCents: 0 },
    { serviceId: svcIds.analyticsCollector, avgRequestsPerMin: "15000.00", revenuePerMinCents: 0 },
    { serviceId: svcIds.postgresPrimary, avgRequestsPerMin: "45000.00", revenuePerMinCents: 0 },
  ];

  await db.insert(currentTrafficSnapshots).values(
    trafficRecords.map((t) => ({
      serviceId: t.serviceId,
      avgRequestsPerMin: t.avgRequestsPerMin,
      conversionRate: "0",
      avgOrderValueCents: 0,
      revenuePerMinCents: t.revenuePerMinCents,
      snapshotWindowStart: windowStart,
      snapshotWindowEnd: now,
    }))
  );
  console.log(`  ${trafficRecords.length} traffic snapshots inserted.`);

  console.log("Inserting failure event...");
  const failureEventId = uuidv4();
  await db.insert(failureEvents).values({
    id: failureEventId,
    serviceId: svcIds.postgresPrimary,
    failureType: "latency_degradation",
    severity: "down",
    signalDetails: {
      connection_pool: "exhausted",
      active_connections: 200,
      max_connections: 200,
      max_idle_time: "0ms",
      avg_query_time: "450ms",
      multiplier: "2.25x",
      original_threshold: "200ms",
    },
  });
  console.log("  1 failure event inserted.");

  console.log("Inserting incident...");
  const incidentId = uuidv4();
  const startedAt = new Date(now.getTime() - 29 * 60 * 1000);

  await db.insert(incidents).values({
    id: incidentId,
    rootFailureEventId: failureEventId,
    startedAt,
    resolvedAt: null,
    totalRevenueImpactCents: 800987,
    affectedServiceCount: 13,
    maxDepth: 2,
    resolutionNotes: null,
  });
  console.log("  1 incident inserted.");

  console.log("Inserting blast radius results...");
  const blastRadius = [
    { serviceId: svcIds.fraudDetector, depth: 1, depType: "database_access", cf: false, rev: 0 },
    { serviceId: svcIds.userService, depth: 1, depType: "database_access", cf: false, rev: 0 },
    { serviceId: svcIds.productCatalog, depth: 1, depType: "database_access", cf: true, rev: 400000 },
    { serviceId: svcIds.inventoryService, depth: 1, depType: "database_access", cf: false, rev: 0 },
    { serviceId: svcIds.billingWorker, depth: 1, depType: "database_access", cf: false, rev: 0 },
    { serviceId: svcIds.analyticsCollector, depth: 1, depType: "database_access", cf: false, rev: 0 },
    { serviceId: svcIds.notificationService, depth: 1, depType: "database_access", cf: false, rev: 0 },
    { serviceId: svcIds.paymentService, depth: 2, depType: "http_call", cf: false, rev: 0 },
    { serviceId: svcIds.checkoutApi, depth: 2, depType: "http_call", cf: true, rev: 320000 },
    { serviceId: svcIds.signupFlow, depth: 2, depType: "http_call", cf: true, rev: 80000 },
    { serviceId: svcIds.cartService, depth: 2, depType: "http_call", cf: false, rev: 0 },
    { serviceId: svcIds.apiGateway, depth: 2, depType: "http_call", cf: false, rev: 0 },
  ];

  const parentMap: Record<string, string> = {
    [svcIds.paymentService]: svcIds.fraudDetector,
    [svcIds.checkoutApi]: svcIds.paymentService,
    [svcIds.signupFlow]: svcIds.userService,
    [svcIds.cartService]: svcIds.inventoryService,
    [svcIds.apiGateway]: svcIds.productCatalog,
  };

  function buildPath(targetId: string, depth: number): string[] {
    if (depth === 1) {
      return [svcIds.postgresPrimary, targetId];
    }
    const parentId = parentMap[targetId];
    if (parentId) {
      return [svcIds.postgresPrimary, parentId, targetId];
    }
    return [svcIds.postgresPrimary, targetId];
  }

  await db.insert(blastRadiusResults).values(
    blastRadius.map((b) => ({
      incidentId,
      affectedServiceId: b.serviceId,
      depth: b.depth,
      dependencyPath: buildPath(b.serviceId, b.depth),
      dependencyType: b.depType,
      isCustomerFacing: b.cf,
      revenuePerMinCents: b.rev,
    }))
  );
  console.log(`  ${blastRadius.length} blast radius results inserted.`);

  console.log("\nSeed complete.");
  console.log(`  Services:          14`);
  console.log(`    Customer-facing: 4 (api-gateway, checkout-api, signup-flow, product-catalog)`);
  console.log(`    Internal:        9`);
  console.log(`    Infrastructure:  1 (postgres-primary)`);
  console.log(`  Dependencies:      ${depRecords.length}`);
  console.log(`  Health Signals:    ${signalRecords.length}`);
  console.log(`  Traffic Snapshots: ${trafficRecords.length}`);
  console.log(`  Failure Events:    1`);
  console.log(`  Incidents:         1`);
  console.log(`  Blast Radius:      ${blastRadius.length}`);
  console.log(`  postgres-primary:  DOWN`);
  console.log(`  Breaches:          2 (latency_p95, health_check)\n`);

  await pool.end();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
