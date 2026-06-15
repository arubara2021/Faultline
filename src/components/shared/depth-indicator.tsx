import { cn } from "@/lib/utils";
import { getDepthColor } from "@/lib/utils/colors";

interface DepthIndicatorProps {
  depth: number;
  className?: string;
}

/** Small pill showing dependency cascade depth (0 = root). */
export function DepthIndicator({ depth, className }: DepthIndicatorProps) {
  const c = getDepthColor(depth);
  const label = depth === 0 ? "Root" : `Depth ${depth}`;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium",
        c.bg,
        c.text,
        c.border,
        className
      )}
    >
      {label}
    </span>
  );
}
