"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, Minus, Plus, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { DepthLegend } from "@/components/graph/depth-legend";
import { GraphSkeleton } from "@/components/shared/loading-skeleton";
import { NodeDetailPanel } from "@/components/graph/node-detail-panel";
import { useServiceGraph } from "@/lib/hooks/use-service-graph";
import { useIncident } from "@/lib/hooks/use-incident";
import {
  computeLayout,
  drawNode,
  drawLabel,
  drawShockwave,
  type LayoutNode,
} from "@/components/graph/service-node";
import { drawEdge, type LayoutEdge } from "@/components/graph/dependency-edge";
import {
  formatClassification,
  formatHealthStatus,
  formatOwnerTeam,
} from "@/lib/utils/format";

interface GraphCanvasProps {
  activeIncidentId: string | null;
}

interface Camera {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const CANVAS_W = 1200;
const CANVAS_H = 720;

const CASCADE_DEPTH_DELAY = 380;
const CASCADE_NODE_DURATION = 500;

function drawDotGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Camera,
  time: number
) {
  const spacing = 28;
  const driftX = (time * 0.004) % spacing;
  const driftY = (time * 0.0025) % spacing;
  const startX = Math.floor(-cam.offsetX / cam.scale / spacing) * spacing - spacing + driftX;
  const startY = Math.floor(-cam.offsetY / cam.scale / spacing) * spacing - spacing + driftY;
  const endX = startX + w / cam.scale + spacing * 4;
  const endY = startY + h / cam.scale + spacing * 4;

  ctx.fillStyle = "rgba(148, 163, 184, 0.04)";
  for (let x = startX; x < endX; x += spacing) {
    for (let y = startY; y < endY; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function isFiniteNum(v: number): boolean {
  return Number.isFinite(v) && !Number.isNaN(v);
}

function MiniMap({
  nodes,
  camera,
  containerW,
  containerH,
}: {
  nodes: LayoutNode[];
  camera: Camera;
  containerW: number;
  containerH: number;
}) {
  const mapW = 140;
  const mapH = 90;

  if (
    !isFiniteNum(camera.scale) ||
    camera.scale <= 0 ||
    !isFiniteNum(camera.offsetX) ||
    !isFiniteNum(camera.offsetY) ||
    containerW <= 0 ||
    containerH <= 0
  ) {
    return null;
  }

  if (containerW < 400) return null;

  const scaleX = mapW / CANVAS_W;
  const scaleY = mapH / CANVAS_H;

  const rawVpX = (-camera.offsetX / camera.scale) * scaleX;
  const rawVpY = (-camera.offsetY / camera.scale) * scaleY;
  const rawVpW = (containerW / camera.scale) * scaleX;
  const rawVpH = (containerH / camera.scale) * scaleY;

  if (!isFiniteNum(rawVpX) || !isFiniteNum(rawVpY) || !isFiniteNum(rawVpW) || !isFiniteNum(rawVpH)) {
    return null;
  }

  const vpX = Math.max(0, rawVpX);
  const vpY = Math.max(0, rawVpY);
  const vpW = Math.min(rawVpW, mapW);
  const vpH = Math.min(rawVpH, mapH);

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 z-10 overflow-hidden rounded-lg border border-white/[0.04] bg-[var(--fl-surface)]/80 shadow-lg backdrop-blur-sm"
      style={{ width: mapW, height: mapH }}
    >
      <div className="relative size-full">
        {nodes.map((n) => {
          const dotColor =
            n.depth === 0 ? "#ef4444" : n.depth > 0 ? "#f59e0b" : "#10b981";
          return (
            <div
              key={n.id}
              className="absolute rounded-full"
              style={{
                left: n.x * scaleX - 2,
                top: n.y * scaleY - 2,
                width: 4,
                height: 4,
                backgroundColor: dotColor,
                opacity: n.depth >= 0 ? 1 : 0.4,
              }}
            />
          );
        })}
        {vpW > 0 && vpH > 0 && (
          <div
            className="absolute border border-indigo-500/50 bg-indigo-500/[0.06]"
            style={{
              left: vpX,
              top: vpY,
              width: vpW,
              height: vpH,
            }}
          />
        )}
      </div>
    </div>
  );
}

export function GraphCanvas({ activeIncidentId }: GraphCanvasProps) {
  const { data: graph } = useServiceGraph();
  const { data: incident } = useIncident(activeIncidentId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<Camera>({ scale: 1, offsetX: 0, offsetY: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);
  const hasIncident = !!activeIncidentId;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);

  const cascadeStartRef = useRef(0);
  const resolutionStartRef = useRef(0);
  const wasIncidentRef = useRef(false);
  const lastDepthMapRef = useRef<Map<string, number>>(new Map());

  const [hovered, setHovered] = useState<{
    node: LayoutNode;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [, force] = useState(0);

  const touchRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
  } | null>(null);

  useEffect(() => {
    if (hasIncident) {
      cascadeStartRef.current = -1;
      resolutionStartRef.current = 0;
      wasIncidentRef.current = true;
    } else if (wasIncidentRef.current && cascadeStartRef.current !== 0) {
      resolutionStartRef.current = -1;
    }
  }, [hasIncident]);

  const toggleFullscreen = useCallback(async () => {
    const el = wrapperRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        // ignore
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const fitCamera = useCallback((width: number, height: number) => {
    const cam = cameraRef.current;
    const fit = Math.min(width / CANVAS_W, height / CANVAS_H) * 0.88;
    if (fit > 0 && isFinite(fit)) {
      cam.scale = fit;
      cam.offsetX = (width - CANVAS_W * fit) / 2;
      cam.offsetY = (height - CANVAS_H * fit) / 2;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      setContainerSize({ w: rect.width, h: rect.height });

      fitCamera(rect.width, rect.height);
      force((n) => n + 1);
    }, 150);

    return () => clearTimeout(timer);
  }, [isFullscreen, fitCamera]);

  const depthMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!incident) return map;
    map.set(incident.rootCause.serviceId, 0);
    for (const entry of incident.blastRadius) {
      if (!map.has(entry.serviceId)) {
        map.set(entry.serviceId, entry.depth);
      }
    }
    return map;
  }, [incident]);

  const layout = useMemo(() => {
    if (!graph) return null;
    const nodes = computeLayout(graph.nodes, graph.edges, CANVAS_W, CANVAS_H);
    const index = new Map(nodes.map((n) => [n.id, n]));
    const edges = graph.edges.reduce<LayoutEdge[]>((acc, e) => {
      const source = index.get(e.sourceServiceId);
      const target = index.get(e.targetServiceId);
      if (source && target) {
        acc.push({
          id: e.id,
          source,
          target,
          dependencyType: e.dependencyType,
          active: false,
        });
      }
      return acc;
    }, []);
    return { nodes, edges, index };
  }, [graph]);

  useEffect(() => {
    if (!layout) return;

    if (depthMap.size > 0) {
      lastDepthMapRef.current = new Map(depthMap);
    }

    const activeMap =
      depthMap.size > 0
        ? depthMap
        : wasIncidentRef.current
          ? lastDepthMapRef.current
          : depthMap;

    for (const n of layout.nodes) {
      n.depth = activeMap.has(n.id) ? (activeMap.get(n.id) as number) : -1;
    }
    for (const e of layout.edges) {
      e.active = e.source.depth >= 0 && e.target.depth >= 0;
    }
  }, [layout, depthMap]);

  useEffect(() => {
    setSelectedNode(null);
  }, [activeIncidentId]);

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !layout) return;

      if (cascadeStartRef.current === -1) cascadeStartRef.current = time;
      if (resolutionStartRef.current === -1) resolutionStartRef.current = time;

      const cam = cameraRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      let maxDepth = 0;
      for (const n of layout.nodes) {
        if (n.depth > maxDepth) maxDepth = n.depth;
      }

      const cascadeElapsed =
        hasIncident && cascadeStartRef.current > 0
          ? time - cascadeStartRef.current
          : 0;

      const isResolving =
        !hasIncident &&
        wasIncidentRef.current &&
        resolutionStartRef.current > 0;
      const resolutionElapsed = isResolving
        ? time - resolutionStartRef.current
        : 0;

      const resolutionDuration =
        (maxDepth + 1) * CASCADE_DEPTH_DELAY + CASCADE_NODE_DURATION + 1000;
      if (resolutionElapsed > resolutionDuration) {
        cascadeStartRef.current = 0;
        resolutionStartRef.current = 0;
        wasIncidentRef.current = false;
      }

      function getNodeProgress(node: LayoutNode): number {
        if (node.depth < 0) return hasIncident || isResolving ? 0 : 1;

        if (hasIncident) {
          const nodeDelay = node.depth * CASCADE_DEPTH_DELAY;
          return Math.min(
            1,
            Math.max(0, (cascadeElapsed - nodeDelay) / CASCADE_NODE_DURATION)
          );
        }

        if (isResolving) {
          const reverseDelay = (maxDepth - node.depth) * CASCADE_DEPTH_DELAY;
          return Math.max(
            0,
            1 -
              Math.max(
                0,
                (resolutionElapsed - reverseDelay) / CASCADE_NODE_DURATION
              )
          );
        }

        return 1;
      }

      const pulse =
        (Math.sin(time / 700) * 0.55 +
          Math.sin(time / 1300) * 0.3 +
          Math.sin(time / 2100) * 0.15 +
          1) /
        2;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      ctx.fillStyle = "#08090c";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(cam.offsetX, cam.offsetY);
      ctx.scale(cam.scale, cam.scale);

      drawDotGrid(ctx, w, h, cam, time);

      if (hasIncident && cascadeElapsed > 0) {
        const rootNode = layout.nodes.find((n) => n.depth === 0);
        if (rootNode) {
          drawShockwave(ctx, rootNode.x, rootNode.y, cascadeElapsed, maxDepth);
        }
      }

      if (isResolving && resolutionElapsed > 0) {
        const rootNode = layout.nodes.find((n) => n.depth === 0);
        if (rootNode) {
          const maxR = 520;
          const shrinkElapsed = resolutionElapsed;
          const radius = Math.max(0, maxR - (shrinkElapsed / 1000) * 220);
          if (radius > 10) {
            const alpha = 0.15 * (radius / maxR);
            ctx.beginPath();
            ctx.arc(rootNode.x, rootNode.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(16, 185, 129, " + alpha + ")";
            ctx.lineWidth = Math.max(0.5, 2 * (radius / maxR));
            ctx.stroke();
          }
        }
      }

      for (const edge of layout.edges) {
        const srcP = getNodeProgress(edge.source);
        const tgtP = getNodeProgress(edge.target);
        const edgeProgress = Math.max(srcP, tgtP);
        drawEdge(ctx, edge, {
          time,
          hasIncident,
          highlight: false,
          cascadeProgress: edgeProgress,
        });
      }

      for (const node of layout.nodes) {
        const progress = getNodeProgress(node);
        drawNode(ctx, node, {
          hovered: hovered?.node.id === node.id || selectedNode?.id === node.id,
          pulse,
          hasIncident,
          cascadeProgress: progress,
        });
      }

      for (const node of layout.nodes) {
        const progress = getNodeProgress(node);
        drawLabel(ctx, node, {
          hovered: hovered?.node.id === node.id || selectedNode?.id === node.id,
          hasIncident,
          cascadeProgress: progress,
        });
      }

      ctx.restore();
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    },
    [layout, hasIncident, hovered, selectedNode]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      setContainerSize({ w: rect.width, h: rect.height });

      fitCamera(rect.width, rect.height);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [layout, fitCamera]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const toVirtual = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const cam = cameraRef.current;
      if (cam.scale <= 0) return null;
      return {
        x: (clientX - rect.left - cam.offsetX) / cam.scale,
        y: (clientY - rect.top - cam.offsetY) / cam.scale,
      };
    },
    []
  );

  const hitTest = useCallback(
    (vx: number, vy: number): LayoutNode | null => {
      if (!layout) return null;
      const isMobile = containerSize.w < 640;
      const hitRadius = isMobile ? 20 : 4;
      for (const n of layout.nodes) {
        const dx = n.x - vx;
        const dy = n.y - vy;
        if (dx * dx + dy * dy <= (n.radius + hitRadius) ** 2) return n;
      }
      return null;
    },
    [layout, containerSize.w]
  );

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const cam = cameraRef.current;
      cam.offsetX += e.clientX - dragRef.current.x;
      cam.offsetY += e.clientY - dragRef.current.y;
      dragRef.current = { x: e.clientX, y: e.clientY };
      setHovered(null);
      return;
    }

    if (containerSize.w < 640) return;

    const v = toVirtual(e.clientX, e.clientY);
    if (!v) return;
    const node = hitTest(v.x, v.y);
    if (node) {
      const rect = canvasRef.current!.getBoundingClientRect();
      setHovered({
        node,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      });
    } else if (hovered) {
      setHovered(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      setHovered(null);
    }
    dragRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isMobile = containerSize.w < 640;
      const threshold = isMobile ? 10 : 4;

      if (dist < threshold) {
        const v = toVirtual(e.clientX, e.clientY);
        if (v) {
          const node = hitTest(v.x, v.y);
          if (node) {
            setSelectedNode((prev) => (prev?.id === node.id ? null : node));
          } else {
            setSelectedNode(null);
          }
        }
      }
    }

    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const cam = cameraRef.current;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    const next = Math.min(3, Math.max(0.3, cam.scale * (1 + delta)));
    cam.offsetX = mx - ((mx - cam.offsetX) * next) / cam.scale;
    cam.offsetY = my - ((my - cam.offsetY) * next) / cam.scale;
    cam.scale = next;
    force((n) => n + 1);
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.sqrt(
          Math.pow(t2.clientX - t1.clientX, 2) +
            Math.pow(t2.clientY - t1.clientY, 2)
        );
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        touchRef.current = { dist, midX, midY };
      }
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && touchRef.current) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const newDist = Math.sqrt(
          Math.pow(t2.clientX - t1.clientX, 2) +
            Math.pow(t2.clientY - t1.clientY, 2)
        );
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        const cam = cameraRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mx = midX - rect.left;
        const my = midY - rect.top;

        const ratio = newDist / touchRef.current.dist;
        const next = Math.min(3, Math.max(0.3, cam.scale * ratio));

        cam.offsetX = mx - ((mx - cam.offsetX) * next) / cam.scale;
        cam.offsetY = my - ((my - cam.offsetY) * next) / cam.scale;

        cam.offsetX += midX - touchRef.current.midX;
        cam.offsetY += midY - touchRef.current.midY;

        cam.scale = next;
        touchRef.current = { dist: newDist, midX, midY };
        force((n) => n + 1);
      }
    },
    []
  );

  const handleTouchEnd = useCallback(() => {
    touchRef.current = null;
  }, []);

  const zoom = (factor: number) => {
    const cam = cameraRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    const mx = (rect?.width ?? CANVAS_W) / 2;
    const my = (rect?.height ?? CANVAS_H) / 2;
    const next = Math.min(3, Math.max(0.3, cam.scale * factor));
    cam.offsetX = mx - ((mx - cam.offsetX) * next) / cam.scale;
    cam.offsetY = my - ((my - cam.offsetY) * next) / cam.scale;
    cam.scale = next;
    force((n) => n + 1);
  };

  const resetView = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    fitCamera(rect.width, rect.height);
    force((n) => n + 1);
  };

  if (!graph) return <GraphSkeleton />;

  const isMobile = containerSize.w < 640;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.04] bg-[var(--fl-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.25)]",
        isFullscreen && "!rounded-none !border-0 !shadow-none"
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.04] px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          <Workflow className="size-3.5 shrink-0 text-[var(--fl-text-tertiary)]" />
          <h3 className="text-[12px] font-semibold text-[var(--fl-text-primary)] sm:text-[13px]">
            Dependency graph
          </h3>
          <span
            className="hidden rounded-lg border border-white/[0.04] bg-[var(--fl-surface-raised)] px-1.5 py-0.5 text-[11px] text-[var(--fl-text-tertiary)] sm:inline-block"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {graph.meta.nodeCount} services · {graph.meta.edgeCount} edges
          </span>
          <span
            className="rounded-md border border-white/[0.04] bg-[var(--fl-surface-raised)] px-1 py-0.5 text-[10px] text-[var(--fl-text-tertiary)] sm:hidden"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {graph.meta.nodeCount}·{graph.meta.edgeCount}
          </span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={() => zoom(0.8)}
            className="flex size-7 items-center justify-center rounded-lg text-[var(--fl-text-tertiary)] transition-colors hover:bg-[var(--fl-surface-raised)] hover:text-[var(--fl-text-secondary)]"
            title="Zoom out"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            onClick={resetView}
            className="rounded-lg border border-white/[0.04] bg-[var(--fl-surface-raised)] px-2 py-1 text-[10px] font-medium text-[var(--fl-text-tertiary)] transition-colors hover:text-[var(--fl-text-secondary)] sm:px-2.5"
            style={{ fontFamily: "var(--font-mono)" }}
            title="Fit to view"
          >
            Fit
          </button>
          <button
            onClick={() => zoom(1.2)}
            className="flex size-7 items-center justify-center rounded-lg text-[var(--fl-text-tertiary)] transition-colors hover:bg-[var(--fl-surface-raised)] hover:text-[var(--fl-text-secondary)]"
            title="Zoom in"
          >
            <Plus className="size-3.5" />
          </button>
          <div className="mx-0.5 hidden h-3 w-px bg-white/[0.06] sm:block" />
          <button
            onClick={toggleFullscreen}
            className="hidden size-7 items-center justify-center rounded-lg text-[var(--fl-text-tertiary)] transition-colors hover:bg-[var(--fl-surface-raised)] hover:text-[var(--fl-text-secondary)] sm:flex"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "relative w-full touch-none",
          isFullscreen
            ? "h-[calc(100vh-44px)]"
            : "h-[500px] sm:h-[480px]"
        )}
      >
        <canvas
          ref={canvasRef}
          className="size-full cursor-grab active:cursor-grabbing"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            dragRef.current = null;
            setHovered(null);
          }}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {containerSize.w > 0 && containerSize.h > 0 && layout && (
          <MiniMap
            nodes={layout.nodes}
            camera={cameraRef.current}
            containerW={containerSize.w}
            containerH={containerSize.h}
          />
        )}

        <div className="absolute bottom-2.5 right-2.5 z-10 sm:bottom-3 sm:right-3">
          <DepthLegend />
        </div>

        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />

        {hovered && !selectedNode && !isMobile && (
          <div
            className="glass-panel pointer-events-none absolute z-20 w-52 rounded-xl px-3 py-2.5 text-[11px]"
            style={{
              left: Math.min(
                hovered.screenX + 14,
                (containerRef.current?.clientWidth ?? 0) - 220
              ),
              top: Math.max(hovered.screenY - 10, 8),
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className="size-1.5 rounded-full"
                style={{
                  backgroundColor:
                    hovered.node.depth >= 0 ? "#ef4444" : "#10b981",
                }}
              />
              <span
                className="font-semibold text-[var(--fl-text-primary)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {hovered.node.name}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <InfoRow
                label="Status"
                value={formatHealthStatus(hovered.node.healthStatus)}
              />
              <InfoRow
                label="Type"
                value={formatClassification(hovered.node.classification)}
              />
              <InfoRow
                label="Owner"
                value={formatOwnerTeam(hovered.node.ownerTeam)}
              />
              {hovered.node.depth >= 0 && (
                <InfoRow
                  label="Cascade"
                  value={
                    hovered.node.depth === 0
                      ? "Root cause"
                      : "Depth " + hovered.node.depth
                  }
                  accent
                />
              )}
              <span className="mt-1 text-[9px] text-[var(--fl-text-tertiary)] opacity-70">
                Click for details
              </span>
            </div>
          </div>
        )}

        {isMobile && !selectedNode && (
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-10">
            <div className="rounded-lg bg-[var(--fl-surface)]/80 px-2 py-1.5 text-[10px] text-[var(--fl-text-tertiary)] backdrop-blur-sm">
              Tap a node for details · Pinch to zoom · Drag to pan
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--fl-text-tertiary)]">{label}</span>
      <span
        className={cn(
          "font-medium",
          accent ? "text-red-400" : "text-[var(--fl-text-secondary)]"
        )}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </span>
    </div>
  );
}