"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, Workflow } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DepthLegend } from "@/components/graph/depth-legend";
import { GraphSkeleton } from "@/components/shared/loading-skeleton";
import { useServiceGraph } from "@/lib/hooks/use-service-graph";
import { useIncident } from "@/lib/hooks/use-incident";
import {
  computeLayout,
  drawNode,
  drawLabel,
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

export function GraphCanvas({ activeIncidentId }: GraphCanvasProps) {
  const { data: graph } = useServiceGraph();
  const { data: incident } = useIncident(activeIncidentId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<Camera>({ scale: 1, offsetX: 0, offsetY: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);
  const hasIncident = !!activeIncidentId;

  const [hovered, setHovered] = useState<{
    node: LayoutNode;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [, force] = useState(0);

  // Map of serviceId -> cascade depth (0 = root) from the live incident.
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

  // Build settled layout once per graph topology.
  const layout = useMemo(() => {
    if (!graph) return null;
    const nodes = computeLayout(graph.nodes, graph.edges, CANVAS_W, CANVAS_H);
    const index = new Map(nodes.map((n) => [n.id, n]));
    const edges: LayoutEdge[] = graph.edges
      .map((e) => {
        const source = index.get(e.sourceServiceId);
        const target = index.get(e.targetServiceId);
        if (!source || !target) return null;
        return {
          id: e.id,
          source,
          target,
          dependencyType: e.dependencyType,
          active: false,
        } satisfies LayoutEdge;
      })
      .filter((e): e is LayoutEdge => e !== null);
    return { nodes, edges, index };
  }, [graph]);

  // Apply live depth + active-edge state onto the layout.
  useEffect(() => {
    if (!layout) return;
    for (const n of layout.nodes) {
      n.depth = depthMap.has(n.id) ? (depthMap.get(n.id) as number) : -1;
    }
    for (const e of layout.edges) {
      e.active = e.source.depth >= 0 && e.target.depth >= 0;
    }
  }, [layout, depthMap]);

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !layout) return;

      const cam = cameraRef.current;
      const dpr = window.devicePixelRatio || 1;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.translate(cam.offsetX, cam.offsetY);
      ctx.scale(cam.scale, cam.scale);

      const pulse = (Math.sin(time / 600) + 1) / 2;

      for (const edge of layout.edges) {
        drawEdge(ctx, edge, {
          time,
          hasIncident,
          highlight: false,
        });
      }
      for (const node of layout.nodes) {
        drawNode(ctx, node, {
          hovered: hovered?.node.id === node.id,
          pulse,
          hasIncident,
        });
      }
      for (const node of layout.nodes) {
        drawLabel(ctx, node, {
          hovered: hovered?.node.id === node.id,
          hasIncident,
        });
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    },
    [layout, hasIncident, hovered]
  );

  // Resize canvas to container with DPR scaling.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // Fit the virtual canvas into the container on first measure.
      const cam = cameraRef.current;
      if (cam.offsetX === 0 && cam.offsetY === 0) {
        const fit = Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H);
        cam.scale = fit;
        cam.offsetX = (rect.width - CANVAS_W * fit) / 2;
        cam.offsetY = (rect.height - CANVAS_H * fit) / 2;
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [layout]);

  // Start/stop the render loop.
  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Pointer -> virtual coordinate transform for hit testing.
  const toVirtual = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const x = (clientX - rect.left - cam.offsetX) / cam.scale;
    const y = (clientY - rect.top - cam.offsetY) / cam.scale;
    return { x, y };
  }, []);

  const hitTest = useCallback(
    (vx: number, vy: number): LayoutNode | null => {
      if (!layout) return null;
      for (const n of layout.nodes) {
        const dx = n.x - vx;
        const dy = n.y - vy;
        if (dx * dx + dy * dy <= (n.radius + 3) ** 2) return n;
      }
      return null;
    },
    [layout]
  );

  const handlePointerMove = (e: React.PointerEvent) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };

    if (dragRef.current) {
      const cam = cameraRef.current;
      cam.offsetX += e.clientX - dragRef.current.x;
      cam.offsetY += e.clientY - dragRef.current.y;
      dragRef.current = { x: e.clientX, y: e.clientY };
      setHovered(null);
      return;
    }

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
    dragRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const cam = cameraRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    const next = Math.min(3, Math.max(0.3, cam.scale * (1 + delta)));
    // Zoom toward cursor.
    cam.offsetX = mx - ((mx - cam.offsetX) * next) / cam.scale;
    cam.offsetY = my - ((my - cam.offsetY) * next) / cam.scale;
    cam.scale = next;
    force((n) => n + 1);
  };

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
    const fit = Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H);
    cameraRef.current = {
      scale: fit,
      offsetX: (rect.width - CANVAS_W * fit) / 2,
      offsetY: (rect.height - CANVAS_H * fit) / 2,
    };
    force((n) => n + 1);
  };

  if (!graph) {
    return <GraphSkeleton />;
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Workflow className="size-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold">
            Dependency graph
          </h3>
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {graph.meta.nodeCount} services · {graph.meta.edgeCount} edges
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => zoom(1.2)}
            aria-label="Zoom in"
          >
            <Plus className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => zoom(0.8)}
            aria-label="Zoom out"
          >
            <Minus className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={resetView}
            aria-label="Reset view"
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[420px] w-full touch-none bg-[radial-gradient(circle_at_center,_var(--color-card)_0%,_var(--color-background)_100%)] md:h-[520px]"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            dragRef.current = null;
            setHovered(null);
          }}
          onWheel={handleWheel}
        />

        <div className="absolute bottom-3 left-3 z-10 max-w-[60%]">
          <DepthLegend />
        </div>

        {hovered && (
          <div
            className="pointer-events-none absolute z-20 w-56 rounded-lg border border-border bg-popover/95 p-3 text-xs shadow-xl backdrop-blur-sm"
            style={{
              left: Math.min(hovered.screenX + 14, (containerRef.current?.clientWidth ?? 0) - 230),
              top: Math.max(hovered.screenY - 10, 8),
            }}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-sm text-foreground">
                {hovered.node.name}
              </span>
            </div>
            <dl className="flex flex-col gap-1 text-muted-foreground">
              <Row label="Status" value={formatHealthStatus(hovered.node.healthStatus)} />
              <Row label="Type" value={formatClassification(hovered.node.classification)} />
              <Row label="Owner" value={formatOwnerTeam(hovered.node.ownerTeam)} />
              {hovered.node.depth >= 0 && (
                <Row
                  label="Cascade"
                  value={hovered.node.depth === 0 ? "Root cause" : `Depth ${hovered.node.depth}`}
                />
              )}
            </dl>
          </div>
        )}
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
