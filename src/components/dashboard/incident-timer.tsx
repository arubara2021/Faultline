"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

interface IncidentTimerProps {
  startedAt: string;
  resolvedAt?: string | null;
  className?: string;
}

/** Live-updating elapsed duration since the incident started. */
export function IncidentTimer({
  startedAt,
  resolvedAt,
  className,
}: IncidentTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (resolvedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resolvedAt]);

  const end = resolvedAt ? new Date(resolvedAt).getTime() : now;
  const elapsed = end - new Date(startedAt).getTime();

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {formatDuration(elapsed)}
    </span>
  );
}
