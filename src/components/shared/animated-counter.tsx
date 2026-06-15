"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}

/**
 * Smoothly tweens from the previous value to the next using
 * requestAnimationFrame with an ease-out curve. Used for revenue
 * tickers and live stat counters.
 */
export function AnimatedCounter({
  value,
  format = (v) => Math.round(v).toLocaleString("en-US"),
  duration = 700,
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const displayRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;

    fromRef.current = from;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromRef.current + (to - fromRef.current) * eased;
      displayRef.current = current;
      setDisplay(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={cn("tabular-nums", className)}>{format(display)}</span>
  );
}
