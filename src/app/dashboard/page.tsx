"use client";

import { useEffect, useRef, useState, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { HealthyState } from "@/components/dashboard/healthy-state";
import { IncidentOverview } from "@/components/dashboard/incident-overview";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { IncidentSidebar } from "@/components/layout/sidebar";
import { AiHeroBanner } from "@/components/dashboard/ai-hero-banner";
import { useIncidents } from "@/lib/hooks/use-incident";
import { DashboardSkeleton } from "@/components/shared/loading-skeleton";

const MemoizedGraphCanvas = memo(GraphCanvas);
const MemoizedIncidentOverview = memo(IncidentOverview);
const MemoizedAiHeroBanner = memo(AiHeroBanner);
const MemoizedIncidentSidebar = memo(IncidentSidebar);
const MemoizedStatsGrid = memo(StatsGrid);
const MemoizedHealthyState = memo(HealthyState);

const RESOLUTION_ANIMATION_MS = 3500;

export default function DashboardPage() {
  const { data: incidents, isLoading } = useIncidents();
  const active = incidents?.active ?? null;
  const hasIncident = (incidents?.activeCount ?? 0) > 0 && active !== null;

  const hasRecordedInitial = useRef(false);
  const prevIncidentIdRef = useRef<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);

  const [isResolving, setIsResolving] = useState(false);
  const wasActiveRef = useRef(false);
  const resolveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const lastIncidentIdRef = useRef<string | null>(null);
  const lastActiveDataRef = useRef<{
    id: string;
    rootServiceName: string;
    failureType: string;
    severity: string;
    startedAt: string;
  } | null>(null);

  useEffect(() => {
    if (hasIncident && active) {
      wasActiveRef.current = true;
      lastIncidentIdRef.current = active.id;
      lastActiveDataRef.current = {
        id: active.id,
        rootServiceName: active.rootServiceName,
        failureType: active.failureType,
        severity: active.severity,
        startedAt: active.startedAt,
      };

      if (isResolving) {
        setIsResolving(false);
        if (resolveTimerRef.current) {
          clearTimeout(resolveTimerRef.current);
          resolveTimerRef.current = null;
        }
      }
    } else if (wasActiveRef.current && !isResolving) {
      wasActiveRef.current = false;
      setIsResolving(true);
      resolveTimerRef.current = setTimeout(() => {
        setIsResolving(false);
        lastIncidentIdRef.current = null;
        lastActiveDataRef.current = null;
      }, RESOLUTION_ANIMATION_MS);
    }
  }, [hasIncident, active, isResolving]);

  useEffect(() => {
    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const currentId = active?.id ?? null;
    if (incidents === undefined) return;

    if (!hasRecordedInitial.current) {
      hasRecordedInitial.current = true;
      prevIncidentIdRef.current = currentId;
      return;
    }

    if (currentId === prevIncidentIdRef.current) return;

    if (currentId !== null) {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), 1500);
      prevIncidentIdRef.current = currentId;
      return () => clearTimeout(timer);
    }

    prevIncidentIdRef.current = currentId;
  }, [incidents, active?.id]);

  const showIncidentLayout = hasIncident || isResolving;
  const displayData = active ?? lastActiveDataRef.current;
  const graphIncidentId = active?.id ?? null;

  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col">
      <AnimatePresence>
        {showFlash && (
          <motion.div
            key="activation-pulse"
            initial={{ opacity: 0.06 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="pointer-events-none fixed inset-0 z-50 bg-red-500"
            onAnimationComplete={() => setShowFlash(false)}
          />
        )}
      </AnimatePresence>

      <div className="mx-auto w-full max-w-[1440px] shrink-0 px-3 pt-4 pb-3 sm:px-5 lg:px-6">
        <div className="mb-3 flex flex-col gap-1 sm:mb-4">
          <h1 className="text-[18px] font-semibold tracking-tight text-[var(--fl-text-primary)] sm:text-[20px]">
            Operations overview
          </h1>
          <p className="text-[12px] text-[var(--fl-text-tertiary)] sm:text-[13px]">
            Real-time dependency health and financial blast radius across your fleet.
          </p>
        </div>
        {isLoading && !incidents ? <DashboardSkeleton /> : <MemoizedStatsGrid />}
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-3 pb-4 sm:px-5 lg:px-6">
        <AnimatePresence mode="wait">
          {showIncidentLayout ? (
            <motion.div
              key="incident-layout"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-4 lg:flex-row"
            >
              <div className="min-w-0 flex-1 overflow-auto scrollbar-thin">
                <div className="flex flex-col gap-3 sm:gap-4">
                  {hasIncident && displayData ? (
                    <>
                      <MemoizedAiHeroBanner incidentId={displayData.id} />
                      <MemoizedIncidentOverview
                        incidentId={displayData.id}
                        rootServiceName={displayData.rootServiceName}
                        failureType={displayData.failureType}
                        severity={displayData.severity}
                        startedAt={displayData.startedAt}
                      />
                    </>
                  ) : isResolving ? (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3 sm:px-5 sm:py-4"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] sm:size-10">
                        <svg className="size-4 text-emerald-400 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-emerald-400 sm:text-[14px]">Incident resolved</p>
                        <p className="text-[11px] text-[var(--fl-text-tertiary)] sm:text-[12px]">
                          All services have recovered. Cascade visualization completing...
                        </p>
                      </div>
                    </motion.div>
                  ) : null}
                  <MemoizedGraphCanvas activeIncidentId={graphIncidentId} />
                </div>
              </div>
              <div className="shrink-0 lg:w-[340px]">
                <MemoizedIncidentSidebar
                  hasIncident={hasIncident}
                  incidentId={hasIncident ? active?.id : undefined}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="healthy-layout"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-4 lg:flex-row"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:gap-4">
                  <MemoizedHealthyState />
                  <div className="min-h-[300px] flex-1 sm:min-h-[500px]">
                    <MemoizedGraphCanvas activeIncidentId={null} />
                  </div>
                </div>
              </div>
              <div className="shrink-0 lg:w-[340px]">
                <MemoizedIncidentSidebar hasIncident={false} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}