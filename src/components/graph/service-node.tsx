// Pure Canvas 2D draw + layout helpers for the dependency graph.
// Kept framework-agnostic so the render loop in graph-canvas.tsx stays lean.

import {
  getClassificationColor,
  getHealthStatusColor,
} from "@/lib/utils/colors";
import type { GraphNode, GraphEdge } from "@/lib/types";

export interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** -1 = not affected, 0 = root, >0 = cascade depth */
  depth: number;
}

const RADIUS_BY_CLASS: Record<string, number> = {
  "customer-facing": 22,
  infrastructure: 20,
  internal: 16,
};

export function nodeRadius(classification: string): number {
  return RADIUS_BY_CLASS[classification] ?? 16;
}

/**
 * Deterministic seeded force-directed layout. Runs synchronously for a fixed
 * number of iterations to settle node positions before the render loop starts.
 */
export function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): LayoutNode[] {
  const cx = width / 2;
  const cy = height / 2;

  // Seed positions on a circle (deterministic, no layout jitter between loads).
  const layout: LayoutNode[] = nodes.map((n, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    const r = Math.min(width, height) * 0.32;
    return {
      ...n,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
      radius: nodeRadius(n.classification),
      depth: -1,
    };
  });

  const index = new Map(layout.map((n) => [n.id, n]));
  const links = edges
    .map((e) => ({
      s: index.get(e.sourceServiceId),
      t: index.get(e.targetServiceId),
    }))
    .filter((l): l is { s: LayoutNode; t: LayoutNode } => !!l.s && !!l.t);

  const iterations = 240;
  const k = Math.sqrt((width * height) / Math.max(1, layout.length)) * 0.55;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    // Repulsion between every pair.
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const a = layout[i];
        const b = layout[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < 1) dist = 1;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Attraction along edges.
    for (const { s, t } of links) {
      const dx = s.x - t.x;
      const dy = s.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx -= fx;
      s.vy -= fy;
      t.vx += fx;
      t.vy += fy;
    }

    // Gentle pull toward center + integrate.
    for (const n of layout) {
      n.vx += (cx - n.x) * 0.012;
      n.vy += (cy - n.y) * 0.012;
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      const max = 24 * cooling + 1;
      const scale = speed > max ? max / speed : 1;
      n.x += n.vx * scale * 0.5;
      n.y += n.vy * scale * 0.5;
      n.vx *= 0.85;
      n.vy *= 0.85;
      const pad = 40;
      n.x = Math.max(pad, Math.min(width - pad, n.x));
      n.y = Math.max(pad, Math.min(height - pad, n.y));
    }
  }

  return layout;
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function drawNode(
  ctx: CanvasRenderingContext2D,
  node: LayoutNode,
  opts: {
    hovered: boolean;
    pulse: number;
    hasIncident: boolean;
  }
) {
  const { hovered, pulse, hasIncident } = opts;
  const affected = node.depth >= 0;
  const isRoot = node.depth === 0;

  const health = getHealthStatusColor(node.healthStatus);
  const cls = getClassificationColor(node.classification);

  // Dim unaffected nodes during an incident to focus attention on the cascade.
  const alpha = hasIncident && !affected ? 0.28 : 1;
  ctx.globalAlpha = alpha;

  // Halo / shockwave ring for affected nodes.
  if (affected) {
    const ringColor = isRoot ? "#ef4444" : health.fill;
    const ringR = node.radius + 8 + pulse * 8;
    ctx.beginPath();
    ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.globalAlpha = alpha * (0.5 - pulse * 0.4);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }

  // Outer glow.
  ctx.save();
  ctx.shadowBlur = hovered ? 26 : affected ? 18 : 8;
  ctx.shadowColor = affected ? health.fill : cls.fill;

  // Node body.
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#0a0a0b";
  ctx.fill();
  ctx.restore();

  // Inner fill ring (health or classification tint).
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.radius - 4, 0, Math.PI * 2);
  ctx.fillStyle = affected
    ? hexWithAlpha(health.fill, 0.18)
    : hexWithAlpha(cls.fill, 0.12);
  ctx.fill();

  // Border.
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
  ctx.lineWidth = hovered ? 2.5 : 1.5;
  ctx.strokeStyle = affected ? health.fill : cls.fill;
  ctx.stroke();

  // Center status dot.
  ctx.beginPath();
  ctx.arc(node.x, node.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = health.fill;
  ctx.fill();

  ctx.globalAlpha = 1;
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  node: LayoutNode,
  opts: { hovered: boolean; hasIncident: boolean }
) {
  const affected = node.depth >= 0;
  if (opts.hasIncident && !affected && !opts.hovered) return;

  ctx.globalAlpha = opts.hovered ? 1 : affected ? 0.92 : 0.6;
  ctx.font =
    '500 11px ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = opts.hovered ? "#fafafa" : "#a1a1aa";
  ctx.fillText(node.name, node.x, node.y + node.radius + 6);
  ctx.globalAlpha = 1;
}
