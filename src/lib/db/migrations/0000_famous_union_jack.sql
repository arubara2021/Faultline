CREATE TABLE "blast_radius_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"affected_service_id" uuid NOT NULL,
	"depth" integer NOT NULL,
	"dependency_path" uuid[] NOT NULL,
	"dependency_type" text,
	"is_customer_facing" boolean DEFAULT false NOT NULL,
	"revenue_per_min_cents" bigint DEFAULT 0,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_blast_per_service_per_incident" UNIQUE("incident_id","affected_service_id"),
	CONSTRAINT "chk_depth" CHECK ("blast_radius_results"."depth" >= 1)
);
--> statement-breakpoint
CREATE TABLE "current_traffic_snapshots" (
	"service_id" uuid PRIMARY KEY NOT NULL,
	"avg_requests_per_min" numeric(12, 2) DEFAULT '0' NOT NULL,
	"conversion_rate" numeric(6, 4) DEFAULT '0' NOT NULL,
	"avg_order_value_cents" bigint DEFAULT 0 NOT NULL,
	"revenue_per_min_cents" bigint DEFAULT 0 NOT NULL,
	"snapshot_window_start" timestamp with time zone NOT NULL,
	"snapshot_window_end" timestamp with time zone NOT NULL,
	"recalculated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_service_id" uuid NOT NULL,
	"target_service_id" uuid NOT NULL,
	"dependency_type" text NOT NULL,
	"observed_frequency" numeric(10, 2) DEFAULT '0',
	"observed_latency_ms" numeric(10, 2) DEFAULT '0',
	"confidence_score" numeric(4, 3) DEFAULT '0' NOT NULL,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_dependency_edge" UNIQUE("source_service_id","target_service_id","dependency_type"),
	CONSTRAINT "chk_dependency_type" CHECK ("dependencies"."dependency_type" IN ('http_call', 'database_access', 'message_queue', 'shared_cache', 'dns', 'configuration')),
	CONSTRAINT "chk_confidence_range" CHECK ("dependencies"."confidence_score" >= 0 AND "dependencies"."confidence_score" <= 1),
	CONSTRAINT "chk_no_self_dependency" CHECK ("dependencies"."source_service_id" <> "dependencies"."target_service_id")
);
--> statement-breakpoint
CREATE TABLE "failure_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"failure_type" text NOT NULL,
	"severity" text NOT NULL,
	"signal_details" jsonb,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "chk_failure_type" CHECK ("failure_events"."failure_type" IN ('health_check', 'error_spike', 'latency_degradation')),
	CONSTRAINT "chk_severity" CHECK ("failure_events"."severity" IN ('degraded', 'down'))
);
--> statement-breakpoint
CREATE TABLE "health_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"signal_type" text NOT NULL,
	"metric_value" numeric(12, 4) NOT NULL,
	"threshold_value" numeric(12, 4),
	"is_breach" boolean DEFAULT false NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_signal_type" CHECK ("health_signals"."signal_type" IN ('error_rate', 'latency_p95', 'health_check'))
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"root_failure_event_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"total_revenue_impact_cents" bigint DEFAULT 0,
	"affected_service_count" integer DEFAULT 0,
	"max_depth" integer DEFAULT 0,
	"resolution_notes" text
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_team" text NOT NULL,
	"classification" text NOT NULL,
	"health_status" text DEFAULT 'unknown' NOT NULL,
	"last_health_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_name_unique" UNIQUE("name"),
	CONSTRAINT "chk_classification" CHECK ("services"."classification" IN ('customer-facing', 'internal', 'infrastructure')),
	CONSTRAINT "chk_health_status" CHECK ("services"."health_status" IN ('healthy', 'degraded', 'down', 'unknown'))
);
--> statement-breakpoint
ALTER TABLE "blast_radius_results" ADD CONSTRAINT "blast_radius_results_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blast_radius_results" ADD CONSTRAINT "blast_radius_results_affected_service_id_services_id_fk" FOREIGN KEY ("affected_service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_traffic_snapshots" ADD CONSTRAINT "current_traffic_snapshots_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_source_service_id_services_id_fk" FOREIGN KEY ("source_service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_target_service_id_services_id_fk" FOREIGN KEY ("target_service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_events" ADD CONSTRAINT "failure_events_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_signals" ADD CONSTRAINT "health_signals_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_root_failure_event_id_failure_events_id_fk" FOREIGN KEY ("root_failure_event_id") REFERENCES "public"."failure_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_blast_incident" ON "blast_radius_results" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_deps_source" ON "dependencies" USING btree ("source_service_id","confidence_score") WHERE "dependencies"."confidence_score" >= 0.3;--> statement-breakpoint
CREATE INDEX "idx_deps_target" ON "dependencies" USING btree ("target_service_id","confidence_score") WHERE "dependencies"."confidence_score" >= 0.3;--> statement-breakpoint
CREATE INDEX "idx_deps_type" ON "dependencies" USING btree ("dependency_type");--> statement-breakpoint
CREATE INDEX "idx_failure_service_time" ON "failure_events" USING btree ("service_id","detected_at");--> statement-breakpoint
CREATE INDEX "idx_health_service_type_time" ON "health_signals" USING btree ("service_id","signal_type","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_incidents_active" ON "incidents" USING btree ("started_at") WHERE "incidents"."resolved_at" IS NULL;