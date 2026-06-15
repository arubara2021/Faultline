// Pure Canvas 2D edge draw helpers.

import { getDependencyTypeColor } from "@/lib/utils/colors";
import { hexWithAlpha, type LayoutNode } from "./service-node";

export interface LayoutEdge {
  id: string;
  source: LayoutNode;
  target: LayoutNode;
  dependencyType: string;
  /** True when both endpoints are part of the active cascade. */
  active: boolean;
}

export function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: LayoutEdge,
  opts: { time: number; hasIncident: boolean; highlight: boolean }
) {
  const { source: s, target: t } = edge;
  const color = getDependencyTypeColor(edge.dependencyType);

  const dim = opts.hasIncident && !edge.active;
  const baseAlpha = dim ? 0.08 : edge.active ? 0.55 : 0.22;

  // Edge line.
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(t.x, t.y);
  ctx.strokeStyle = hexWithAlpha(color, baseAlpha);
  ctx.lineWidth = edge.active ? 1.8 : 1;
  ctx.stroke();

  // Animated particle flowing source -> target to convey traffic direction.
  const showParticles = opts.highlight || edge.active || !opts.hasIncident;
  if (showParticles) {
    const speed = edge.active ? 0.0009 : 0.0004;
    const count = edge.active ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const phase = (((opts.time * speed + i / count) % 1) + 1) % 1;
      const px = s.x + (t.x - s.x) * phase;
      const py = s.y + (t.y - s.y) * phase;
      ctx.beginPath();
      ctx.arc(px, py, edge.active ? 2.2 : 1.6, 0, Math.PI * 2);
      ctx.fillStyle = hexWithAlpha(color, edge.active ? 0.95 : 0.6);
      ctx.fill();
    }
  }
}
