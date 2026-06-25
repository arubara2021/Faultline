"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DollarSign, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIncident } from "@/lib/hooks/use-incident";
import { IncidentTimer } from "@/components/dashboard/incident-timer";
import { RevenueTicker } from "@/components/dashboard/revenue-ticker";

interface RevenueImpactSectionProps {
  incidentId: string;
  resolved?: boolean;
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000000) return "$" + (dollars / 1000000).toFixed(1) + "M";
  if (dollars >= 1000) return "$" + (dollars / 1000).toFixed(1) + "K";
  return "$" + Math.round(dollars).toLocaleString();
}

function buildSeries(ratePerMinCents: number, startedAt: string, resolvedAt?: string | null) {
  const startMs = new Date(startedAt).getTime();
  const endMs = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const elapsedMin = Math.max(1, (endMs - startMs) / 60000);
  const rate = ratePerMinCents / 100;
  const steps = 30;
  const points: Array<{ minute: number; cumulative: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const minute = (elapsedMin * i) / steps;
    points.push({
      minute: Math.round(minute * 10) / 10,
      cumulative: Math.round(rate * minute * 100) / 100,
    });
  }
  return points;
}

export function RevenueImpactSection({ incidentId, resolved }: RevenueImpactSectionProps) {
  const { data } = useIncident(incidentId);

  const ratePerMin = data?.revenueImpact?.totalRevenuePerMinCents ?? 0;
  const startedAt = data?.incident?.startedAt ?? "";
  const resolvedAt = data?.incident?.resolvedAt ?? null;
  const isResolved = resolved ?? Boolean(resolvedAt);

  const totalImpact = useMemo(() => {
    if (!startedAt || ratePerMin <= 0) return 0;
    const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
    const minutes = (end - new Date(startedAt).getTime()) / 60000;
    return Math.max(0, Math.round(ratePerMin * minutes));
  }, [ratePerMin, startedAt, resolvedAt]);

  const series = useMemo(
    () => buildSeries(ratePerMin, startedAt, resolvedAt),
    [ratePerMin, startedAt, resolvedAt]
  );

  const serviceBreakdown = useMemo(() => {
    if (!data?.blastRadius) return [];
    return data.blastRadius
      .filter((s) => s.revenuePerMinCents > 0)
      .sort((a, b) => b.revenuePerMinCents - a.revenuePerMinCents)
      .slice(0, 6);
  }, [data?.blastRadius]);

  const maxRevenue = serviceBreakdown.length > 0
    ? serviceBreakdown[0].revenuePerMinCents
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="overflow-hidden rounded-xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]">
        <div className="border-b border-[var(--fl-border-subtle)] px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2">
            <DollarSign className="size-3.5 text-[var(--fl-accent-revenue)]" />
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--fl-accent-revenue)]" style={{ fontFamily: "var(--font-mono)" }}>
              Revenue impact
            </span>
            {isResolved && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Final
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px border-b border-[var(--fl-border-subtle)] bg-[var(--fl-border-subtle)]">
          <div className="flex flex-col gap-0.5 bg-[var(--fl-surface)] px-2.5 py-2.5 sm:gap-1 sm:px-4 sm:py-3">
            <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--fl-text-tertiary)] sm:text-[10px]" style={{ fontFamily: "var(--font-mono)" }}>
              Burn rate
            </span>
            <span className={cn(
              "font-metric text-[16px] font-bold leading-none sm:text-[20px]",
              isResolved ? "text-emerald-400" : "text-[var(--fl-accent-revenue)]"
            )}>
              {isResolved ? "$0" : formatMoney(ratePerMin)}
              <span className="ml-0.5 text-[9px] font-normal text-[var(--fl-text-tertiary)] sm:text-[11px]">/min</span>
            </span>
          </div>
          <div className="flex flex-col gap-0.5 bg-[var(--fl-surface)] px-2.5 py-2.5 sm:gap-1 sm:px-4 sm:py-3">
            <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--fl-text-tertiary)] sm:text-[10px]" style={{ fontFamily: "var(--font-mono)" }}>
              Total impact
            </span>
            <span className="font-metric text-[16px] font-bold leading-none text-[var(--fl-accent-revenue)] sm:text-[20px]">
              {formatMoney(totalImpact)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 bg-[var(--fl-surface)] px-2.5 py-2.5 sm:gap-1 sm:px-4 sm:py-3">
            <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--fl-text-tertiary)] sm:text-[10px]" style={{ fontFamily: "var(--font-mono)" }}>
              Duration
            </span>
            {startedAt ? (
              <IncidentTimer
                startedAt={startedAt}
                resolvedAt={resolvedAt}
                className="font-metric text-[16px] font-bold leading-none text-[var(--fl-text-primary)] sm:text-[20px]"
              />
            ) : (
              <span className="font-metric text-[16px] font-bold leading-none text-[var(--fl-text-tertiary)] sm:text-[20px]">—</span>
            )}
          </div>
        </div>

        <div style={{ width: "100%", height: 150, minWidth: 200, minHeight: 100 }} className="px-1 pt-2 sm:px-2 sm:pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="fl-rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isResolved ? "#10B981" : "#F43F5E"} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={isResolved ? "#10B981" : "#F43F5E"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="minute"
                tickFormatter={(v) => v + "m"}
                stroke="#475569"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                minTickGap={30}
                tick={{ fontFamily: "var(--font-mono)" }}
              />
              <YAxis
                tickFormatter={(v) => {
                  if (v >= 1000) return "$" + (v / 1000).toFixed(1) + "k";
                  return "$" + v;
                }}
                stroke="#475569"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                width={42}
                tick={{ fontFamily: "var(--font-mono)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "#111318",
                  border: "1px solid #1E2128",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  color: "#F1F5F9",
                }}
                labelStyle={{ color: "#94A3B8" }}
                formatter={(value) => [
                  "$" + Number(value ?? 0).toLocaleString("en-US"),
                  "Cumulative",
                ]}
                labelFormatter={(label) => label + " min elapsed"}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={isResolved ? "#10B981" : "#F43F5E"}
                strokeWidth={2}
                fill="url(#fl-rev-grad)"
                isAnimationActive
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {serviceBreakdown.length > 0 && (
          <div className="border-t border-[var(--fl-border-subtle)] px-3 py-3 sm:px-4 sm:py-3.5">
            <span className="mb-2.5 block text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--fl-text-tertiary)] sm:mb-3" style={{ fontFamily: "var(--font-mono)" }}>
              Breakdown by service
            </span>
            <div className="space-y-2">
              {serviceBreakdown.map((svc, i) => {
                const pct = maxRevenue > 0
                  ? (svc.revenuePerMinCents / maxRevenue) * 100
                  : 0;
                return (
                  <motion.div
                    key={svc.serviceId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[11px] font-medium text-[var(--fl-text-secondary)]" style={{ fontFamily: "var(--font-mono)" }}>
                        {svc.serviceName}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-[var(--fl-accent-revenue)]" style={{ fontFamily: "var(--font-mono)" }}>
                        {formatMoney(svc.revenuePerMinCents)}/min
                      </span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--fl-surface-raised)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: pct + "%" }}
                        transition={{ duration: 0.6, delay: 0.4 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          background: isResolved
                            ? "linear-gradient(90deg, #10B981, #059669)"
                            : "linear-gradient(90deg, #F43F5E, #BE123C)",
                        }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {!isResolved && (
              <p className="mt-2.5 text-[11px] text-[var(--fl-text-tertiary)] sm:mt-3">
                Resolving this incident will restore{" "}
                <span className="font-semibold text-[var(--fl-accent-revenue)]" style={{ fontFamily: "var(--font-mono)" }}>
                  ~{formatMoney(ratePerMin)}/min
                </span>{" "}
                in revenue capacity.
              </p>
            )}
            {isResolved && (
              <p className="mt-2.5 text-[11px] text-emerald-400 sm:mt-3">
                Revenue capacity restored. All affected services recovered.
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}