// ═══════════════════════════════════════════
// 15. src/lib/utils/format.ts
// ═══════════════════════════════════════════

export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return `$$$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactCurrency(cents: number): string {
  const dollars = cents / 100;

  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (dollars >= 1_000) {
    return `$${(dollars / 1_000).toFixed(1)}K`;
  }
  if (dollars >= 1) {
    return `$${dollars.toFixed(2)}`;
  }
  return `$${dollars.toFixed(2)}`;
}

export function formatDollars(dollars: number): string {
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactDollars(dollars: number): string {
  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (dollars >= 1_000) {
    return `$${(dollars / 1_000).toFixed(1)}K`;
  }
  return `$${dollars.toFixed(2)}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("en-US");
}

export function formatPercentage(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

export function formatConfidence(score: string | number): string {
  const value = typeof score === "string" ? parseFloat(score) : score;
  if (isNaN(value)) return "0%";
  return `${(value * 100).toFixed(0)}%`;
}

export function formatHealthStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatClassification(classification: string): string {
  return classification
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatDependencyType(depType: string | null | undefined): string {
  if (!depType) return "Unknown";
  return depType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatOwnerTeam(team: string): string {
  return team
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function centsToDollars(cents: number): number {
  return Math.round((cents / 100) * 100) / 100;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
