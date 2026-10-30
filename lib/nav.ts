import type { Role } from "@prisma/client";

import { roleAllows, type Action } from "@/lib/auth/can";

/**
 * The navigation each role sees, derived from the permission model.
 *
 * SCRUM-66 asks for one source of truth: a role's menu follows from the
 * actions ROLE_ACTIONS grants it (lib/auth/can.ts), so granting a role an
 * action shows the matching link with no second edit here, and revoking it
 * takes the link away. UI visibility is never the security boundary — that is
 * SCRUM-67's server-side check on every operation.
 *
 * Each entry binds a route to the single action that route needs, and to the
 * task it belongs to (SCRUM-210). The menu shows the groups in GROUP_ORDER,
 * each with its links in the order here; the first link a role has is where
 * it lands after signing in, so each role's own list comes first.
 *
 * These links mirror the domain-first route structure. Keep them in sync with
 * the folders under app/(app). Routes are shared across roles — the page (not
 * the folder) dispatches on role (see ADR 0001's addendum and ADR 0004).
 *
 * Deliberately string-only (no icon components) so this module is safe to
 * import from server components. The sidebar attaches an icon per route on the
 * client — see components/app/sidebar.tsx.
 */
export type NavItem = {
  label: string;
  href: string;
};

/**
 * SCRUM-210 — the tasks the menu is grouped by, in the order they appear.
 * "work" is the role's own lists, where it lands.
 *
 * SCRUM-248 — "attending" is an Attendee's lists. Attendees aren't staff,
 * so it has no heading and each link shows on its own. A user whose other
 * roles have work of their own keeps these links in My work, as before.
 */
export type GroupId = "work" | "attending" | "venues" | "equipment" | "planning";

const GROUP_ORDER: GroupId[] = ["work", "attending", "venues", "equipment", "planning"];

const GROUP_HEADING: Record<GroupId, string | null> = {
  work: "My work",
  attending: null,
  venues: "Venues",
  equipment: "Equipment",
  planning: "Planning",
};

/**
 * A group of links under its heading. A group with one link has no heading,
 * since a heading over a single link says nothing (SCRUM-210 AC1), and nor
 * does an Attendee's (SCRUM-248): the menu shows each link on its own.
 */
export type NavGroup = {
  id: GroupId;
  heading: string | null;
  items: NavItem[];
};

type NavRoute = {
  action: Action;
  href: string;
  /** One label, or a label per role where the same route reads differently. */
  label: string | Partial<Record<Role, string>>;
  group: GroupId;
  /**
   * The route is the user's own work, in My work instead of `group`, when one
   * of their roles also holds this action: Equipment Requests is Technical
   * Support's queue to review, but a Coordinator's way to ask for equipment.
   */
  workWhen?: Action;
};

const NAV_ROUTES: NavRoute[] = [
  {
    action: "event:list",
    href: "/events",
    label: { ORGANISER: "My Events", COORDINATOR: "Events" },
    group: "work",
  },
  {
    action: "event:browse",
    href: "/events",
    label: "Browse Events",
    group: "attending",
  },
  {
    action: "venue:search",
    href: "/venues/search",
    label: "Venue Search",
    group: "venues",
  },
  {
    action: "booking:request",
    href: "/bookings/new",
    label: "Request Venue",
    group: "venues",
  },
  {
    action: "booking:review",
    href: "/bookings",
    label: "Bookings",
    group: "work",
  },
  {
    action: "venue:availability",
    href: "/venues/availability",
    label: "Availability",
    group: "venues",
  },
  {
    action: "equipment:read",
    href: "/equipment",
    label: "Equipment",
    group: "work",
  },
  {
    action: "equipment-request:list",
    href: "/equipment-requests",
    label: "Equipment Requests",
    group: "equipment",
    workWhen: "equipment-request:review",
  },
  {
    action: "safety-check:review",
    href: "/safety-checks",
    label: "Safety Checks",
    group: "work",
  },
  // SCRUM-165: the Lead's queue of requests waiting for a Coordinator.
  {
    action: "event:assign",
    href: "/queue",
    label: "Unassigned Queue",
    group: "work",
  },
  // SCRUM-141: every event, read-only, for planning.
  {
    action: "event:view-all",
    href: "/all-events",
    label: "All Events",
    group: "planning",
  },
  {
    action: "registration:read",
    href: "/registrations",
    label: "My Registrations",
    group: "attending",
  },
  // Notifications are reached from the bell beside the user's name, the one
  // way in (shared page conventions, change 9), not from this menu.
  // SCRUM-34 AC2: every internal role reads the catalogue. Named as its page
  // is, since for some roles it stands alone, without the Venues heading.
  {
    action: "venue:read",
    href: "/venues",
    label: "Venue Catalogue",
    group: "venues",
  },
];

const ROLES: Role[] = [
  "ORGANISER",
  "COORDINATOR",
  "VENUE_STAFF",
  "TECH_SUPPORT",
  "ATTENDEE",
  "COORDINATOR_LEAD",
  "SAFETY_OFFICER",
];

const linkFor = (route: NavRoute, role: Role): NavItem => ({
  href: route.href,
  label:
    typeof route.label === "string"
      ? route.label
      : (route.label[role] ?? route.href.replace("/", "")),
});

/**
 * SCRUM-121 AC2, SCRUM-210 AC4 — the menu for every role the user holds,
 * primary role first, grouped by task: each route any of them may use, once,
 * under its group, and each group once. A route two roles reach is labelled
 * as the first of them names it. Groups left empty are not shown.
 */
export function navGroupsForRoles(roles: Role[]): NavGroup[] {
  const holds = (action: Action) =>
    roles.some((held) => roleAllows(held, action));
  // SCRUM-248: with work of their own, an Attendee's links stay in My work.
  const hasWork = NAV_ROUTES.some(
    (route) => route.group === "work" && holds(route.action),
  );
  const hrefs = new Set<string>();
  const byGroup = new Map<GroupId, NavItem[]>();
  for (const route of NAV_ROUTES) {
    const role = roles.find((held) => roleAllows(held, route.action));
    if (!role || hrefs.has(route.href)) continue;
    hrefs.add(route.href);
    const group =
      (route.workWhen && holds(route.workWhen)) ||
      (route.group === "attending" && hasWork)
        ? "work"
        : route.group;
    byGroup.set(group, [...(byGroup.get(group) ?? []), linkFor(route, role)]);
  }
  return GROUP_ORDER.flatMap((id) => {
    const items = byGroup.get(id);
    if (!items) return [];
    return [
      { id, heading: items.length > 1 ? GROUP_HEADING[id] : null, items },
    ];
  });
}

/** SCRUM-210 — one role's menu, grouped by task. */
export function navGroupsFor(role: Role): NavGroup[] {
  return navGroupsForRoles([role]);
}

/** The links for every role the user holds, in the menu's order. */
export function navForRoles(roles: Role[]): NavItem[] {
  return navGroupsForRoles(roles).flatMap((group) => group.items);
}

/** The links a role sees: every nav route whose action that role holds. */
export function navFor(role: Role): NavItem[] {
  return navForRoles([role]);
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = Object.fromEntries(
  ROLES.map((role) => [role, navFor(role)]),
) as Record<Role, NavItem[]>;

/**
 * Where each role is sent from the app root after signing in: the first link
 * in its own menu, so a permission change moves the landing page too. My work
 * comes first, so each role lands on its own list (SCRUM-210 AC3). A user
 * with several roles lands where their primary role does.
 */
export const LANDING_ROUTE_BY_ROLE: Record<Role, string> = Object.fromEntries(
  ROLES.map((role) => [role, navFor(role)[0]?.href ?? "/notifications"]),
) as Record<Role, string>;

/** SCRUM-121 — every role held, the primary first, as the user menu lists them. */
export function rolesLabel(roles: Role[]): string {
  return roles.map((role) => ROLE_LABEL[role]).join(" · ");
}

/** SCRUM-121 — the top bar's shorter label: the primary role, and how many more. */
export function primaryRoleLabel(roles: Role[]): string {
  return roles.length > 1
    ? `${ROLE_LABEL[roles[0]]} +${roles.length - 1}`
    : ROLE_LABEL[roles[0]];
}

/** Human-readable role label for the header. */
export const ROLE_LABEL: Record<Role, string> = {
  ORGANISER: "Event Organiser",
  COORDINATOR: "Event Coordinator",
  VENUE_STAFF: "Venue Staff",
  TECH_SUPPORT: "Technical Support",
  ATTENDEE: "Attendee",
  COORDINATOR_LEAD: "Event Coordinator Lead",
  SAFETY_OFFICER: "Safety Officer",
};
