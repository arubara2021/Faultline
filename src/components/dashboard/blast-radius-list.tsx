"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { DepthIndicator } from "@/components/shared/depth-indicator";
import { EmptyState } from "@/components/shared/empty-state";
import { useIncident } from "@/lib/hooks/use-incident";
import {
  getClassificationColor,
  getDepthColor,
} from "@/lib/utils/colors";
import { ListTree, Table2, ShieldCheck, Star } from "lucide-react";

interface BlastRadiusListProps {
  incidentId: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

type ViewMode = "tree" | "table";

export function BlastRadiusList({ incidentId }: BlastRadiusListProps) {
  const { data, isLoading } = useIncident(incidentId);
  const [view, setView] = useState<ViewMode>("tree");

  const entries = useMemo(() => data?.blastRadius ?? [], [data]);

  const byDepth = useMemo(() => {
    const groups = new Map<number, typeof entries>();
    for (const entry of entries) {
      const list = groups.get(entry.depth) ?? [];
      list.push(entry);
      groups.set(entry.depth, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [entries]);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--fl-border-subtle)] px-4 py-3">
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--fl-text-primary)]">Blast Radius</h3>
          <p className="text-[11px] text-[var(--fl-text-tertiary)]">
            {entries.length} downstream {entries.length === 1 ? "service" : "services"} impacted
          </p>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--fl-border-subtle)] bg-[var(--fl-surface-raised)] p-0.5">
          <button
            type="button"
            onClick={() => setView("tree")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200",
              view === "tree"
                ? "bg-[var(--fl-surface)] text-[var(--fl-text-primary)] shadow-sm"
                : "text-[var(--fl-text-tertiary)] hover:text-[var(--fl-text-secondary)]"
            )}
          >
            <ListTree className="size-3" />
            Tree
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200",
              view === "table"
                ? "bg-[var(--fl-surface)] text-[var(--fl-text-primary)] shadow-sm"
                : "text-[var(--fl-text-tertiary)] hover:text-[var(--fl-text-secondary)]"
            )}
          >
            <Table2 className="size-3" />
            Table
          </button>
        </div>
      </div>

      <div className="p-4">
        {isLoading && entries.length === 0 ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--fl-surface-raised)]" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No downstream impact"
            description="This incident has not propagated to any dependent services."
          />
        ) : view === "tree" ? (
          <div className="space-y-5">
            {byDepth.map(([depth, list]) => {
              const dc = getDepthColor(depth);
              return (
                <div key={depth} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                        dc.bg, dc.text
                      )}
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Depth {depth}
                    </span>
                    <span className="text-[10px] text-[var(--fl-text-tertiary)]">
                      {list.length} {list.length === 1 ? "service" : "services"}
                    </span>
                  </div>

                  <div className="ml-1 space-y-1 border-l-2 border-[var(--fl-border-subtle)] pl-4">
                    {list.map((entry, idx) => {
                      const cls = getClassificationColor(entry.classification);
                      return (
                        <motion.div
                          key={entry.serviceId}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)] px-3 py-2 transition-colors hover:border-[var(--fl-border-active)]"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: dc.fill }} />
                            <div className="flex min-w-0 flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-[12px] font-semibold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                                  {entry.serviceName}
                                </span>
                                {entry.isCustomerFacing && (
                                  <Star className="size-3 shrink-0 fill-blue-400 text-blue-400" />
                                )}
                              </div>
                              <span className="truncate text-[11px] text-[var(--fl-text-tertiary)]">
                                {entry.ownerTeam} · {entry.dependencyType?.replace(/_/g, " ") ?? "—"}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", cls.bg, cls.text)}
                            >
                              {entry.classification === "customer-facing" ? "CF" : entry.classification === "infrastructure" ? "Infra" : "Int"}
                            </span>
                            {entry.revenuePerMinCents > 0 && (
                              <span className="font-metric text-[11px] font-semibold text-[var(--fl-accent-revenue)]">
                                {formatMoney(entry.revenuePerMinCents)}/m
                              </span>
                            )}
                            <StatusBadge status="down" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--fl-border-subtle)]">
                  <th className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>Service</th>
                  <th className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>Team</th>
                  <th className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>Depth</th>
                  <th className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>Via</th>
                  <th className="px-3 pb-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>Rev/min</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const dc = getDepthColor(entry.depth);
                  return (
                    <tr
                      key={entry.serviceId}
                      className="border-b border-[var(--fl-border-subtle)] transition-colors hover:bg-[var(--fl-surface-raised)]"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: dc.fill }} />
                          <span className="text-[12px] font-semibold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                            {entry.serviceName}
                          </span>
                          {entry.isCustomerFacing && (
                            <Star className="size-3 fill-blue-400 text-blue-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[var(--fl-text-tertiary)]">
                        {entry.ownerTeam}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn("inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold", dc.bg, dc.text)}
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          D{entry.depth}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                        {entry.dependencyType?.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {entry.revenuePerMinCents > 0 ? (
                          <span className="font-metric text-[11px] font-semibold text-[var(--fl-accent-revenue)]">
                            {formatMoney(entry.revenuePerMinCents)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--fl-text-tertiary)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}