"use client";

import { motion } from "framer-motion";
import { AlertCircle, GitBranch, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useIncident } from "@/lib/hooks/use-incident";
import { formatDependencyType } from "@/lib/utils/format";

interface RootCausePanelProps {
  incidentId: string;
}

function humanizeSignal(
  details: Record<string, unknown> | null
): { label: string; value: string }[] {
  if (!details) return [];
  return Object.entries(details).map(([key, value]) => ({
    label: key.replace(/_/g, " "),
    value: typeof value === "object" ? JSON.stringify(value) : String(value),
  }));
}

export function RootCausePanel({ incidentId }: RootCausePanelProps) {
  const { data } = useIncident(incidentId);

  const rootCause = data?.rootCause;
  const upstream = data?.upstreamCandidates ?? [];
  const signals = humanizeSignal(rootCause?.signalDetails ?? null);

  return (
    <Card className="flex flex-col gap-5 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
          <AlertCircle className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Root cause
          </h2>
          <p className="text-sm text-muted-foreground">
            Detected origin of the cascade
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.04] px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-base font-medium text-foreground">
            {rootCause?.serviceName ?? "—"}
          </span>
          <span className="text-xs text-muted-foreground">
            {rootCause ? formatDependencyType(rootCause.failureType) : ""}
          </span>
        </div>
        {rootCause && (
          <StatusBadge
            status={rootCause.severity === "down" ? "down" : "degraded"}
          />
        )}
      </div>

      {signals.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Search className="size-3.5" />
            Signal evidence
          </h3>
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            {signals.map((s) => (
              <div
                key={s.label}
                className="flex flex-col gap-0.5 bg-card px-3 py-2"
              >
                <dt className="text-xs capitalize text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="font-mono text-sm text-foreground">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <GitBranch className="size-3.5" />
          Upstream suspects
        </h3>
        {upstream.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
            No degraded upstream dependencies found. The failure most likely
            originates within this service.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {upstream.map((u, i) => (
              <motion.li
                key={u.serviceId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="font-mono text-sm text-foreground">
                    {u.serviceName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {u.path.join(" → ")}
                  </span>
                </div>
                <StatusBadge
                  status={
                    u.healthStatus === "down"
                      ? "down"
                      : u.healthStatus === "degraded"
                        ? "degraded"
                        : "healthy"
                  }
                />
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
