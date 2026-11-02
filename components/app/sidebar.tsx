"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarPlus,
  CalendarRange,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  LayoutGrid,
  Search,
  ShieldCheck,
  Inbox,
  LayoutList,
  Ticket,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";

import { navGroupsForRoles, type GroupId, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { PendingNavIcon } from "@/components/app/pending-nav-icon";

// Icons are a presentation detail attached here on the client, keyed by route.
// (lib/nav.ts stays string-only so it's safe to import from server components.)
const ICON_BY_HREF: Record<string, LucideIcon> = {
  "/events": CalendarDays,
  "/venues": Building2,
  "/bookings": CalendarCheck,
  "/bookings/new": CalendarPlus,
  "/venues/availability": CalendarRange,
  "/venues/search": Search,
  "/equipment": Wrench,
  "/equipment-requests": ClipboardList,
  "/safety-checks": ShieldCheck,
  "/queue": Inbox,
  "/all-events": LayoutList,
  "/registrations": Ticket,
  "/notifications": Bell,
};

// SCRUM-210: the icon of a group that opens to show its links.
const ICON_BY_GROUP: Record<GroupId, LucideIcon> = {
  work: Briefcase,
  venues: Building2,
  equipment: Wrench,
  planning: LayoutList,
};

// SCRUM-210: the rail from `md` up, the phone's bar below it. The server
// renders the rail; a phone switches once mounted.
const DESKTOP = "(min-width: 768px)";
function onWidthChange(notify: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
const isDesktop = () => window.matchMedia(DESKTOP).matches;

/**
 * The left navigation rail. Collapsed by default: a slim column with a toggle
 * at the top and the role's items as circular icon buttons stacked inside one
 * long, rounded (pill) container. Expanded, the same container widens and each
 * item shows its label beside the icon. The choice is remembered in
 * localStorage.
 *
 * The rail only receives the user's roles (plain strings) from the server
 * layout; it works out the items itself, because the icons are React
 * components and can't cross the server/client boundary. Several roles show
 * the links of all of them (SCRUM-121 AC2).
 *
 * SCRUM-210: the links are grouped by task. A group of more than one link is
 * one item, named for the task; selecting it opens its links beneath it,
 * indented (on a phone, in a panel above the bar). The group of the page
 * being viewed starts open. A group of one link is just that link.
 */
export function Sidebar({ roles }: { roles: Role[] }) {
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

  const groups = navGroupsForRoles(roles);
  const items = groups.flatMap((group) => group.items);
  // The most specific link that matches wins, so /venues/availability does
  // not also light up /venues.
  const activeHref = items
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  // A group opened or closed by hand; otherwise it is open while it holds
  // the page being viewed.
  const [opened, setOpened] = useState<Partial<Record<GroupId, boolean>>>({});
  // On a phone, the group whose links show in the panel above the bar.
  const [phoneGroup, setPhoneGroup] = useState<GroupId | null>(null);
  const desktop = useSyncExternalStore(onWidthChange, isDesktop, () => true);
  const holdsActive = (links: NavItem[]) =>
    links.some((item) => item.href === activeHref);

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

      {/* SCRUM-210: on a phone, an opened group's links in a panel above the
          bar. */}
      {groups.map(
        (group) =>
          group.heading &&
          phoneGroup === group.id && (
            <div
              key={group.id}
              role="group"
              aria-label={group.heading}
              className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-1 rounded-3xl border border-border/50 bg-background p-2 shadow-glass md:hidden"
            >
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                  inPanel
                  onSelect={() => setPhoneGroup(null)}
                />
              ))}
            </div>
          ),
      )}

      {/* Nav items: a spaced-out row across the bottom bar on mobile; the tall
          rounded pill container on desktop. */}
      <nav
        className={cn(
          "flex items-center justify-around gap-1 px-2 py-1.5",
          "md:w-full md:flex-col md:justify-start md:gap-2 md:rounded-[1.9rem] md:border md:border-border/60 md:bg-card/50 md:px-2 md:py-2 md:shadow-glass md:backdrop-blur-glass md:backdrop-saturate-150",
          // Expanded, every item spans the rail so icons and labels line up on
          // the left; collapsed, the lone icons sit centred.
          collapsed ? "md:items-center" : "md:items-stretch",
        )}
      >
        {groups.map((group) => {
          if (!group.heading) {
            const item = group.items[0];
            return (
              <NavLink
                key={item.href}
                item={item}
                active={item.href === activeHref}
                collapsed={collapsed}
              />
            );
          }
          const open = opened[group.id] ?? holdsActive(group.items);
          const Icon = ICON_BY_GROUP[group.id];
          // Whether its links are in view: in place on the rail, in the
          // panel on a phone.
          const shown = desktop ? open : phoneGroup === group.id;
          // Closed over the page being viewed, the group shows as active.
          const lit = holdsActive(group.items) && !shown;
          return (
            <div
              key={group.id}
              className={cn(
                "contents md:flex md:w-full md:flex-col md:gap-2",
                collapsed ? "md:items-center" : "md:items-stretch",
              )}
            >
              <button
                type="button"
                title={group.heading}
                aria-label={group.heading}
                aria-expanded={shown}
                onClick={() => {
                  // The rail opens the group in place; a phone, in its panel.
                  if (desktop) {
                    setOpened((current) => ({ ...current, [group.id]: !open }));
                  } else {
                    setPhoneGroup((current) =>
                      current === group.id ? null : group.id,
                    );
                  }
                }}
                className={cn(
                  "group flex items-center justify-center gap-3 rounded-full transition-colors",
                  "flex-1 md:flex-none",
                  collapsed ? "md:justify-center" : "md:justify-start md:pr-4",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-full shrink-0 items-center justify-center rounded-full transition-colors md:w-11",
                    lit
                      ? "bg-foreground text-background shadow-glass-sm"
                      : phoneGroup === group.id
                        ? "bg-secondary text-foreground md:bg-transparent md:text-muted-foreground"
                        : "text-muted-foreground group-hover:bg-secondary group-hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {!collapsed && (
                  <span className="hidden flex-1 items-center justify-between text-sm font-medium text-muted-foreground group-hover:text-foreground md:flex">
                    <span className="truncate">{group.heading}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </span>
                )}
              </button>
              {open && (
                <div
                  role="group"
                  aria-label={group.heading}
                  className={cn(
                    "hidden flex-col gap-1 md:flex",
                    // Indented under the group: further in when labelled; in
                    // the narrow rail, smaller icons set in from the left.
                    collapsed
                      ? "md:items-end md:self-stretch md:pr-0.5"
                      : "md:pl-6",
                  )}
                >
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={item.href === activeHref}
                      collapsed={collapsed}
                      nested
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/**
 * One link: its icon in a circle, and its label beside it when the rail is
 * expanded. Nested under a group, the icon is a little smaller; in the
 * phone's panel, the label always shows.
 */
function NavLink({
  item,
  active,
  collapsed = false,
  nested = false,
  inPanel = false,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  nested?: boolean;
  inPanel?: boolean;
  onSelect?: () => void;
}) {
  const Icon = ICON_BY_HREF[item.href] ?? LayoutGrid;
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-3 rounded-full transition-colors",
        inPanel
          ? "justify-start pr-4"
          : cn(
              "justify-center",
              // Mobile: each item takes an equal share of the bar (½ for two
              // items), so the active highlight can fill that whole segment.
              "flex-1 md:flex-none",
              collapsed ? "md:justify-center" : "md:justify-start md:pr-4",
            ),
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full transition-colors",
          inPanel
            ? "h-10 w-10"
            : nested
              ? "h-11 w-full md:h-9 md:w-9"
              : // Mobile: the highlight stretches to fill the item's share;
                // on desktop it's the fixed circular icon button.
                "h-11 w-full md:w-11",
          active
            ? "bg-foreground text-background shadow-glass-sm"
            : "text-muted-foreground group-hover:bg-secondary group-hover:text-foreground",
        )}
      >
        <PendingNavIcon icon={Icon} className={nested ? "h-4 w-4" : "h-5 w-5"} />
      </span>
      {(inPanel || !collapsed) && (
        <span
          className={cn(
            "truncate text-sm font-medium",
            !inPanel && "hidden md:inline",
            active
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}
