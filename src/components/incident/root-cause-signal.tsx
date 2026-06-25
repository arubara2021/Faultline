"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Target, Flame, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIncident } from "@/lib/hooks/use-incident";
import { getHealthStatusColor } from "@/lib/utils/colors";

interface RootCauseSignalProps {
  incidentId: string;
}

function formatFailureType(type?: string): string {
  if (!type) return "unknown";
  return type.replace(/_/g, " ");
}

function ThresholdBar({
  label,
  value,
  threshold,
  unit,
}: {
  label: string;
  value: string;
  threshold: string;
  unit?: string;
}) {
  const vNum = parseFloat(value);
  const tNum = parseFloat(threshold);
  const ratio = tNum > 0 ? Math.min(vNum / tNum, 3) : 0;
  const pct = Math.min((ratio / 3) * 100, 100);
  const breached = vNum > tNum;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--fl-text-tertiary)]">{label}</span>
        <span className={cn(
          "text-[11px] font-semibold",
          breached ? "text-[var(--fl-accent-revenue)]" : "text-[var(--fl-text-secondary)]"
        )} style={{ fontFamily: "var(--font-mono)" }}>
          {value}{unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--fl-surface-raised)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: breached ? "#F43F5E" : "#10B981",
          }}
        />
        <div
          className="absolute inset-y-0 w-px bg-[var(--fl-text-tertiary)]"
          style={{ left: `${(1 / 3) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SignalRow({ label, value, breached }: { label: string; value: string; breached?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-[var(--fl-text-tertiary)]">{label}</span>
      <span
        className={cn(
          "text-[12px] font-medium",
          breached ? "text-[var(--fl-accent-revenue)]" : "text-[var(--fl-text-secondary)]"
        )}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function RootCauseSignal({ incidentId }: RootCauseSignalProps) {
  const { data } = useIncident(incidentId);

  const rootCause = data?.rootCause;
  const signalDetails = rootCause?.signalDetails;
  const severity = rootCause?.severity ?? "down";
  const isCritical = severity === "down";

  const parsedSignals = useMemo(() => {
    if (!signalDetails || typeof signalDetails !== "object") return null;

    const signals: {
      connectionPool?: string;
      multiplier?: string;
      errorRate?: string;
      latency?: string;
      threshold?: string;
      raw: Array<{ label: string; value: string; breached?: boolean }>;
    } = { raw: [] };

    if (signalDetails.connection_pool) {
      signals.connectionPool = String(signalDetails.connection_pool);
      signals.raw.push({ label: "Connection pool", value: signals.connectionPool, breached: true });
    }
    if (signalDetails.multiplier) {
      signals.multiplier = `${signalDetails.multiplier}x`;
      signals.raw.push({ label: "Latency multiplier", value: signals.multiplier, breached: true });
    }
    if (signalDetails.error_rate) {
      signals.errorRate = String(signalDetails.error_rate);
      signals.raw.push({ label: "Error rate", value: signals.errorRate, breached: true });
    }
    if (signalDetails.latency_p95 || signalDetails.latency) {
      signals.latency = String(signalDetails.latency_p95 ?? signalDetails.latency);
      signals.raw.push({ label: "P95 latency", value: signals.latency, breached: true });
    }
    if (signalDetails.threshold) {
      signals.threshold = String(signalDetails.threshold);
      signals.raw.push({ label: "Threshold", value: signals.threshold });
    }

    if (signals.raw.length === 0) {
      for (const [key, val] of Object.entries(signalDetails)) {
        if (key === "checked_at" || key === "source") continue;
        signals.raw.push({
          label: key.replace(/_/g, " "),
          value: typeof val === "object" ? JSON.stringify(val) : String(val),
        });
      }
    }

    return signals;
  }, [signalDetails]);

  const healthColor = getHealthStatusColor(rootCause?.severity ?? "down");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative overflow-hidden rounded-xl border border-red-500/20 bg-[var(--fl-surface)]">
        <div className="absolute left-0 inset-y-0 w-1 bg-gradient-to-b from-red-500 via-red-500/60 to-red-500/20" />

        <div className="flex flex-col gap-4 pl-5 pr-4 py-4">
          <div className="flex items-center gap-2">
            <Target className="size-3.5 text-red-400" />
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-red-400" style={{ fontFamily: "var(--font-mono)" }}>
              Root cause signal
            </span>
          </div>

          <div className="rounded-lg border border-red-500/15 bg-red-500/[0.04]">
            <div className="px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-bold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                    {rootCause?.serviceName ?? "unknown"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--fl-text-secondary)]">
                    {formatFailureType(rootCause?.failureType)}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    isCritical
                      ? "border border-red-500/30 bg-red-500/15 text-red-400"
                      : "border border-amber-500/30 bg-amber-500/15 text-amber-400"
                  )}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {isCritical ? <Flame className="size-2.5" /> : <AlertTriangle className="size-2.5" />}
                  {severity}
                </span>
              </div>
            </div>

            {parsedSignals && parsedSignals.raw.length > 0 && (
              <div className="space-y-3 border-t border-red-500/10 px-3.5 py-3">
                <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                  Signal details
                </span>
                {parsedSignals.raw.map((s, i) => (
                  <SignalRow key={i} label={s.label} value={s.value} breached={s.breached} />
                ))}

                {parsedSignals.multiplier && parsedSignals.threshold && (
                  <div className="pt-1">
                    <ThresholdBar
                      label="Latency breach"
                      value={parsedSignals.multiplier.replace("x", "")}
                      threshold={parsedSignals.threshold.replace(/[^0-9.]/g, "")}
                      unit="x threshold"
                    />
                  </div>
                )}
              </div>
            )}

            {(!parsedSignals || parsedSignals.raw.length === 0) && (
              <div className="border-t border-red-500/10 px-3.5 py-3">
                <p className="text-[11px] text-[var(--fl-text-tertiary)]">
                  No signal details available for this failure.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-[11px] text-[var(--fl-text-tertiary)]">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: healthColor.fill }} />
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {rootCause?.severity ?? "unknown"}
              </span>
            </div>
            {rootCause?.detectedAt && (
              <span style={{ fontFamily: "var(--font-mono)" }}>
                Detected {new Date(rootCause.detectedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}