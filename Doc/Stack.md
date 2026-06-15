# Faultline — Frontend Stack

The design target: a **B2B SRE / observability product**. Think Datadog, Vercel
Observability, Linear, Sentry — calm, precise, confident, *enterprise-credible*.
Not cyberpunk, not neon, not "hacker dashboard." Motion is used to communicate
**state and causality** (a service failing, a blast radius spreading, an incident
resolving), never as decoration.

Everything below is either **already installed** in `package.json` or a small,
well-justified addition. Nothing speculative.

---

## 1. Core Framework (already in place)

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, RSC) | Already the project base. Server components for data-heavy pages, client islands for interactivity. |
| Language | **TypeScript 5** (strict) | Backend types in `lib/types` flow straight into the UI. |
| Runtime | **React 19.2** | Concurrent features, `useEffectEvent`, `<Activity>` for cheap show/hide of panels. |

---

## 2. Styling System

| Concern | Choice | Why |
|---|---|---|
| CSS engine | **Tailwind CSS v4** (`@theme inline`) | Already configured. Tokens live in `globals.css`, no `tailwind.config` color sprawl. |
| Component base | **shadcn/ui** — `radix-nova` style | Already initialized. 14 primitives already added (button, card, dialog, tabs, select, tooltip, etc.). |
| Primitives | **Radix UI** | Accessible, unstyled — the a11y backbone (focus traps, ARIA, keyboard nav) enterprise buyers check for. |
| Class utils | **clsx + tailwind-merge** (`cn`) | Already present. |
| Animations CSS | **tw-animate-css** | Already present — for simple enter/exit utility animations. |
| Theming | **next-themes** | Already present. Dark-first (SRE tools live in dark mode), with a real light theme too. |

**Design language**
- **Color**: neutral slate/zinc base + **one** brand accent (blue) + a strict
  **semantic status ramp** — `healthy` (emerald), `degraded` (amber), `down`
  (red), `unknown` (zinc). Status colors are reserved *only* for status — never
  decorative. This is what makes it read as "real monitoring tool."
- **Typography**: **Inter** (UI/headings) + **JetBrains Mono** (metrics, IDs,
  durations, $ figures). Two families, loaded via `next/font`.
- **Density**: information-dense but breathable — enterprise users want a lot on
  screen, so we lean on a clear type scale and 4px spacing grid, not whitespace.
- **Surfaces**: subtle layered elevation (border + faint shadow + slight bg
  shift), not heavy glassmorphism. Crisp, not flashy.

---

## 3. Motion & Animation (the differentiator)

| Concern | Choice | Why |
|---|---|---|
| Primary animation | **Framer Motion 12** (already installed) | `layout` animations, `AnimatePresence`, shared layout transitions, spring physics, scroll/viewport triggers, gestures. |
| Number transitions | **Framer Motion `useSpring` + `useTransform`** | Revenue tickers, MTTR counters, blast-radius totals that roll smoothly instead of jumping. |
| Micro-interactions | **Framer Motion `whileHover` / `whileTap` + variants** | Button presses, card lifts, row hovers — orchestrated, consistent. |
| Page/section transitions | **Framer Motion variants + `staggerChildren`** | Stat cards, lists, and panels cascade in instead of popping. |
| Reduced motion | **`useReducedMotion`** | Respect `prefers-reduced-motion` — required for enterprise accessibility sign-off. |

**Motion principles**
1. **Motion = meaning.** A failure animation propagates *outward* along
   dependencies. A resolution animation settles *inward*. Users should
   understand causality without reading text.
2. **Spring, not linear.** Everything uses spring physics for an organic,
   premium feel — no robotic `ease-in-out`.
3. **Staggered reveals** for any group of items (stats, incident lists, table rows).
4. **Always interruptible & reversible** — `AnimatePresence` so state changes
   mid-animation never break.

---

## 4. Data Visualization

| Concern | Choice | Why |
|---|---|---|
| Charts (timelines, sparklines, revenue-at-risk) | **Recharts 3** (already installed) + shadcn **charts** wrapper | Themeable via CSS vars, responsive, animated. Use the `charts` skill. |
| Dependency graph | **Canvas 2D render loop** (custom, no new dep) **with optional ReactFlow fallback** | The graph needs custom shockwave/particle/blast-radius animations the design calls for. Canvas gives 60fps control at scale. ReactFlow only if we want drag-to-edit later. |
| Graph layout math | **lightweight force/hierarchy helper in `lib/graph/`** | Deterministic node placement by dependency depth — no heavy graph lib needed for layout. |

**Decision flag:** Graph is the one place with a real choice — **Canvas 2D
(recommended for the animations)** vs **ReactFlow (faster to build, heavier,
less animation control)**. Tell me your preference; the layout/color utilities
work either way.

---

## 5. State & Data Fetching

| Concern | Choice | Why |
|---|---|---|
| Server data | **SWR 2** (already installed) | Hooks already exist (`use-incident`, `use-services`, `use-blast-radius`, etc.). Polling intervals already wired to `config.swr`. Gives live-updating dashboards. |
| Client/UI state | **Zustand** *(small add)* | For ephemeral UI: selected service, selected incident, graph filters, the calm↔critical animation **phase**. Decouples animation orchestration from data. |
| Forms | **react-hook-form + Zod + @hookform/resolvers** (all installed) | Simulate-failure dialog, filters, any inputs — validated with the same Zod schemas the API uses. |
| Notifications | **Sonner** (already installed) | Toasts for incident detection, resolution, simulate actions. |

---

## 6. Supporting Libraries (already installed)

| Library | Use |
|---|---|
| **lucide-react** | Icon system — consistent 16/20/24px line icons. No emojis. |
| **date-fns** | Relative timestamps ("2m ago"), durations, incident timelines. |
| **uuid** | Client-side IDs where needed. |
| **class-variance-authority** | Variant-driven components (status badges, buttons). |

---

## 7. Proposed Additions (the only new deps)

| Package | Purpose | Footprint |
|---|---|---|
| **zustand** | UI/animation-phase state store | ~1KB, tiny |
| *(optional)* **reactflow** | Only if we choose the ReactFlow graph path | heavier — skip if we go Canvas |

That's it. The stack is **95% already in your `package.json`** — I'm proposing
Zustand and (conditionally) one graph decision. Nothing else new.

---

## 8. Component Architecture Layers

```
ui/         shadcn primitives (installed)        — atoms
shared/     status-badge, animated-counter,      — themed molecules
            empty-state, skeletons, depth pills
layout/     header, shell, sidebar, mobile-nav   — page frame
dashboard/  stats-grid, incident-overview,       — feature sections
            revenue-ticker, blast-radius-list
graph/      graph-canvas + draw helpers          — the centerpiece
simulate/   simulate-failure dialog              — actions
```

Each layer only imports downward. Animations are orchestrated at the
feature/section level, driven by the Zustand phase store + SWR data.

---

## 9. Quality / "Will the company believe it?" checklist

- ✅ **Accessibility**: Radix primitives, full keyboard nav, ARIA, focus
  management, `prefers-reduced-motion`, AA contrast on all status colors.
- ✅ **Responsive**: mobile bottom-nav → tablet → wide desktop dashboards.
- ✅ **Loading/empty/error states** for every async surface (skeletons, not spinners).
- ✅ **Performance**: RSC for data, client islands only where needed, Canvas
  graph at 60fps, memoized selectors.
- ✅ **Polish**: consistent spring motion, staggered reveals, smooth number
  transitions, no layout shift.
- ✅ **Real product feel**: dense but legible, semantic color discipline,
  monospace metrics — reads like Datadog/Linear, not a demo.

---

## Open questions for you
1. **Graph engine**: Canvas 2D (recommended, best animation control) or ReactFlow (faster to build)?
2. **Theme**: dark-first with light support (recommended for SRE tools), or light-first?
3. **OK to add Zustand?** (only genuinely new dependency)
