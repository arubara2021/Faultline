"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, Copy, Check,
  AlertTriangle, Target, Zap, DollarSign, Wrench, BarChart3,
  Clock, Network, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIncidentSummary } from "@/lib/hooks/use-summary";
import { useIncident } from "@/lib/hooks/use-incident";

interface IncidentSummaryProps {
  incidentId: string;
}

export function IncidentSummary({ incidentId }: IncidentSummaryProps) {
  const { data: summary, isLoading } = useIncidentSummary(incidentId);
  const { data: incident } = useIncident(incidentId);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const headline = summary?.ai?.headline ?? "";
  const affectedCount = incident?.incident?.affectedServiceCount ?? 0;
  const maxDepth = incident?.incident?.maxDepth ?? 0;
  const revenuePerMin = incident?.revenueImpact?.totalRevenuePerMinCents ?? 0;
  const startedAt = incident?.incident?.startedAt;

  const duration = (() => {
    if (!startedAt) return "—";
    const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0) return `${h}h ${mm}m`;
    return `${m}m`;
  })();

  const severity = headline.includes("CRITICAL") ? "critical" : headline.includes("WARNING") ? "warning" : "info";

  const handleCopy = useCallback(async () => {
    if (!headline) return;
    await navigator.clipboard.writeText(headline);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [headline]);

  if (isLoading && !summary) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/[0.04] bg-[var(--fl-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
        <div className="space-y-3 p-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-[var(--fl-surface-raised)]" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary?.ai) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="overflow-hidden rounded-2xl border border-white/[0.04] bg-[var(--fl-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-3.5 text-indigo-400" />
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-indigo-400" style={{ fontFamily: "var(--font-mono)" }}>
              AI Summary
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              severity === "critical"
                ? "border border-red-500/25 bg-red-500/10 text-red-400"
                : severity === "warning"
                ? "border border-amber-500/25 bg-amber-500/10 text-amber-400"
                : "border border-blue-500/25 bg-blue-500/10 text-blue-400"
            )}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {severity}
          </span>
        </div>

        {/* Headline + copy */}
        <div className="border-b border-white/[0.04] px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-[13px] font-bold leading-relaxed text-[var(--fl-text-primary)]">
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

          {/* Mini stats */}
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <div className="flex flex-col items-center gap-0.5 rounded-lg border border-white/[0.04] bg-[var(--fl-surface-raised)] px-1 py-2">
              <span className="font-metric text-[14px] font-bold text-[var(--fl-text-primary)]">{affectedCount}</span>
              <span className="text-[8px] text-[var(--fl-text-tertiary)]">affected</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg border border-white/[0.04] bg-[var(--fl-surface-raised)] px-1 py-2">
              <span className="font-metric text-[14px] font-bold text-[var(--fl-text-primary)]">{maxDepth}</span>
              <span className="text-[8px] text-[var(--fl-text-tertiary)]">depth</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg border border-white/[0.04] bg-[var(--fl-surface-raised)] px-1 py-2">
              <span className="font-metric text-[14px] font-bold text-[var(--fl-accent-revenue)]">
                {revenuePerMin >= 100000 ? `$${(revenuePerMin / 100000).toFixed(1)}k` : `$${(revenuePerMin / 100).toFixed(0)}`}
              </span>
              <span className="text-[8px] text-[var(--fl-text-tertiary)]">/min</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg border border-white/[0.04] bg-[var(--fl-surface-raised)] px-1 py-2">
              <span className="font-metric text-[14px] font-bold text-[var(--fl-text-primary)]">{duration}</span>
              <span className="text-[8px] text-[var(--fl-text-tertiary)]">elapsed</span>
            </div>
          </div>
        </div>

        {/* Expandable full summary */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--fl-surface-raised)]/50"
        >
          <FileText className="size-3 text-[var(--fl-text-tertiary)]" />
          <span className="flex-1 text-[11px] font-medium text-[var(--fl-text-secondary)]">Full analysis</span>
          <ChevronDown
            className="size-3 text-[var(--fl-text-tertiary)] transition-transform duration-200"
            style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/[0.04] px-4 py-3">
                <p className="text-[11px] leading-relaxed text-[var(--fl-text-tertiary)]">
                  {summary.summary}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}