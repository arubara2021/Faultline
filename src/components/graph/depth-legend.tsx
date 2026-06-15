"use client";

const dependencyTypes: { type: string; label: string; color: string }[] = [
  { type: "http_call", label: "HTTP", color: "#3b82f6" },
  { type: "database_access", label: "Database", color: "#10b981" },
  { type: "message_queue", label: "Queue", color: "#f59e0b" },
  { type: "shared_cache", label: "Cache", color: "#8b5cf6" },
  { type: "dns", label: "DNS", color: "#ec4899" },
  { type: "configuration", label: "Config", color: "#71717a" },
];

const healthStates: { label: string; color: string }[] = [
  { label: "Healthy", color: "#10b981" },
  { label: "Degraded", color: "#f59e0b" },
  { label: "Down", color: "#ef4444" },
];

export function DepthLegend() {
  return (
    <div className="pointer-events-none flex flex-col gap-3 rounded-lg border border-border bg-background/80 p-3 text-xs backdrop-blur-sm">
      <div className="flex flex-col gap-1.5">
        <span className="font-medium uppercase tracking-wider text-muted-foreground">
          Health
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {healthStates.map((h) => (
            <span key={h.label} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: h.color }}
              />
              <span className="text-muted-foreground">{h.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-medium uppercase tracking-wider text-muted-foreground">
          Dependency type
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {dependencyTypes.map((d) => (
            <span key={d.type} className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-muted-foreground">{d.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
