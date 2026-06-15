"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpDown, Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

type StatusFilter = "all" | "healthy" | "degraded" | "down" | "unknown";
type SortKey = "name" | "ownerTeam" | "classification" | "healthStatus";
type SortDir = "asc" | "desc";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "healthy", label: "Healthy" },
  { key: "degraded", label: "Degraded" },
  { key: "down", label: "Down" },
];

const STATUS_ORDER: Record<string, number> = {
  down: 0,
  degraded: 1,
  unknown: 2,
  healthy: 3,
};

export function ServicesTable() {
  const { data, isLoading } = useServices();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("healthStatus");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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
        cmp =
          (STATUS_ORDER[a.healthStatus] ?? 9) -
          (STATUS_ORDER[b.healthStatus] ?? 9);
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

  if (isLoading) {
    return <TableSkeleton rows={8} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services, teams…"
            className="pl-9"
            aria-label="Search services"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                status === f.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No services match"
            description="Try adjusting your search or filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <SortHeader
                    label="Service"
                    active={sortKey === "name"}
                    dir={sortDir}
                    onClick={() => toggleSort("name")}
                  />
                  <SortHeader
                    label="Owner team"
                    active={sortKey === "ownerTeam"}
                    dir={sortDir}
                    onClick={() => toggleSort("ownerTeam")}
                  />
                  <SortHeader
                    label="Classification"
                    active={sortKey === "classification"}
                    dir={sortDir}
                    onClick={() => toggleSort("classification")}
                  />
                  <SortHeader
                    label="Health"
                    active={sortKey === "healthStatus"}
                    dir={sortDir}
                    onClick={() => toggleSort("healthStatus")}
                  />
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-foreground">
                          {svc.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Users className="size-3.5" />
                          {formatOwnerTeam(svc.ownerTeam)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-block rounded-md px-2 py-0.5 text-xs font-medium",
                            cls.bg,
                            cls.text
                          )}
                        >
                          {formatClassification(svc.classification)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={svc.healthStatus} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
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
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {services.length} services
      </p>
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
    <th className="px-4 py-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        className={cn(
          "-ml-2 h-auto gap-1 px-2 py-1 text-xs font-medium uppercase tracking-wider",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <ArrowUpDown
          className={cn(
            "size-3 transition-transform",
            active && dir === "desc" && "rotate-180",
            active ? "opacity-100" : "opacity-40"
          )}
        />
      </Button>
    </th>
  );
}
