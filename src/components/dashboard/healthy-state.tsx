"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Zap } from "lucide-react";
import { useServices } from "@/lib/hooks/use-services";
import { SimulateDialog } from "@/components/simulate/simulate-dialog";

export function HealthyState() {
  const { data } = useServices();
  const total = data?.summary.total ?? 0;
  const healthy = data?.summary.healthy ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/10 bg-[var(--fl-surface)] shadow-[0_2px_16px_rgba(16,185,129,0.08)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.04)_0%,_transparent_70%)]" />

        <div className="relative flex flex-col items-center gap-6 px-6 py-12 text-center sm:py-16">
          <div className="relative">
            <motion.div
              className="absolute -inset-4 rounded-full bg-emerald-500/[0.06]"
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -inset-6 rounded-full bg-emerald-500/[0.04]"
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            />
            <div className="relative flex size-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08]">
              <ShieldCheck className="size-7 text-emerald-400" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <h2 className="text-[22px] font-bold tracking-tight text-[var(--fl-text-primary)]">
              All systems nominal
            </h2>
            <p className="max-w-md text-[13px] leading-relaxed text-[var(--fl-text-tertiary)]">
              No active incidents detected across your dependency graph. Faultline
              is continuously monitoring every service for cascading failures.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fl-border-subtle)] bg-[var(--fl-surface-raised)] px-3 py-1 text-[11px] font-medium text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
              {total} services
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1 text-[11px] font-medium text-emerald-400" style={{ fontFamily: "var(--font-mono)" }}>
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {healthy} healthy
            </span>
          </div>

          <SimulateDialog />
        </div>
      </div>
    </motion.div>
  );
}