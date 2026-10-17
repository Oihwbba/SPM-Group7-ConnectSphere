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
 * Each entry binds a route to the single action that route needs. The order
 * here is the order the links appear, and the first link a role has is where
 * it lands after signing in.
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

type NavRoute = {
  action: Action;
  href: string;
  /** One label, or a label per role where the same route reads differently. */
  label: string | Partial<Record<Role, string>>;
};

const NAV_ROUTES: NavRoute[] = [
  {
    action: "event:list",
    href: "/events",
    label: { ORGANISER: "My Events", COORDINATOR: "Events" },
  },
  { action: "event:browse", href: "/events", label: "Browse Events" },
  { action: "booking:request", href: "/bookings/new", label: "Request Venue" },
  { action: "booking:review", href: "/bookings", label: "Bookings" },
  {
    action: "venue:availability",
    href: "/venues/availability",
    label: "Availability",
  },
  { action: "equipment:read", href: "/equipment", label: "Equipment" },
  {
    action: "equipment-request:list",
    href: "/equipment-requests",
    label: "Equipment Requests",
  },
  {
    action: "safety-check:review",
    href: "/safety-checks",
    label: "Safety Checks",
  },
  {
    action: "registration:read",
    href: "/registrations",
    label: "My Registrations",
  },
  {
    action: "notification:read",
    href: "/notifications",
    label: "Notifications",
  },
  // SCRUM-34 AC2: every internal role reads the catalogue. Listed last, so it
  // never becomes a role's first link and so never moves where it lands.
  { action: "venue:read", href: "/venues", label: "Venues" },
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

/** The links a role sees: every nav route whose action that role holds. */
export function navFor(role: Role): NavItem[] {
  return NAV_ROUTES.filter((route) => roleAllows(role, route.action)).map(
    (route) => linkFor(route, role),
  );
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = Object.fromEntries(
  ROLES.map((role) => [role, navFor(role)]),
) as Record<Role, NavItem[]>;

/**
 * Where each role is sent from the app root after signing in: the first link
 * in its own navigation, so a permission change moves the landing page too.
 */
export const LANDING_ROUTE_BY_ROLE: Record<Role, string> = Object.fromEntries(
  ROLES.map((role) => [role, navFor(role)[0]?.href ?? "/notifications"]),
) as Record<Role, string>;

/**
 * SCRUM-121 AC2 — the links for every role the user holds, primary role
 * first: each route any of them may use, once, in the routes' own order. A
 * route two roles reach is labelled as the first of them names it, and only
 * one link to a page is kept.
 */
export function navForRoles(roles: Role[]): NavItem[] {
  const hrefs = new Set<string>();
  return NAV_ROUTES.flatMap((route) => {
    const role = roles.find((held) => roleAllows(held, route.action));
    if (!role || hrefs.has(route.href)) return [];
    hrefs.add(route.href);
    return [linkFor(route, role)];
  });
}

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
