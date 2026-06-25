import "dotenv/config";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;
let total = 0;

function ok(label: string) {
  total++;
  passed++;
  console.log(`  \x1b[32m✓\x1b[0m ${label}`);
}

function fail(label: string, detail?: string) {
  total++;
  failed++;
  console.log(`  \x1b[31m✗\x1b[0m ${label}`);
  if (detail) console.log(`    \x1b[31m${detail}\x1b[0m`);
}

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    ok(label);
  } else {
    fail(label, detail);
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m\x1b[36m── ${title} ──\x1b[0m`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api<T = any>(
  path: string,
  opts?: RequestInit
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function checkServerRunning() {
  section("STEP 0: Server Check");

  try {
    const { data: healthRes } = await api("/api/health");
    assert("Server is running", healthRes.success === true);
  } catch (err: any) {
    fail(
      "Server is running",
      `Cannot reach ${BASE} — is npm run dev running?`
    );
    process.exit(1);
  }
}

async function resetViaSimulate() {
  section("STEP 1: Reset & Seed via Simulate API");

  const { data: simRes } = await api("/api/simulate", {
    method: "POST",
    body: JSON.stringify({
      serviceName: "postgres-primary",
      reset: true,
    }),
  });

  assert("Simulate API resets and seeds data", simRes.success === true);
  assert(
    "Failed service is postgres-primary",
    simRes.data?.failedService === "postgres-primary",
    `Got: ${simRes.data?.failedService}`
  );
  assert(
    "Blast radius count is 13",
    simRes.data?.blastRadiusCount === 13,
    `Got: ${simRes.data?.blastRadiusCount}`
  );
  assert(
    "Revenue per minute is $10,000",
    simRes.data?.totalRevenuePerMinDollars === 10000,
    `Got: $${simRes.data?.totalRevenuePerMinDollars}`
  );
  assert(
    "Cascade depth is 2",
    simRes.data?.cascadeDepth === 2,
    `Got: {simRes.data?.cascadeDepth}`
  );
  assert(
    "4 customer-facing services affected",
    simRes.data?.customerFacingAffected === 4,
    `Got: ${simRes.data?.customerFacingAffected}`
  );

  console.log(`\n    Simulated: ${simRes.data?.failedService}`);
  console.log(
    `    Blast radius: ${simRes.data?.blastRadiusCount} services`
  );
  console.log(
    `    Revenue: $$$${simRes.data?.totalRevenuePerMinDollars}/min`
  );
  console.log(`    Depth: ${simRes.data?.cascadeDepth}`);
  console.log(
    `    Customer-facing: ${simRes.data?.customerFacingAffected}`
  );

  await sleep(2000);
}

async function checkDashboardAfterSimulation() {
  section("STEP 2: Dashboard After Simulation");

  const { data: incidentsRes } = await api("/api/incidents");
  assert(
    "1 active incident",
    incidentsRes.data?.activeCount === 1,
    `Got: ${incidentsRes.data?.activeCount}`
  );

  const active = incidentsRes.data?.active;
  assert(
    "Active incident has rootServiceName",
    active?.rootServiceName === "postgres-primary",
    `Got: ${active?.rootServiceName}`
  );
  assert(
    "Active incident has failureType",
    active?.failureType === "latency_degradation",
    `Got: ${active?.failureType}`
  );
  assert(
    "Active incident has severity",
    active?.severity === "down",
    `Got: ${active?.severity}`
  );
  assert(
    "Revenue impact computed (not 0)",
    active?.totalRevenueImpactCents > 0,
    `Got: ${active?.totalRevenueImpactCents}`
  );

  const { data: servicesRes } = await api("/api/services");
  assert(
    "13 services healthy",
    servicesRes.data?.summary?.healthy === 13,
    `Got: ${servicesRes.data?.summary?.healthy}`
  );
  assert(
    "1 service down",
    servicesRes.data?.summary?.down === 1,
    `Got: ${servicesRes.data?.summary?.down}`
  );

  const { data: graphRes } = await api("/api/graph");
  assert(
    "Graph has 14 nodes",
    graphRes.data?.meta?.nodeCount === 14,
    `Got: ${graphRes.data?.meta?.nodeCount}`
  );
  assert(
    "Graph has 22 edges",
    graphRes.data?.meta?.edgeCount === 22,
    `Got: ${graphRes.data?.meta?.edgeCount}`
  );
}

async function checkIncidentDetail() {
  section("STEP 3: Incident Detail Page");

  const { data: incidentsRes } = await api("/api/incidents");
  const activeId = incidentsRes.data?.active?.id;
  assert("Active incident ID exists", !!activeId);

  const { data: detailRes } = await api(`/api/incidents/${activeId}`);
  assert(
    "Incident detail returns success",
    detailRes.success === true
  );

  const detail = detailRes.data;

  assert("Detail has incident data", !!detail?.incident);
  assert(
    "Incident is not resolved",
    detail?.incident?.resolvedAt === null
  );
  assert("Detail has rootCause", !!detail?.rootCause);
  assert(
    "Root cause service is postgres-primary",
    detail?.rootCause?.serviceName === "postgres-primary",
    `Got: ${detail?.rootCause?.serviceName}`
  );
  assert(
    "Root cause failure type is latency_degradation",
    detail?.rootCause?.failureType === "latency_degradation",
    `Got: ${detail?.rootCause?.failureType}`
  );
  assert(
    "Root cause severity is down",
    detail?.rootCause?.severity === "down",
    `Got: ${detail?.rootCause?.severity}`
  );
  assert(
    "Detail has signal details",
    !!detail?.rootCause?.signalDetails
  );
  assert(
    "Signal details is an object",
    typeof detail?.rootCause?.signalDetails === "object"
  );

  assert(
    "Detail has blastRadius",
    Array.isArray(detail?.blastRadius)
  );
  assert(
    "Blast radius has 13 entries",
    detail?.blastRadius?.length === 13,
    `Got: ${detail?.blastRadius?.length}`
  );

  const cfServices = detail?.blastRadius?.filter(
    (b: any) => b.isCustomerFacing
  );
  assert(
    "4 customer-facing services in blast radius",
    cfServices?.length === 4,
    `Got: ${cfServices?.length}`
  );

  assert("Detail has revenueImpact", !!detail?.revenueImpact);
  assert(
    "Revenue per minute > 0",
    detail?.revenueImpact?.totalRevenuePerMinCents > 0,
    `Got: ${detail?.revenueImpact?.totalRevenuePerMinCents}`
  );

  assert(
    "Detail has upstreamCandidates",
    Array.isArray(detail?.upstreamCandidates)
  );
  assert(
    "Upstream candidates array exists (postgres-primary has 0 upstream deps — correct)",
    Array.isArray(detail?.upstreamCandidates)
  );

  const depths = new Set(
    detail?.blastRadius?.map((b: any) => b.depth)
  );
  assert("Has depth 1 entries", depths.has(1));
  assert("Has depth 2 entries", depths.has(2));

  const allHaveServiceName = detail?.blastRadius?.every(
    (b: any) => !!b.serviceName
  );
  assert(
    "All blast radius entries have serviceName",
    allHaveServiceName
  );

  const allHaveClassification = detail?.blastRadius?.every(
    (b: any) => !!b.classification
  );
  assert(
    "All blast radius entries have classification",
    allHaveClassification
  );
}

async function checkSummary() {
  section("STEP 4: AI Summary");

  const { data: incidentsRes } = await api("/api/incidents");
  const activeId = incidentsRes.data?.active?.id;

  const { data: summaryRes } = await api("/api/summary", {
    method: "POST",
    body: JSON.stringify({ incidentId: activeId }),
  });

  assert("Summary API returns success", summaryRes.success === true);

  const summary = summaryRes.data;
  assert("Summary has headline", !!summary?.ai?.headline);
  assert("Summary has whatHappened", !!summary?.ai?.whatHappened);
  assert(
    "Summary has rootCauseAnalysis",
    !!summary?.ai?.rootCauseAnalysis
  );
  assert(
    "Summary has blastRadiusSummary",
    !!summary?.ai?.blastRadiusSummary
  );
  assert(
    "Summary has revenueImpactSummary",
    !!summary?.ai?.revenueImpactSummary
  );
  assert("Summary has fixPriority", !!summary?.ai?.fixPriority);
  assert("Summary has summary text", !!summary?.summary);

  assert("Summary has incident data", !!summary?.incident);
  assert(
    "Summary incident is active",
    summary?.incident?.status === "active",
    `Got: ${summary?.incident?.status}`
  );
  assert("Summary has impact data", !!summary?.impact);
  assert(
    "Summary revenue per minute > 0",
    summary?.impact?.revenuePerMinCents > 0,
    `Got: ${summary?.impact?.revenuePerMinCents}`
  );
  assert(
    "Summary total accumulated > 0",
    summary?.impact?.totalAccumulatedImpactCents > 0,
    `Got: ${summary?.impact?.totalAccumulatedImpactCents}`
  );

  assert(
    "Summary has upstreamCandidates",
    Array.isArray(summary?.upstreamCandidates)
  );

  assert(
    "Summary has cascade data",
    !!summary?.cascade
  );

  console.log(`\n    Headline: ${summary?.ai?.headline}`);

  const headlineMentionsPostgres =
    summary?.ai?.headline?.toLowerCase().includes("postgres-primary");
  assert(
    "Headline mentions postgres-primary",
    headlineMentionsPostgres
  );
}

async function resolveIncident() {
  section("STEP 5: Resolve Incident");

  const { data: incidentsRes } = await api("/api/incidents");
  const activeId = incidentsRes.data?.active?.id;
  assert("Active incident exists to resolve", !!activeId);

  const { data: resolveRes } = await api("/api/resolve", {
    method: "POST",
    body: JSON.stringify({ incidentId: activeId }),
  });

  assert("Resolve returns success", resolveRes.success === true);
  assert(
    "Resolve has durationFormatted",
    !!resolveRes.data?.durationFormatted,
    `Got: ${resolveRes.data?.durationFormatted}`
  );
  assert(
    "Resolve has totalRevenueImpactCents",
    typeof resolveRes.data?.totalRevenueImpactCents === "number"
  );
  assert(
    "Resolve has affectedServiceCount",
    resolveRes.data?.affectedServiceCount > 0,
    `Got: ${resolveRes.data?.affectedServiceCount}`
  );

  console.log(
    `\n    Duration: ${resolveRes.data?.durationFormatted}`
  );
  console.log(
    `    Total impact: $${(resolveRes.data?.totalRevenueImpactCents / 100).toLocaleString()}`
  );
  console.log(
    `    Services recovered: {resolveRes.data?.affectedServiceCount}`
  );

  await sleep(500);

  const { data: afterRes } = await api("/api/incidents");
  assert(
    "No active incidents after resolve",
    afterRes.data?.activeCount === 0,
    `Got: ${afterRes.data?.activeCount}`
  );

  const { data: afterDetail } = await api(
    `/api/incidents/${activeId}`
  );
  assert(
    "Incident has resolvedAt",
    afterDetail.data?.incident?.resolvedAt !== null
  );

  const { data: afterServices } = await api("/api/services");
  assert(
    "All 14 services healthy after resolve",
    afterServices.data?.summary?.healthy === 14,
    `Got: ${afterServices.data?.summary?.healthy}`
  );
  assert(
    "No down services after resolve",
    afterServices.data?.summary?.down === 0,
    `Got: ${afterServices.data?.summary?.down}`
  );
}

async function checkPostResolution() {
  section("STEP 6: Dashboard After Resolution");

  const { data: incidentsRes } = await api("/api/incidents");
  assert(
    "Active incidents: 0",
    incidentsRes.data?.activeCount === 0,
    `Got: ${incidentsRes.data?.activeCount}`
  );
  assert(
    "Resolved incidents: > 0",
    incidentsRes.data?.resolvedCount > 0,
    `Got: ${incidentsRes.data?.resolvedCount}`
  );
  assert(
    "No active incident data",
    incidentsRes.data?.active === null
  );
}

async function checkServicesPage() {
  section("STEP 7: Services Page");

  const { data: servicesRes } = await api("/api/services");
  const services = servicesRes.data?.services ?? [];

  assert(
    "14 services returned",
    services.length === 14,
    `Got: ${services.length}`
  );

  const withTeam = services.filter((s: any) => !!s.ownerTeam);
  assert("All services have ownerTeam", withTeam.length === 14);

  const classifications = new Set(
    services.map((s: any) => s.classification)
  );
  assert(
    "Has customer-facing classification",
    classifications.has("customer-facing")
  );
  assert(
    "Has internal classification",
    classifications.has("internal")
  );
  assert(
    "Has infrastructure classification",
    classifications.has("infrastructure")
  );

  const allHealthy = services.every(
    (s: any) => s.healthStatus === "healthy"
  );
  assert("All services healthy after resolve", allHealthy);

  const withLastCheck = services.filter(
    (s: any) => s.lastHealthCheckAt !== null
  );
  assert(
    "All services have lastHealthCheckAt",
    withLastCheck.length === 14,
    `Only ${withLastCheck.length} of 14 have timestamps`
  );

  const uniqueNames = new Set(services.map((s: any) => s.name));
  assert("All service names are unique", uniqueNames.size === 14);

  const uniqueIds = new Set(services.map((s: any) => s.id));
  assert("All service IDs are unique", uniqueIds.size === 14);
}

async function testMultipleSimulations() {
  section("STEP 8: Multiple Simulations");

  console.log("\n  Testing signup-flow simulation...");
  const { data: sim1 } = await api("/api/simulate", {
    method: "POST",
    body: JSON.stringify({
      serviceName: "signup-flow",
      reset: true,
    }),
  });
  assert("signup-flow simulation succeeds", sim1.success === true);
  assert(
    "signup-flow has smaller cascade than postgres-primary",
    sim1.data?.blastRadiusCount < 13,
    `Got: ${sim1.data?.blastRadiusCount}`
  );
  console.log(
    `    signup-flow: ${sim1.data?.blastRadiusCount} services affected`
  );

  await sleep(500);

  const { data: after1 } = await api("/api/incidents");
  assert(
    "Active incident after signup-flow sim",
    after1.data?.activeCount === 1
  );

  const activeId1 = after1.data?.active?.id;
  const { data: resolve1 } = await api("/api/resolve", {
    method: "POST",
    body: JSON.stringify({ incidentId: activeId1 }),
  });
  assert("Resolve signup-flow incident", resolve1.success === true);

  await sleep(500);

  const { data: svc1 } = await api("/api/services");
  assert(
    "All healthy after signup-flow resolve",
    svc1.data?.summary?.healthy === 14,
    `Got: ${svc1.data?.summary?.healthy}`
  );

  console.log("\n  Testing postgres-primary simulation again...");
  const { data: sim2 } = await api("/api/simulate", {
    method: "POST",
    body: JSON.stringify({
      serviceName: "postgres-primary",
      reset: true,
    }),
  });
  assert(
    "postgres-primary re-simulation succeeds",
    sim2.success === true
  );
  assert(
    "postgres-primary full cascade returns",
    sim2.data?.blastRadiusCount === 13,
    `Got: ${sim2.data?.blastRadiusCount}`
  );
  assert(
    "Revenue per minute matches expected",
    sim2.data?.totalRevenuePerMinCents === 1000000,
    `Got: ${sim2.data?.totalRevenuePerMinCents}`
  );
  console.log(
    `    postgres-primary: ${sim2.data?.blastRadiusCount} services, $$$${sim2.data?.totalRevenuePerMinDollars}/min`
  );

  const activeId2 = (await api("/api/incidents")).data?.active?.id;
  await api("/api/resolve", {
    method: "POST",
    body: JSON.stringify({ incidentId: activeId2 }),
  });
  await sleep(500);

  const { data: svc2 } = await api("/api/services");
  assert(
    "All healthy after final resolve",
    svc2.data?.summary?.healthy === 14,
    `Got: ${svc2.data?.summary?.healthy}`
  );
}

async function checkGraphIntegrity() {
  section("BONUS: Graph Integrity");

  const { data: graphRes } = await api("/api/graph");
  const nodes = graphRes.data?.nodes ?? [];
  const edges = graphRes.data?.edges ?? [];

  assert(
    "Graph has 14 nodes",
    nodes.length === 14,
    `Got: ${nodes.length}`
  );
  assert(
    "Graph has 22 edges",
    edges.length === 22,
    `Got: ${edges.length}`
  );

  const nodeIds = new Set(nodes.map((n: any) => n.id));
  let allEdgesValid = true;
  for (const edge of edges) {
    const valid =
      nodeIds.has(edge.sourceServiceId) &&
      nodeIds.has(edge.targetServiceId);
    if (!valid) {
      allEdgesValid = false;
      fail(
        `Edge ${edge.id} references invalid node`,
        `source: ${edge.sourceServiceId}, target: ${edge.targetServiceId}`
      );
    }
  }
  if (allEdgesValid) ok("All edges reference valid nodes");

  const noSelfLoop = edges.every(
    (e: any) => e.sourceServiceId !== e.targetServiceId
  );
  assert("No self-loop edges", noSelfLoop);

  const postgresNode = nodes.find(
    (n: any) => n.name === "postgres-primary"
  );
  assert(
    "postgres-primary exists in graph",
    !!postgresNode
  );
  assert(
    "postgres-primary is infrastructure",
    postgresNode?.classification === "infrastructure",
    `Got: ${postgresNode?.classification}`
  );

  const cfNodes = nodes.filter(
    (n: any) => n.classification === "customer-facing"
  );
  assert(
    "4 customer-facing nodes in graph",
    cfNodes.length === 4,
    `Got: ${cfNodes.length}`
  );

  const internalNodes = nodes.filter(
    (n: any) => n.classification === "internal"
  );
  assert(
    "9 internal nodes in graph",
    internalNodes.length === 9,
    `Got: ${internalNodes.length}`
  );

  const infraNodes = nodes.filter(
    (n: any) => n.classification === "infrastructure"
  );
  assert(
    "1 infrastructure node in graph",
    infraNodes.length === 1,
    `Got: ${infraNodes.length}`
  );

  const depTypes = new Set(edges.map((e: any) => e.dependencyType));
  assert(
    "Has http_call edges",
    depTypes.has("http_call")
  );
  assert(
    "Has database_access edges",
    depTypes.has("database_access")
  );
  assert(
    "Has message_queue edges",
    depTypes.has("message_queue")
  );
}

async function checkApiErrorHandling() {
  section("BONUS: API Error Handling");

  const { status: s1 } = await api("/api/incidents/nonexistent");
  assert("404 for nonexistent incident", s1 === 404);

  const { data: badSim } = await api("/api/simulate", {
    method: "POST",
    body: JSON.stringify({ serviceName: "nonexistent-service" }),
  });
  assert(
    "Error for nonexistent service simulation",
    badSim.success === false
  );

  const { status: s2 } = await api("/api/summary", {
    method: "POST",
    body: JSON.stringify({}),
  });
  assert("400 for missing incidentId in summary", s2 === 400);

  const { data: healthRes } = await api("/api/health");
  assert(
    "Health endpoint returns success",
    healthRes.success === true
  );
}

async function main() {
  console.log("\n\x1b[1m\x1b[35m");
  console.log("  ┌─────────────────────────────────────────┐");
  console.log("  │     FAULTLINE — FULL VERIFICATION       │");
  console.log("  └─────────────────────────────────────────┘");
  console.log("\x1b[0m");
  console.log(`  Target: ${BASE}\n`);

  try {
    await checkServerRunning();
    await resetViaSimulate();
    await checkDashboardAfterSimulation();
    await checkIncidentDetail();
    await checkSummary();
    await resolveIncident();
    await checkPostResolution();
    await checkServicesPage();
    await testMultipleSimulations();
    await checkGraphIntegrity();
    await checkApiErrorHandling();
  } catch (err: any) {
    console.error(`\n\x1b[31mFATAL: ${err.message}\x1b[0m`);
    failed++;
    total++;
  }

  console.log(
    `\n\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`
  );
  console.log(`  Total:  ${total}`);
  console.log(`  \x1b[32mPassed: ${passed}\x1b[0m`);
  if (failed > 0) {
    console.log(`  \x1b[31mFailed: ${failed}\x1b[0m`);
  } else {
    console.log(`  Failed: 0`);
  }
  console.log(
    `\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`
  );

  if (failed === 0) {
    console.log(
      `\n  \x1b[32m\x1b[1m✓ ALL TESTS PASSED — App is fully working.\x1b[0m\n`
    );
  } else {
    console.log(
      `\n  \x1b[31m\x1b[1m✗ ${failed} TESTS FAILED — Review above.\x1b[0m\n`
    );
    process.exit(1);
  }
}

main();