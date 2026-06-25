"use client";

const healthStates = [
  { label: "Healthy", color: "#10b981" },
  { label: "Degraded", color: "#f59e0b" },
  { label: "Down", color: "#ef4444" },
];

const depTypes = [
  { label: "HTTP", color: "#3b82f6", dash: [] },
  { label: "Database", color: "#10b981", dash: [6, 4] },
  { label: "Queue", color: "#f59e0b", dash: [2, 4] },
  { label: "Cache", color: "#8b5cf6", dash: [8, 3, 2, 3] },
  { label: "DNS", color: "#ec4899", dash: [] },
  { label: "Config", color: "#71717a", dash: [] },
];

function DashPreview({ color, dash }: { color: string; dash: number[] }) {
  return (
    <svg width="22" height="4" className="shrink-0">
      <line
        x1="0" y1="2" x2="22" y2="2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dash.length > 0 ? dash.join(",") : undefined}
      />
    </svg>
  );
}

export function DepthLegend() {
  return (
    <div className="pointer-events-none flex flex-col gap-2.5 rounded-lg border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]/85 px-3 py-2.5 text-[10px] shadow-lg backdrop-blur-md">
      <div className="flex flex-col gap-1">
        <span className="font-medium uppercase tracking-widest text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
          Health
        </span>
        <div className="flex flex-wrap gap-x-2.5 gap-y-1">
          {healthStates.map((h) => (
            <span key={h.label} className="flex items-center gap-1.5">
              <span className="size-[5px] rounded-full" style={{ backgroundColor: h.color, boxShadow: `0 0 4px ${h.color}40` }} />
              <span className="text-[var(--fl-text-tertiary)]">{h.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="h-px bg-[var(--fl-border-subtle)]" />

      <div className="flex flex-col gap-1">
        <span className="font-medium uppercase tracking-widest text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
          Dependency
        </span>
        <div className="flex flex-wrap gap-x-2.5 gap-y-1">
          {depTypes.map((d) => (
            <span key={d.label} className="flex items-center gap-1.5">
              <DashPreview color={d.color} dash={d.dash} />
              <span className="text-[var(--fl-text-tertiary)]">{d.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}