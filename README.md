```markdown
# Faultline — Dependency Intelligence Platform

> **Know your blast radius. Quantify every cascading failure. Resolve incidents faster.**

Faultline is a full-stack B2B platform for SRE and engineering teams to map service dependencies, detect cascading failures in real time, and get AI-powered root cause analysis with revenue impact quantification — all backed by **Amazon Aurora PostgreSQL Serverless v2** through **Vercel** and **v0**.

**Built for the H0: Hack the Zero Stack with Vercel v0 and AWS Databases hackathon.**

---

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Architecture](#architecture)
- [How Aurora PostgreSQL Powers Faultline](#how-aurora-postgresql-powers-faultline)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Frontend](#frontend)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)

---

## The Problem

When a critical service goes down in production, engineering teams face three questions:

1. **Which services are affected?** — In a microservices architecture with dozens of dependencies, the blast radius of a failure is unclear until it's too late.
2. **How much money are we losing?** — Revenue impact is estimated after the fact, not tracked in real time.
3. **Where do we fix first?** — Teams waste precious minutes investigating the wrong service instead of the root cause.

Existing monitoring tools show individual service health. None of them map the full dependency graph, compute real-time revenue loss across the cascade, and rank fix priorities by upstream analysis.

---

## The Solution

Faultline solves this with three core capabilities:

### 1. Dependency Mapping
Auto-discover your service dependency graph. Every edge between every service is stored in Aurora PostgreSQL as a structured relationship with dependency type (HTTP call, database access, message queue, shared cache), confidence scores, and observed latency.

### 2. Revenue Blast Radius
When a failure is detected, Faultline runs a breadth-first traversal of the dependency graph stored in Aurora PostgreSQL, identifies every downstream affected service, and calculates real-time revenue loss per minute using traffic snapshot data — all queried and aggregated from the database.

### 3. AI-Powered Root Cause Analysis
Using **AWS Bedrock**, Faultline generates structured incident summaries with root cause analysis, blast radius breakdowns, and ranked fix priorities. The AI model receives a detailed prompt built from data queried live from Aurora PostgreSQL — service health, signal details, upstream candidates, and revenue impact.



## Why Faultline Matters

Modern companies operate hundreds of interconnected services.
When a single dependency fails, engineers often spend valuable
time determining what broke, who is affected, and where to begin.

Faultline transforms dependency data into operational intelligence,
helping teams understand cascading failures, prioritize remediation,
and quantify business impact in real time.


---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL                                        │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Next.js 16 (App Router)                          │  │
│  │                                                                      │  │
│  │  ┌───────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │  │
│  │  │   Dashboard   │  │  Incidents   │  │      Services Page         │ │  │
│  │  │   (Graph +    │  │  Detail Page │  │  (Health table + filters)  │ │  │
│  │  │   Stats +     │  │  (Blast      │  │                            │ │  │
│  │  │   Sidebar)    │  │   Radius +   │  │                            │ │  │
│  │  │               │  │   AI Summary)│  │                            │ │  │
│  │  └───────┬───────┘  └──────┬───────┘  └─────────────┬──────────────┘ │  │
│  │         │                 │                         │                │  │
│  │         ▼                 ▼                         ▼                │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │              SWR Data Fetching Layer (Polling)                  │ │  │
│  │  │     incident: 5s · blastRadius: 5s · services: 8s · graph: 15s  │ │  │
│  │  └────────────────────────────┬────────────────────────────────────┘ │  │
│  │                               │                                      │  │
│  │  ┌────────────────────────────▼────────────────────────────────────┐ │  │
│  │  │                   Next.js API Routes                            │ │  │
│  │  │                                                                 │ │  │
│  │  │  /api/services     /api/incidents    /api/graph                 │ │  │
│  │  │  /api/blast-radius /api/summary      /api/health                │ │  │
│  │  │  /api/ingest       /api/simulate     /api/resolve               │ │  │
│  │  │  /api/reconcile                                                 │ │  │
│  │  └──────────────────┬─────────────────────────┬────────────────────┘ │  │
│  │                     │                         │                      │  │
│  │                     ▼                         ▼                      │  │
│  │  ┌──────────────────────────┐  ┌─────────────────────────────────┐   │  │
│  │  │  Drizzle ORM             │  │  AWS Bedrock                    │   │  │
│  │  │  (Query Builder +        │  │  (AI Summary Generation)        │   │  │
│  │  │   Schema Validation)     │  │  Nova / Claude / Mistral        │   │  │
│  │  └────────────┬─────────────┘  └─────────────────────────────────┘   │  │
│  │               │                                                      │  │
│  └───────────────┼──────────────────────────────────────────────────────┘  │
│                  │                                                         │
└──────────────────┼─────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AWS (us-east-1)                                  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          RDS Proxy                                    │  │
│  │   Production Aurora PostgreSQL Cluster                                │  │
│  │   Handles connection multiplexing from Vercel serverless functions    │  │
│  │   ──────────────────────────────────────────────────────────────────  │  │
│  │   ┌────────────────────────────────────────────────────────────────┐  │  │
│  │   │              Aurora PostgreSQL Serverless v2                   │  │  │
│  │   │   Cluster: faultline-cluster                                   │  │  │
│  │   │   Engine: Aurora PostgreSQL 17                                 │  │  │
│  │   │   Scaling: 0.5 ACU (1 GiB) — 2 ACU (4 GiB)                     │  │  │
│  │   │                                                                │  │  │
│  │   │   ┌──────────┐ ┌──────────────┐ ┌────────────────┐             │  │  │
│  │   │   │ services │ │ dependencies │ │ health_signals │             │  │  │
│  │   │   └──────────┘ └──────────────┘ └────────────────┘             │  │  │
│  │   │   ┌───────────────────────┐ ┌──────────────┐                   │  │  │
│  │   │   │ current_traffic_      │ │ failure_     │                   │  │  │
│  │   │   │ snapshots             │ │ events       │                   │  │  │
│  │   │   └───────────────────────┘ └──────────────┘                   │  │  │
│  │   │   ┌────────────┐ ┌─────────────────────┐                       │  │  │
│  │   │   │ incidents  │ │ blast_radius_results│                       │  │  │
│  │   │   └────────────┘ └─────────────────────┘                       │  │  │
│  │   └────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────────────────┐                                                 │
│  │     AWS Bedrock        │                                                 │
│  │  (AI Summary Engine)   │                                                 │
│  └────────────────────────┘                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## How Aurora PostgreSQL Powers Faultline

Aurora PostgreSQL is not just a data store for Faultline — it **is** the intelligence layer. Every feature depends on structured, relational data that only a production-grade relational database can provide.

### Why Aurora PostgreSQL, Not a NoSQL Store

| Requirement | Why Aurora PostgreSQL Is Essential |
|---|---|
| **Dependency graph traversal** | Faultline's blast radius algorithm queries the `dependencies` table with recursive CTEs and multi-hop JOINs to traverse the service graph from a root cause node outward. This requires foreign key relationships and indexed joins that a document store cannot perform efficiently. |
| **Constrained data integrity** | The `dependencies` table enforces `CHECK` constraints (no self-dependencies, valid dependency types, confidence score 0–1 range) and `UNIQUE` constraints (one edge per source-target-type pair). These guarantees prevent graph corruption that would break the blast radius algorithm. |
| **Real-time revenue aggregation** | The `/api/incidents` route JOINs `blast_radius_results` with `current_traffic_snapshots` to compute total revenue at risk across all affected customer-facing services. This multi-table aggregation with filtering (`WHERE classification = 'customer-facing'`) is a natural relational query. |
| **Time-series health signals** | The `health_signals` table stores timestamped metric values with breach flags. Composite indexes on `(service_id, signal_type, recorded_at)` enable fast lookups of recent health data per service for both the dashboard and AI summary prompt. |
| **Incident lifecycle tracking** | The `incidents` table tracks the full lifecycle from detection to resolution. Partial indexes (`WHERE resolved_at IS NULL`) enable fast active-incident queries. The `failure_events` → `incidents` → `blast_radius_results` foreign key chain ensures referential integrity across the incident lifecycle. |
| **Serverless scaling** | Aurora Serverless v2 scales from 0.5 ACU to 2 ACU automatically. During idle periods, costs drop to near-zero. During incident simulation or active failures, the database scales to handle the burst of graph traversal queries and traffic snapshot recalculations. |

### How the Database Is Queried

**Graph traversal (blast radius computation):**
The `dependencies` table stores every edge in the service graph with `source_service_id`, `target_service_id`, `dependency_type`, and `confidence_score`. When a failure is injected, the API traverses this graph using breadth-first search, querying edges at each depth level. Results are written to `blast_radius_results` with the computed depth, dependency path, and whether each affected service is customer-facing.

**Revenue impact calculation:**
The `current_traffic_snapshots` table stores per-service revenue metrics (`revenue_per_min_cents`, `avg_order_value_cents`, `conversion_rate`). When the incidents API enriches an active incident, it JOINs blast radius results with traffic snapshots to sum the total revenue at risk across all affected customer-facing services in a single query.

**AI summary generation:**
The `/api/summary` endpoint queries the database for the full incident context — root failure event, affected services, upstream candidates, health signals — and constructs a structured prompt for AWS Bedrock. The database is the single source of truth that feeds the AI model.

### Connection Architecture

```
Vercel Serverless Functions
  → pg Pool (max 5 connections, SSL, keepalive)
    → RDS Proxy (connection multiplexing, Secrets Manager auth)
      → Aurora PostgreSQL Serverless v2 (0.5–2 ACU)
```

The application connects through **RDS Proxy**, not directly to Aurora. This is critical because Vercel serverless functions are stateless — each invocation may create a new connection. RDS Proxy multiplexes thousands of function invocations into a small pool of database connections, preventing the "too many clients" error.

The connection pool is configured with:
- `max: 5` connections per function instance
- `ssl: { rejectUnauthorized: false }` for encrypted transport
- `keepAlive: true` to prevent idle connection drops
- `statement_timeout: 30000` to fail fast on long-running queries
- Automatic pool validation and repair on connection errors (`withDbRetry`)

---

## Database Schema

Faultline uses **7 tables** in Aurora PostgreSQL, managed by **Drizzle ORM** with type-safe queries and schema-driven migrations.

### Entity Relationship

```
services ──────────────────────── dependencies (source/target FK)
   │                                    │
   ├── health_signals                   │
   ├── current_traffic_snapshots        │
   └── failure_events ── incidents ── blast_radius_results
```

### Tables

#### `services`
Core service registry. Every monitored microservice is a row.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique service identifier |
| `name` | TEXT (UNIQUE) | Service name (e.g., `postgres-primary`) |
| `owner_team` | TEXT | Owning team (e.g., `payments-team`) |
| `classification` | TEXT | `customer-facing`, `internal`, or `infrastructure` (CHECK constraint) |
| `health_status` | TEXT | `healthy`, `degraded`, `down`, or `unknown` (CHECK constraint) |
| `last_health_check_at` | TIMESTAMPTZ | Last health signal received |
| `created_at` / `updated_at` | TIMESTAMPTZ | Audit timestamps |

**Indexes:** `idx_services_health`, `idx_services_classification`

#### `dependencies`
Directed edges in the service dependency graph. Each row represents one service depending on another.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique edge identifier |
| `source_service_id` | UUID (FK → services) | The dependent service |
| `target_service_id` | UUID (FK → services) | The dependency |
| `dependency_type` | TEXT | `http_call`, `database_access`, `message_queue`, `shared_cache`, `dns`, or `configuration` |
| `confidence_score` | NUMERIC(4,3) | 0.000–1.000 confidence in this observed edge |
| `observed_frequency` | NUMERIC(10,2) | How often this dependency is called |
| `observed_latency_ms` | NUMERIC(10,2) | Observed latency of this dependency |
| `last_observed_at` | TIMESTAMPTZ | When this edge was last confirmed |

**Constraints:**
- `chk_no_self_dependency`: source ≠ target
- `uq_dependency_edge`: unique (source, target, type)
- `chk_confidence_range`: confidence between 0 and 1

**Indexes:** Composite indexes on `(source, confidence)`, `(target, confidence)` filtered for `confidence >= 0.3` — optimizes graph traversal queries that ignore low-confidence edges.

#### `health_signals`
Time-series health metrics per service. Each row is one signal reading.

| Column | Type | Description |
|---|---|---|
| `service_id` | UUID (FK → services) | Service this signal belongs to |
| `signal_type` | TEXT | `error_rate`, `latency_p95`, or `health_check` |
| `metric_value` | NUMERIC(12,4) | The measured value |
| `threshold_value` | NUMERIC(12,4) | The threshold for breach detection |
| `is_breach` | BOOLEAN | Whether this reading breached the threshold |
| `recorded_at` | TIMESTAMPTZ | When the signal was recorded |

**Indexes:** Composite `(service_id, signal_type, recorded_at)` for fast time-range queries per service and signal type.

#### `current_traffic_snapshots`
Per-service revenue metrics. Used to compute real-time revenue impact during incidents.

| Column | Type | Description |
|---|---|---|
| `service_id` | UUID (PK, FK → services) | One snapshot per service |
| `avg_requests_per_min` | NUMERIC(12,2) | Average request rate |
| `conversion_rate` | NUMERIC(6,4) | Conversion rate |
| `avg_order_value_cents` | BIGINT | Average order value in cents |
| `revenue_per_min_cents` | BIGINT | Computed revenue per minute in cents |
| `snapshot_window_start` / `snapshot_window_end` | TIMESTAMPTZ | The time window this snapshot covers |

#### `failure_events`
Detected failures. Each event captures one service failure with signal details stored as JSONB.

| Column | Type | Description |
|---|---|---|
| `service_id` | UUID (FK → services) | The failed service |
| `failure_type` | TEXT | `health_check`, `error_spike`, or `latency_degradation` |
| `severity` | TEXT | `degraded` or `down` |
| `signal_details` | JSONB | Structured failure signals (e.g., connection pool state, latency multiplier, error rate vs baseline) |
| `detected_at` / `resolved_at` | TIMESTAMPTZ | Lifecycle timestamps |

#### `incidents`
Top-level incident records. Links to the root failure event and tracks aggregate impact.

| Column | Type | Description |
|---|---|---|
| `root_failure_event_id` | UUID (FK → failure_events) | The failure that triggered this incident |
| `total_revenue_impact_cents` | BIGINT | Accumulated revenue loss in cents |
| `affected_service_count` | INT | Number of affected services |
| `max_depth` | INT | Maximum dependency depth of the blast radius |
| `started_at` / `resolved_at` | TIMESTAMPTZ | Incident lifecycle |

**Partial Index:** `idx_incidents_active` on `started_at` WHERE `resolved_at IS NULL` — fast lookup of the active incident.

#### `blast_radius_results`
Per-service blast radius computation results. One row per affected service per incident.

| Column | Type | Description |
|---|---|---|
| `incident_id` | UUID (FK → incidents) | The incident this result belongs to |
| `affected_service_id` | UUID (FK → services) | The downstream affected service |
| `depth` | INT | Dependency depth from root cause (≥1) |
| `dependency_path` | UUID[] | Array of service IDs forming the path from root to this service |
| `dependency_type` | TEXT | The type of the edge that caused this service to be affected |
| `is_customer_facing` | BOOLEAN | Whether this service is customer-facing |
| `revenue_per_min_cents` | BIGINT | Revenue loss rate for this service |

**Constraints:**
- `chk_depth`: depth ≥ 1
- `uq_blast_per_service_per_incident`: unique (incident_id, affected_service_id)

---

## API Routes

All API routes are Next.js serverless functions deployed on Vercel. They query Aurora PostgreSQL through Drizzle ORM with automatic retry on connection errors.

| Route | Method | Description |
|---|---|---|
| `/api/services` | GET | Returns all services with health status summary (total, healthy, degraded, down) |
| `/api/incidents` | GET | Returns all incidents with the active incident enriched with root cause service, failure type, and real-time revenue impact computed by joining blast radius results with traffic snapshots |
| `/api/incidents/[id]` | GET | Returns a single incident with full context |
| `/api/graph` | GET | Returns the full dependency graph (nodes + edges) for the graph canvas |
| `/api/blast-radius` | GET | Returns blast radius results for the active incident, grouped by depth |
| `/api/summary` | GET | Generates an AI summary using AWS Bedrock. Constructs a structured prompt from database data (root cause, blast radius, upstream candidates, revenue impact) and returns headline, what happened, root cause analysis, blast radius summary, revenue impact summary, and fix priority |
| `/api/health` | GET | Returns application health status including database connectivity check |
| `/api/ingest` | POST | Ingests new dependency observations or health signals |
| `/api/simulate` | POST | Injects a simulated failure on a target service. Resets all services to healthy, injects failure, computes full blast radius via graph traversal, and creates an incident record |
| `/api/resolve` | POST | Resolves the active incident, resets all services to healthy |
| `/api/reconcile` | POST | Reconciles stale dependencies and health signals |

---

## Frontend

### Pages

- **Landing Page (`/`)** — Hero section with live dependency graph visualization, animated counters (services mapped, dependency edges, revenue at risk), feature cards, and "How it works" section. Canvas particle background with mouse-following spotlight effect.
- **Dashboard (`/dashboard`)** — Full operational view: stats grid (4 metric cards), interactive dependency graph (Canvas-based with zoom, pan, fullscreen, minimap), incident sidebar (root cause signal, blast radius, revenue impact, AI summary), revenue timeline chart, and simulate failure dialog.
- **Incident Detail (`/incidents/[id]`)** — Deep-dive into a single incident: header with live status, root cause signal panel with threshold breach visualization, blast radius in tree/table view, revenue impact with per-service breakdown and area chart, AI summary with collapsible sections, and fix priority ranking with scored candidates.
- **Services (`/services`)** — Service registry table with search, health filter pills, sortable columns, and per-service status indicators.

### Design System

- **Dark mode only** — optimized for operations engineers in dim environments
- **Color-coded health status** — green (healthy), amber (degraded), red (down), blue (unknown)
- **JetBrains Mono** for all metrics, counters, and service identifiers
- **Choreographed animations** — incident activation cascade (10-step sequence with shockwave, node cascade, edge particles), resolution reverse cascade, ambient breathing on healthy nodes
- **Glassmorphism panels** for incident sidebar and floating UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Animation | Framer Motion |
| Data Fetching | SWR (polling) |
| Graph Rendering | HTML5 Canvas 2D + SVG |
| Charts | Recharts |
| ORM | Drizzle ORM (type-safe PostgreSQL queries) |
| Database | Amazon Aurora PostgreSQL Serverless v2 (engine: Aurora PostgreSQL 17) |
| Connection Pooling | RDS Proxy (connection multiplexing from Vercel serverless functions) |
| AI | AWS Bedrock (supports Amazon Nova, Anthropic Claude, Mistral) |
| Deployment | Vercel (frontend + serverless API routes) |
| Language | TypeScript |

---

## Getting Started

### Prerequisites

- Node.js 18+
- An AWS account with Aurora PostgreSQL cluster provisioned
- A Vercel account

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd Faultline

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database URL and AWS credentials

# Run database migrations
npx drizzle-kit push

# Seed the database with demo data
npx tsx scripts/seed.ts

# Start the development server
npm run dev
```

### Database Setup

```bash
# Push schema to Aurora PostgreSQL
npx drizzle-kit push

# Generate migrations
npx drizzle-kit generate

# Run migrations
npx tsx scripts/migrate.ts

# Seed demo data (14 services, 22 dependency edges)
npx tsx scripts/seed.ts

# Test database connection
npx tsx scripts/test-connection.ts
```

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Aurora PostgreSQL connection string (via RDS Proxy) | `postgresql://admin:PASSWORD@proxy-endpoint:5432/faultline` |
| `NEXT_PUBLIC_APP_URL` | Application base URL | `https://your-project.vercel.app` |
| `NEXT_PUBLIC_DEMO_MODE` | Enable demo mode for the frontend | `true` |
| `AWS_REGION` | AWS region for Bedrock | `us-east-1` |
| `AWS_BEARER_TOKEN_BEDROCK` | Bearer token for AWS Bedrock API access | — |
| `BEDROCK_MODEL_ID` | Bedrock model ID for AI summaries | `amazon.nova-pro-v1:0` |

**Important:** Never commit credentials to your repository. Use Vercel Environment Variables for production deployment. The Vercel Marketplace OIDC integration is the most secure option — it uses IAM roles with no stored keys.

---

## License

Built for the H0 Hackathon. See Devpost for official rules.
```

That's the full README. You can copy it directly. It covers everything the hackathon judges care about — especially the heavy emphasis on how Aurora PostgreSQL is integral to the architecture, not just a data store.