"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, ChevronDown, ChevronRight,
  DollarSign, ExternalLink, FileText, Flame, Loader2,
  Server, ShieldCheck, Target, Zap, Copy, Check
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIncidents } from "@/lib/hooks/use-incident";
import { useIncident } from "@/lib/hooks/use-incident";
import { useResolve } from "@/lib/hooks/use-resolve";
import { useIncidentSummary } from "@/lib/hooks/use-summary";
import { mutate } from "swr";
import {
  getHealthStatusColor,
  getClassificationColor,
  getDepthColor,
} from "@/lib/utils/colors";

function formatDuration(startedAt: string): string {
  const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

function formatDollars(dollars: number): string {
  if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

function formatFailureType(type?: string): string {
  if (!type) return "unknown";
  return type.replace(/_/g, " ");
}

function AnimatedNumber({
  value,
  prefix = "$",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (Math.abs(diff) < 1) {
      setDisplay(value);
      return;
    }
    let frame: number;
    const duration = 500;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + diff * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className="text-glow-revenue font-metric text-[28px] font-bold leading-none text-[var(--fl-accent-revenue)]">
      {prefix}
      {Math.round(display).toLocaleString()}
      {suffix}
    </span>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  color,
  collapsible,
  open,
  onToggle,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!collapsible}
      className={cn(
        "flex w-full items-center gap-2",
        collapsible && "cursor-pointer"
      )}
    >
      <Icon className="size-3.5" style={{ color }} />
      <span
        className="text-[10px] font-semibold tracking-[0.12em] uppercase"
        style={{ color, fontFamily: "var(--font-mono)" }}
      >
        {label}
      </span>
      {collapsible && (
        <ChevronDown
          className="ml-auto size-3 text-[var(--fl-text-tertiary)] transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      )}
    </button>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const isCritical = severity === "down" || severity === "critical";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        isCritical
          ? "border border-red-500/30 bg-red-500/15 text-red-400"
          : "border border-amber-500/30 bg-amber-500/15 text-amber-400"
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {isCritical ? <Flame className="size-2.5" /> : <AlertTriangle className="size-2.5" />}
      {isCritical ? "critical" : "warning"}
    </div>
  );
}

function CollapsibleSection({
  icon,
  label,
  color,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.04] px-4 py-3.5">
      <SectionHeader
        icon={icon}
        label={label}
        color={color}
        collapsible
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SignalDetail({ label, value, breached }: { label: string; value: string; breached?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-[var(--fl-text-tertiary)]">{label}</span>
      <span
        className={cn(
          "text-[11px] font-medium",
          breached ? "text-[var(--fl-accent-revenue)]" : "text-[var(--fl-text-secondary)]"
        )}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </span>
    </div>
  );
}

function HealthySidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[0.04] px-4 py-3">
        <span className="text-[13px] font-semibold text-[var(--fl-text-primary)]">System Status</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="relative">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06]">
            <ShieldCheck className="size-6 text-emerald-500" />
          </div>
          <div className="absolute -inset-3 -z-10 rounded-3xl bg-emerald-500/[0.04] blur-xl animate-fl-breathe" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[14px] font-semibold text-[var(--fl-text-primary)]">All systems nominal</p>
          <p className="text-[12px] leading-relaxed text-[var(--fl-text-tertiary)]">
            No active incidents detected. Faultline is monitoring all services continuously.
          </p>
        </div>
      </div>
      <div className="border-t border-white/[0.04] px-4 py-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--fl-text-tertiary)]">Last check</span>
          <span className="text-[var(--fl-text-secondary)]" style={{ fontFamily: "var(--font-mono)" }}>just now</span>
        </div>
      </div>
    </div>
  );
}

function IncidentSidebarContent({ incidentId }: { incidentId: string }) {
  const { data: incidents } = useIncidents();
  const { data: detail } = useIncident(incidentId);
  const { data: summary } = useIncidentSummary(incidentId);
  const { trigger: resolveIncident, isMutating: isResolving } = useResolve();
  const active = incidents?.active;

  const [duration, setDuration] = useState("00:00");
  const [copied, setCopied] = useState(false);
  const [accumulatedDollars, setAccumulatedDollars] = useState(0);

  const startedAt = active?.startedAt;
  const revenuePerMinCents = detail?.revenueImpact?.totalRevenuePerMinCents ?? 0;
  const revenuePerMinDollars = revenuePerMinCents / 100;

  useEffect(() => {
    if (!startedAt) return;
    setDuration(formatDuration(startedAt));
    const timer = setInterval(
      () => setDuration(formatDuration(startedAt)),
      1000
    );
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    if (!startedAt || revenuePerMinDollars <= 0) {
      setAccumulatedDollars(0);
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 60000;
      setAccumulatedDollars(Math.max(0, revenuePerMinDollars * elapsed));
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt, revenuePerMinDollars]);

  const affectedCount = active?.affectedServiceCount ?? 0;
  const maxDepth = active?.maxDepth ?? 0;
  const signalDetails = detail?.rootCause?.signalDetails;

  const blastByDepth = new Map<number, typeof detail.blastRadius>();
  if (detail?.blastRadius) {
    for (const entry of detail.blastRadius) {
      const list = blastByDepth.get(entry.depth) ?? [];
      list.push(entry);
      blastByDepth.set(entry.depth, list);
    }
  }
  const sortedDepths = [...blastByDepth.keys()].sort((a, b) => a - b);

  const headline = summary?.ai?.headline ?? "";

  const handleCopy = useCallback(async () => {
    if (!headline) return;
    await navigator.clipboard.writeText(headline);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [headline]);

  const handleResolve = useCallback(async () => {
    try {
      const result = await resolveIncident({ incidentId });
      toast.success("Incident resolved", {
        description: `${result.durationFormatted} · $${(result.totalRevenueImpactCents / 100).toLocaleString()} total impact`,
      });
      await Promise.all([
        mutate("/api/incidents"),
        mutate("/api/services"),
        mutate("/api/graph"),
      ]);
    } catch (err) {
      toast.error("Failed to resolve", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [incidentId, resolveIncident]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-red-500/15 bg-red-500/[0.03] px-4 py-3">
        <div className="flex items-center justify-between">
          <SeverityBadge severity={active?.severity ?? "down"} />
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-red-500" />
            {duration}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="border-b border-white/[0.04] px-4 py-4">
          <SectionHeader icon={Target} label="Root cause" color="#EF4444" />
          <div className="mt-3 rounded-xl border border-red-500/10 bg-red-500/[0.04] shadow-[0_2px_8px_rgba(239,68,68,0.06)]">
            <div className="px-3.5 py-3">
              <p className="text-[14px] font-semibold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                {active?.rootServiceName ?? "unknown"}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--fl-text-secondary)]">
                {formatFailureType(active?.failureType)}
              </p>
            </div>
            {signalDetails && typeof signalDetails === "object" && (
              <div className="space-y-1.5 border-t border-red-500/10 px-3.5 py-3">
                {signalDetails.connection_pool && (
                  <SignalDetail label="Connection pool" value={String(signalDetails.connection_pool)} breached />
                )}
                {signalDetails.multiplier && (
                  <SignalDetail label="Latency multiplier" value={`{signalDetails.multiplier}x`} breached />
                )}
                {signalDetails.error_rate && (
                  <SignalDetail label="Error rate" value={String(signalDetails.error_rate)} breached />
                )}
                {signalDetails.threshold && (
                  <SignalDetail label="Threshold" value={String(signalDetails.threshold)} />
                )}
              </div>
            )}
          </div>
        </div>

        <CollapsibleSection icon={DollarSign} label="Revenue at risk" color="#F43F5E">
          <div className="space-y-2">
            <AnimatedNumber value={revenuePerMinDollars} suffix="/min" />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--fl-text-tertiary)]">Accumulated</span>
              <span className="text-[var(--fl-text-secondary)]" style={{ fontFamily: "var(--font-mono)" }}>
                {formatDollars(accumulatedDollars)}
              </span>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection icon={Zap} label="Blast radius" color="#F59E0B">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--fl-text-secondary)]">Affected</span>
              <span className="font-metric text-[14px] font-bold text-[var(--fl-text-primary)]">{affectedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--fl-text-secondary)]">Max depth</span>
              <span className="font-metric text-[14px] font-bold text-[var(--fl-text-primary)]">{maxDepth}</span>
            </div>

            {sortedDepths.map((depth) => {
              const entries = blastByDepth.get(depth) ?? [];
              const dc = getDepthColor(depth);
              return (
                <div key={depth} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold", dc.bg, dc.text)} style={{ fontFamily: "var(--font-mono)" }}>
                      D{depth}
                    </span>
                    <span className="text-[10px] text-[var(--fl-text-tertiary)]">{entries.length} services</span>
                  </div>
                  <div className="space-y-1">
                    {entries.map((entry) => {
                      const cls = getClassificationColor(entry.classification);
                      return (
                        <div
                          key={entry.serviceId}
                          className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-[var(--fl-surface-raised)] px-2.5 py-1.5"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: dc.fill }} />
                            <span className="truncate text-[11px] font-medium text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                              {entry.serviceName}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {entry.isCustomerFacing && (
                              <span className="rounded-md bg-blue-500/10 px-1 py-0.5 text-[9px] font-semibold text-blue-400 uppercase">CF</span>
                            )}
                            {entry.revenuePerMinCents > 0 && (
                              <span className="text-[10px] text-[var(--fl-accent-revenue)]" style={{ fontFamily: "var(--font-mono)" }}>
                                {formatMoney(entry.revenuePerMinCents)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {headline && (
          <div className="border-b border-white/[0.04] px-4 py-3.5">
            <SectionHeader icon={FileText} label="AI Summary" color="#6366F1" />
            <div className="mt-3 flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-[var(--fl-text-secondary)]">
                {headline}
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-lg p-1.5 text-[var(--fl-text-tertiary)] transition-colors hover:bg-[var(--fl-surface-raised)] hover:text-[var(--fl-text-secondary)]"
              >
                {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-3.5">
          <div className="space-y-2">
            <Link
              href={`/incidents/${incidentId}`}
              className="group flex items-center justify-between rounded-xl border border-white/[0.04] bg-[var(--fl-surface-raised)] px-3.5 py-2.5 text-[12px] font-medium text-[var(--fl-text-secondary)] transition-all duration-200 hover:border-indigo-500/30 hover:bg-indigo-500/[0.06] hover:text-indigo-400 hover:shadow-[0_0_16px_rgba(99,102,241,0.08)]"
            >
              <div className="flex items-center gap-2.5">
                <Server className="size-4 opacity-50 transition-opacity group-hover:opacity-80" />
                View full details
              </div>
              <ChevronRight className="size-3.5 opacity-30 transition-all group-hover:translate-x-0.5 group-hover:opacity-60" />
            </Link>

            <button
              type="button"
              onClick={handleResolve}
              disabled={isResolving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-[12px] font-semibold text-white transition-all duration-200 hover:bg-emerald-600/90 hover:shadow-[0_0_16px_rgba(16,185,129,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isResolving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="size-3.5" />
              )}
              Resolve incident
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  hasIncident: boolean;
  incidentId?: string;
}

export function IncidentSidebar({ hasIncident, incidentId }: SidebarProps) {
  return (
    <aside className="hidden w-[340px] shrink-0 border-l border-white/[0.04] bg-[var(--fl-surface)] lg:block">
      <AnimatePresence mode="wait">
        {hasIncident && incidentId ? (
          <motion.div
            key="incident"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <IncidentSidebarContent incidentId={incidentId} />
          </motion.div>
        ) : (
          <motion.div
            key="healthy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <HealthySidebar />
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}