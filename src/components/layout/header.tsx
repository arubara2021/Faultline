"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SimulateDialog } from "@/components/simulate/simulate-dialog";

function FaultlineLogo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative flex size-[26px] items-center justify-center rounded-md border border-[var(--fl-border-active)] bg-[var(--fl-surface-raised)] transition-all duration-300 hover:border-indigo-500/40 hover:shadow-[0_0_12px_rgba(99,102,241,0.15)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fl-text-secondary)]">
          <line x1="2" y1="10" x2="8" y2="10" />
          <line x1="16" y1="10" x2="22" y2="10" />
          <path d="M8 10 L11 7 L14 13 L16 10" />
        </svg>
      </div>
      <span className="font-mono text-[13px] font-semibold tracking-tight text-[var(--fl-text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
        faultline
      </span>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/services", label: "Services" },
];

export function Header() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[52px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
        <div className="flex items-center gap-7">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <FaultlineLogo />
          </Link>

          <nav ref={navRef} className="relative hidden items-center gap-0.5 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200",
                    active ? "text-[var(--fl-text-primary)]" : "text-[var(--fl-text-tertiary)] hover:text-[var(--fl-text-secondary)]"
                  )}
                >
                  {item.label}
                  {active && (
                    <motion.div
                      layoutId="nav-active-indicator"
                      className="absolute inset-x-3.5 -bottom-[11px] h-[2px] rounded-full bg-indigo-500"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-2 rounded-md border border-emerald-500/10 bg-emerald-500/[0.04] px-2.5 py-1 sm:flex">
            <span className="relative flex size-[7px]">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-[7px] rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            </span>
            <span className="text-[11px] font-medium tracking-wide text-emerald-400/80 uppercase" style={{ fontFamily: "var(--font-mono)" }}>
              Live
            </span>
          </div>

          <div className="hidden h-4 w-px bg-[var(--fl-border-subtle)] sm:block" />

          <SimulateDialog />
        </div>
      </div>
    </header>
  );
}