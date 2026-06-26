"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { IncidentHeader } from "@/components/incident/incident-header";
import { RootCauseSignal } from "@/components/incident/root-cause-signal";
import { RevenueImpactSection } from "@/components/incident/revenue-impact-section";
import { AiSummaryPanel } from "@/components/incident/ai-summary-panel";
import { FixPriorityRanking } from "@/components/incident/fix-priority-ranking";
import { BlastRadiusList } from "@/components/dashboard/blast-radius-list";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { useIncident } from "@/lib/hooks/use-incident";
import { useResolve } from "@/lib/hooks/use-resolve";
import { ShieldCheck, FileWarning } from "lucide-react";
import { mutate } from "swr";

interface IncidentDetailProps {
  incidentId: string;
}

export function IncidentDetail({ incidentId }: IncidentDetailProps) {
  const { data, isLoading, error } = useIncident(incidentId);
  const { trigger, isMutating } = useResolve();

  const resolved = Boolean(data?.incident.resolvedAt);
  const wasActiveRef = useRef(false);
  const [justResolved, setJustResolved] = useState(false);
  const [showResolvedBanner, setShowResolvedBanner] = useState(false);

  useEffect(() => {
    if (!resolved) {
      wasActiveRef.current = true;
    } else if (wasActiveRef.current && resolved) {
      wasActiveRef.current = false;
      setJustResolved(true);
      setShowResolvedBanner(true);

      const timer = setTimeout(() => {
        setShowResolvedBanner(false);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [resolved]);

  async function handleResolve() {
    try {
      const result = await trigger({ incidentId });
      toast.success("Incident resolved", {
        description: result.affectedServiceCount + " services recovered · $" + (result.totalRevenueImpactCents / 100).toLocaleString() + " total impact over " + result.durationFormatted + ".",
      });
      await Promise.all([
        mutate("/api/incidents/" + incidentId),
        mutate("/api/incidents"),
        mutate("/api/services"),
        mutate("/api/graph"),
      ]);
    } catch (err) {
      toast.error("Failed to resolve incident", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-center px-4 py-16 sm:py-24">
        <EmptyState
          icon={FileWarning}
          title="Incident not found"
          description="This incident may have been resolved or the link is invalid."
        >
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--fl-border-active)] bg-[var(--fl-surface-raised)] px-4 py-2 text-[13px] font-medium text-[var(--fl-text-secondary)] transition-colors hover:bg-[var(--fl-surface)] hover:text-[var(--fl-text-primary)]"
          >
            Back to dashboard
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-5 sm:py-6 lg:px-6">
      <AnimatePresence>
        {showResolvedBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -12, height: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] px-3 py-3 shadow-[0_2px_16px_rgba(16,185,129,0.08)] sm:gap-4 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.1] sm:size-10">
                  <ShieldCheck className="size-4 text-emerald-400 sm:size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-emerald-400 sm:text-[14px]">
                    Incident resolved
                  </p>
                  <p className="text-[11px] text-[var(--fl-text-tertiary)] sm:text-[12px]">
                    All affected services have recovered. The dependency graph is returning to normal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResolvedBanner(false)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--fl-text-tertiary)] transition-colors hover:bg-[var(--fl-surface-raised)] hover:text-[var(--fl-text-secondary)] sm:px-3"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <IncidentHeader
        incidentId={incidentId}
        rootServiceName={data?.rootCause.serviceName}
        failureType={data?.rootCause.failureType}
        severity={data?.rootCause.severity}
        startedAt={data?.incident.startedAt}
        resolvedAt={data?.incident.resolvedAt}
        affectedCount={data?.incident.affectedServiceCount}
        maxDepth={data?.incident.maxDepth}
        resolved={resolved}
        isResolving={isMutating}
        onResolve={handleResolve}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 sm:gap-5">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5 xl:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="overflow-hidden rounded-xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--fl-border-subtle)] px-3 py-2 sm:px-4 sm:py-2.5">
                <h3 className="text-[12px] font-semibold text-[var(--fl-text-primary)] sm:text-[13px]">
                  Dependency cascade
                </h3>
                {resolved ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-0.5 text-[9px] font-semibold text-emerald-400 sm:px-2.5 sm:text-[10px]">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Resolved
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--fl-text-tertiary)] sm:text-[11px]">
                    Affected services highlighted
                  </span>
                )}
              </div>
              <div className="h-[280px] sm:h-[380px] lg:h-auto">
                <GraphCanvas activeIncidentId={resolved ? null : incidentId} />
              </div>
            </div>
          </motion.div>

          <BlastRadiusList incidentId={incidentId} />

          <RevenueImpactSection incidentId={incidentId} resolved={resolved} />

          <AiSummaryPanel incidentId={incidentId} />
        </div>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <RootCauseSignal incidentId={incidentId} />

          <FixPriorityRanking incidentId={incidentId} resolved={resolved} />
        </div>
      </div>
    </div>
  );
}