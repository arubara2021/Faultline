import { cn } from "@/lib/utils";

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-[var(--fl-surface-raised)] via-[var(--fl-surface)] to-[var(--fl-surface-raised)]",
        "bg-[length:200%_100%] animate-fl-shimmer",
        className
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)] px-4 py-3.5">
      <div className="flex items-start justify-between">
        <ShimmerBar className="h-3 w-20" />
        <ShimmerBar className="size-7 rounded-lg" />
      </div>
      <ShimmerBar className="mt-3 h-7 w-16" />
      <ShimmerBar className="mt-1.5 h-3 w-24" />
    </div>
  );
}

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function GraphSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex min-h-[380px] w-full flex-1 items-center justify-center overflow-hidden rounded-xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]",
        className
      )}
    >
      <div className="bg-grid absolute inset-0 opacity-30" />
      <div className="flex flex-col items-center gap-3">
        <div className="size-16 animate-pulse rounded-full bg-[var(--fl-surface-raised)]" />
        <ShimmerBar className="h-3 w-32" />
        <ShimmerBar className="h-2.5 w-24" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]">
      <div className="border-b border-[var(--fl-border-subtle)] px-4 py-2.5">
        <ShimmerBar className="h-3 w-48" />
      </div>
      <div className="divide-y divide-[var(--fl-border-subtle)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <ShimmerBar className="h-3 w-28" />
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-5 w-16 rounded-md" />
            <ShimmerBar className="h-5 w-14 rounded-full" />
            <div className="flex-1" />
            <ShimmerBar className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineSkeleton({ className }: { className?: string }) {
  return <ShimmerBar className={cn("h-3.5 w-full", className)} />;
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <StatsGridSkeleton />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          <div className="overflow-hidden rounded-xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]">
            <div className="border-b border-[var(--fl-border-subtle)] px-4 py-2.5">
              <ShimmerBar className="h-3 w-36" />
            </div>
            <div className="flex h-[300px] items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="size-14 animate-pulse rounded-full bg-[var(--fl-surface-raised)]" />
                <ShimmerBar className="h-2.5 w-28" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <div className="overflow-hidden rounded-xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface)] p-4">
            <ShimmerBar className="h-3 w-24" />
            <ShimmerBar className="mt-4 h-20 w-full rounded-lg" />
            <ShimmerBar className="mt-3 h-3 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}