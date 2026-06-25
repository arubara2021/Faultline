import { getDependencyTypeColor } from "@/lib/utils/colors";
import { hexWithAlpha, type LayoutNode } from "./service-node";

export interface LayoutEdge {
  id: string;
  source: LayoutNode;
  target: LayoutNode;
  dependencyType: string;
  active: boolean;
}

function getDashPattern(depType: string): number[] {
  switch (depType) {
    case "database_access":
      return [6, 4];
    case "message_queue":
      return [2, 4];
    case "shared_cache":
      return [8, 3, 2, 3];
    default:
      return [];
  }
}

function getCurveControl(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  offset: number
): { cpx: number; cpy: number } {
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  return {
    cpx: mx + nx * offset,
    cpy: my + ny * offset,
  };
}

function quadBezierPoint(
  sx: number,
  sy: number,
  cpx: number,
  cpy: number,
  tx: number,
  ty: number,
  t: number
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * sx + 2 * mt * t * cpx + t * t * tx,
    y: mt * mt * sy + 2 * mt * t * cpy + t * t * ty,
  };
}

export function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: LayoutEdge,
  opts: {
    time: number;
    hasIncident: boolean;
    highlight: boolean;
    cascadeProgress: number;
    canvasWidth?: number;
  }
) {
  const { source: s, target: t } = edge;
  const color = getDependencyTypeColor(edge.dependencyType);
  const { cascadeProgress } = opts;

  const canvasW = opts.canvasWidth ?? 1200;
  const isCompact = canvasW < 500;

  const dim = opts.hasIncident && !edge.active;
  let baseAlpha = dim ? 0.04 : edge.active ? 0.5 : 0.18;

  if (edge.active && opts.hasIncident) {
    baseAlpha = 0.08 + cascadeProgress * 0.5;
  }

  const dist = Math.sqrt((t.x - s.x) ** 2 + (t.y - s.y) ** 2);
  const curveOffset = Math.min(dist * 0.12, 30);
  const { cpx, cpy } = getCurveControl(s.x, s.y, t.x, t.y, curveOffset);

  const dash = getDashPattern(edge.dependencyType);

  ctx.save();

  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
  ctx.strokeStyle = hexWithAlpha(color, baseAlpha);
  ctx.lineWidth = edge.active ? 1 + 0.8 * cascadeProgress : 1;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);

  const showParticles = !isCompact && (opts.highlight || edge.active || !opts.hasIncident);
  if (showParticles && cascadeProgress > 0.2) {
    const particleAlpha = Math.min(1, (cascadeProgress - 0.2) / 0.6);
    const speed = edge.active ? 0.0008 : 0.00035;
    const count = edge.active ? 3 : 1;

    for (let i = 0; i < count; i++) {
      const phase = (((opts.time * speed + i / count) % 1) + 1) % 1;
      const p = quadBezierPoint(s.x, s.y, cpx, cpy, t.x, t.y, phase);

      ctx.beginPath();
      ctx.arc(p.x, p.y, edge.active ? 2.2 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = hexWithAlpha(color, (edge.active ? 0.9 : 0.5) * particleAlpha);
      ctx.fill();
    }
  }

  if (!isCompact && edge.active && cascadeProgress > 0.5 && opts.hasIncident) {
    const glowAlpha = (cascadeProgress - 0.5) * 0.2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.strokeStyle = hexWithAlpha(color, glowAlpha);
    ctx.lineWidth = 5;
    ctx.filter = "blur(3px)";
    ctx.stroke();
    ctx.filter = "none";
  }

  ctx.restore();
}