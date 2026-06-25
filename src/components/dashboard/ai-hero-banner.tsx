"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  Network,
  Zap,
  DollarSign,
  Clock,
  ArrowRight,
  ShieldCheck,
  Loader2,
  X,
  ChevronDown,
  AlertTriangle,
  Target,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mutate } from "swr";
import { toast } from "sonner";
import { useIncidentSummary } from "@/lib/hooks/use-summary";
import { useIncident } from "@/lib/hooks/use-incident";
import { useResolve } from "@/lib/hooks/use-resolve";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface AiHeroBannerProps {
  incidentId: string;
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function formatMoneyFull(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function AiHeroBanner({ incidentId }: AiHeroBannerProps) {
  const { data: summary } = useIncidentSummary(incidentId);
  const { data: incident } = useIncident(incidentId);
  const { trigger: resolveTrigger, isMutating } = useResolve();
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showResolveConfirm, setShowResolveConfirm] = useState(false);

  const headline = summary?.ai?.headline ?? "";
  const whatHappened = summary?.ai?.whatHappened ?? "";
  const rootCause = summary?.ai?.rootCauseAnalysis ?? "";
  const fixPriority = summary?.ai?.fixPriority ?? "";

  const affectedCount = incident?.incident?.affectedServiceCount ?? summary?.impact?.totalServicesAffected ?? 0;
  const maxDepth = incident?.incident?.maxDepth ?? 0;
  const revenuePerMin = incident?.revenueImpact?.totalRevenuePerMinCents ?? summary?.impact?.revenuePerMinCents ?? 0;
  const totalImpact = summary?.impact?.totalAccumulatedImpactCents ?? 0;
  const startedAt = incident?.incident?.startedAt ?? summary?.incident?.startedAt;

  const duration = (() => {
    if (!startedAt) return "—";
    const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0) return `${h}h ${mm}m`;
    return `${m}m`;
  })();

  const severity = headline.includes("CRITICAL")
    ? "critical"
    : headline.includes("WARNING")
      ? "warning"
      : "info";

  const handleResolve = useCallback(async () => {
    try {
      const result = await resolveTrigger({ incidentId });
      toast.success("Incident resolved", {
        description: `${result.durationFormatted} — ${formatMoneyFull(result.totalRevenueImpactCents)} total impact`,
      });
      await Promise.all([
        mutate("/api/incidents"),
        mutate("/api/services"),
        mutate("/api/graph"),
        mutate("/api/summary"),
      ]);
    } catch (err) {
      toast.error("Failed to resolve", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [incidentId, resolveTrigger]);

  if (dismissed || !summary?.ai) return null;

  const borderColor = severity === "critical"
    ? "border-red-500/20"
    : severity === "warning"
      ? "border-amber-500/20"
      : "border-blue-500/20";

  const glowColor = severity === "critical"
    ? "shadow-[0_8px_40px_rgba(239,68,68,0.08)]"
    : severity === "warning"
      ? "shadow-[0_8px_40px_rgba(245,158,11,0.08)]"
      : "shadow-[0_8px_40px_rgba(59,130,246,0.08)]";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={cn(
          "relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#111113] to-[#0e0e10]",
          borderColor,
          glowColor
        )}>
          {/* Animated top edge */}
          <motion.div
            className={cn(
              "absolute inset-x-0 top-0 h-[2px]",
              severity === "critical"
                ? "bg-gradient-to-r from-transparent via-red-500 to-transparent"
                : severity === "warning"
                  ? "bg-gradient-to-r from-transparent via-amber-500 to-transparent"
                  : "bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            )}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-6 items-center justify-center rounded-lg bg-violet-500/10">
                <Sparkles className="size-3.5 text-violet-400" />
              </div>
              <span
                className="text-[11px] font-bold tracking-[0.1em] uppercase text-violet-400"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                AI Incident Detected
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  severity === "critical"
                    ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                    : severity === "warning"
                      ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                      : "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
                )}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span className={cn(
                  "size-1.5 rounded-full",
                  severity === "critical" ? "bg-red-400 animate-pulse" : "bg-amber-400"
                )} />
                {severity}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/[0.04] hover:text-white/40"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Main content */}
          <div className="px-5 py-4">
            {/* Headline */}
            <p className="text-[16px] font-bold leading-snug text-white/95 mb-1">
              {headline.replace(/^(CRITICAL|WARNING):\s*/, "")}
            </p>
            {whatHappened && (
              <p className="text-[13px] leading-relaxed text-white/40 mb-5 max-w-2xl">
                {whatHappened}
              </p>
            )}

            {/* Metrics row */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <MetricChip
                icon={<Network className="size-3" />}
                value={String(affectedCount)}
                label="affected"
              />
              <MetricChip
                icon={<Zap className="size-3" />}
                value={String(maxDepth)}
                label="depth"
              />
              <MetricChip
                icon={<DollarSign className="size-3" />}
                value={formatMoney(revenuePerMin)}
                label="/min"
                accent
              />
              <MetricChip
                icon={<Clock className="size-3" />}
                value={duration}
                label="elapsed"
              />
            </div>

            {/* Root cause snippet */}
            {rootCause && (
              <div className="mb-4 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Target className="size-3 text-red-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
                    Root cause
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-white/50">
                  {rootCause.length > 200 ? rootCause.slice(0, 200) + "..." : rootCause}
                </p>
              </div>
            )}

            {/* Expandable details */}
            {fixPriority && (
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="mb-4 flex w-full items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <Wrench className="size-3 text-purple-400" />
                <span className="flex-1 text-[11px] font-medium text-white/40">Fix priority</span>
                <ChevronDown
                  className="size-3 text-white/20 transition-transform duration-200"
                  style={{ transform: showDetails ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
              </button>
            )}

            <AnimatePresence initial={false}>
              {showDetails && fixPriority && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden -mt-2 mb-4"
                >
                  <div className="rounded-xl border border-purple-500/10 bg-purple-500/[0.03] px-4 py-3">
                    <p className="text-[12px] leading-relaxed text-white/45">
                      {fixPriority}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTAs */}
            <div className="flex items-center gap-2">
              <Link
                href={`/incidents/${incidentId}`}
                className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-[12px] font-semibold text-white/70 transition-all hover:bg-white/[0.06] hover:text-white/90"
              >
                View incident
                <ArrowRight className="size-3" />
              </Link>
              <button
                type="button"
                onClick={() => setShowResolveConfirm(true)}
                disabled={isMutating}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[12px] font-semibold text-white transition-all duration-200 hover:bg-emerald-600/90 hover:shadow-[0_0_16px_rgba(16,185,129,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMutating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="size-3.5" />
                )}
                Resolve
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Confirm dialog for resolve */}
      <ConfirmDialog
        open={showResolveConfirm}
        onClose={() => setShowResolveConfirm(false)}
        onConfirm={handleResolve}
        title="Resolve this incident?"
        description="This will mark the incident as resolved and all affected services will return to healthy."
        confirmLabel="Resolve incident"
        cancelLabel="Cancel"
        variant="success"
        stats={[
          { icon: Network, label: "Services affected", value: String(affectedCount) },
          { icon: Clock, label: "Duration", value: duration },
          { icon: DollarSign, label: "Revenue at risk", value: `${formatMoney(revenuePerMin)}/min`, accent: true },
          { icon: DollarSign, label: "Total impact", value: formatMoneyFull(totalImpact), accent: true },
        ]}
        successTitle="Incident resolved"
        successDescription={`${affectedCount} services recovered. Total impact over ${duration}.`}
        successStats={[
          { label: "Duration", value: duration },
          { label: "Services recovered", value: String(affectedCount) },
          { label: "Total impact", value: formatMoneyFull(totalImpact) },
        ]}
      />
    </>
  );
}

function MetricChip({
  icon,
  value,
  label,
  accent = false,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.04] bg-white/[0.02] px-2 py-2.5 transition-colors hover:bg-white/[0.04]">
      <span className="text-white/25">{icon}</span>
      <span
        className={cn(
          "text-[16px] font-black tracking-tight",
          accent ? "text-rose-400" : "text-white/90"
        )}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </span>
      <span className="text-[8px] font-medium uppercase tracking-wider text-white/25">
        {label}
      </span>
    </div>
  );
}