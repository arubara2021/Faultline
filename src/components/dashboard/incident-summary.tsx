"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIncidentSummary } from "@/lib/hooks/use-summary";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  AlertTriangle,
  Search,
  Network,
  DollarSign,
  Wrench,
} from "lucide-react";

interface IncidentSummaryProps {
  incidentId: string;
}

const SECTIONS = [
  { key: "whatHappened", label: "What Happened", icon: AlertTriangle },
  { key: "rootCauseAnalysis", label: "Root Cause Analysis", icon: Search },
  { key: "blastRadiusSummary", label: "Blast Radius", icon: Network },
  { key: "revenueImpactSummary", label: "Revenue Impact", icon: DollarSign },
  { key: "fixPriority", label: "Recommended Fix", icon: Wrench },
] as const;

export function IncidentSummary({ incidentId }: IncidentSummaryProps) {
  const { data, isLoading, error } = useIncidentSummary(incidentId);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-border/60 border-b">
        <CardTitle className="flex items-center gap-2">
          <span className="bg-primary/15 text-primary flex size-7 items-center justify-center rounded-md">
            <Sparkles className="size-4" aria-hidden />
          </span>
          AI Incident Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading && !data ? (
          <div className="flex flex-col gap-4">
            {SECTIONS.map((s) => (
              <div key={s.key} className="flex flex-col gap-2">
                <div className="bg-muted/50 h-3 w-32 animate-pulse rounded" />
                <div className="bg-muted/40 h-3 w-full animate-pulse rounded" />
                <div className="bg-muted/40 h-3 w-2/3 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-muted-foreground text-sm">
            Unable to generate analysis right now. Retrying automatically.
          </p>
        ) : data ? (
          <div className="flex flex-col gap-5">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/10 border-destructive/30 rounded-lg border p-4"
            >
              <p className="text-destructive text-sm font-semibold text-pretty">
                {data.ai.headline}
              </p>
            </motion.div>

            <div className="flex flex-col gap-5">
              {SECTIONS.map((section, idx) => {
                const Icon = section.icon;
                const text = data.ai[section.key];
                return (
                  <motion.div
                    key={section.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className="flex gap-3"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                        section.key === "fixPriority"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wide">
                        {section.label}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                        {text}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
