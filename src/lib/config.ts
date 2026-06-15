// ═══════════════════════════════════════════
// 11. src/lib/config.ts
// ═══════════════════════════════════════════

export const config = {
  isDemoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",

  healthCheckInterval:
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? 1_000 : 30_000,

  signalBatchInterval:
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? 1_000 : 30_000,

  snapshotRefreshInterval:
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? 10_000 : 300_000,

  swr: {
    incident:
      process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? 1_000 : 5_000,
    blastRadius:
      process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? 1_000 : 5_000,
    services:
      process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? 2_000 : 10_000,
    graph:
      process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? 5_000 : 30_000,
  },

  errorRateMultiplier: 3,
  latencyMultiplier: 2,
  consecutiveFailures: 3,

  maxTraversalDepth: 5,
  minConfidenceScore: 0.3,

  staleEdgeDays: 14,

  fixPriority: {
    downWeight: 100,
    degradedWeight: 50,
    depthDecay: 2,
    maxDepthBonus: 10,
    sharedDependentMultiplier: 3,
    sharedDependentThreshold: 2,
  },

  sharedStateTypes: [
    "database_access",
    "shared_cache",
    "message_queue",
  ] as const,

  demo: {
    defaultFailedService: "postgres-primary",
    cascadeDelayMs: 100,
    simulationEnabled: true,
  },

  summary: {
    maxUpstreamCandidates: 5,
    maxCustomerFacingHighlights: 3,
  },

  api: {
    maxIngestBatchSize: 500,
    uuidPattern:
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  },

  db: {
    poolMax: 5,
    idleTimeoutMs: 30_000,
    connectionTimeoutMs: 30_000,
    statementTimeoutMs: 30_000,
  },

  retry: {
    maxAttempts: 3,
    baseDelayMs: 1_000,
  },
} as const;
