"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/services", label: "Services", icon: Boxes },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--fl-border-subtle)] bg-[var(--fl-surface)]/90 backdrop-blur-xl md:hidden">
      <div className="flex items-stretch justify-around">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-200",
                active ? "text-indigo-400" : "text-[var(--fl-text-tertiary)]"
              )}
            >
              <Icon className="size-5" />
              {item.label}
              {active && (
                <span className="absolute top-0 left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-indigo-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}