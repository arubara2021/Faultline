"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Activity, Boxes } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useServices } from "@/lib/hooks/use-services";

export function HealthyState() {
  const { data } = useServices();
  const total = data?.summary.total ?? 0;
  const healthy = data?.summary.healthy ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="relative items-center gap-6 overflow-hidden border-emerald-500/20 bg-emerald-500/[0.02] py-12 text-center">
        <div className="relative flex size-20 items-center justify-center">
          <motion.span
            className="absolute inset-0 rounded-full bg-emerald-500/10"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="absolute inset-0 rounded-full bg-emerald-500/10"
            animate={{ scale: [1, 1.7, 1], opacity: [0.4, 0, 0.4] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.6,
            }}
          />
          <span className="relative flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <ShieldCheck className="size-7" />
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance">
            All systems nominal
          </h2>
          <p className="max-w-md text-pretty text-sm text-muted-foreground">
            No active incidents detected across your dependency graph. Faultline
            is continuously monitoring every service for cascading failures.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Pill icon={<Boxes className="size-3.5" />} label={`${total} services`} />
          <Pill
            icon={<Activity className="size-3.5" />}
            label={`${healthy} healthy`}
            tone
          />
        </div>
      </Card>
    </motion.div>
  );
}

function Pill({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: boolean;
}) {
  return (
    <span
      className={
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium " +
        (tone
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
          : "border-border bg-card text-muted-foreground")
      }
    >
      {icon}
      {label}
    </span>
  );
}
