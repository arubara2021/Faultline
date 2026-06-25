"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIncident } from "@/lib/hooks/use-incident";

interface RevenueTimelineProps {
  incidentId: string;
  startedAt: string;
}

interface Point {
  minute: number;
  cumulative: number;
}

function buildSeries(ratePerMinCents: number, startedAt: string): Point[] {
  const elapsedMin = Math.max(1, (Date.now() - new Date(startedAt).getTime()) / 60000);
  const ratePerMinDollars = ratePerMinCents / 100;
  const steps = 24;
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const minute = (elapsedMin * i) / steps;
    points.push({
      minute: Math.round(minute * 10) / 10,
      cumulative: Math.round(ratePerMinDollars * minute * 100) / 100,
    });
  }
  return points;
}

export function RevenueTimeline({ incidentId, startedAt }: RevenueTimelineProps) {
  const { data } = useIncident(incidentId);
  const rate = data?.revenueImpact.totalRevenuePerMinCents ?? 0;

  const series = useMemo(() => buildSeries(rate, startedAt), [rate, startedAt]);
  const total = series.length ? series[series.length - 1].cumulative : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--fl-border-subtle)] px-4 py-3">
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--fl-text-primary)]">Revenue impact</h3>
          <p className="text-[11px] text-[var(--fl-text-tertiary)]">Cumulative loss since incident start</p>
        </div>
        <span className="text-glow-revenue font-metric text-[20px] font-bold text-[var(--fl-accent-revenue)]">
          ${total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>

      <div style={{ width: "100%", height: 180, minWidth: 0, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="fl-revenue-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="minute"
              tickFormatter={(v) => `${v}m`}
              stroke="#475569"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={{ fontFamily: "var(--font-mono)" }}
            />
            <YAxis
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              stroke="#475569"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={50}
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
              formatter={(value) => [`$${Number(value ?? 0).toLocaleString("en-US")}`, "Total"]}
              labelFormatter={(label) => `${label} min elapsed`}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#F43F5E"
              strokeWidth={2}
              fill="url(#fl-revenue-grad)"
              isAnimationActive
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}