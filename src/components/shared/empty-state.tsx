"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="flex size-11 items-center justify-center rounded-2xl border border-[var(--fl-border-subtle)] bg-[var(--fl-surface-raised)]">
          <Icon className="size-5 text-[var(--fl-text-tertiary)]" />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] font-semibold text-[var(--fl-text-primary)]">
          {title}
        </p>
        {description && (
          <p className="mx-auto max-w-sm text-[12px] leading-relaxed text-[var(--fl-text-tertiary)]">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}