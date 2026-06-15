"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DepthIndicator } from "@/components/shared/depth-indicator";
import { EmptyState } from "@/components/shared/empty-state";
import { useIncident } from "@/lib/hooks/use-incident";
import { cn } from "@/lib/utils";
import { ListTree, Table2, ShieldCheck } from "lucide-react";

interface BlastRadiusListProps {
  incidentId: string;
}

function money(cents: number): string {
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Blast Radius</CardTitle>
          <p className="text-muted-foreground text-sm">
            {entries.length} downstream {entries.length === 1 ? "service" : "services"} impacted
          </p>
        </div>
        <div className="bg-muted/40 flex items-center gap-1 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setView("tree")}
            aria-pressed={view === "tree"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              view === "tree"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ListTree className="size-3.5" aria-hidden />
            Tree
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            aria-pressed={view === "table"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              view === "table"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Table2 className="size-3.5" aria-hidden />
            Table
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && entries.length === 0 ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-muted/40 h-12 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No downstream impact"
            description="This incident has not propagated to any dependent services."
          />
        ) : view === "tree" ? (
          <div className="flex flex-col gap-6">
            {byDepth.map(([depth, list]) => (
              <div key={depth} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <DepthIndicator depth={depth} />
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {list.length} {list.length === 1 ? "service" : "services"}
                  </span>
                </div>
                <div className="border-border/60 ml-2.5 flex flex-col gap-2 border-l pl-4">
                  {list.map((entry, idx) => (
                    <motion.div
                      key={entry.serviceId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="bg-card/60 border-border/60 hover:border-border flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {entry.serviceName}
                          </span>
                          {entry.isCustomerFacing && (
                            <span className="bg-destructive/15 text-destructive rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                              Customer-facing
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground truncate text-xs">
                          {entry.ownerTeam} · {entry.dependencyType ?? "—"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {entry.revenuePerMinCents > 0 && (
                          <span className="text-destructive font-mono text-sm tabular-nums">
                            {money(entry.revenuePerMinCents)}/min
                          </span>
                        )}
                        <StatusBadge status="down" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Service</th>
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 font-medium">Depth</th>
                  <th className="px-3 py-2 font-medium">Via</th>
                  <th className="px-3 py-2 text-right font-medium">Revenue / min</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.serviceId}
                    className="border-border/50 hover:bg-muted/30 border-b transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{entry.serviceName}</span>
                        {entry.isCustomerFacing && (
                          <span className="bg-destructive/15 text-destructive rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            CF
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-muted-foreground px-3 py-2.5">{entry.ownerTeam}</td>
                    <td className="px-3 py-2.5">
                      <DepthIndicator depth={entry.depth} />
                    </td>
                    <td className="text-muted-foreground px-3 py-2.5 font-mono text-xs">
                      {entry.dependencyType ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {entry.revenuePerMinCents > 0 ? (
                        <span className="text-destructive">{money(entry.revenuePerMinCents)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
