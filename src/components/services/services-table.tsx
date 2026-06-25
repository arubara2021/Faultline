"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Users, Server, Activity, Clock, ChevronRight, Grid3X3, List } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useServices } from "@/lib/hooks/use-services";
import {
  formatClassification,
  formatOwnerTeam,
} from "@/lib/utils/format";
import { getClassificationColor } from "@/lib/utils/colors";
import { formatRelativeTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "healthy" | "degraded" | "down";
type SortKey = "name" | "ownerTeam" | "classification" | "healthStatus";
type SortDir = "asc" | "desc";
type ViewMode = "cards" | "table";

const STATUS_FILTERS: { key: StatusFilter; label: string; color: string; activeColor: string }[] = [
  { key: "all", label: "All", color: "text-[var(--fl-text-secondary)]", activeColor: "bg-white/[0.06] text-white" },
  { key: "healthy", label: "Healthy", color: "text-emerald-400", activeColor: "bg-emerald-500/10 text-emerald-400" },
  { key: "degraded", label: "Degraded", color: "text-amber-400", activeColor: "bg-amber-500/10 text-amber-400" },
  { key: "down", label: "Down", color: "text-red-400", activeColor: "bg-red-500/10 text-red-400" },
];

const STATUS_ORDER: Record<string, number> = {
  down: 0,
  degraded: 1,
  unknown: 2,
  healthy: 3,
};

const STATUS_COLORS: Record<string, { border: string; bg: string; dot: string }> = {
  healthy: { border: "border-emerald-500/10", bg: "bg-emerald-500/[0.04]", dot: "bg-emerald-500" },
  degraded: { border: "border-amber-500/10", bg: "bg-amber-500/[0.04]", dot: "bg-amber-500" },
  down: { border: "border-red-500/10", bg: "bg-red-500/[0.04]", dot: "bg-red-500" },
  unknown: { border: "border-indigo-500/10", bg: "bg-indigo-500/[0.04]", dot: "bg-indigo-500" },
};

export function ServicesTable() {
  const { data, isLoading } = useServices();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("healthStatus");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const services = data?.services ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = services.filter((s) => {
      const matchesStatus = status === "all" || s.healthStatus === status;
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.ownerTeam.toLowerCase().includes(q) ||
        s.classification.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "healthStatus") {
        cmp = (STATUS_ORDER[a.healthStatus] ?? 9) - (STATUS_ORDER[b.healthStatus] ?? 9);
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [services, query, status, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (isLoading) return <TableSkeleton rows={8} />;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {/* Search */}
        <div className="relative w-full sm:max-w-[280px]">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--fl-text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services, teams..."
            aria-label="Search services"
            className="w-full rounded-lg border border-white/[0.04] bg-[var(--fl-surface)] py-2 pl-9 pr-3 text-[12px] text-[var(--fl-text-primary)] outline-none transition-colors placeholder:text-[var(--fl-text-tertiary)] focus:border-[var(--fl-border-active)] sm:text-[13px]"
            style={{ fontFamily: "var(--font-sans)" }}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status filters — scrollable on mobile */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin rounded-lg border border-white/[0.04] bg-[var(--fl-surface-raised)] p-0.5">
            {STATUS_FILTERS.map((f) => {
              const isActive = status === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatus(f.key)}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-all duration-200 sm:px-3 sm:text-[11px]",
                    isActive
                      ? f.activeColor + " shadow-sm"
                      : "text-[var(--fl-text-tertiary)] hover:text-[var(--fl-text-secondary)]"
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* View toggle */}
          <div className="hidden items-center gap-0.5 rounded-lg border border-white/[0.04] bg-[var(--fl-surface-raised)] p-0.5 sm:flex">
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-all duration-200",
                viewMode === "cards"
                  ? "bg-[var(--fl-surface)] text-[var(--fl-text-primary)] shadow-sm"
                  : "text-[var(--fl-text-tertiary)] hover:text-[var(--fl-text-secondary)]"
              )}
            >
              <Grid3X3 className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-all duration-200",
                viewMode === "table"
                  ? "bg-[var(--fl-surface)] text-[var(--fl-text-primary)] shadow-sm"
                  : "text-[var(--fl-text-tertiary)] hover:text-[var(--fl-text-secondary)]"
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="overflow-hidden rounded-xl border border-white/[0.04] bg-[var(--fl-surface)] p-8 sm:rounded-2xl">
          <EmptyState
            icon={Search}
            title="No services match"
            description="Try adjusting your search or filters."
          />
        </div>
      )}

      {/* Card Grid (mobile default + desktop cards mode) */}
      <AnimatePresence mode="wait">
        {filtered.length > 0 && (viewMode === "cards" ? (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3"
          >
            {filtered.map((svc, i) => {
              const cls = getClassificationColor(svc.classification);
              const sc = STATUS_COLORS[svc.healthStatus] ?? STATUS_COLORS.unknown;
              return (
                <motion.div
                  key={svc.id}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(i * 0.03, 0.4),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <div className={cn(
                    "group relative overflow-hidden rounded-xl border transition-all duration-300 hover:border-white/[0.08] hover:shadow-[0_4px_24px_rgba(0,0,0,0.2)] sm:rounded-2xl",
                    sc.border,
                    "bg-[var(--fl-surface)]"
                  )}>
                    {/* Status accent line at top */}
                    <div
                      className="absolute left-0 right-0 top-0 h-px"
                      style={{
                        background: svc.healthStatus === "healthy"
                          ? "linear-gradient(90deg, transparent, #10b98130, transparent)"
                          : svc.healthStatus === "degraded"
                          ? "linear-gradient(90deg, transparent, #f59e0b30, transparent)"
                          : svc.healthStatus === "down"
                          ? "linear-gradient(90deg, transparent, #ef444430, transparent)"
                          : "linear-gradient(90deg, transparent, #6366f130, transparent)",
                      }}
                    />

                    <div className="p-3.5 sm:p-4">
                      {/* Header row */}
                      <div className="mb-2.5 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3
                            className="truncate text-[13px] font-semibold text-[var(--fl-text-primary)] sm:text-[14px]"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {svc.name}
                          </h3>
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--fl-text-tertiary)]">
                            <Users className="size-3 shrink-0 opacity-40" />
                            {formatOwnerTeam(svc.ownerTeam)}
                          </span>
                        </div>
                        <StatusBadge status={svc.healthStatus} />
                      </div>

                      {/* Tags */}
                      <div className="flex items-center gap-1.5">
                        <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold", cls.bg, cls.text)}>
                          {formatClassification(svc.classification)}
                        </span>
                        {svc.lastHealthCheckAt && (
                          <span className="flex items-center gap-1 text-[9px] text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                            <Clock className="size-2.5 opacity-40" />
                            {formatRelativeTime(svc.lastHealthCheckAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom bar with subtle hover */}
                    <div className="flex items-center justify-between border-t border-white/[0.03] px-3.5 py-2 sm:px-4">
                      <span className="text-[9px] text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                        {svc.id.substring(0, 8)}
                      </span>
                      <ChevronRight className="size-3 text-[var(--fl-text-tertiary)] opacity-0 transition-all duration-200 group-hover:opacity-50 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          /* Table view (desktop) */
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-xl border border-white/[0.04] bg-[var(--fl-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.25)] sm:rounded-2xl"
          >
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <SortHeader label="Service" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                    <SortHeader label="Owner team" active={sortKey === "ownerTeam"} dir={sortDir} onClick={() => toggleSort("ownerTeam")} />
                    <SortHeader label="Classification" active={sortKey === "classification"} dir={sortDir} onClick={() => toggleSort("classification")} />
                    <SortHeader label="Health" active={sortKey === "healthStatus"} dir={sortDir} onClick={() => toggleSort("healthStatus")} />
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                      Last check
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((svc, i) => {
                    const cls = getClassificationColor(svc.classification);
                    return (
                      <motion.tr
                        key={svc.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: Math.min(i * 0.02, 0.3),
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-2.5">
                          <span className="text-[12px] font-semibold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                            {svc.name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5 text-[12px] text-[var(--fl-text-tertiary)]">
                            <Users className="size-3 opacity-40" />
                            {formatOwnerTeam(svc.ownerTeam)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold", cls.bg, cls.text)}>
                            {formatClassification(svc.classification)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={svc.healthStatus} />
                        </td>
                        <td className="px-4 py-2.5 text-right text-[11px] text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                          {svc.lastHealthCheckAt
                            ? formatRelativeTime(svc.lastHealthCheckAt)
                            : "—"}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[var(--fl-text-tertiary)] sm:text-[11px]" style={{ fontFamily: "var(--font-mono)" }}>
          Showing {filtered.length} of {services.length} services
        </p>
        {viewMode === "cards" && (
          <p className="text-[10px] text-[var(--fl-text-tertiary)] sm:hidden" style={{ fontFamily: "var(--font-mono)" }}>
            Swipe to filter · Tap to sort
          </p>
        )}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-2.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "-ml-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
          active
            ? "text-[var(--fl-text-primary)]"
            : "text-[var(--fl-text-tertiary)] hover:text-[var(--fl-text-secondary)]"
        )}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </button>
    </th>
  );
}