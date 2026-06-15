"use client";

import { motion } from "framer-motion";
import { Boxes, ShieldAlert, DollarSign, GitBranch } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { StatsGridSkeleton } from "@/components/shared/loading-skeleton";
import { useServices } from "@/lib/hooks/use-services";
import { useIncidents } from "@/lib/hooks/use-incident";
import { cn } from "@/lib/utils";

interface StatTile {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "neutral" | "good" | "warn" | "bad";
  hint: string;
  format?: (v: number) => string;
}

const toneStyles: Record<StatTile["tone"], string> = {
  neutral: "text-foreground",
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
};

const toneIcon: Record<StatTile["tone"], string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-emerald-500/10 text-emerald-500",
  warn: "bg-amber-500/10 text-amber-500",
  bad: "bg-red-500/10 text-red-500",
};

function money(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

export function StatsGrid() {
  const { data: services } = useServices();
  const { data: incidents } = useIncidents();

  if (!services || !incidents) {
    return <StatsGridSkeleton />;
  }

  const active = incidents.active;
  const hasIncident = incidents.activeCount > 0;

  const tiles: StatTile[] = [
    {
      label: "Services monitored",
      value: services.summary.total,
      icon: Boxes,
      tone: "neutral",
      hint: `${services.summary.healthy} healthy`,
    },
    {
      label: "Active incidents",
      value: incidents.activeCount,
      icon: ShieldAlert,
      tone: hasIncident ? "bad" : "good",
      hint: hasIncident ? "Mitigation required" : "All clear",
    },
    {
      label: "Revenue at risk",
      value: active?.totalRevenueImpactCents ?? 0,
      icon: DollarSign,
      tone: hasIncident ? "bad" : "good",
      hint: hasIncident ? "Accumulated impact" : "No exposure",
      format: money,
    },
    {
      label: "Affected services",
      value: active?.affectedServiceCount ?? 0,
      icon: GitBranch,
      tone: hasIncident ? "warn" : "good",
      hint: hasIncident ? `${active?.maxDepth} levels deep` : "None impacted",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((tile, i) => {
        const Icon = tile.icon;
        return (
          <motion.div
            key={tile.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="gap-3">
              <div className="flex items-center justify-between px-4">
                <span className="text-xs font-medium text-muted-foreground">
                  {tile.label}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    toneIcon[tile.tone]
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
              </div>
              <div className="flex flex-col gap-0.5 px-4">
                <span
                  className={cn(
                    "font-heading text-2xl font-semibold tracking-tight",
                    toneStyles[tile.tone]
                  )}
                >
                  <AnimatedCounter
                    value={tile.value}
                    format={tile.format ?? ((v) => Math.round(v).toLocaleString("en-US"))}
                  />
                </span>
                <span className="text-xs text-muted-foreground">{tile.hint}</span>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
