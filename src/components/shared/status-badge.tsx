"use client";

import { cn } from "@/lib/utils";
import { getHealthStatusColor } from "@/lib/utils/colors";
import { formatHealthStatus } from "@/lib/utils/format";

interface StatusBadgeProps {
  status: string;
  withDot?: boolean;
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
  label?: string;
}

export function StatusBadge({
  status,
  withDot = true,
  pulse = false,
  size = "md",
  className,
  label,
}: StatusBadgeProps) {
  const c = getHealthStatusColor(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-semibold",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        c.bg,
        c.text,
        c.border,
        className
      )}
      style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.03em" }}
    >
      {withDot && (
        <span className="relative flex size-1.5 shrink-0">
          {pulse && (
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-75",
                c.dot
              )}
            />
          )}
          <span
            className={cn("relative inline-flex size-1.5 rounded-full", c.dot)}
          />
        </span>
      )}
      {label ?? formatHealthStatus(status)}
    </span>
  );
}