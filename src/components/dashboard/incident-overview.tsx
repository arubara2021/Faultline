"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { DepthIndicator } from "@/components/shared/depth-indicator";
import { IncidentTimer } from "@/components/dashboard/incident-timer";
import { RevenueTicker } from "@/components/dashboard/revenue-ticker";
import { useIncident } from "@/lib/hooks/use-incident";
import { useResolve } from "@/lib/hooks/use-resolve";
import {
  formatClassification,
  formatDependencyType,
  formatOwnerTeam,
} from "@/lib/utils/format";
import { getClassificationColor } from "@/lib/utils/colors";
import { cn } from "@/lib/utils";
import { mutate } from "swr";

interface IncidentOverviewProps {
  incidentId: string;
  rootServiceName: string;
  failureType: string;
  severity: string;
  startedAt: string;
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function IncidentOverview({
  incidentId,
  rootServiceName,
  failureType,
  severity,
  startedAt,
}: IncidentOverviewProps) {
  const { data } = useIncident(incidentId);
  const { trigger, isMutating } = useResolve();

  const ratePerMin = data?.revenueImpact.totalRevenuePerMinCents ?? 0;
  const topAffected = (data?.blastRadius ?? [])
    .slice()
    .sort((a, b) => b.revenuePerMinCents - a.revenuePerMinCents)
    .slice(0, 5);

  async function handleResolve() {
    try {
      const result = await trigger({ incidentId });
      toast.success("Incident resolved", {
        description: `${result.durationFormatted} • ${money(
          result.totalRevenueImpactCents
        )} total impact`,
      });
      await Promise.all([
        mutate("/api/incidents"),
        mutate("/api/services"),
        mutate("/api/graph"),
      ]);
    } catch (err) {
      toast.error("Failed to resolve incident", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="relative gap-0 overflow-hidden border-red-500/30 bg-red-500/[0.03] p-0">
        {/* Pulsing accent rail */}
        <motion.div
          className="absolute inset-x-0 top-0 h-0.5 bg-red-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="flex flex-col gap-6 p-5 md:p-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="relative mt-0.5 flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                <AlertTriangle className="size-5" />
                <motion.span
                  className="absolute inset-0 rounded-lg ring-1 ring-red-500/40"
                  animate={{ opacity: [0, 0.8, 0], scale: [1, 1.25, 1.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-lg font-semibold tracking-tight">
                    Active incident
                  </h2>
                  <StatusBadge status={severity === "down" ? "down" : "degraded"} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Root cause:{" "}
                  <span className="font-mono text-foreground">
                    {rootServiceName}
                  </span>{" "}
                  · {formatDependencyType(failureType)}
                </p>
              </div>
            </div>

            <Button
              onClick={handleResolve}
              disabled={isMutating}
              className="bg-emerald-600 text-white hover:bg-emerald-600/90"
            >
              {isMutating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Resolve incident
            </Button>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
            <Metric label="Revenue at risk">
              <RevenueTicker
                ratePerMinCents={ratePerMin}
                startedAt={startedAt}
                className="text-xl font-semibold text-red-500"
              />
            </Metric>
            <Metric label="Burn rate">
              <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
                {money(ratePerMin)}
                <span className="text-xs text-muted-foreground">/min</span>
              </span>
            </Metric>
            <Metric label="Duration">
              <IncidentTimer
                startedAt={startedAt}
                className="text-xl font-semibold text-foreground"
              />
            </Metric>
            <Metric label="Services impacted">
              <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
                {data?.incident.affectedServiceCount ?? 0}
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · d{data?.incident.maxDepth ?? 0}
                </span>
              </span>
            </Metric>
          </div>

          {/* Top affected services */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Highest-impact affected services
              </h3>
              <Link
                href={`/incidents/${incidentId}`}
                className="flex items-center gap-1 text-xs font-medium text-foreground/80 transition-colors hover:text-foreground"
              >
                Full blast radius
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <ul className="flex flex-col gap-1.5">
              {topAffected.map((svc, i) => {
                const cls = getClassificationColor(svc.classification);
                return (
                  <motion.li
                    key={svc.serviceId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.07 }}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <DepthIndicator depth={svc.depth} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-mono text-sm text-foreground">
                          {svc.serviceName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {formatOwnerTeam(svc.ownerTeam)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "hidden rounded-md px-2 py-0.5 text-xs font-medium sm:inline-block",
                          cls.bg,
                          cls.text
                        )}
                      >
                        {formatClassification(svc.classification)}
                      </span>
                      {svc.revenuePerMinCents > 0 && (
                        <span className="font-mono text-sm tabular-nums text-red-500">
                          {money(svc.revenuePerMinCents)}/min
                        </span>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-card px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
