// ═══════════════════════════════════════════
// 14. src/lib/utils/dates.ts
// ═══════════════════════════════════════════

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function formatDurationFromDates(
  start: Date | string,
  end?: Date | string
): string {
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = end
    ? typeof end === "string"
      ? new Date(end)
      : end
    : new Date();

  const diffMs = endDate.getTime() - startDate.getTime();
  return formatDuration(diffMs);
}

export function formatRelativeTime(date: Date | string): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function formatTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString();
}

export function formatTimestampLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatMinutesElapsed(start: Date | string): number {
  const startDate = typeof start === "string" ? new Date(start) : start;
  const now = new Date();
  return Math.round(((now.getTime() - startDate.getTime()) / 60000) * 100) / 100;
}

export function getElapsedLabel(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    return `${hours}h ${mins}m`;
  }
  return `${rounded}m`;
}

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}
