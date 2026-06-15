// ═══════════════════════════════════════════
// 13. src/lib/utils/colors.ts
// ═══════════════════════════════════════════

export const healthStatusColors = {
  healthy: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
    fill: "#10b981",
  },
  degraded: {
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
    fill: "#f59e0b",
  },
  down: {
    bg: "bg-red-500/10",
    text: "text-red-500",
    border: "border-red-500/20",
    dot: "bg-red-500",
    fill: "#ef4444",
  },
  unknown: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-500",
    border: "border-zinc-500/20",
    dot: "bg-zinc-500",
    fill: "#71717a",
  },
} as const;

export type HealthStatus = keyof typeof healthStatusColors;

export const classificationColors = {
  "customer-facing": {
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    border: "border-blue-500/20",
    fill: "#3b82f6",
  },
  internal: {
    bg: "bg-violet-500/10",
    text: "text-violet-500",
    border: "border-violet-500/20",
    fill: "#8b5cf6",
  },
  infrastructure: {
    bg: "bg-orange-500/10",
    text: "text-orange-500",
    border: "border-orange-500/20",
    fill: "#f97316",
  },
} as const;

export type Classification = keyof typeof classificationColors;

export const dependencyTypeColors: Record<string, string> = {
  http_call: "#3b82f6",
  database_access: "#10b981",
  message_queue: "#f59e0b",
  shared_cache: "#8b5cf6",
  dns: "#ec4899",
  configuration: "#71717a",
};

export const depthColors = {
  1: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30", fill: "#ef4444" },
  2: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30", fill: "#f59e0b" },
  3: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30", fill: "#3b82f6" },
} as const;

export function getDepthColor(depth: number) {
  if (depth <= 1) return depthColors[1];
  if (depth === 2) return depthColors[2];
  return depthColors[3];
}

export function getHealthStatusColor(status: string) {
  const key = (status in healthStatusColors
    ? status
    : "unknown") as HealthStatus;
  return healthStatusColors[key];
}

export function getClassificationColor(classification: string) {
  const key = (classification in classificationColors
    ? classification
    : "internal") as Classification;
  return classificationColors[key];
}

export function getDependencyTypeColor(depType: string): string {
  return dependencyTypeColors[depType] ?? "#71717a";
}

export const severityColors = {
  critical: { bg: "bg-red-500/10", text: "text-red-500", fill: "#ef4444" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-500", fill: "#f59e0b" },
} as const;
