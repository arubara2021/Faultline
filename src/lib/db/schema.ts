// src/lib/db/schema.ts

import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  bigint,
  jsonb,
  timestamp,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").unique().notNull(),
    ownerTeam: text("owner_team").notNull(),
    classification: text("classification").notNull(),
    healthStatus: text("health_status").notNull().default("unknown"),
    lastHealthCheckAt: timestamp("last_health_check_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "chk_classification",
      sql`${table.classification} IN ('customer-facing', 'internal', 'infrastructure')`
    ),
    check(
      "chk_health_status",
      sql`${table.healthStatus} IN ('healthy', 'degraded', 'down', 'unknown')`
    ),
    index("idx_services_health").on(table.healthStatus),
    index("idx_services_classification").on(table.classification),
  ]
);

export const dependencies = pgTable(
  "dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceServiceId: uuid("source_service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    targetServiceId: uuid("target_service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    dependencyType: text("dependency_type").notNull(),
    observedFrequency: numeric("observed_frequency", {
      precision: 10,
      scale: 2,
    }).default("0"),
    observedLatencyMs: numeric("observed_latency_ms", {
      precision: 10,
      scale: 2,
    }).default("0"),
    confidenceScore: numeric("confidence_score", {
      precision: 4,
      scale: 3,
    })
      .notNull()
      .default("0"),
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "chk_dependency_type",
      sql`${table.dependencyType} IN ('http_call', 'database_access', 'message_queue', 'shared_cache', 'dns', 'configuration')`
    ),
    check(
      "chk_confidence_range",
      sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 1`
    ),
    check(
      "chk_no_self_dependency",
      sql`${table.sourceServiceId} <> ${table.targetServiceId}`
    ),
    unique("uq_dependency_edge").on(
      table.sourceServiceId,
      table.targetServiceId,
      table.dependencyType
    ),
    index("idx_deps_source")
      .on(table.sourceServiceId, table.confidenceScore)
      .where(sql`${table.confidenceScore} >= 0.3`),
    index("idx_deps_target")
      .on(table.targetServiceId, table.confidenceScore)
      .where(sql`${table.confidenceScore} >= 0.3`),
    index("idx_deps_type").on(table.dependencyType),
    index("idx_deps_last_observed").on(table.lastObservedAt),
    index("idx_deps_source_target").on(
      table.sourceServiceId,
      table.targetServiceId
    ),
  ]
);

export const healthSignals = pgTable(
  "health_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    signalType: text("signal_type").notNull(),
    metricValue: numeric("metric_value", {
      precision: 12,
      scale: 4,
    }).notNull(),
    thresholdValue: numeric("threshold_value", { precision: 12, scale: 4 }),
    isBreach: boolean("is_breach").notNull().default(false),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "chk_signal_type",
      sql`${table.signalType} IN ('error_rate', 'latency_p95', 'health_check')`
    ),
    index("idx_health_service_type_time").on(
      table.serviceId,
      table.signalType,
      table.recordedAt
    ),
    index("idx_health_service_recorded").on(
      table.serviceId,
      table.recordedAt
    ),
    index("idx_signals_service").on(table.serviceId),
    index("idx_signals_service_type").on(table.serviceId, table.signalType),
    index("idx_signals_breach").on(table.isBreach),
  ]
);

export const currentTrafficSnapshots = pgTable(
  "current_traffic_snapshots",
  {
    serviceId: uuid("service_id")
      .primaryKey()
      .references(() => services.id, { onDelete: "cascade" }),
    avgRequestsPerMin: numeric("avg_requests_per_min", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    conversionRate: numeric("conversion_rate", {
      precision: 6,
      scale: 4,
    })
      .notNull()
      .default("0"),
    avgOrderValueCents: bigint("avg_order_value_cents", { mode: "number" })
      .notNull()
      .default(0),
    revenuePerMinCents: bigint("revenue_per_min_cents", { mode: "number" })
      .notNull()
      .default(0),
    snapshotWindowStart: timestamp("snapshot_window_start", {
      withTimezone: true,
    }).notNull(),
    snapshotWindowEnd: timestamp("snapshot_window_end", {
      withTimezone: true,
    }).notNull(),
    recalculatedAt: timestamp("recalculated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

export const failureEvents = pgTable(
  "failure_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    failureType: text("failure_type").notNull(),
    severity: text("severity").notNull(),
    signalDetails: jsonb("signal_details"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "chk_failure_type",
      sql`${table.failureType} IN ('health_check', 'error_spike', 'latency_degradation')`
    ),
    check(
      "chk_severity",
      sql`${table.severity} IN ('degraded', 'down')`
    ),
    index("idx_failure_service_time").on(table.serviceId, table.detectedAt),
    index("idx_failures_service").on(table.serviceId),
    index("idx_failures_detected").on(table.detectedAt),
    index("idx_failures_severity").on(table.severity),
  ]
);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rootFailureEventId: uuid("root_failure_event_id")
      .notNull()
      .references(() => failureEvents.id),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    totalRevenueImpactCents: bigint("total_revenue_impact_cents", {
      mode: "number",
    }).default(0),
    affectedServiceCount: integer("affected_service_count").default(0),
    maxDepth: integer("max_depth").default(0),
    resolutionNotes: text("resolution_notes"),
  },
  (table) => [
    index("idx_incidents_active")
      .on(table.startedAt)
      .where(sql`${table.resolvedAt} IS NULL`),
    index("idx_incidents_root_failure").on(table.rootFailureEventId),
    index("idx_incidents_started").on(table.startedAt),
    index("idx_incidents_resolved").on(table.resolvedAt),
  ]
);

export const blastRadiusResults = pgTable(
  "blast_radius_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    affectedServiceId: uuid("affected_service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    depth: integer("depth").notNull(),
    dependencyPath: uuid("dependency_path").array().notNull(),
    dependencyType: text("dependency_type"),
    isCustomerFacing: boolean("is_customer_facing").notNull().default(false),
    revenuePerMinCents: bigint("revenue_per_min_cents", {
      mode: "number",
    }).default(0),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("chk_depth", sql`${table.depth} >= 1`),
    unique("uq_blast_per_service_per_incident").on(
      table.incidentId,
      table.affectedServiceId
    ),
    index("idx_blast_incident").on(table.incidentId),
    index("idx_blast_affected_service").on(table.affectedServiceId),
    index("idx_blast_depth").on(table.depth),
    index("idx_blast_incident_depth").on(table.incidentId, table.depth),
  ]
);
