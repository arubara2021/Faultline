"use client";

import { motion } from "framer-motion";
import { Activity, AlertCircle, CheckCircle2, ServerCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServicesTable } from "@/components/services/services-table";
import { useServices } from "@/lib/hooks/use-services";

export default function ServicesPage() {
  const { data } = useServices();
  const summary = data?.summary;
  const hasDown = (summary?.down ?? 0) > 0;
  const hasDegraded = (summary?.degraded ?? 0) > 0;

  const stats = [
    {
      label: "Total services",
      value: summary?.total ?? 0,
      icon: ServerCog,
      iconBg: "bg-indigo-500/10 text-indigo-400",
      valueColor: "text-[var(--fl-text-primary)]",
    },
    {
      label: "Healthy",
      value: summary?.healthy ?? 0,
      icon: CheckCircle2,
      iconBg: "bg-emerald-500/10 text-emerald-400",
      valueColor: "text-emerald-400",
    },
    {
      label: "Degraded",
      value: summary?.degraded ?? 0,
      icon: Activity,
      iconBg: hasDegraded ? "bg-amber-500/10 text-amber-400" : "bg-[var(--fl-surface-raised)] text-[var(--fl-text-tertiary)]",
      valueColor: hasDegraded ? "text-amber-400" : "text-[var(--fl-text-tertiary)]",
    },
    {
      label: "Down",
      value: summary?.down ?? 0,
      icon: AlertCircle,
      iconBg: hasDown ? "bg-red-500/10 text-red-400" : "bg-[var(--fl-surface-raised)] text-[var(--fl-text-tertiary)]",
      valueColor: hasDown ? "text-red-400" : "text-[var(--fl-text-tertiary)]",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-5 sm:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[18px] font-bold tracking-tight text-[var(--fl-text-primary)] sm:text-[20px]">Services</h1>
        <p className="text-[12px] text-[var(--fl-text-tertiary)] sm:text-[13px]">
          Every monitored service in your fleet, with live health and ownership.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="rounded-xl border border-white/[0.04] bg-[var(--fl-surface)] px-3 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.25)] sm:rounded-2xl sm:px-4 sm:py-3.5">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--fl-text-tertiary)] sm:text-[11px]" style={{ fontFamily: "var(--font-mono)" }}>
                    {stat.label}
                  </span>
                  <span className={cn("flex size-6 items-center justify-center rounded-lg sm:size-7", stat.iconBg)}>
                    <Icon className="size-3 sm:size-3.5" />
                  </span>
                </div>
                <span className={cn("font-metric mt-1.5 block text-[22px] font-bold leading-none tracking-tight sm:mt-2 sm:text-[26px]", stat.valueColor)}>
                  {stat.value}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <ServicesTable />
    </div>
  );
}