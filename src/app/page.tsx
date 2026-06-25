"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { ArrowRight, DollarSign, GitBranch, Shield, Zap, ChevronRight, Radio, Eye, TrendingDown, Activity, Server, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServiceGraph } from "@/lib/hooks/use-service-graph";

function useIncidents() {
  return { data: { activeCount: 0 } };
}

// ── Canvas Particle Background ──────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }> = [];
    const CONNECTION_DIST = 120;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = window.innerWidth + "px";
      canvas!.style.height = window.innerHeight + "px";
      ctx!.scale(dpr, dpr);
    }

    function init() {
      resize();
      const count = Math.min(80, Math.floor(window.innerWidth * 0.04));
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.3 + 0.05,
        });
      }
    }

    function draw(time: number) {
      if (!canvas || !ctx) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        const pulse = Math.sin(time * 0.001 + i) * 0.15 + 0.85;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * pulse, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, " + (p.alpha * pulse) + ")";
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.06;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = "rgba(99, 102, 241, " + alpha + ")";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    }

    init();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", init);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", init);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.6 }}
    />
  );
}

// ── Animated Counter with IntersectionObserver ──────────────────────
function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let current = 0;
    const duration = 2000;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      current = Math.floor(eased * target);
      setCount(current);
      if (progress < 1) requestAnimationFrame(tick);
      else setCount(target);
    }
    requestAnimationFrame(tick);
  }, [target, isVisible]);

  return (
    <span ref={ref} className="font-metric tabular-nums text-[40px] font-bold leading-none tracking-tight text-white sm:text-[52px] lg:text-[60px]">
      {prefix}{count}{suffix}
    </span>
  );
}

// ── Spotlight Mouse Effect ──────────────────────────────────────────
function MouseSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 20 });
  const springY = useSpring(y, { stiffness: 150, damping: 20 });

  useEffect(() => {
    function onMove(e: MouseEvent) {
      x.set(e.clientX);
      y.set(e.clientY);
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{
        background: useTransform(
          [springX, springY],
          ([lx, ly]) => "radial-gradient(600px circle at " + lx + "px " + ly + "px, rgba(99,102,241,0.04), transparent 60%)"
        ),
      }}
    />
  );
}

// ── SVG Graph Visualization ─────────────────────────────────────────
function HeroGraph() {
  const nodes = useMemo(() => [
    { id: "gateway", x: 200, y: 60, r: 18, color: "#818cf8", label: "api-gateway", layer: 0 },
    { id: "catalog", x: 80, y: 80, r: 14, color: "#818cf8", label: "product-catalog", layer: 0 },
    { id: "checkout", x: 320, y: 70, r: 14, color: "#818cf8", label: "checkout-api", layer: 0 },
    { id: "signup", x: 420, y: 60, r: 12, color: "#818cf8", label: "signup-flow", layer: 0 },
    { id: "fraud", x: 160, y: 160, r: 13, color: "#34d399", label: "fraud-detector", layer: 1 },
    { id: "cart", x: 280, y: 150, r: 11, color: "#34d399", label: "cart-service", layer: 1 },
    { id: "user", x: 60, y: 170, r: 11, color: "#34d399", label: "user-service", layer: 1 },
    { id: "inventory", x: 380, y: 165, r: 10, color: "#34d399", label: "inventory", layer: 1 },
    { id: "billing", x: 460, y: 155, r: 10, color: "#34d399", label: "billing", layer: 1 },
    { id: "analytics", x: 100, y: 240, r: 9, color: "#34d399", label: "analytics", layer: 1 },
    { id: "notification", x: 350, y: 240, r: 9, color: "#34d399", label: "notification", layer: 1 },
    { id: "postgres", x: 230, y: 300, r: 20, color: "#ef4444", label: "postgres-primary", layer: 2 },
    { id: "recommendation", x: 420, y: 290, r: 9, color: "#34d399", label: "recommendation", layer: 2 },
    { id: "payment", x: 130, y: 310, r: 10, color: "#34d399", label: "payment", layer: 2 },
  ], []);

  const edges = useMemo(() => [
    { from: "gateway", to: "catalog" },
    { from: "gateway", to: "checkout" },
    { from: "gateway", to: "signup" },
    { from: "catalog", to: "fraud" },
    { from: "catalog", to: "user" },
    { from: "checkout", to: "cart" },
    { from: "checkout", to: "billing" },
    { from: "signup", to: "inventory" },
    { from: "fraud", to: "postgres", active: true },
    { from: "cart", to: "postgres", active: true },
    { from: "user", to: "postgres", active: true },
    { from: "billing", to: "postgres", active: true },
    { from: "inventory", to: "postgres", active: true },
    { from: "analytics", to: "postgres", active: true },
    { from: "notification", to: "postgres", active: true },
    { from: "checkout", to: "analytics" },
    { from: "cart", to: "recommendation" },
    { from: "billing", to: "payment" },
    { from: "payment", to: "postgres", active: true },
  ], []);

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  function getCubicPath(from: typeof nodes[0], to: typeof nodes[0]) {
    const midY = (from.y + to.y) / 2;
    return "M" + from.x + "," + from.y + " C" + from.x + "," + midY + " " + to.x + "," + midY + " " + to.x + "," + to.y;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.2, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto mt-12 w-full max-w-[540px] sm:mt-16"
    >
      {/* Glow behind graph */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#08080c]/90 shadow-[0_8px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {/* Title bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.04] px-4 py-2.5">
          <div className="flex gap-1.5">
            <div className="size-2 rounded-full bg-[#ff5f57]/70" />
            <div className="size-2 rounded-full bg-[#ffbd2e]/70" />
            <div className="size-2 rounded-full bg-[#28c840]/70" />
          </div>
          <span className="ml-2 text-[10px] text-[#475569]" style={{ fontFamily: "var(--font-mono)" }}>
            dependency-graph.live
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-medium tracking-wider text-red-400/70" style={{ fontFamily: "var(--font-mono)" }}>LIVE</span>
          </div>
        </div>

        {/* SVG Graph */}
        <div className="relative px-2 py-3 sm:px-4 sm:py-5">
          <svg viewBox="0 0 500 360" className="w-full" style={{ height: "auto" }}>
            <defs>
              <filter id="glow-red">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-indigo">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="edge-active" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="edge-normal" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Edges */}
            {edges.map((edge, i) => {
              const from = nodeMap.get(edge.from)!;
              const to = nodeMap.get(edge.to)!;
              const path = getCubicPath(from, to);
              const pathId = "edge-path-" + i;
              return (
                <g key={pathId}>
                  <motion.path
                    d={path}
                    fill="none"
                    stroke={edge.active ? "url(#edge-active)" : "url(#edge-normal)"}
                    strokeWidth={edge.active ? 1.5 : 1}
                    strokeDasharray={edge.active ? "6 3" : "4 4"}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.2, delay: 1.2 + i * 0.05, ease: "easeOut" }}
                  />
                  {/* Traveling particle */}
                  {edge.active && (
                    <circle r="2.5" fill="#ef4444" opacity="0.9">
                      <animateMotion
                        dur={2.5 + i * 0.3 + "s"}
                        repeatCount="indefinite"
                        path={path}
                        begin={2 + i * 0.2 + "s"}
                      />
                    </circle>
                  )}
                  {!edge.active && i % 3 === 0 && (
                    <circle r="1.5" fill="#818cf8" opacity="0.5">
                      <animateMotion
                        dur={4 + i * 0.2 + "s"}
                        repeatCount="indefinite"
                        path={path}
                        begin={2.5 + i * 0.15 + "s"}
                      />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node, i) => (
              <motion.g
                key={node.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 1 + i * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {/* Outer glow */}
                {node.color === "#ef4444" && (
                  <>
                    <motion.circle
                      cx={node.x}
                      cy={node.y}
                      r={node.r + 12}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="1"
                      opacity="0"
                      animate={{ opacity: [0, 0.3, 0], r: [node.r + 8, node.r + 20, node.r + 8] }}
                      transition={{ duration: 3, repeat: Infinity, delay: 2 }}
                    />
                    <circle cx={node.x} cy={node.y} r={node.r + 6} fill="none" stroke="#ef4444" strokeWidth="0.5" opacity="0.2" filter="url(#glow-red)" />
                  </>
                )}
                {node.color === "#818cf8" && (
                  <circle cx={node.x} cy={node.y} r={node.r + 4} fill="none" stroke="#818cf8" strokeWidth="0.5" opacity="0.15" />
                )}

                {/* Node body */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill="#0d0e12"
                  stroke={node.color}
                  strokeWidth={node.color === "#ef4444" ? 2 : 1.2}
                  filter={node.color === "#ef4444" ? "url(#glow-red)" : node.color === "#818cf8" ? "url(#glow-indigo)" : undefined}
                />

                {/* Inner glow */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r - 3}
                  fill={node.color}
                  opacity={node.color === "#ef4444" ? 0.15 : 0.08}
                />

                {/* Center dot */}
                <circle cx={node.x} cy={node.y} r="2" fill={node.color} opacity="0.8" />

                {/* Label */}
                <motion.text
                  x={node.x}
                  y={node.y + node.r + 12}
                  textAnchor="middle"
                  fill={node.color === "#ef4444" ? "#ef4444" : "#64748b"}
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                  fontWeight={node.color === "#ef4444" ? "600" : "400"}
                  opacity={node.color === "#ef4444" ? 0.9 : 0.6}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: node.color === "#ef4444" ? 0.9 : 0.6 }}
                  transition={{ delay: 1.5 + i * 0.06 }}
                >
                  {node.label}
                </motion.text>
              </motion.g>
            ))}
          </svg>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-2">
          <span className="text-[9px] text-[#475569]" style={{ fontFamily: "var(--font-mono)" }}>14 services · 22 edges</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[9px] text-[#6366f1]/60" style={{ fontFamily: "var(--font-mono)" }}>
              <span className="size-1.5 rounded-full bg-[#818cf8]" /> CF
            </span>
            <span className="flex items-center gap-1 text-[9px] text-[#34d399]/60" style={{ fontFamily: "var(--font-mono)" }}>
              <span className="size-1.5 rounded-full bg-[#34d399]" /> Internal
            </span>
            <span className="flex items-center gap-1 text-[9px] text-[#ef4444]/60" style={{ fontFamily: "var(--font-mono)" }}>
              <span className="size-1.5 rounded-full bg-[#ef4444]" /> Infra
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Feature Card with Hover Effect ──────────────────────────────────
function FeatureCard({ icon: Icon, title, description, accent, delay }: {
  icon: any; title: string; description: string; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="group relative overflow-hidden rounded-2xl border border-white/[0.04] bg-[#0a0a0f] transition-all duration-500 hover:border-white/[0.08]">
        {/* Gradient hover glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: "radial-gradient(400px circle at 50% 0%, " + accent + "08, transparent 60%)" }}
        />
        {/* Top accent line */}
        <div
          className="absolute left-0 right-0 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: "linear-gradient(90deg, transparent, " + accent + "50, transparent)" }}
        />

        <div className="relative p-5 sm:p-6">
          <div
            className="mb-4 flex size-11 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110"
            style={{ background: accent + "0c", border: "1px solid " + accent + "18" }}
          >
            <Icon className="size-5" style={{ color: accent }} />
          </div>
          <h3 className="mb-2 text-[15px] font-semibold text-white sm:text-[16px]">{title}</h3>
          <p className="text-[13px] leading-[1.75] text-[#64748b]">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Hero Page ──────────────────────────────────────────────────
export default function HomePage() {
  const { data: graph } = useServiceGraph();
  const { data: incidents } = useIncidents();

  const nodeCount = graph?.meta?.nodeCount ?? 14;
  const edgeCount = graph?.meta?.edgeCount ?? 22;
  const hasActiveIncident = (incidents?.activeCount ?? 0) > 0;

  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } },
};

  return (
    <div className="relative min-h-[calc(100vh-52px)] overflow-hidden bg-[#040406]">
      <ParticleField />
      <MouseSpotlight />

      {/* Radial gradient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute left-1/2 top-0 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/3"
          style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 65%)" }}
        />
        <div
          className="absolute bottom-0 left-1/4 h-[500px] w-[500px] -translate-x-1/2 translate-y-1/3"
          style={{ background: "radial-gradient(ellipse, rgba(244,63,94,0.03) 0%, transparent 65%)" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">

        {/* ─── Hero Section ─── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center pt-16 pb-6 sm:pt-24 sm:pb-10 lg:pt-32 lg:pb-14"
        >
          {/* Status pill */}
          <motion.div variants={fadeUp} className="mb-8 sm:mb-10">
            <div className={cn(
              "group inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-[11px] font-medium tracking-wide backdrop-blur-sm",
              hasActiveIncident
                ? "border-red-500/20 bg-red-500/[0.04] text-red-400"
                : "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400"
            )} style={{ fontFamily: "var(--font-mono)" }}>
              <span className="relative flex size-2">
                <span className={cn(
                  "absolute inline-flex size-full animate-ping rounded-full opacity-40",
                  hasActiveIncident ? "bg-red-400" : "bg-emerald-400"
                )} />
                <span className={cn(
                  "relative inline-flex size-2 rounded-full",
                  hasActiveIncident ? "bg-red-500" : "bg-emerald-500"
                )} />
              </span>
              {hasActiveIncident ? "Active incident detected" : "All systems operational"}
              <ChevronRight className="size-3 opacity-30 transition-opacity group-hover:opacity-60" />
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-center text-[38px] font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-[56px] lg:text-[76px]"
          >
            Your blast radius.
            <br />
            <span
              className="inline-block bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #818cf8 0%, #a78bfa 30%, #f43f5e 70%, #fb923c 100%)" }}
            >
              Quantified.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="mt-5 max-w-[460px] text-center text-[14px] leading-[1.8] text-[#64748b] sm:mt-7 sm:text-[16px] lg:max-w-[520px]"
          >
            Map your service dependencies. Track the financial impact of every cascading failure. Resolve incidents faster with AI-powered root cause analysis.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeUp}
            className="mt-9 flex flex-col items-center gap-3 sm:mt-11 sm:flex-row sm:gap-4"
          >
            <Link
              href="/dashboard"
              className="group relative flex items-center gap-2.5 overflow-hidden rounded-xl bg-white px-8 py-3.5 text-[14px] font-semibold text-[#040406] shadow-[0_0_40px_rgba(99,102,241,0.12)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(99,102,241,0.2)] sm:px-10 sm:text-[15px]"
            >
              <span className="relative z-10">Enter Dashboard</span>
              <ArrowRight className="relative z-10 size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/services"
              className="flex items-center gap-2 rounded-xl border border-white/[0.07] px-8 py-3.5 text-[14px] font-medium text-[#94a3b8] backdrop-blur-sm transition-all duration-300 hover:border-white/[0.14] hover:text-white sm:px-10 sm:text-[15px]"
            >
              View Services
            </Link>
          </motion.div>
        </motion.div>

        {/* ─── Live Stats Grid ─── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto grid max-w-[780px] grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.02]"
        >
          {[
            { value: nodeCount, suffix: "", prefix: "", label: "Services mapped", accent: "indigo" },
            { value: edgeCount, suffix: "", prefix: "", label: "Dependency edges", accent: "purple" },
            { value: 10, suffix: "K", prefix: "$", label: "Max revenue at risk/min", accent: "red" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
              className="group flex flex-col items-center gap-2 bg-[#08080c] px-3 py-5 transition-colors duration-300 hover:bg-[#0c0c12] sm:px-6 sm:py-7"
            >
              <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
              <span
                className="text-[9px] font-medium uppercase tracking-[0.15em] text-[#475569] sm:text-[10px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {stat.label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* ─── Graph Preview ─── */}
        <HeroGraph />

        {/* ─── Features ─── */}
        <div className="mx-auto mt-16 grid max-w-[960px] grid-cols-1 gap-4 sm:mt-24 sm:grid-cols-3 sm:gap-5">
          <FeatureCard
            icon={Eye}
            title="Dependency Mapping"
            description="Auto-discover your service dependency graph. Every edge, every connection, visualized in real time."
            accent="#818cf8"
            delay={0}
          />
          <FeatureCard
            icon={TrendingDown}
            title="Revenue Blast Radius"
            description="Quantify the financial impact of every outage. See exactly how much each cascading failure costs per minute."
            accent="#f43f5e"
            delay={0.1}
          />
          <FeatureCard
            icon={Shield}
            title="AI Root Cause Analysis"
            description="Instantly identify the root cause and get ranked fix priorities powered by upstream dependency analysis."
            accent="#10b981"
            delay={0.2}
          />
        </div>

        {/* ─── How It Works ─── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-20 max-w-[700px] sm:mt-28"
        >
          <div className="text-center">
            <span
              className="mb-3 inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400/50 sm:text-[11px]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              How it works
            </span>
            <h2 className="text-[24px] font-bold text-white sm:text-[30px]">
              Three steps to incident clarity
            </h2>
          </div>

          <div className="mt-10">
            {[
              { step: "01", title: "Map", desc: "Your service dependency graph is auto-discovered — 14 services, 22 edges, zero config.", icon: GitBranch, accent: "#818cf8" },
              { step: "02", title: "Detect", desc: "Real-time health monitoring catches failures the moment they happen and traces the cascade.", icon: Activity, accent: "#f59e0b" },
              { step: "03", title: "Quantify", desc: "Revenue impact, blast radius, and AI-powered fix priority — all in one view.", icon: DollarSign, accent: "#f43f5e" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className="group flex items-start gap-5 border-b border-white/[0.04] py-6 last:border-0 sm:gap-7 sm:py-7"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <span
                      className="font-metric text-[13px] font-bold sm:text-[15px]"
                      style={{ color: item.accent, fontFamily: "var(--font-mono)" }}
                    >
                      {item.step}
                    </span>
                    <div
                      className="flex size-9 items-center justify-center rounded-xl sm:size-10"
                      style={{ background: item.accent + "0c", border: "1px solid " + item.accent + "15" }}
                    >
                      <Icon className="size-4" style={{ color: item.accent }} />
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-1 text-[15px] font-semibold text-white sm:text-[16px]">{item.title}</h3>
                    <p className="text-[13px] leading-[1.75] text-[#64748b]">{item.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Bottom CTA ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="mt-20 pb-20 text-center sm:mt-28 sm:pb-28"
        >
          <h2 className="text-[22px] font-bold text-white sm:text-[28px]">
            Ready to see your blast radius?
          </h2>
          <p className="mt-3 text-[13px] text-[#64748b] sm:text-[14px]">
            Simulate failures. Track cascades. Quantify revenue loss. All in real time.
          </p>
          <div className="mt-7 flex justify-center sm:mt-8">
            <Link
              href="/dashboard"
              className="group flex items-center gap-2.5 rounded-xl bg-white px-8 py-3.5 text-[14px] font-semibold text-[#040406] shadow-[0_0_40px_rgba(99,102,241,0.1)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(99,102,241,0.18)] sm:text-[15px]"
            >
              <Zap className="size-4 text-indigo-500" />
              Launch Dashboard
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Tech stack badges */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-2.5 sm:mt-12"
          >
            {["Next.js", "Aurora PostgreSQL", "AWS Bedrock", "Vercel"].map((tech) => (
              <span
                key={tech}
                className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-1.5 text-[10px] font-medium text-[#475569] backdrop-blur-sm transition-colors duration-200 hover:border-white/[0.08] hover:text-[#64748b] sm:text-[11px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {tech}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}