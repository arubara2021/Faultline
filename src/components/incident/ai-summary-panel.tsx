"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Copy,
  Check,
  AlertTriangle,
  Target,
  Zap,
  DollarSign,
  Wrench,
  BarChart3,
  Clock,
  Network,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIncidentSummary } from "@/lib/hooks/use-summary";
import { useIncident } from "@/lib/hooks/use-incident";

interface AiSummaryPanelProps {
  incidentId: string;
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$$$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

export function AiSummaryPanel({ incidentId }: AiSummaryPanelProps) {
  const { data: summary, isLoading } = useIncidentSummary(incidentId);
  const { data: incident } = useIncident(incidentId);
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["whatHappened", "rootCause"])
  );

  const toggle = useCallback((key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const headline = summary?.ai?.headline ?? "";
  const affectedCount = incident?.incident?.affectedServiceCount ?? summary?.impact?.totalServicesAffected ?? 0;
  const maxDepth = incident?.incident?.maxDepth ?? 0;
  const revenuePerMin = incident?.revenueImpact?.totalRevenuePerMinCents ?? summary?.impact?.revenuePerMinCents ?? 0;
  const startedAt = incident?.incident?.startedAt ?? summary?.incident?.startedAt;
  const resolvedAt = incident?.incident?.resolvedAt;

  const duration = (() => {
    if (!startedAt) return "—";
    const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
    const diff = Math.max(0, end - new Date(startedAt).getTime());
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

  const handleCopyHeadline = useCallback(async () => {
    if (!headline) return;
    await navigator.clipboard.writeText(headline);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [headline]);

  const sections = [
    {
      key: "whatHappened",
      label: "What happened",
      icon: AlertTriangle,
      color: "#F59E0B",
      borderColor: "#F59E0B",
      content: summary?.ai?.whatHappened ?? "",
    },
    {
      key: "rootCause",
      label: "Root cause analysis",
      icon: Target,
      color: "#EF4444",
      borderColor: "#EF4444",
      content: summary?.ai?.rootCauseAnalysis ?? "",
    },
    {
      key: "blastRadius",
      label: "Blast radius",
      icon: Zap,
      color: "#F59E0B",
      borderColor: "#F59E0B",
      content: summary?.ai?.blastRadiusSummary ?? "",
    },
    {
      key: "revenue",
      label: "Revenue impact",
      icon: DollarSign,
      color: "#F43F5E",
      borderColor: "#F43F5E",
      content: summary?.ai?.revenueImpactSummary ?? "",
    },
    {
      key: "fixPriority",
      label: "Fix priority",
      icon: Wrench,
      color: "#8B5CF6",
      borderColor: "#8B5CF6",
      content: summary?.ai?.fixPriority ?? "",
    },
  ];

  if (isLoading && !summary) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#111113] to-[#0e0e10]"
      >
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-4 text-violet-400 animate-pulse" />
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-violet-400" style={{ fontFamily: "var(--font-mono)" }}>
              Generating AI Summary
            </span>
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="h-3 rounded-full bg-white/[0.04] animate-pulse" style={{ width: `${85 - i * 15}%` }} />
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  if (!summary?.ai) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#111113] to-[#0e0e10] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 items-center justify-center rounded-lg bg-violet-500/10">
              <Sparkles className="size-3.5 text-violet-400" />
            </div>
            <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-violet-400" style={{ fontFamily: "var(--font-mono)" }}>
              AI Summary
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
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
              severity === "critical" ? "bg-red-400 animate-pulse" : severity === "warning" ? "bg-amber-400" : "bg-blue-400"
            )} />
            {severity}
          </span>
        </div>

        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[15px] font-bold leading-snug text-white/95 flex-1">
              {headline}
            </p>
            <button
              type="button"
              onClick={handleCopyHeadline}
              className="shrink-0 rounded-lg p-2 text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/60"
              title="Copy headline"
            >
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <MetricCard icon={<Network className="size-3.5" />} value={String(affectedCount)} label="services" />
            <MetricCard icon={<Zap className="size-3.5" />} value={String(maxDepth)} label="depth" />
            <MetricCard icon={<DollarSign className="size-3.5" />} value={formatMoney(revenuePerMin)} label="/min" accent />
            <MetricCard icon={<Clock className="size-3.5" />} value={duration} label="elapsed" />
          </div>
        </div>

        <div className="py-1">
          {sections.map((section) => {
            const isOpen = openSections.has(section.key);
            const Icon = section.icon;

            return (
              <div key={section.key}>
                <button
                  type="button"
                  onClick={() => toggle(section.key)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: section.color }} />
                  <Icon className="size-3.5 shrink-0" style={{ color: section.color }} />
                  <span className="flex-1 text-[12px] font-semibold text-white/80">{section.label}</span>
                  <ChevronDown
                    className="size-3.5 shrink-0 text-white/20 transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && section.content && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 pl-10">
                        <div
                          className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3"
                          style={{ borderLeftColor: section.borderColor, borderLeftWidth: "2px" }}
                        >
                          <p className="text-[12px] leading-[1.7] text-white/55">
                            {section.content}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({
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
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.04] bg-white/[0.02] px-2 py-3 transition-colors hover:bg-white/[0.04]">
      <span className="text-white/25">{icon}</span>
      <span
        className={cn(
          "text-[18px] font-black tracking-tight",
          accent ? "text-rose-400" : "text-white/90"
        )}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-wider text-white/25">
        {label}
      </span>
    </div>
  );
}