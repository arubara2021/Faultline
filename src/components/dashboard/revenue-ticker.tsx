"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface RevenueTickerProps {
  ratePerMinCents: number;
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

export function RevenueTicker({
  ratePerMinCents,
  startedAt,
  resolvedAt,
  className,
}: RevenueTickerProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const dataRef = useRef({ ratePerMinCents, startedAt, resolvedAt });

  dataRef.current = { ratePerMinCents, startedAt, resolvedAt };

  useEffect(() => {
    if (resolvedAt) {
      const minutes =
        (new Date(resolvedAt).getTime() - new Date(startedAt).getTime()) / 60000;
      const final = Math.max(0, ratePerMinCents * minutes);
      if (spanRef.current) spanRef.current.textContent = formatMoney(final);
      return;
    }

    let rafId: number;

    const tick = () => {
      const { ratePerMinCents: rate, startedAt: start } = dataRef.current;
      const minutes = (Date.now() - new Date(start).getTime()) / 60000;
      const cents = Math.max(0, rate * minutes);
      if (spanRef.current) spanRef.current.textContent = formatMoney(cents);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [ratePerMinCents, startedAt, resolvedAt]);

  return (
    <span
      ref={spanRef}
      className={cn("font-mono tabular-nums", className)}
    >
      {formatMoney(
        Math.max(
          0,
          ratePerMinCents *
            ((Date.now() - new Date(startedAt).getTime()) / 60000)
        )
      )}
    </span>
  );
}