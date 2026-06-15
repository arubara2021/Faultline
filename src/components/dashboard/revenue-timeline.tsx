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
import { Card } from "@/components/ui/card";
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
  const elapsedMin = Math.max(
    1,
    (Date.now() - new Date(startedAt).getTime()) / 60000
  );
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

  const series = useMemo(
    () => buildSeries(rate, startedAt),
    [rate, startedAt]
  );

  const total = series.length ? series[series.length - 1].cumulative : 0;

  return (
    <Card className="gap-4">
      <div className="flex items-center justify-between px-5">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-heading text-sm font-semibold">
            Cumulative revenue impact
          </h3>
          <p className="text-xs text-muted-foreground">
            Projected loss since incident start
          </p>
        </div>
        <span className="font-mono text-lg font-semibold tabular-nums text-red-500">
          ${total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>

      <div className="h-40 w-full px-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="minute"
              tickFormatter={(v) => `${v}m`}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
              }}
              labelStyle={{ color: "var(--color-muted-foreground)" }}
              formatter={(value: number) => [
                `$${value.toLocaleString("en-US")}`,
                "Cumulative",
              ]}
              labelFormatter={(label) => `${label} min elapsed`}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              isAnimationActive
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
