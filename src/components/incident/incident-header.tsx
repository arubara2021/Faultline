"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Activity, Clock, DollarSign, Flame,
  Loader2, Network, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIncident } from "@/lib/hooks/use-incident";
import { IncidentTimer } from "@/components/dashboard/incident-timer";
import { RevenueTicker } from "@/components/dashboard/revenue-ticker";

interface IncidentHeaderProps {
  incidentId: string;
  rootServiceName?: string;
  failureType?: string;
  severity?: string;
  startedAt?: string;
  resolvedAt?: string | null;
  affectedCount?: number;
  maxDepth?: number;
  resolved: boolean;
  isResolving: boolean;
  onResolve: () => void;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function StatusPulse({ resolved }: { resolved: boolean }) {
  if (resolved) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400" style={{ fontFamily: "var(--font-mono)" }}>
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Resolved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400" style={{ fontFamily: "var(--font-mono)" }}>
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
      </span>
      Active
    </span>
  );
}

function MetricChip({
  icon: Icon,
  label,
  value,
  accent,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)] px-3 py-2">
      <Icon className="size-3.5 shrink-0" style={{ color: iconColor ?? "var(--fl-text-tertiary)" }} />
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
          {label}
        </span>
        <span className={cn(
          "font-metric text-[15px] font-bold leading-tight",
          accent ? "text-[var(--fl-accent-revenue)]" : "text-[var(--fl-text-primary)]"
        )}>
          {value}
        </span>
      </div>
    </div>
  );
}

export function IncidentHeader({
  incidentId,
  rootServiceName,
  failureType,
  severity,
  startedAt,
  resolvedAt,
  affectedCount,
  maxDepth,
  resolved,
  isResolving,
  onResolve,
}: IncidentHeaderProps) {
  const { data } = useIncident(incidentId);
  const ratePerMin = resolved ? 0 : (data?.revenueImpact?.totalRevenuePerMinCents ?? 0);
  const shortId = incidentId.slice(0, 8);

  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[12px] text-[var(--fl-text-tertiary)] transition-colors hover:text-[var(--fl-text-secondary)]"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>

        {!resolved && (
          <button
            type="button"
            onClick={onResolve}
            disabled={isResolving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-emerald-600/90 hover:shadow-[0_0_16px_rgba(16,185,129,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResolving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Resolve incident
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPulse resolved={resolved} />
          <span className="text-[11px] text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
            {shortId}
          </span>
        </div>

        <h1 className="text-[22px] font-bold tracking-tight text-[var(--fl-text-primary)] sm:text-[26px]">
          {rootServiceName ?? "Unknown"}{" "}
          <span className="font-normal text-[var(--fl-text-tertiary)]">
            — {(failureType ?? "unknown").replace(/_/g, " ")}
          </span>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MetricChip
          icon={DollarSign}
          label="Revenue at risk"
          accent={ratePerMin > 0 && !resolved}
          iconColor="#F43F5E"
          value={
            resolved ? (
              <span className="text-emerald-400">
                {formatMoney(data?.revenueImpact?.totalAccumulatedImpactCents ?? 0)}
              </span>
            ) : startedAt && ratePerMin > 0 ? (
              <RevenueTicker
                ratePerMinCents={ratePerMin}
                startedAt={startedAt}
                resolvedAt={resolvedAt}
                className="font-metric text-[15px] font-bold text-[var(--fl-accent-revenue)]"
              />
            ) : (
              <span className="text-[var(--fl-text-tertiary)]">—</span>
            )
          }
        />
        <MetricChip
          icon={Flame}
          label="Burn rate"
          iconColor="#EF4444"
          value={
            resolved ? (
              <span className="text-emerald-400">0<span className="ml-0.5 text-[10px] font-normal text-[var(--fl-text-tertiary)]">/min</span></span>
            ) : ratePerMin > 0 ? (
              <span>
                {formatMoney(ratePerMin)}
                <span className="ml-0.5 text-[10px] font-normal text-[var(--fl-text-tertiary)]">/min</span>
              </span>
            ) : (
              <span className="text-[var(--fl-text-tertiary)]">—</span>
            )
          }
        />
        <MetricChip
          icon={Clock}
          label="Duration"
          iconColor="#F59E0B"
          value={
            startedAt ? (
              <IncidentTimer
                startedAt={startedAt}
                resolvedAt={resolvedAt}
                className="font-metric text-[15px] font-bold text-[var(--fl-text-primary)]"
              />
            ) : (
              <span className="text-[var(--fl-text-tertiary)]">—</span>
            )
          }
        />
        <MetricChip
          icon={Network}
          label="Impacted"
          iconColor="#6366F1"
          value={
            <span>
              {affectedCount ?? 0}
              <span className="ml-1 text-[10px] font-normal text-[var(--fl-text-tertiary)]">
                · d{maxDepth ?? 0}
              </span>
            </span>
          }
        />
      </div>
    </motion.header>
  );
}