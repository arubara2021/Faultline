"use client";

import { motion } from "framer-motion";
import { Activity, AlertCircle, CheckCircle2, ServerCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ServicesTable } from "@/components/services/services-table";
import { useServices } from "@/lib/hooks/use-services";

export default function ServicesPage() {
  const { data } = useServices();
  const summary = data?.summary;

  const stats = [
    {
      label: "Total services",
      value: summary?.total ?? 0,
      icon: ServerCog,
      tone: "text-foreground",
    },
    {
      label: "Healthy",
      value: summary?.healthy ?? 0,
      icon: CheckCircle2,
      tone: "text-success",
    },
    {
      label: "Degraded",
      value: summary?.degraded ?? 0,
      icon: Activity,
      tone: "text-warning",
    },
    {
      label: "Down",
      value: summary?.down ?? 0,
      icon: AlertCircle,
      tone: "text-destructive",
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Services
        </h1>
        <p className="text-sm text-muted-foreground">
          Every monitored service in your fleet, with live health and ownership.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="flex flex-row items-center justify-between gap-2 p-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  {stat.label}
                </span>
                <span className="font-mono text-2xl font-semibold tabular-nums">
                  {stat.value}
                </span>
              </div>
              <stat.icon className={`size-5 ${stat.tone}`} />
            </Card>
          </motion.div>
        ))}
      </div>

      <ServicesTable />
    </div>
  );
}
