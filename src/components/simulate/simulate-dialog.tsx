"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSWRConfig } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Zap, Loader2, RotateCcw, AlertTriangle, ChevronDown, Search, X, Users, DollarSign, GitBranch, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSimulate, useSimulateTargets } from "@/lib/hooks/use-simulate";
import { useServiceGraph } from "@/lib/hooks/use-service-graph";
import { formatCompactDollars, formatOwnerTeam } from "@/lib/utils/format";
import { getClassificationColor } from "@/lib/utils/colors";

interface PreviewStats {
  affectedCount: number;
  maxDepth: number;
  customerFacingCount: number;
  isLoaded: boolean;
}

function computePreviewStats(
  serviceName: string,
  graphNodes: Array<{ id: string; name: string; classification: string }>,
  graphEdges: Array<{ sourceServiceId: string; targetServiceId: string }>
): PreviewStats {
  const adj = new Map<string, string[]>();
  for (const edge of graphEdges) {
    if (!adj.has(edge.targetServiceId)) adj.set(edge.targetServiceId, []);
    adj.get(edge.targetServiceId)!.push(edge.sourceServiceId);
  }

  const startNode = graphNodes.find((n) => n.name === serviceName);
  if (!startNode) return { affectedCount: 0, maxDepth: 0, customerFacingCount: 0, isLoaded: true };

  const visited = new Map<string, number>();
  visited.set(startNode.id, 0);
  const queue: Array<{ id: string; depth: number }> = [{ id: startNode.id, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    const neighbors = adj.get(id) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const newDepth = depth + 1;
        visited.set(neighbor, newDepth);
        queue.push({ id: neighbor, depth: newDepth });
      }
    }
  }

  let maxDepth = 0;
  let customerFacingCount = 0;

  for (const [nodeId, depth] of visited) {
    if (depth === 0) continue;
    if (depth > maxDepth) maxDepth = depth;
    const node = graphNodes.find((n) => n.id === nodeId);
    if (node?.classification === "customer-facing") customerFacingCount++;
  }

  return {
    affectedCount: visited.size - 1,
    maxDepth,
    customerFacingCount,
    isLoaded: true,
  };
}

export function SimulateDialog() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("postgres-primary");
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: targets } = useSimulateTargets();
  const { data: graph } = useServiceGraph();
  const { trigger: simulate, isMutating } = useSimulate();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    setMounted(true);
  }, []);

  const targetsWithStats = useMemo(() => {
    if (!graph || !targets?.services) return [];
    return targets.services.map((s) => ({
      ...s,
      ...computePreviewStats(s.name, graph.nodes, graph.edges),
    }));
  }, [graph, targets?.services]);

  const filteredTargets = targetsWithStats
    .filter((s) => s.affectedCount > 0)
    .sort((a, b) => b.affectedCount - a.affectedCount)
    .filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ownerTeam.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const selectedService = targets?.services?.find((s) => s.name === target);

  const preview = useMemo<PreviewStats>(() => {
    if (!graph || !target) return { affectedCount: 0, maxDepth: 0, customerFacingCount: 0, isLoaded: false };
    return computePreviewStats(target, graph.nodes, graph.edges);
  }, [target, graph]);

  const recommendedTarget = useMemo(() => {
    if (!graph || !targets?.services) return null;
    let best: { name: string; count: number } | null = null;
    for (const svc of targets.services) {
      const stats = computePreviewStats(svc.name, graph.nodes, graph.edges);
      if (!best || stats.affectedCount > best.count) {
        best = { name: svc.name, count: stats.affectedCount };
      }
    }
    return best;
  }, [graph, targets?.services]);

  useEffect(() => {
    if (filteredTargets.length > 0) {
      const exists = filteredTargets.find((s) => s.name === target);
      if (!exists) {
        setTarget(filteredTargets[0].name);
      }
    }
  }, [filteredTargets, target]);

  async function handleSimulate() {
    try {
      const result = await simulate({ serviceName: target, reset: true });
      await Promise.all([
        mutate("/api/incidents"),
        mutate("/api/graph"),
        mutate("/api/services"),
        mutate("/api/blast-radius"),
      ]);
      toast.error(`Failure injected: ${result.failedService}`, {
        description: `${result.blastRadiusCount} services affected · ${formatCompactDollars(result.totalRevenuePerMinDollars)}/min at risk · depth ${result.cascadeDepth}`,
      });
      setOpen(false);
    } catch (err) {
      toast.error("Simulation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const modalContent = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!isMutating) setOpen(false); }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.04] bg-[var(--fl-surface)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-red-500/10">
                    <AlertTriangle className="size-4 text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[var(--fl-text-primary)]">Simulate a service failure</h2>
                    <p className="text-[11px] text-[var(--fl-text-tertiary)]">Inject a failure to test the full cascade pipeline</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { if (!isMutating) setOpen(false); }}
                  className="flex size-7 items-center justify-center rounded-lg text-[var(--fl-text-tertiary)] transition-colors hover:bg-[var(--fl-surface-raised)] hover:text-[var(--fl-text-secondary)]"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="px-5 py-4">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                  Target service
                </label>

                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.04] bg-[var(--fl-surface-raised)] px-3 py-2.5 text-left transition-colors hover:border-[var(--fl-border-active)]"
                  >
                    {selectedService ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                          {selectedService.name}
                        </span>
                        <span className="text-[11px] text-[var(--fl-text-tertiary)]">
                          {formatOwnerTeam(selectedService.ownerTeam)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[13px] text-[var(--fl-text-tertiary)]">Select a service</span>
                    )}
                    <ChevronDown className={cn("size-3.5 text-[var(--fl-text-tertiary)] transition-transform duration-200", dropdownOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-hidden rounded-xl border border-white/[0.04] bg-[var(--fl-surface)] shadow-xl"
                      >
                        <div className="border-b border-white/[0.04] px-3 py-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-[var(--fl-text-tertiary)]" />
                            <input
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search..."
                              className="w-full rounded-lg border-0 bg-[var(--fl-surface-raised)] py-1.5 pl-7 pr-2 text-[12px] text-[var(--fl-text-primary)] outline-none placeholder:text-[var(--fl-text-tertiary)]"
                              style={{ fontFamily: "var(--font-mono)" }}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-44 overflow-y-auto scrollbar-thin">
                          {filteredTargets.map((s) => {
                            const cls = getClassificationColor(s.classification);
                            const isSelected = s.name === target;
                            const isRecommended = recommendedTarget?.name === s.name;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setTarget(s.name);
                                  setDropdownOpen(false);
                                  setSearchQuery("");
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors",
                                  isSelected
                                    ? "bg-indigo-500/[0.08] text-[var(--fl-text-primary)]"
                                    : "text-[var(--fl-text-secondary)] hover:bg-[var(--fl-surface-raised)]"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[12px] font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                                    {s.name}
                                  </span>
                                  <span className={cn("rounded-md px-1 py-0.5 text-[9px] font-semibold", cls.bg, cls.text)}>
                                    {s.classification === "customer-facing" ? "CF" : s.classification === "infrastructure" ? "Infra" : "Int"}
                                  </span>
                                  <span className="rounded bg-red-500/10 px-1 py-0.5 text-[9px] font-bold text-red-400" style={{ fontFamily: "var(--font-mono)" }}>
                                    {s.affectedCount}↓
                                  </span>
                                  {isRecommended && (
                                    <span className="flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-bold text-amber-400">
                                      <Star className="size-2" />
                                      widest
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-red-400" style={{ fontFamily: "var(--font-mono)" }}>
                                    {s.affectedCount} svc
                                  </span>
                                  <span className="text-[10px] text-[var(--fl-text-tertiary)]">{formatOwnerTeam(s.ownerTeam)}</span>
                                </div>
                              </button>
                            );
                          })}
                          {filteredTargets.length === 0 && (
                            <div className="px-3 py-4 text-center text-[11px] text-[var(--fl-text-tertiary)]">
                              No cascading services found
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.04] bg-[var(--fl-surface-raised)]">
                  {preview.isLoaded && preview.affectedCount > 0 ? (
                    <div className="grid grid-cols-3 gap-px border-b border-white/[0.04]">
                      <div className="flex flex-col items-center gap-1 px-2 py-3">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                          Affected
                        </span>
                        <span className="font-metric text-[18px] font-bold text-[var(--fl-text-primary)]">
                          {preview.affectedCount}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 border-x border-white/[0.04] px-2 py-3">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                          Depth
                        </span>
                        <span className="font-metric text-[18px] font-bold text-[var(--fl-text-primary)]">
                          {preview.maxDepth}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 px-2 py-3">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--fl-text-tertiary)]" style={{ fontFamily: "var(--font-mono)" }}>
                          Customer
                        </span>
                        <span className={cn(
                          "font-metric text-[18px] font-bold",
                          preview.customerFacingCount > 0 ? "text-red-400" : "text-[var(--fl-text-tertiary)]"
                        )}>
                          {preview.customerFacingCount}
                        </span>
                      </div>
                    </div>
                  ) : preview.isLoaded && preview.affectedCount === 0 ? (
                    <div className="flex items-center justify-center gap-2 border-b border-white/[0.04] px-3 py-3">
                      <GitBranch className="size-3.5 text-emerald-400" />
                      <span className="text-[11px] font-medium text-emerald-400">No downstream dependencies — isolated failure</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center border-b border-white/[0.04] px-3 py-3">
                      <span className="text-[11px] text-[var(--fl-text-tertiary)]">Loading graph data...</span>
                    </div>
                  )}

                  <div className="space-y-1.5 px-3.5 py-3">
                    {preview.isLoaded && preview.affectedCount > 0 ? (
                      <>
                        <p className="text-[11px] font-semibold text-[var(--fl-text-primary)]">
                          Simulating <span className="font-mono text-red-400">{target}</span> failure will:
                        </p>
                        <ul className="space-y-1 text-[11px] text-[var(--fl-text-tertiary)]">
                          <li className="flex items-start gap-1.5">
                            <span className="mt-1 size-1 shrink-0 rounded-full bg-red-500/50" />
                            Cascade to <span className="font-semibold text-[var(--fl-text-secondary)]">{preview.affectedCount} downstream {preview.affectedCount === 1 ? "service" : "services"}</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="mt-1 size-1 shrink-0 rounded-full bg-red-500/50" />
                            Propagate through <span className="font-semibold text-[var(--fl-text-secondary)]">{preview.maxDepth} dependency {preview.maxDepth === 1 ? "layer" : "layers"}</span>
                          </li>
                          {preview.customerFacingCount > 0 && (
                            <li className="flex items-start gap-1.5">
                              <span className="mt-1 size-1 shrink-0 rounded-full bg-red-500/50" />
                              Impact <span className="font-semibold text-red-400">{preview.customerFacingCount} customer-facing {preview.customerFacingCount === 1 ? "service" : "services"}</span> (direct revenue loss)
                            </li>
                          )}
                          <li className="flex items-start gap-1.5">
                            <span className="mt-1 size-1 shrink-0 rounded-full bg-amber-500/50" />
                            Reset all services to healthy first
                          </li>
                        </ul>
                      </>
                    ) : preview.isLoaded && preview.affectedCount === 0 ? (
                      <p className="text-[11px] text-[var(--fl-text-tertiary)]">
                        <span className="font-mono text-[var(--fl-text-secondary)]">{target}</span> has no downstream dependents. Failure will be contained to this service only.
                      </p>
                    ) : (
                      <p className="text-[11px] text-[var(--fl-text-tertiary)]">
                        Analyzing dependency graph...
                      </p>
                    )}

                    {recommendedTarget && recommendedTarget.name !== target && preview.isLoaded && (
                      <p className="pt-1 text-[11px] text-amber-400/80" style={{ fontFamily: "var(--font-mono)" }}>
                        Tip: {recommendedTarget.name} produces the widest cascade ({recommendedTarget.count} services).
                      </p>
                    )}
                    {recommendedTarget && recommendedTarget.name === target && preview.isLoaded && preview.affectedCount > 0 && (
                      <p className="pt-1 text-[11px] text-amber-400/80" style={{ fontFamily: "var(--font-mono)" }}>
                        This is the widest cascade in your graph ({preview.affectedCount} services).
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/[0.04] px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isMutating}
                  className="rounded-xl border border-white/[0.04] bg-[var(--fl-surface-raised)] px-4 py-2 text-[12px] font-medium text-[var(--fl-text-secondary)] transition-colors hover:bg-[var(--fl-surface)] hover:text-[var(--fl-text-primary)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSimulate}
                  disabled={isMutating}
                  className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-[12px] font-semibold text-white transition-all duration-200 hover:bg-red-500/90 hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isMutating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Injecting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-3.5" />
                      Reset &amp; inject
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3.5 py-1.5 text-[12px] font-semibold text-red-400 transition-all duration-200 hover:border-red-500/35 hover:bg-red-500/[0.1] hover:shadow-[0_0_16px_rgba(239,68,68,0.12)]"
      >
        <Zap className="size-3.5" />
        Simulate failure
      </button>

      {mounted ? createPortal(modalContent, document.body) : null}
    </>
  );
}