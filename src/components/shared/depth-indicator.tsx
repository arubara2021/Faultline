"use client";

import { cn } from "@/lib/utils";
import { getDepthColor } from "@/lib/utils/colors";

interface DepthIndicatorProps {
  depth: number;
  className?: string;
}

export function DepthIndicator({ depth, className }: DepthIndicatorProps) {
  const c = getDepthColor(depth);
  const label = depth === 0 ? "Root" : `D${depth}`;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
        c.bg,
        c.text,
        c.border,
        className
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {label}
    </span>
  );
}