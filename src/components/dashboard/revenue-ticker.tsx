"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RevenueTickerProps {
  /** Revenue burn rate, in cents per minute. */
  ratePerMinCents: number;
  /** When the incident started — anchor for the accumulating total. */
  startedAt: string;
  resolvedAt?: string | null;
  className?: string;
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Continuously accumulating revenue-at-risk total. Recomputes from the
 * incident start anchor every 250ms so the number visibly climbs, conveying
 * the ongoing financial cost of the outage.
 */
export function RevenueTicker({
  ratePerMinCents,
  startedAt,
  resolvedAt,
  className,
}: RevenueTickerProps) {
  const compute = () => {
    const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
    const minutes = (end - new Date(startedAt).getTime()) / 60000;
    return Math.max(0, ratePerMinCents * minutes);
  };

  const [cents, setCents] = useState(compute);

  useEffect(() => {
    setCents(compute());
    if (resolvedAt) return;
    const id = setInterval(() => setCents(compute()), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratePerMinCents, startedAt, resolvedAt]);

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {formatMoney(cents)}
    </span>
  );
}
