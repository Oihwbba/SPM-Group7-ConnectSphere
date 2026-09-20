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

  // Restore the remembered choice after mount. This cannot move into the
  // useState initialiser: the server has no localStorage, so it would render
  // a different value than the client and cause a hydration mismatch.
  // Reading it here — once, on mount — is the trade-off, and the new
  // react-hooks/set-state-in-effect rule is suppressed for exactly this line.
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from an external store (localStorage) on mount
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
      aria-label="Primary"
      className={cn(
        // Mobile: a floating, rounded, translucent bar that spans the width
        // (with a small side margin) and hovers just above the bottom edge; the
        // shell adds bottom padding to clear it. From `md` up it becomes the
        // in-flow, collapsible vertical rail.
        "fixed inset-x-4 bottom-4 z-40 rounded-full border border-border/50 bg-card/45 shadow-glass backdrop-blur-glass backdrop-saturate-150",
        "md:sticky md:inset-x-auto md:bottom-auto md:top-16 md:z-auto md:flex md:h-[calc(100vh-4rem)] md:shrink-0 md:flex-col md:gap-3 md:rounded-none md:border-0 md:bg-transparent md:p-3 md:shadow-none md:backdrop-blur-none md:backdrop-saturate-100 md:transition-[width] md:duration-200",
        collapsed ? "md:w-[84px]" : "md:w-64",
      )}
    >
      {/* Toggle — desktop rail only; the bottom bar needs no collapse. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        className={cn(
          "hidden h-12 w-full shrink-0 items-center rounded-full border border-border/60 bg-card/55 text-muted-foreground shadow-glass-sm backdrop-blur-glass backdrop-saturate-150 transition-colors hover:text-foreground md:flex",
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

      {/* Nav items: a spaced-out row across the bottom bar on mobile; the tall
          rounded pill container on desktop. */}
      <nav
        className={cn(
          "flex items-center justify-around gap-1 px-2 py-1.5",
          "md:w-full md:flex-col md:justify-start md:gap-2 md:rounded-[1.9rem] md:border md:border-border/60 md:bg-card/50 md:px-2 md:py-2 md:shadow-glass md:backdrop-blur-glass md:backdrop-saturate-150",
          collapsed && "md:items-center",
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
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex items-center justify-center gap-3 rounded-full transition-colors",
                // Mobile: each item takes an equal share of the bar (½ for two
                // items), so the active highlight can fill that whole segment.
                "flex-1 md:flex-none",
                collapsed ? "md:justify-center" : "md:pr-4",
              )}
            >
              <span
                className={cn(
                  // Mobile: the highlight stretches to fill the item's share;
                  // on desktop it's the fixed circular icon button.
                  "flex h-11 w-full shrink-0 items-center justify-center rounded-full transition-colors md:w-11",
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
                    "hidden truncate text-sm font-medium md:inline",
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
