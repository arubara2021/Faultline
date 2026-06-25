"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, DollarSign, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { StatsGridSkeleton } from "@/components/shared/loading-skeleton";
import { useServices } from "@/lib/hooks/use-services";
import { useIncidents } from "@/lib/hooks/use-incident";

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}K`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

function ServiceBar({ total, healthy, down }: { total: number; healthy: number; down: number }) {
  const hPct = (healthy / total) * 100;
  const dPct = (down / total) * 100;
  return (
    <div className="mt-2 flex h-[3px] w-full gap-px overflow-hidden rounded-full">
      {healthy > 0 && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${hPct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-full bg-emerald-500"
        />
      )}
      {down > 0 && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${dPct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="rounded-full bg-red-500"
        />
      )}
    </div>
  );
}

interface CardDef {
  key: string;
  label: string;
  icon: React.ElementType;
  value: number;
  format: (v: number) => string;
  accent: string;
  iconBg: string;
  hint: string;
  bar?: { total: number; healthy: number; down: number };
}

export function StatsGrid() {
  const { data: services } = useServices();
  const { data: incidents } = useIncidents();

  if (!services || !incidents) return <StatsGridSkeleton />;

  const active = incidents.active;
  const hasIncident = incidents.activeCount > 0;
  const total = services.summary.total;
  const healthy = services.summary.healthy;
  const down = services.summary.down;

  const cards: CardDef[] = [
    {
      key: "monitored",
      label: "Services monitored",
      icon: Activity,
      value: total,
      format: (v) => Math.round(v).toString(),
      accent: "text-[var(--fl-text-primary)]",
      iconBg: "bg-indigo-500/10 text-indigo-400",
      hint: `${healthy} healthy`,
      bar: hasIncident ? { total, healthy, down } : undefined,
    },
    {
      key: "incidents",
      label: "Active incidents",
      icon: AlertTriangle,
      value: incidents.activeCount,
      format: (v) => Math.round(v).toString(),
      accent: hasIncident ? "text-red-400" : "text-emerald-400",
      iconBg: hasIncident ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400",
      hint: hasIncident ? "Mitigation required" : "All clear",
    },
    {
      key: "revenue",
      label: "Revenue at risk",
      icon: DollarSign,
      value: active?.totalRevenueImpactCents ?? 0,
      format: formatMoney,
      accent: hasIncident ? "text-[var(--fl-accent-revenue)]" : "text-emerald-400",
      iconBg: hasIncident
        ? "bg-[var(--fl-accent-revenue)]/10 text-[var(--fl-accent-revenue)]"
        : "bg-emerald-500/10 text-emerald-400",
      hint: hasIncident ? "Accumulated impact" : "No exposure",
    },
    {
      key: "affected",
      label: "Affected services",
      icon: Network,
      value: active?.affectedServiceCount ?? 0,
      format: (v) => Math.round(v).toString(),
      accent: hasIncident ? "text-amber-400" : "text-emerald-400",
      iconBg: hasIncident ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400",
      hint: hasIncident ? `${active?.maxDepth ?? 0} levels deep` : "None impacted",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const isRevenue = card.key === "revenue";
        const isIncidentHighlight = hasIncident && isRevenue;

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border px-4 py-3.5 transition-all duration-500",
                isIncidentHighlight
                  ? "border-[var(--fl-accent-revenue)]/15 bg-[var(--fl-accent-revenue)]/[0.03] shadow-[0_2px_16px_rgba(244,63,94,0.12)]"
                  : "border-white/[0.04] bg-[var(--fl-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.25)]",
                isIncidentHighlight && "animate-fl-glow-red"
              )}
            >
              {isIncidentHighlight && (
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(244,63,94,0.06)_0%,_transparent_60%)]" />
              )}

              <div className="relative flex items-start justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                  {card.label}
                </span>
                <span className={cn("flex size-7 items-center justify-center rounded-lg", card.iconBg)}>
                  <Icon className="size-3.5" />
                </span>
              </div>

              <div className="relative mt-2">
                <span className={cn("font-metric text-[26px] font-bold leading-none tracking-tight", card.accent)}>
                  <AnimatedCounter
                    value={card.value}
                    format={card.format}
                  />
                </span>
              </div>

              <span className="relative mt-1 block text-[11px] text-[var(--fl-text-tertiary)]">
                {card.hint}
              </span>

              {card.bar && <ServiceBar total={card.bar.total} healthy={card.bar.healthy} down={card.bar.down} />}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}