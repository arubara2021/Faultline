
# Faultline — Tech Stack & Code Structure

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 14+ (App Router) | Pages, SSR, API routes, serverless functions |
| UI Scaffolding | Vercel v0 | Generate initial dashboard components |
| CSS | Tailwind CSS v3.4+ | Utility-first styling |
| Components | shadcn/ui | Accessible, customizable UI primitives |
| Icons | Lucide React | Consistent icon set |
| Animations | Framer Motion | Incident ticker, blast radius reveal, graph transitions |
| Charts | Recharts | Revenue impact timeline, failure trend |
| Data Fetching | SWR | Caching, revalidation, polling (real-time dashboard updates) |
| Theming | next-themes | Dark mode (default) |
| Notifications | Sonner | Toast notifications for incident alerts |
| Forms | React Hook Form + Zod | Validation for config and resolution forms |
| ORM | Drizzle ORM | Type-safe PostgreSQL queries, raw recursive CTEs |
| Database | Aurora PostgreSQL (Serverless v2) | Dependency graph, traffic snapshots, incidents |
| Connection Pooling | AWS RDS Proxy | Multiplexes serverless connections to Aurora |
| Frontend Hosting | Vercel | Deployment, SSL, serverless functions |
| Version Control | GitHub | Public repository |

---

## Why Each Choice

### Next.js 14+ (App Router)

The entire application — dashboard, graph visualization, API routes, health check polling — runs as a single Next.js project on Vercel. No separate backend server.

- **Server Components** render the initial dashboard shell (fast first paint).
- **Client Components** handle interactive elements (graph visualization, incident timeline, resolve buttons).
- **API Routes** handle all backend logic: signal ingestion, graph traversal, failure detection, revenue calculation.
- **All API routes use the default Node.js runtime**, not the Edge runtime. This is required because the `pg` database driver depends on Node.js core modules (`net`, `crypto`, `tls`) that are not available in V8 isolates. The Edge runtime is explicitly avoided for any route that touches the database.

### AWS RDS Proxy (Connection Pooling Layer)

Vercel serverless functions are stateless. Each invocation may create a new database connection. Under concurrent load (multiple dashboard users, health check polling, and graph reconciliation running simultaneously), this can exhaust Aurora's connection limit.

**The problem at scale:**

```
50 dashboard users → 50 serverless containers
  → each creates a connection pool
    → 50 × max_connections_per_pool = connection exhaustion
      → FATAL: sorry, too many clients already
```

**AWS RDS Proxy solves this** by sitting between Vercel's serverless functions and Aurora PostgreSQL. It multiplexes hundreds of short-lived client connections into a small pool of persistent database connections to Aurora. The application connects to the RDS Proxy endpoint instead of the Aurora endpoint directly.

```
Vercel Serverless Functions → RDS Proxy → Aurora PostgreSQL
  (many short-lived conns)    (pooling)   (few persistent conns)
```

For the hackathon demo (low concurrency, 1-3 users), RDS Proxy is not strictly required — the default `pg` pool instantiated outside the request handler is sufficient. But it is included in the architecture diagram and documentation to demonstrate production-readiness and understanding of serverless-to-relational database mechanics.

### Tailwind CSS v3.4+

All styling is utility-first. Every spacing value, color, font size, and layout is Tailwind. No custom CSS files.

### shadcn/ui

Copied into the project (not installed as a dependency). Customized with Tailwind. Used components:

| Component | Usage |
|-----------|-------|
| `Button` | Resolve actions, trigger reconciliation, navigation |
| `Card` | Service cards, failure cards, stat cards |
| `Badge` | Health status (healthy/degraded/down), severity, depth indicators |
| `Dialog` | Confirmation for resolution actions |
| `Tabs` | Dashboard view switching (Overview, Blast Radius, Root Cause, Timeline) |
| `Tooltip` | Service name, dependency type, revenue amount on hover |
| `Skeleton` | Loading states for graph and data |
| `Separator` | Visual dividers between sections |
| `Sonner` | Toast notifications for real-time alerts |

### Lucide React

Key icons:

| Icon | Usage |
|------|-------|
| `Activity` | Health status indicator |
| `AlertTriangle` | Degraded service |
| `XCircle` | Down service |
| `CheckCircle2` | Healthy service |
| `DollarSign` | Revenue impact amounts |
| `Clock` | Incident duration timer |
| `ArrowDown` | Downstream dependency direction |
| `ArrowUp` | Upstream dependency direction |
| `GitBranch` | Dependency graph |
| `Zap` | One-click resolve |
| `Radio` | Live connection indicator |
| `Shield` | Infrastructure services |
| `Server` | Internal services |
| `Globe` | Customer-facing services |
| `Search` | Service search/filter |
| `RefreshCw` | Force graph refresh |
| `TrendingUp` / `TrendingDown` | Revenue impact direction |

### Framer Motion

| Animation | Technique |
|-----------|-----------|
| Revenue ticker counting up | `useMotionValue` + `animate` |
| Blast radius cards staggering in | `staggerChildren` on parent `motion.div` |
| Graph node appearing on failure | Scale + opacity transition |
| Edge pulsing on cascade propagation | Animated `stroke-opacity` with repeat |
| Incident timer | Continuous count-up with `useMotionValue` |
| Card hover lift | `whileHover={{ y: -2 }}` |
| Depth indicator fade | Opacity cascade by depth level |

### Recharts

Renders the revenue impact timeline during an active incident. Uses `AreaChart` with gradient fill — red during high impact, fading to green as services recover. Custom tooltip shows exact timestamp, revenue per minute, and cumulative impact.

### SWR (Real-Time Dashboard Updates)

SWR handles all dashboard data fetching and real-time updates.

**Why SWR polling instead of SSE or WebSocket:**

Vercel serverless functions have strict execution time limits:

| Tier | Function Timeout |
|------|-----------------|
| Hobby (free — hackathon tier) | 10 seconds |
| Pro | 60 seconds |

Server-Sent Events require a long-lived HTTP connection held open by the server. On Vercel's Hobby tier, the serverless function will be forcibly terminated after 10 seconds, killing the SSE connection. The dashboard would show the connection dropping and reconnecting every 10 seconds — a choppy, broken experience during a demo.

**The solution:** SWR polling with `refreshInterval`. In production demo mode, hooks poll every 1 second. This produces the same visual effect as real-time updates (the dashboard refreshes once per second with new data) without requiring long-lived server connections.

```typescript
// Example: polling for active incident data
const { data, error } = useSWR('/api/incidents/active', fetcher, {
  refreshInterval: config.isDemoMode ? 1_000 : 5_000,
});
```

For a 3-minute demo video, 1-second polling is visually indistinguishable from true real-time streaming. The viewer sees numbers updating, cards appearing, and the revenue ticker climbing — all without the technical complexity of maintaining persistent connections on a serverless platform.

For production deployment beyond the hackathon, the polling approach can be replaced with a true SSE or WebSocket implementation on a long-running server (such as ECS, a standalone Node.js process, or a dedicated real-time service). That is outside the scope of the hackathon build.

Custom hooks:

- `useIncident()` — active incident data, polls every 1s in demo mode
- `useBlastRadius(incidentId)` — affected services list, polls every 1s in demo mode
- `useServiceGraph()` — full dependency graph for visualization
- `useServices()` — all services with health status
- `useResolve()` — mutation hook for incident resolution, triggers SWR revalidation

### Drizzle ORM

Type-safe database access. Schema defined as TypeScript. Queries written close to SQL for complex traversals but with full type inference for simpler operations. Migrations managed by `drizzle-kit`.

**Why Drizzle over Prisma or Knex:**

| Requirement | Drizzle | Prisma | Knex |
|-------------|---------|--------|------|
| Raw recursive CTE queries | Native — write SQL directly | Limited — `.$queryRaw` works but fights the ORM | Yes — but no type inference |
| TypeScript type inference | Full — schema types flow to queries | Full | None |
| Lightweight runtime | Minimal — no query engine binary | Heavy — Prisma Query Engine binary | Minimal |
| Close to SQL | Yes — feels like writing SQL with type safety | No — Prisma Client has its own query DSL | Yes — but untyped |
| Migration management | `drizzle-kit` — simple, fast | `prisma migrate` — more opinionated | `knex migrate` — manual |

Drizzle is the right tool for this workload because the blast radius traversal requires complex recursive CTEs that must be written in raw SQL. Drizzle lets you write those queries with full PostgreSQL expressiveness while keeping simpler CRUD operations type-safe.

---

## Dependencies

```bash
# Create project
npx create-next-app@latest faultline \
  --typescript --tailwind --eslint --app --src-dir
cd faultline

# Core UI
npm install lucide-react framer-motion recharts

# shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card badge dialog tabs \
  dropdown-menu tooltip skeleton separator sonner \
  input label select textarea

# Data fetching
npm install swr

# Theming
npm install next-themes

# Forms and validation
npm install react-hook-form @hookform/resolvers zod

# Database
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg

# Utilities
npm install clsx tailwind-merge class-variance-authority date-fns
```

---

## Environment Variables

```bash
# Aurora PostgreSQL (via RDS Proxy endpoint)
DATABASE_URL=postgresql://admin:password@rds-proxy-endpoint:5432/faultline

# App
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app

# Demo mode (set to 'true' for 1s polling intervals)
NEXT_PUBLIC_DEMO_MODE=false
```

**Note:** The `DATABASE_URL` points to the RDS Proxy endpoint, not the Aurora cluster endpoint directly. This ensures all serverless function connections go through the proxy's connection pool.

Stored as Vercel Environment Variables. Never committed to the repository.

---

## Code Structure

```
faultline/
│
├── app/
│   ├── layout.tsx                      # Root layout: theme provider,
│   │                                   # font loading, Sonner toaster
│   ├── page.tsx                        # Main dashboard page
│   ├── globals.css                     # Tailwind base, CSS custom
│   │                                   # properties (colors, fonts)
│   │
│   └── api/
│       ├── ingest/
│       │   └── route.ts                # POST: accepts pre-aggregated
│       │                               # topological summaries from
│       │                               # service mesh / API gateway
│       │                               # Runtime: nodejs (default)
│       │
│       ├── health/
│       │   └── route.ts                # POST: trigger health check
│       │                               # poll cycle. Polls service
│       │                               # /health endpoints, updates
│       │                               # services table, creates
│       │                               # failure events on status
│       │                               # change
│       │                               # Runtime: nodejs (default)
│       │
│       ├── reconcile/
│       │   └── route.ts                # POST: trigger graph
│       │                               # reconciliation: stale edge
│       │                               # cleanup, confidence score
│       │                               # recalculation, traffic
│       │                               # snapshot refresh
│       │                               # Runtime: nodejs (default)
│       │
│       ├── incidents/
│       │   ├── route.ts                # GET: list incidents (active +
│       │   │                           #   resolved)
│       │   │                           # Runtime: nodejs (default)
│       │   └── [id]/
│       │       └── route.ts            # GET: single incident detail
│       │                               #   with blast radius results
│       │                               # Runtime: nodejs (default)
│       │
│       ├── blast-radius/
│       │   └── route.ts                # POST: trigger blast radius
│       │                               #   traversal for a service.
│       │                               #   Runs recursive CTE, writes
│       │                               #   results to blast_radius_
│       │                               #   results, calculates
│       │                               #   revenue impact
│       │                               # Runtime: nodejs (default)
│       │
│       ├── graph/
│       │   └── route.ts                # GET: full dependency graph
│       │                               #   (services + edges) for
│       │                               #   visualization
│       │                               # Runtime: nodejs (default)
│       │
│       ├── resolve/
│       │   └── route.ts                # POST: resolve an incident
│       │                               #   (mark as resolved, log
│       │                               #   resolution notes)
│       │                               # Runtime: nodejs (default)
│       │
│       └── services/
│           └── route.ts                # GET: list all services with
│                                       #   current health status
│                                       # Runtime: nodejs (default)
│
├── components/
│   │
│   ├── ui/                             # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── tabs.tsx
│   │   ├── tooltip.tsx
│   │   ├── skeleton.tsx
│   │   ├── separator.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   └── sonner.tsx
│   │
│   ├── dashboard/
│   │   ├── incident-overview.tsx       # Main incident view: failed
│   │   │                               # service centered, affected
│   │   │                               # services around it, revenue
│   │   │                               # ticker at top
│   │   │
│   │   ├── blast-radius-list.tsx       # Affected services sorted by
│   │   │                               # depth. Each card shows service
│   │   │                               # name, depth, dependency type,
│   │   │                               # revenue impact
│   │   │
│   │   ├── root-cause-panel.tsx        # Upstream dependencies ranked
│   │   │                               # by likelihood. Shows health
│   │   │                               # status, degradation timeline,
│   │   │                               # shared-impact correlation
│   │   │
│   │   ├── revenue-timeline.tsx        # Recharts AreaChart: revenue
│   │   │                               # impact per minute over
│   │   │                               # incident duration
│   │   │
│   │   ├── service-graph.tsx           # Interactive dependency graph
│   │   │                               # visualization. Nodes =
│   │   │                               # services, edges =
│   │   │                               # dependencies. Failed service
│   │   │                               # highlighted, affected services
│   │   │                               # color-coded by depth
│   │   │
│   │   ├── revenue-ticker.tsx          # Large animated number:
│   │   │                               # accumulated revenue impact.
│   │   │                               # Counts up in real time via
│   │   │                               # Framer Motion
│   │   │
│   │   ├── incident-timer.tsx          # Clock showing incident
│   │   │                               # duration since detection.
│   │   │                               # JetBrains Mono for stable
│   │   │                               # digit rendering
│   │   │
│   │   ├── healthy-state.tsx           # Calm view when no incident
│   │   │                               # is active. "All 42 services
│   │   │                               # healthy" with green indicators
│   │   │
│   │   └── stats-grid.tsx             # Summary row: active incidents,
│   │                                   # total services, healthy count,
│   │                                   # degraded count, down count
│   │
│   ├── graph/
│   │   ├── graph-canvas.tsx            # Main graph rendering component.
│   │   │                               # Uses SVG with force-directed
│   │   │                               # layout (d3-force) or pre-
│   │   │                               # computed positions
│   │   │
│   │   ├── service-node.tsx            # Individual service node in
│   │   │                               # the graph. Shows name, health
│   │   │                               # badge, classification icon.
│   │   │                               # Pulses on failure
│   │   │
│   │   ├── dependency-edge.tsx         # Edge between two nodes.
│   │   │                               # Solid for high confidence,
│   │   │                               # dashed for medium. Animates
│   │   │                               # on cascade propagation
│   │   │
│   │   └── depth-legend.tsx            # Color legend for depth levels
│   │
│   ├── layout/
│   │   ├── header.tsx                  # Top bar: Faultline logo,
│   │   │                               # incident count badge,
│   │   │                               # connection status indicator
│   │   │
│   │   ├── sidebar.tsx                 # Navigation: Dashboard, Graph,
│   │   │                               # Services, Incidents history
│   │   │
│   │   └── mobile-nav.tsx              # Mobile navigation drawer
│   │
│   └── shared/
│       ├── animated-counter.tsx        # Reusable number animation
│       │                               # component (Framer Motion)
│       │
│       ├── loading-skeleton.tsx        # Page-level loading skeleton
│       │
│       ├── empty-state.tsx             # No active incidents state
│       │
│       ├── error-boundary.tsx          # Error handling wrapper
│       │
│       ├── status-badge.tsx            # Health status badge
│       │                               # (healthy/degraded/down)
│       │                               # with color and icon
│       │
│       ├── depth-indicator.tsx         # Visual depth level indicator
│       │                               # (1, 2, 3+) with color coding
│       │
│       └── confirm-dialog.tsx          # Reusable confirmation dialog
│                                       # for resolution actions
│
├── lib/
│   │
│   ├── db/
│   │   ├── schema.ts                   # Drizzle schema: services,
│   │   │                               # dependencies, health_signals,
│   │   │                               # current_traffic_snapshots,
│   │   │                               # failure_events, incidents,
│   │   │                               # blast_radius_results
│   │   │
│   │   ├── index.ts                    # Database connection singleton.
│   │   │                               # Pool instantiated ONCE at
│   │   │                               # module level (outside request
│   │   │                               # handler) to enable connection
│   │   │                               # reuse across serverless
│   │   │                               # invocations. Connects to
│   │   │                               # RDS Proxy endpoint.
│   │   │
│   │   └── migrations/                 # Drizzle migration files
│   │
│   ├── graph/
│   │   ├── traversal.ts                # Recursive CTE queries for
│   │   │                               # downstream (blast radius) and
│   │   │                               # upstream (root cause) traversal
│   │   │
│   │   ├── confidence.ts               # Confidence score calculation:
│   │   │                               # frequency x consistency x
│   │   │                               # recency
│   │   │
│   │   ├── ingest.ts                   # Normalize incoming topological
│   │   │                               # summaries into dependency edge
│   │   │                               # updates (insert new, update
│   │   │                               # existing, refresh timestamps)
│   │   │
│   │   └── stale.ts                    # Stale edge detection: flag
│   │                                   # dependencies not observed in
│   │                                   # 14+ days for removal
│   │
│   ├── detection/
│   │   ├── health-checker.ts           # Polls service /health endpoints
│   │   │                               # at configurable interval.
│   │   │                               # Creates failure events on
│   │   │                               # consecutive failures
│   │   │
│   │   ├── error-detector.ts           # Monitors aggregated error rate
│   │   │                               # metrics. Flags services where
│   │   │                               # error rate > 3x 7-day average
│   │   │
│   │   └── latency-detector.ts         # Monitors aggregated p95
│   │                                   # latency. Flags services where
│   │                                   # latency > 2x 7-day average
│   │
│   ├── impact/
│   │   ├── scorer.ts                   # Revenue impact calculation:
│   │   │                               # JOIN blast_radius_results
│   │   │                               # against current_traffic_
│   │   │                               # snapshots (single query,
│   │   │                               # same database)
│   │   │
│   │   └── snapshot-refresh.ts         # Background job: recalculate
│   │                                   # current_traffic_snapshots from
│   │                                   # raw traffic data (7-day rolling
│   │                                   # averages per service)
│   │
│   ├── hooks/
│   │   ├── use-incident.ts             # SWR hook: active incident.
│   │   │                               # refreshInterval: 1000ms in
│   │   │                               # demo mode, 5000ms in production
│   │   │
│   │   ├── use-blast-radius.ts         # SWR hook: affected services.
│   │   │                               # refreshInterval: 1000ms in
│   │   │                               # demo mode
│   │   │
│   │   ├── use-service-graph.ts        # SWR hook: full graph for vis.
│   │   │                               # refreshInterval: 5000ms
│   │   │
│   │   ├── use-services.ts             # SWR hook: all services with
│   │   │                               # health status
│   │   │
│   │   └── use-resolve.ts              # Mutation hook: resolve incident.
│   │                                   # On success, triggers SWR
│   │                                   # revalidation of incident
│   │                                   # and blast radius hooks
│   │
│   ├── utils/
│   │   ├── format.ts                   # Currency formatting, percentage
│   │   │                               # formatting, number abbreviation
│   │   │                               # ($47K, $1.2M)
│   │   ├── cn.ts                       # clsx + tailwind-merge utility
│   │   ├── dates.ts                    # Relative timestamps ("3 min
│   │   │                               # ago"), duration formatting
│   │   │                               # ("1h 23m 45s")
│   │   └── colors.ts                   # Health status -> color mapping,
│   │                                   # depth -> color mapping,
│   │                                   # severity -> color mapping
│   │
│   ├── types/
│   │   └── index.ts                    # TypeScript interfaces:
│   │                                   # Service, Dependency,
│   │                                   # HealthSignal, FailureEvent,
│   │                                   # Incident, BlastRadiusResult,
│   │                                   # TrafficSnapshot,
│   │                                   # GraphNode, GraphEdge
│   │
│   └── config.ts                       # Configuration constants with
│                                       # demo/production mode switching
│
├── scripts/
│   ├── seed.ts                         # Data seeder: creates 14
│   │                                   # services, 22 dependencies,
│   │                                   # traffic baselines, and
│   │                                   # failure scenarios
│   │
│   └── migrate.ts                      # Database migration runner
│
├── public/
│   └── fonts/                          # Custom fonts if needed
│
├── drizzle.config.ts                   # Drizzle Kit configuration
├── tailwind.config.ts                  # Tailwind configuration
├── next.config.ts                      # Next.js configuration
├── tsconfig.json                       # TypeScript configuration
└── package.json
```

---

## API Routes Summary

| Route | Method | Runtime | Purpose |
|-------|--------|---------|---------|
| `/api/ingest` | POST | nodejs | Accept aggregated topological summaries |
| `/api/health` | POST | nodejs | Trigger health check poll cycle |
| `/api/reconcile` | POST | nodejs | Graph reconciliation (stale edges, confidence, snapshots) |
| `/api/incidents` | GET | nodejs | List all incidents |
| `/api/incidents/[id]` | GET | nodejs | Single incident with blast radius results |
| `/api/blast-radius` | POST | nodejs | Trigger blast radius traversal |
| `/api/graph` | GET | nodejs | Full dependency graph for visualization |
| `/api/resolve` | POST | nodejs | Resolve an incident |
| `/api/services` | GET | nodejs | All services with health status |

**Every route uses the default `nodejs` runtime.** No route uses `runtime: 'edge'`. This is intentional and documented: the `pg` driver requires Node.js core modules (`net`, `crypto`, `tls`) that are not available in V8 isolates.

---

## Database Connection

```typescript
// lib/db/index.ts

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Pool is instantiated ONCE at module level.
// In Vercel's serverless environment, this module is cached
// across invocations within the same container. The pool
// is reused, not recreated per request.
//
// The connection string points to the RDS Proxy endpoint,
// not the Aurora cluster endpoint directly. RDS Proxy
// multiplexes connections from many serverless containers
// into a small persistent pool to Aurora.

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,                     // Conservative: let RDS Proxy
                               // handle the heavy pooling
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });
```

**Why `max: 5` and not `max: 10`:**

Each serverless container maintains a small local pool (5 connections). RDS Proxy aggregates these into its own pool. With RDS Proxy in the architecture, the local pool should be conservative — the proxy handles the high-concurrency pooling. A local pool of 5 is sufficient because each API route typically needs only 1-2 concurrent queries.

---

## Configuration Constants

```typescript
// lib/config.ts

export const config = {
  // Feature flag: demo vs production mode
  isDemoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",

  // Health check polling
  healthCheckInterval:
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
      ? 1_000       // 1s in demo mode (fast cascade visualization)
      : 30_000,     // 30s in production

  // Signal batch processing
  signalBatchInterval:
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
      ? 1_000
      : 30_000,

  // Traffic snapshot refresh
  snapshotRefreshInterval:
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
      ? 10_000      // 10s in demo mode
      : 300_000,    // 5min in production

  // SWR polling intervals (replaces SSE)
  swr: {
    incident:
      process.env.NEXT_PUBLIC_DEMO_MODE === "true"
        ? 1_000     // 1s polling in demo (mimics real-time)
        : 5_000,    // 5s polling in production
    blastRadius:
      process.env.NEXT_PUBLIC_DEMO_MODE === "true"
        ? 1_000
        : 5_000,
    services:
      process.env.NEXT_PUBLIC_DEMO_MODE === "true"
        ? 2_000
        : 10_000,
    graph:
      process.env.NEXT_PUBLIC_DEMO_MODE === "true"
        ? 5_000
        : 30_000,
  },

  // Failure detection thresholds
  errorRateMultiplier: 3,         // 3x 7-day average = degraded
  latencyMultiplier: 2,           // 2x 7-day p95 = degraded
  consecutiveFailures: 3,         // 3 consecutive health check
                                  // failures = down

  // Graph traversal
  maxTraversalDepth: 10,
  minConfidenceScore: 0.3,

  // Stale edge cleanup
  staleEdgeDays: 14,

  // RDS Proxy
  rdsProxyEndpoint:
    process.env.DATABASE_URL ?? "",
} as const;
```

---

## Key Data Flow Paths

### 1. Signal Ingestion -> Graph Update

```
Service mesh / API gateway
  -> POST /api/ingest (aggregated summary JSON)
    -> lib/graph/ingest.ts
      -> Upsert dependency edge in `dependencies` table
      -> Update confidence score
      -> Update observed_frequency and observed_latency_ms
      -> Refresh last_observed_at
```

### 2. Failure Detection -> Incident Creation

```
Cron job / manual trigger
  -> POST /api/health
    -> lib/detection/health-checker.ts
      -> Poll each service's /health endpoint
      -> Update `services.health_status`
      -> If status changed to degraded/down:
        -> Insert into `failure_events`
        -> Create row in `incidents`
        -> Trigger blast radius traversal
        -> SWR will pick up the new incident on next poll
```

### 3. Blast Radius Traversal -> Revenue Impact

```
Incident created
  -> POST /api/blast-radius
    -> lib/graph/traversal.ts
      -> Execute recursive CTE (downstream walk)
      -> For each affected service:
        -> LEFT JOIN current_traffic_snapshots
        -> Calculate revenue_per_min_cents
        -> Insert into blast_radius_results
      -> Sum total revenue impact
      -> Update incidents.total_revenue_impact_cents
      -> Dashboard picks up results via SWR polling
```

### 4. Dashboard Real-Time Update (SWR Polling)

```
Dashboard loads
  -> useIncident() hook initiates SWR fetch to /api/incidents
    -> refreshInterval: 1000ms in demo mode
    -> On each poll:
      -> If new incident detected: render incident overview
      -> If incident resolved: render healthy state
      -> SWR revalidation triggers child hooks to refetch

  -> useBlastRadius(incidentId) hook polls /api/blast-radius
    -> refreshInterval: 1000ms in demo mode
    -> On each poll:
      -> If new affected services: update blast radius list
      -> If revenue impact changed: update ticker
      -> Framer Motion animates transitions
```

**Why this works for the demo:**

In demo mode, all SWR hooks poll every 1 second. When you trigger a simulated failure:
1. Health check detects the failure (within 1s)
2. Incident is created in the database
3. Blast radius traversal runs (milliseconds via recursive CTE)
4. Next SWR poll picks up the new incident and blast radius results
5. Dashboard updates with Framer Motion animations

Total time from simulated failure to dashboard update: approximately 1-2 seconds. Indistinguishable from real-time to a viewer watching the demo video.

---

## Component Hierarchy

```
<RootLayout>                              (app/layout.tsx)
  <ThemeProvider>                          (next-themes)
    <Sonner />                            (toast notifications)
    <Header />                            (components/layout/header.tsx)
    <Sidebar />                           (components/layout/sidebar.tsx)

    <main>
      {/* No active incident */}
      <HealthyState />                    (components/dashboard/healthy-state.tsx)
        <StatsGrid />                     (components/dashboard/stats-grid.tsx)
        <ServiceGraph />                  (components/graph/graph-canvas.tsx)

      {/* Active incident */}
      <IncidentOverview />                (components/dashboard/incident-overview.tsx)
        <RevenueTicker />                 (components/dashboard/revenue-ticker.tsx)
        <IncidentTimer />                 (components/dashboard/incident-timer.tsx)
        <ServiceGraph
          failedService={...}
          affectedServices={...}
        />                                (components/graph/graph-canvas.tsx)
          <ServiceNode />                 (components/graph/service-node.tsx)
          <DependencyEdge />              (components/graph/dependency-edge.tsx)
          <DepthLegend />                 (components/graph/depth-legend.tsx)

      <Tabs>
        <TabsList>
          <TabsTrigger value="blast">Blast Radius</TabsTrigger>
          <TabsTrigger value="cause">Root Cause</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="blast">
          <BlastRadiusList />             (components/dashboard/blast-radius-list.tsx)
        </TabsContent>

        <TabsContent value="cause">
          <RootCausePanel />              (components/dashboard/root-cause-panel.tsx)
        </TabsContent>

        <TabsContent value="timeline">
          <RevenueTimeline />             (components/dashboard/revenue-timeline.tsx)
        </TabsContent>
      </Tabs>
    </main>
  </ThemeProvider>
</RootLayout>
```

---

## Color System

```css
:root {
  /* Background layers */
  --bg-primary: #0a0a0f;
  --bg-secondary: #111118;
  --bg-tertiary: #1a1a24;
  --bg-hover: #22222e;

  /* Text */
  --text-primary: #f0f0f5;
  --text-secondary: #8b8b9e;
  --text-tertiary: #5a5a6e;

  /* Health status */
  --healthy: #22c55e;
  --healthy-muted: rgba(34, 197, 94, 0.15);
  --degraded: #f59e0b;
  --degraded-muted: rgba(245, 158, 11, 0.15);
  --down: #ef4444;
  --down-muted: rgba(239, 68, 68, 0.15);

  /* Depth colors (blast radius) */
  --depth-1: #ef4444;       /* Red - directly impacted */
  --depth-2: #f59e0b;       /* Amber - cascade impacted */
  --depth-3: #eab308;       /* Yellow - secondary cascade */
  --depth-4-plus: #6b7280;  /* Gray - distant impact */

  /* Revenue impact */
  --impact-high: #ef4444;
  --impact-medium: #f59e0b;
  --impact-low: #22c55e;

  /* Accent */
  --accent: #3b82f6;
  --accent-muted: rgba(59, 130, 246, 0.15);

  /* Borders */
  --border: #2a2a3a;
  --border-subtle: #1e1e2a;
}
```

---

## Typography

```css
/* UI text - Inter */
--font-ui: 'Inter', system-ui, sans-serif;

/* Data/numbers - JetBrains Mono */
--font-mono: 'JetBrains Mono', monospace;

/* Scale */
--text-hero: 64px;        /* Revenue impact ticker */
--text-display: 48px;     /* Incident duration timer */
--text-heading: 24px;     /* Card titles, section headers */
--text-body: 14px;        /* Body text */
--text-caption: 12px;     /* Timestamps, labels */
```

**Why JetBrains Mono for financial numbers:**

Monospaced fonts prevent layout shifting when digits tick up rapidly. In a proportional font, "1" is narrower than "8" — so "$1,111" is visually narrower than "$8,888", causing the surrounding elements to shift as the number changes. JetBrains Mono gives every digit the same width, so the revenue ticker animates smoothly without layout jitter.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
