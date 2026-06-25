"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, AlertTriangle, X, Loader2, CheckCircle2, DollarSign, Clock, Network } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "success";
  stats?: Array<{
    icon: React.ElementType;
    label: string;
    value: string;
    accent?: boolean;
  }>;
  successTitle?: string;
  successDescription?: string;
  successStats?: Array<{
    label: string;
    value: string;
  }>;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "success",
  stats,
  successTitle,
  successDescription,
  successStats,
}: ConfirmDialogProps) {
  const [phase, setPhase] = useState<"confirm" | "loading" | "success">("confirm");

  async function handleConfirm() {
    setPhase("loading");
    try {
      await onConfirm();
      setPhase("success");
    } catch {
      setPhase("confirm");
    }
  }

  function handleClose() {
    if (phase === "loading") return;
    setPhase("confirm");
    onClose();
  }

  const isMounted = typeof window !== "undefined";

  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        if (!open) setPhase("confirm");
      }}
    >
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.04] bg-[var(--fl-surface)] shadow-2xl"
            >
              {/* Close button */}
              <button
                type="button"
                onClick={handleClose}
                disabled={phase === "loading"}
                className="absolute right-3 top-3 z-10 flex size-6 items-center justify-center rounded-lg text-[var(--fl-text-tertiary)] transition-colors hover:bg-[var(--fl-surface-raised)] hover:text-[var(--fl-text-secondary)]"
              >
                <X className="size-3.5" />
              </button>

              <AnimatePresence mode="wait">
                {phase === "success" ? (
                  /* ── Success state ── */
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center gap-4 px-6 py-8 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <div className="flex size-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08]">
                        <CheckCircle2 className="size-7 text-emerald-400" />
                      </div>
                    </motion.div>

                    <div>
                      <h3 className="text-[16px] font-bold text-[var(--fl-text-primary)]">
                        {successTitle ?? "Success"}
                      </h3>
                      <p className="mt-1 text-[12px] text-[var(--fl-text-tertiary)]">
                        {successDescription ?? "Operation completed successfully."}
                      </p>
                    </div>

                    {successStats && successStats.length > 0 && (
                      <div className="w-full space-y-1.5 rounded-xl border border-white/[0.04] bg-[var(--fl-surface-raised)] px-4 py-3">
                        {successStats.map((s, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-[11px] text-[var(--fl-text-tertiary)]">{s.label}</span>
                            <span className="text-[12px] font-semibold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                              {s.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleClose}
                      className="mt-1 w-full rounded-xl border border-white/[0.04] bg-[var(--fl-surface-raised)] px-4 py-2.5 text-[12px] font-medium text-[var(--fl-text-secondary)] transition-colors hover:bg-[var(--fl-surface)] hover:text-[var(--fl-text-primary)]"
                    >
                      Close
                    </button>
                  </motion.div>
                ) : (
                  /* ── Confirm state ── */
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="flex flex-col items-center gap-4 px-6 pt-7 pb-2 text-center">
                      <div className={cn(
                        "flex size-12 items-center justify-center rounded-2xl",
                        variant === "success"
                          ? "border border-emerald-500/20 bg-emerald-500/[0.08]"
                          : "border border-red-500/20 bg-red-500/[0.08]"
                      )}>
                        {variant === "success" ? (
                          <ShieldCheck className="size-6 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="size-6 text-red-400" />
                        )}
                      </div>

                      <div>
                        <h3 className="text-[15px] font-bold text-[var(--fl-text-primary)]">{title}</h3>
                        <p className="mt-1 text-[12px] leading-relaxed text-[var(--fl-text-tertiary)]">{description}</p>
                      </div>
                    </div>

                    {stats && stats.length > 0 && (
                      <div className="mx-4 mb-3 space-y-1.5 rounded-xl border border-white/[0.04] bg-[var(--fl-surface-raised)] px-3.5 py-3">
                        {stats.map((s, i) => {
                          const Icon = s.icon;
                          return (
                            <div key={i} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Icon className="size-3 text-[var(--fl-text-tertiary)]" />
                                <span className="text-[11px] text-[var(--fl-text-tertiary)]">{s.label}</span>
                              </div>
                              <span
                                className={cn(
                                  "text-[12px] font-semibold",
                                  s.accent ? "text-[var(--fl-accent-revenue)]" : "text-[var(--fl-text-primary)]"
                                )}
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                {s.value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex gap-2 border-t border-white/[0.04] px-4 py-3.5">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={phase === "loading"}
                        className="flex-1 rounded-xl border border-white/[0.04] bg-[var(--fl-surface-raised)] px-4 py-2 text-[12px] font-medium text-[var(--fl-text-secondary)] transition-colors hover:bg-[var(--fl-surface)] hover:text-[var(--fl-text-primary)] disabled:opacity-50"
                      >
                        {cancelLabel}
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={phase === "loading"}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                          variant === "success"
                            ? "bg-emerald-600 hover:bg-emerald-600/90 hover:shadow-[0_0_16px_rgba(16,185,129,0.2)]"
                            : "bg-red-500 hover:bg-red-500/90 hover:shadow-[0_0_16px_rgba(239,68,68,0.2)]"
                        )}
                      >
                        {phase === "loading" ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : variant === "success" ? (
                          <ShieldCheck className="size-3.5" />
                        ) : (
                          <AlertTriangle className="size-3.5" />
                        )}
                        {phase === "loading" ? "Resolving..." : confirmLabel}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}