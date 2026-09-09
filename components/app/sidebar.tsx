"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  CalendarCheck,
  CalendarDays,
  LayoutGrid,
  Ticket,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";

import { NAV_BY_ROLE } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Icons are a presentation detail attached here on the client, keyed by route.
// (lib/nav.ts stays string-only so it's safe to import from server components.)
const ICON_BY_HREF: Record<string, LucideIcon> = {
  "/events": CalendarDays,
  "/venues": Building2,
  "/bookings": CalendarCheck,
  "/equipment": Wrench,
  "/registrations": Ticket,
  "/notifications": Bell,
};

/**
 * The left navigation rail. Collapsed by default: a slim column with a toggle
 * at the top and the role's items as circular icon buttons stacked inside one
 * long, rounded (pill) container. Expanded, the same container widens and each
 * item shows its label beside the icon. The choice is remembered in
 * localStorage.
 *
 * The rail only receives `role` (a plain string) from the server layout; it
 * looks the items up in NAV_BY_ROLE itself, because the icons are React
 * components and can't cross the server/client boundary.
 */
export function Sidebar({ role }: { role: Role }) {
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  const items = NAV_BY_ROLE[role];

  return (
    <aside
      className={cn(
        "sticky top-16 flex h-[calc(100vh-4rem)] shrink-0 flex-col gap-3 p-3 transition-[width] duration-200",
        collapsed ? "w-[84px]" : "w-64",
      )}
    >
      {/* Toggle at the top. It stretches to the same width as the nav pill
          below (both fill the rail's content box), so they line up and match. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        className={cn(
          "flex h-12 w-full shrink-0 items-center rounded-full border border-border/60 bg-card/55 text-muted-foreground shadow-glass-sm backdrop-blur-glass backdrop-saturate-150 transition-colors hover:text-foreground",
          collapsed ? "justify-center" : "justify-start gap-2 px-4",
        )}
      >
        {collapsed ? (
          <ArrowRight className="h-5 w-5" />
        ) : (
          <>
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Collapse</span>
          </>
        )}
      </button>

      {/* The long vertical rounded container holding the circular icon buttons */}
      <nav
        className={cn(
          "flex w-full flex-col gap-2 rounded-[1.9rem] border border-border/60 bg-card/50 p-2 shadow-glass backdrop-blur-glass backdrop-saturate-150",
          collapsed && "items-center",
        )}
      >
        {items.map((item) => {
          const Icon = ICON_BY_HREF[item.href] ?? LayoutGrid;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-full transition-colors",
                collapsed ? "justify-center" : "pr-4",
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                  isActive
                    ? "bg-foreground text-background shadow-glass-sm"
                    : "text-muted-foreground group-hover:bg-secondary group-hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {!collapsed && (
                <span
                  className={cn(
                    "truncate text-sm font-medium",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
