"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, ChevronDown, DollarSign,
  Flame, Loader2, ShieldCheck, Clock, Activity
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { mutate } from "swr";

interface IncidentOverviewProps {
  incidentId: string;
  rootServiceName?: string;
  failureType?: string;
  severity?: string;
  startedAt?: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function MetricTile({
  icon: Icon,
  label,
  iconColor,
  children,
}: {
  icon: React.ElementType;
  label: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)] px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="size-3" style={{ color: iconColor }} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

export function IncidentOverview({ incidentId }: IncidentOverviewProps) {
  const { data } = useIncident(incidentId);
  const { trigger, isMutating } = useResolve();

  const rootServiceName = data?.rootCause.serviceName ?? "";
  const failureType = data?.rootCause.failureType ?? "";
  const severity = data?.rootCause.severity ?? "down";
  const startedAt = data?.incident.startedAt ?? new Date().toISOString();

  const ratePerMin = data?.revenueImpact.totalRevenuePerMinCents ?? 0;
  const topAffected = (data?.blastRadius ?? [])
    .slice()
    .sort((a, b) => b.revenuePerMinCents - a.revenuePerMinCents)
    .slice(0, 5);

  async function handleResolve() {
    try {
      const result = await trigger({ incidentId });
      toast.success("Incident resolved", {
        description: `${result.durationFormatted} — ${formatMoney(result.totalRevenueImpactCents)} total impact`,
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
      <div className="relative overflow-hidden rounded-2xl border border-red-500/15 bg-[var(--fl-surface)] shadow-[0_2px_16px_rgba(239,68,68,0.1)]">
        <motion.div
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="relative mt-0.5">
                <div className="flex size-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/[0.08]">
                  <Flame className="size-5 text-red-400" />
                </div>
                <motion.div
                  className="absolute -inset-1 -z-10 rounded-xl bg-red-500/10"
                  animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-bold tracking-tight text-[var(--fl-text-primary)]">Active incident</h2>
                  <StatusBadge status={severity === "down" ? "down" : "degraded"} />
                </div>
                <p className="mt-1 text-[13px] text-[var(--fl-text-secondary)]">
                  Root cause:{" "}
                  <span className="font-semibold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                    {rootServiceName}
                  </span>
                  {" · "}
                  {formatDependencyType(failureType)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResolve}
              disabled={isMutating}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-emerald-600/90 hover:shadow-[0_0_16px_rgba(16,185,129,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isMutating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Resolve
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <MetricTile icon={DollarSign} label="Revenue at risk" iconColor="#F43F5E">
              <RevenueTicker
                ratePerMinCents={ratePerMin}
                startedAt={startedAt}
                className="text-glow-revenue font-metric text-[22px] font-bold leading-none text-[var(--fl-accent-revenue)]"
              />
            </MetricTile>

            <MetricTile icon={Flame} label="Burn rate" iconColor="#EF4444">
              <span className="font-metric text-[22px] font-bold leading-none text-[var(--fl-text-primary)]">
                {formatMoney(ratePerMin)}
                <span className="ml-0.5 text-[11px] font-normal text-[var(--fl-text-tertiary)]">/min</span>
              </span>
            </MetricTile>

            <MetricTile icon={Clock} label="Duration" iconColor="#F59E0B">
              <IncidentTimer
                startedAt={startedAt}
                className="font-metric text-[22px] font-bold leading-none text-[var(--fl-text-primary)]"
              />
            </MetricTile>

            <MetricTile icon={Activity} label="Impacted" iconColor="#6366F1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-metric text-[22px] font-bold leading-none text-[var(--fl-text-primary)]">
                  {data?.incident.affectedServiceCount ?? 0}
                </span>
                <span className="text-[11px] text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                  · d{data?.incident.maxDepth ?? 0}
                </span>
              </div>
            </MetricTile>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                Highest-impact affected services
              </span>
              <Link
                href={`/incidents/${incidentId}`}
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--fl-text-tertiary)] transition-colors hover:text-[var(--fl-text-secondary)]"
              >
                Full blast radius
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="space-y-1.5">
              {topAffected.map((svc, i) => {
                const cls = getClassificationColor(svc.classification);
                return (
                  <motion.div
                    key={svc.serviceId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.06 }}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)] px-3 py-2 transition-colors hover:border-[var(--fl-border-active)]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <DepthIndicator depth={svc.depth} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[12px] font-semibold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                          {svc.serviceName}
                        </span>
                        <span className="truncate text-[11px] text-[var(--fl-text-tertiary)]">
                          {formatOwnerTeam(svc.ownerTeam)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:inline-block",
                          cls.bg, cls.text
                        )}
                      >
                        {formatClassification(svc.classification)}
                      </span>
                      {svc.revenuePerMinCents > 0 && (
                        <span className="font-metric text-[12px] font-semibold text-[var(--fl-accent-revenue)]">
                          {formatMoney(svc.revenuePerMinCents)}/min
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}