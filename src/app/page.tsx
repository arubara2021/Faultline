"use client";

import { AnimatePresence, motion } from "framer-motion";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { HealthyState } from "@/components/dashboard/healthy-state";
import { IncidentOverview } from "@/components/dashboard/incident-overview";
import { RevenueTimeline } from "@/components/dashboard/revenue-timeline";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { useIncidents } from "@/lib/hooks/use-incident";
import { DashboardSkeleton } from "@/components/shared/loading-skeleton";

export default function DashboardPage() {
  const { data: incidents, isLoading } = useIncidents();

  const active = incidents?.active ?? null;
  const hasIncident = (incidents?.activeCount ?? 0) > 0 && active !== null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      {/* Page heading */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
          Operations overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time dependency health and financial blast radius across your
          fleet.
        </p>
      </div>

      {isLoading && !incidents ? (
        <DashboardSkeleton />
      ) : (
        <>
          <StatsGrid />

          <AnimatePresence mode="wait">
            {hasIncident && active ? (
              <motion.div
                key="incident"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 gap-6 xl:grid-cols-3"
              >
                <div className="flex flex-col gap-6 xl:col-span-2">
                  <IncidentOverview
                    incidentId={active.id}
                    rootServiceName={active.rootServiceName}
                    failureType={active.failureType}
                    severity={active.severity}
                    startedAt={active.startedAt}
                  />
                  <GraphCanvas activeIncidentId={active.id} />
                </div>
                <div className="flex flex-col gap-6">
                  <RevenueTimeline
                    incidentId={active.id}
                    startedAt={active.startedAt}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="healthy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-6"
              >
                <HealthyState />
                <GraphCanvas activeIncidentId={null} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
