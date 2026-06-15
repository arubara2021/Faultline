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
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        c.bg,
        c.text,
        c.border,
        className
      )}
    >
      {withDot && (
        <span className="relative flex size-1.5">
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
