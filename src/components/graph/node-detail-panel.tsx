"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X, Activity, Users, Server, ExternalLink, AlertTriangle,
  ShieldCheck, Flame, Database, Wifi, MessageSquare
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getHealthStatusColor, getClassificationColor } from "@/lib/utils/colors";
import { StatusBadge } from "@/components/shared/status-badge";
import type { LayoutNode } from "@/components/graph/service-node";

interface NodeDetailPanelProps {
  node: LayoutNode | null;
  onClose: () => void;
}

const DEP_TYPE_ICONS: Record<string, React.ElementType> = {
  http_call: Wifi,
  database_access: Database,
  message_queue: MessageSquare,
  shared_cache: Server,
};

function formatClassification(cls: string): string {
  return cls.replace(/_/g, " ");
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, x: 12, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-3 top-3 z-30 w-72 overflow-hidden rounded-2xl border border-white/[0.04] bg-[var(--fl-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-white/[0.04] px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: node.depth >= 0
                      ? (node.depth === 0 ? "#EF4444" : "#F59E0B")
                      : "#10B981",
                  }}
                />
                <span className="truncate text-[14px] font-bold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                  {node.name}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusBadge status={node.healthStatus} size="sm" />
                {node.depth >= 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                      node.depth === 0
                        ? "bg-red-500/15 text-red-400 border border-red-500/20"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                    )}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {node.depth === 0 ? (
                      <Flame className="size-2.5" />
                    ) : (
                      <AlertTriangle className="size-2.5" />
                    )}
                    {node.depth === 0 ? "Root" : `D${node.depth}`}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-6 shrink-0 items-center justify-center rounded-lg text-[var(--fl-text-tertiary)] transition-colors hover:bg-[var(--fl-surface-raised)] hover:text-[var(--fl-text-secondary)]"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Details */}
          <div className="space-y-3 px-4 py-3">
            <DetailRow
              icon={Server}
              label="Classification"
              value={formatClassification(node.classification)}
              valueClass={getClassificationColor(node.classification).text}
            />
            <DetailRow
              icon={Users}
              label="Owner team"
              value={node.ownerTeam}
            />
            <DetailRow
              icon={Activity}
              label="Health status"
              value={node.healthStatus}
              badge={
                <span
                  className="inline-block size-1.5 rounded-full"
                  style={{ backgroundColor: getHealthStatusColor(node.healthStatus).fill }}
                />
              }
            />
          </div>

          {/* Cascade info */}
          {node.depth >= 0 && (
            <div className="border-t border-white/[0.04] px-4 py-3">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                Cascade impact
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--fl-text-tertiary)]">Depth level</span>
                  <span className="text-[12px] font-semibold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                    {node.depth === 0 ? "Root cause" : `${node.depth}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--fl-text-tertiary)]">Classification</span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                      getClassificationColor(node.classification).bg,
                      getClassificationColor(node.classification).text
                    )}
                  >
                    {formatClassification(node.classification)}
                  </span>
                </div>
                {node.classification === "customer-facing" && (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-500/10 bg-blue-500/[0.04] px-2.5 py-2">
                    <ShieldCheck className="size-3.5 shrink-0 text-blue-400" />
                    <span className="text-[11px] text-blue-400">
                      Customer-facing service — direct revenue impact
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-white/[0.04] px-4 py-3">
            <Link
              href={`/services`}
              className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-[var(--fl-surface-raised)] px-3 py-2 text-[11px] font-medium text-[var(--fl-text-secondary)] transition-all duration-200 hover:border-indigo-500/25 hover:bg-indigo-500/[0.05] hover:text-indigo-400"
            >
              <div className="flex items-center gap-2">
                <Server className="size-3.5 opacity-50" />
                View service details
              </div>
              <ExternalLink className="size-3 opacity-40" />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  valueClass,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="size-3 text-[var(--fl-text-tertiary)]" />
        <span className="text-[11px] text-[var(--fl-text-tertiary)]">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {badge}
        <span
          className={cn(
            "text-[12px] font-medium",
            valueClass ?? "text-[var(--fl-text-secondary)]"
          )}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}