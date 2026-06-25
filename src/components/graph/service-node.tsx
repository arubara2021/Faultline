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
  depth: number;
}

const RADIUS_BY_CLASS: Record<string, number> = {
  "customer-facing": 24,
  infrastructure: 22,
  internal: 17,
};

const LAYER_ORDER: Record<string, number> = {
  "customer-facing": 0,
  internal: 1,
  infrastructure: 2,
};

export function nodeRadius(classification: string): number {
  return RADIUS_BY_CLASS[classification] ?? 17;
}

export function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): LayoutNode[] {
  const layers: GraphNode[][] = [[], [], []];
  for (const n of nodes) {
    const l = LAYER_ORDER[n.classification] ?? 1;
    layers[l].push(n);
  }

  const topPad = 90;
  const bottomPad = 90;
  const usableH = height - topPad - bottomPad;
  const layerY = [
    topPad + usableH * 0.1,
    topPad + usableH * 0.5,
    topPad + usableH * 0.9,
  ];

  const index = new Map<string, GraphNode>();
  for (const n of nodes) index.set(n.id, n);

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.sourceServiceId)) adj.set(e.sourceServiceId, []);
    if (!adj.has(e.targetServiceId)) adj.set(e.targetServiceId, []);
    adj.get(e.sourceServiceId)!.push(e.targetServiceId);
    adj.get(e.targetServiceId)!.push(e.sourceServiceId);
  }

  function barycenterOrder(layer: GraphNode[], refLayer: GraphNode[]): GraphNode[] {
    const refX = new Map(refLayer.map((n, i) => [n.id, i]));
    const scored = layer.map((n) => {
      const neighbors = (adj.get(n.id) ?? [])
        .map((id) => refX.get(id))
        .filter((v) => v !== undefined) as number[];
      const avg = neighbors.length > 0
        ? neighbors.reduce((a, b) => a + b, 0) / neighbors.length
        : 0;
      return { node: n, score: avg };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.node);
  }

  if (layers[0].length > 0 && layers[1].length > 0) {
    layers[1] = barycenterOrder(layers[1], layers[0]);
  }
  if (layers[1].length > 0 && layers[2].length > 0) {
    layers[2] = barycenterOrder(layers[2], layers[1]);
  }

  const layout: LayoutNode[] = [];
  const hPad = 80;
  for (let l = 0; l < 3; l++) {
    const row = layers[l];
    if (row.length === 0) continue;
    const spacing = (width - hPad * 2) / (row.length + 1);
    for (let i = 0; i < row.length; i++) {
      layout.push({
        ...row[i],
        x: hPad + spacing * (i + 1),
        y: layerY[l],
        vx: 0,
        vy: 0,
        radius: nodeRadius(row[i].classification),
        depth: -1,
      });
    }
  }

  const lIndex = new Map(layout.map((n) => [n.id, n]));
  const links = edges
    .map((e) => ({
      s: lIndex.get(e.sourceServiceId),
      t: lIndex.get(e.targetServiceId),
    }))
    .filter((l): l is { s: LayoutNode; t: LayoutNode } => !!l.s && !!l.t);

  const iterations = 80;
  const k = Math.sqrt((width * height) / Math.max(1, layout.length)) * 0.5;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const a = layout[i];
        const b = layout[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < 1) dist = 1;
        const repulse = (k * k) / dist;
        const fx = (dx / dist) * repulse;
        const fy = (dy / dist) * repulse;
        a.vx += fx;
        a.vy += fy * 0.2;
        b.vx -= fx;
        b.vy -= fy * 0.2;
      }
    }

    for (const { s, t } of links) {
      const dx = s.x - t.x;
      const dy = s.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const attract = (dist * dist) / k;
      const fx = (dx / dist) * attract;
      const fy = (dy / dist) * attract;
      s.vx -= fx * 0.4;
      s.vy -= fy * 0.1;
      t.vx += fx * 0.4;
      t.vy += fy * 0.1;
    }

    for (const n of layout) {
      const layerTarget = layerY[LAYER_ORDER[n.classification] ?? 1];
      n.vy += (layerTarget - n.y) * 0.12;
      n.vx += (width / 2 - n.x) * 0.003;

      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      const max = 14 * cooling + 0.5;
      const scale = speed > max ? max / speed : 1;
      n.x += n.vx * scale * 0.35;
      n.y += n.vy * scale * 0.35;
      n.vx *= 0.78;
      n.vy *= 0.78;

      const pad = 60;
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
  return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function drawShockwave(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  elapsed: number,
  _maxDepth: number
) {
  if (elapsed <= 0) return;

  const waves = 3;
  const waveDelay = 320;
  const speed = 220;
  const maxRadius = 520;

  for (let w = 0; w < waves; w++) {
    const waveElapsed = elapsed - w * waveDelay;
    if (waveElapsed < 0) continue;

    const radius = (waveElapsed / 1000) * speed;
    if (radius > maxRadius) continue;

    const progress = radius / maxRadius;
    const alpha = Math.max(0, 0.22 * (1 - progress * progress));
    const lineWidth = Math.max(0.3, 2.8 * (1 - progress));

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(239, 68, 68, " + alpha + ")";
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function drawNode(
  ctx: CanvasRenderingContext2D,
  node: LayoutNode,
  opts: {
    hovered: boolean;
    pulse: number;
    hasIncident: boolean;
    cascadeProgress: number;
  }
) {
  const { hovered, pulse, hasIncident, cascadeProgress } = opts;
  const affected = node.depth >= 0;
  const isRoot = node.depth === 0;
  const health = getHealthStatusColor(node.healthStatus);
  const cls = getClassificationColor(node.classification);

  const eased = easeOutCubic(cascadeProgress);

  let alpha = 1;
  if (hasIncident) {
    alpha = affected ? 0.12 + eased * 0.88 : 0.12;
  }
  ctx.globalAlpha = alpha;

  const nodeScale = affected && hasIncident ? 0.45 + eased * 0.55 : 1;

  ctx.save();
  if (nodeScale < 0.99) {
    ctx.translate(node.x, node.y);
    ctx.scale(nodeScale, nodeScale);
    ctx.translate(-node.x, -node.y);
  }

  if (affected && cascadeProgress > 0 && cascadeProgress < 0.2) {
    const flashAlpha = ((0.2 - cascadeProgress) / 0.2) * 0.55;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, " + flashAlpha + ")";
    ctx.fill();
  }

  if (affected && cascadeProgress > 0.3) {
    const ringAlpha = Math.min(1, (cascadeProgress - 0.3) / 0.7);
    const ringColor = isRoot ? "#ef4444" : health.fill;
    const ringR = node.radius + 10 + pulse * 10;

    ctx.beginPath();
    ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.globalAlpha = alpha * (0.4 - pulse * 0.35) * ringAlpha;
    ctx.lineWidth = isRoot ? 2.5 : 1.5;
    ctx.stroke();
    ctx.globalAlpha = alpha;

    if (isRoot) {
      const outerR = node.radius + 20 + pulse * 18;
      ctx.beginPath();
      ctx.arc(node.x, node.y, outerR, 0, Math.PI * 2);
      ctx.strokeStyle = ringColor;
      ctx.globalAlpha = alpha * (0.15 - pulse * 0.12) * ringAlpha;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }
  }

  const glowSize = hovered
    ? 28
    : affected
    ? 4 + 20 * eased
    : hasIncident
    ? 2
    : 10;
  const glowColor = affected ? health.fill : cls.fill;

  ctx.save();
  ctx.shadowBlur = glowSize;
  ctx.shadowColor = glowColor;
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#0d0e12";
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(node.x, node.y, node.radius - 3, 0, Math.PI * 2);
  ctx.fillStyle = affected
    ? hexWithAlpha(health.fill, 0.08 + 0.08 * eased)
    : hexWithAlpha(cls.fill, 0.08);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
  ctx.lineWidth = hovered ? 2.5 : affected ? 1 + eased : 1.2;
  ctx.strokeStyle = affected
    ? hexWithAlpha(health.fill, 0.4 + 0.6 * eased)
    : hexWithAlpha(cls.fill, 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = health.fill;
  ctx.fill();

  if (node.classification === "customer-facing") {
    const sx = node.x + node.radius - 5;
    const sy = node.y - node.radius + 5;
    const sz = 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy - sz);
    ctx.lineTo(sx + sz * 0.6, sy + sz * 0.3);
    ctx.lineTo(sx - sz * 0.6, sy + sz * 0.3);
    ctx.closePath();
    ctx.fillStyle = hexWithAlpha(cls.fill, 0.7);
    ctx.fill();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function abbreviateName(name: string, isCompact: boolean): string {
  if (!isCompact) return name;
  if (name.length <= 12) return name;
  const parts = name.split("-");
  if (parts.length >= 2) {
    return parts.map((p) => p.substring(0, 4)).join("-");
  }
  return name.substring(0, 10) + "..";
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  node: LayoutNode,
  opts: {
    hovered: boolean;
    hasIncident: boolean;
    cascadeProgress: number;
    canvasWidth?: number;
  }
) {
  const affected = node.depth >= 0;
  const { cascadeProgress } = opts;

  const canvasW = opts.canvasWidth ?? 1200;
  const isCompact = canvasW < 500;

  if (isCompact && opts.hasIncident && !affected && !opts.hovered) return;

  const labelAlpha = affected
    ? cascadeProgress * (opts.hovered ? 1 : 0.9)
    : opts.hovered
    ? 1
    : opts.hasIncident
    ? 0.12
    : 0.55;

  if (labelAlpha < 0.01) return;

  ctx.globalAlpha = labelAlpha;

  const fontSize = isCompact ? 8.5 : 10.5;
  ctx.font = "500 " + fontSize + 'px ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const displayName = abbreviateName(node.name, isCompact);
  const textWidth = ctx.measureText(displayName).width;
  const halfText = textWidth / 2;

  let labelX = node.x;
  if (node.x - halfText < 4) {
    labelX = halfText + 4;
    ctx.textAlign = "left";
  } else if (node.x + halfText > canvasW - 4) {
    labelX = canvasW - halfText - 4;
    ctx.textAlign = "right";
  }

  const labelOffset = isCompact ? 6 : 8;
  ctx.fillStyle = opts.hovered ? "#f1f5f9" : "#94a3b8";
  ctx.fillText(displayName, labelX, node.y + node.radius + labelOffset);

  if (!isCompact && node.classification === "customer-facing" && !opts.hasIncident) {
    ctx.textAlign = "center";
    ctx.font = '400 9px ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = hexWithAlpha("#3b82f6", 0.6);
    let subX = node.x;
    const subWidth = ctx.measureText("customer").width;
    if (node.x - subWidth / 2 < 4) subX = subWidth / 2 + 4;
    else if (node.x + subWidth / 2 > canvasW - 4) subX = canvasW - subWidth / 2 - 4;
    ctx.fillText("customer", subX, node.y + node.radius + 20);
  }

  ctx.globalAlpha = 1;
}