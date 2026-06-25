"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Wrench, AlertTriangle, Flame, ArrowUp,
  ChevronRight, Info, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIncident } from "@/lib/hooks/use-incident";
import { getHealthStatusColor, getDepthColor } from "@/lib/utils/colors";

interface FixPriorityRankingProps {
  incidentId: string;
  resolved?: boolean;
}

interface CandidateScore {
  serviceId: string;
  serviceName: string;
  healthStatus: string;
  depth: number;
  score: number;
  reasons: string[];
  sharedDepCount: number;
}

function computeScore(
  healthStatus: string,
  depth: number,
  sharedDepCount: number
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (healthStatus === "down") {
    score += 100;
    reasons.push("currently down");
  } else if (healthStatus === "degraded") {
    score += 50;
    reasons.push("currently degraded");
  }

  const depthBonus = Math.max(0, 50 - depth * 15);
  score += depthBonus;
  if (depth === 1) {
    reasons.push("direct upstream dependency");
  } else if (depth > 1) {
    reasons.push(`depth ${depth} upstream`);
  }

  const sharedBonus = sharedDepCount * 5;
  score += sharedBonus;
  if (sharedDepCount > 0) {
    reasons.push(`shared dependency for ${sharedDepCount} services`);
  }

  return { score, reasons };
}

export function FixPriorityRanking({ incidentId, resolved }: FixPriorityRankingProps) {
  const { data } = useIncident(incidentId);

  const candidates = useMemo<CandidateScore[]>(() => {
    const upstream = data?.upstreamCandidates ?? [];
    if (upstream.length === 0) return [];

    return upstream
      .map((c: any) => {
        const { score, reasons } = computeScore(
          c.healthStatus ?? "unknown",
          c.depth ?? 1,
          c.sharedDependentCount ?? 0
        );
        return {
          serviceId: c.serviceId ?? c.id ?? "",
          serviceName: c.serviceName ?? c.name ?? "unknown",
          healthStatus: c.healthStatus ?? "unknown",
          depth: c.depth ?? 1,
          score,
          reasons,
          sharedDepCount: c.sharedDependentCount ?? 0,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [data?.upstreamCandidates]);

  const maxScore = candidates.length > 0 ? candidates[0].score : 100;

  const rootCauseName = data?.rootCause?.serviceName ?? "unknown";

  if (resolved) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="overflow-hidden rounded-xl border border-emerald-500/15 bg-[var(--fl-surface)]">
          <div className="flex items-center gap-2 border-b border-[var(--fl-border-subtle)] px-4 py-3">
            <Wrench className="size-3.5 text-emerald-400" />
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-emerald-400" style={{ fontFamily: "var(--font-mono)" }}>
              Fix priority
            </span>
          </div>
          <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06]">
              <ShieldCheck className="size-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[var(--fl-text-primary)]">
                Incident resolved
              </p>
              <p className="mt-1 text-[12px] text-[var(--fl-text-tertiary)]">
                All affected services have recovered. No further action required.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="overflow-hidden rounded-xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--fl-border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Wrench className="size-3.5 text-indigo-400" />
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-indigo-400" style={{ fontFamily: "var(--font-mono)" }}>
              Fix priority
            </span>
          </div>
          {candidates.length > 0 && (
            <span className="text-[10px] text-[var(--fl-text-tertiary)]">
              {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="p-4">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06]">
                <Info className="size-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[var(--fl-text-primary)]">
                  No upstream candidates found
                </p>
                <p className="mt-1 text-[12px] text-[var(--fl-text-tertiary)]">
                  <span className="font-medium text-[var(--fl-text-secondary)]" style={{ fontFamily: "var(--font-mono)" }}>
                    {rootCauseName}
                  </span>{" "}
                  appears to be the root cause. Investigate this service directly.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {candidates.map((candidate, i) => {
                const isFirst = i === 0;
                const pct = maxScore > 0 ? (candidate.score / maxScore) * 100 : 0;
                const healthColor = getHealthStatusColor(candidate.healthStatus);
                const depthColor = getDepthColor(candidate.depth);

                return (
                  <motion.div
                    key={candidate.serviceId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.06 }}
                    className={cn(
                      "relative overflow-hidden rounded-lg border transition-colors",
                      isFirst
                        ? "border-red-500/25 bg-red-500/[0.03]"
                        : "border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]"
                    )}
                  >
                    {isFirst && (
                      <div className="absolute left-0 inset-y-0 w-0.5 bg-red-500" />
                    )}

                    <div className="px-3.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                              isFirst
                                ? "bg-red-500/15 text-red-400"
                                : "bg-[var(--fl-surface-raised)] text-[var(--fl-text-tertiary)]"
                            )}
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {i + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                                {candidate.serviceName}
                              </span>
                              <span
                                className="inline-flex size-1.5 rounded-full"
                                style={{ backgroundColor: healthColor.fill }}
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", depthColor.bg, depthColor.text)} style={{ fontFamily: "var(--font-mono)" }}>
                                Depth {candidate.depth}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                  candidate.healthStatus === "down"
                                    ? "bg-red-500/15 text-red-400"
                                    : candidate.healthStatus === "degraded"
                                    ? "bg-amber-500/15 text-amber-400"
                                    : "bg-[var(--fl-surface-raised)] text-[var(--fl-text-tertiary)]"
                                )}
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                {candidate.healthStatus === "down" && <Flame className="size-2.5" />}
                                {candidate.healthStatus === "degraded" && <AlertTriangle className="size-2.5" />}
                                {candidate.healthStatus}
                              </span>
                              {candidate.sharedDepCount > 0 && (
                                <span className="text-[10px] text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                                  {candidate.sharedDepCount} shared deps
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 font-metric text-[16px] font-bold",
                            isFirst ? "text-red-400" : "text-[var(--fl-text-primary)]"
                          )}
                        >
                          {candidate.score}
                        </span>
                      </div>

                      <div className="mt-2.5 space-y-1.5">
                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--fl-surface-raised)]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              duration: 0.7,
                              delay: 0.4 + i * 0.06,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              background: isFirst
                                ? "linear-gradient(90deg, #EF4444, #F43F5E)"
                                : "linear-gradient(90deg, #6366F1, #818CF8)",
                            }}
                          />
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {candidate.reasons.map((reason, ri) => (
                            <span
                              key={ri}
                              className="rounded bg-[var(--fl-surface-raised)] px-1.5 py-0.5 text-[10px] text-[var(--fl-text-tertiary)]"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>

                      {isFirst && (
                        <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/15 bg-red-500/[0.04] px-3 py-2">
                          <ArrowUp className="size-3.5 shrink-0 text-red-400" />
                          <span className="text-[11px] font-medium text-red-400">
                            Fix this first — downstream services will recover automatically
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}