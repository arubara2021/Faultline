"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RootCausePanel } from "@/components/dashboard/root-cause-panel";
import { BlastRadiusList } from "@/components/dashboard/blast-radius-list";
import { IncidentSummary } from "@/components/dashboard/incident-summary";
import { IncidentTimer } from "@/components/dashboard/incident-timer";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { useIncident } from "@/lib/hooks/use-incident";
import { useResolve } from "@/lib/hooks/use-resolve";
import { ArrowLeft, CheckCircle2, FileWarning } from "lucide-react";

interface IncidentDetailProps {
  incidentId: string;
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function IncidentDetail({ incidentId }: IncidentDetailProps) {
  const router = useRouter();
  const { data, isLoading, error, mutate } = useIncident(incidentId);
  const { trigger, isMutating } = useResolve();

  const resolved = Boolean(data?.incident.resolvedAt);

  async function handleResolve() {
    try {
      const result = await trigger({ incidentId });
      toast.success("Incident resolved", {
        description: `${result.affectedServiceCount} services recovered · ${money(
          result.totalRevenueImpactCents
        )} total impact over ${result.durationFormatted}.`,
      });
      await mutate();
      router.refresh();
    } catch (err) {
      toast.error("Failed to resolve incident", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <EmptyState
          icon={FileWarning}
          title="Incident not found"
          description="This incident may have been resolved or the link is invalid."
        >
          <Button asChild variant="outline">
            <Link href="/">Back to dashboard</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  const ratePerMin = data?.revenueImpact.totalRevenuePerMinCents ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:py-8">
      {/* Breadcrumb + actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Dashboard
        </Link>
        {!resolved && (
          <Button onClick={handleResolve} disabled={isMutating} className="gap-2">
            <CheckCircle2 className="size-4" aria-hidden />
            {isMutating ? "Resolving…" : "Resolve incident"}
          </Button>
        )}
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={resolved ? "resolved" : "active"} />
          {isLoading && !data ? (
            <div className="bg-muted/50 h-8 w-72 animate-pulse rounded" />
          ) : (
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance md:text-3xl">
              {data?.rootCause.serviceName}{" "}
              <span className="text-muted-foreground font-normal">
                — {data?.rootCause.failureType.replace(/_/g, " ")}
              </span>
            </h1>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeaderStat
            label={resolved ? "Duration" : "Elapsed"}
            value={
              data?.incident.startedAt ? (
                <IncidentTimer
                  startedAt={data.incident.startedAt}
                  resolvedAt={data.incident.resolvedAt}
                />
              ) : (
                "—"
              )
            }
          />
          <HeaderStat
            label="Services impacted"
            value={`${data?.incident.affectedServiceCount ?? 0}`}
          />
          <HeaderStat label="Cascade depth" value={`${data?.incident.maxDepth ?? 0}`} />
          <HeaderStat
            label="Revenue / min"
            value={ratePerMin > 0 ? money(ratePerMin) : "—"}
            emphasis={ratePerMin > 0 && !resolved}
          />
        </div>
      </motion.header>

      {/* Body grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <div className="border-border bg-card overflow-hidden rounded-xl border">
            <div className="border-border/60 flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Dependency Cascade</h2>
              <span className="text-muted-foreground text-xs">
                Highlighting affected services
              </span>
            </div>
            <GraphCanvas activeIncidentId={incidentId} />
          </div>
          <BlastRadiusList incidentId={incidentId} />
        </div>

        <div className="flex flex-col gap-6">
          <RootCausePanel incidentId={incidentId} />
          <IncidentSummary incidentId={incidentId} />
        </div>
      </div>
    </div>
  );
}

function HeaderStat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="border-border bg-card/50 flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </span>
      <span
        className={
          emphasis
            ? "text-destructive font-mono text-lg font-semibold tabular-nums"
            : "font-mono text-lg font-semibold tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}
