import type { Role } from "@prisma/client";

/**
 * The navigation each role sees, and where each role lands after signing in.
 * The shell (the sidebar in app/(app)/layout.tsx) renders nav straight from
 * this map, and app/(app)/page.tsx redirects using it — so adding a route to a
 * role's menu is a one-line change here, not an edit to the shell.
 *
 * These links mirror the folder-per-developer route structure. Keep them in
 * sync with the folders under app/(app).
 *
 * Deliberately string-only (no icon components) so this module is safe to
 * import from server components. The sidebar attaches an icon per route on the
 * client — see components/app/sidebar.tsx.
 */
export type NavItem = {
  label: string;
  href: string;
};

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  ORGANISER: [
    { label: "My Events", href: "/organiser/events" },
    { label: "Notifications", href: "/notifications" },
  ],
  COORDINATOR: [
    { label: "Events", href: "/coordinator/events" },
    { label: "Venues", href: "/coordinator/venues" },
    { label: "Notifications", href: "/notifications" },
  ],
  VENUE_STAFF: [
    { label: "Bookings", href: "/venue-staff/bookings" },
    { label: "Notifications", href: "/notifications" },
  ],
  TECH_SUPPORT: [
    { label: "Equipment", href: "/tech-support/equipment" },
    { label: "Notifications", href: "/notifications" },
  ],
  ATTENDEE: [
    { label: "Browse Events", href: "/attendee/events" },
    { label: "My Registrations", href: "/attendee/registrations" },
    { label: "Notifications", href: "/notifications" },
  ],
};

/** Where each role is sent from the app root after signing in. */
export const LANDING_ROUTE_BY_ROLE: Record<Role, string> = {
  ORGANISER: "/organiser/events",
  COORDINATOR: "/coordinator/events",
  VENUE_STAFF: "/venue-staff/bookings",
  TECH_SUPPORT: "/tech-support/equipment",
  ATTENDEE: "/attendee/events",
};

/** Human-readable role label for the header. */
export const ROLE_LABEL: Record<Role, string> = {
  ORGANISER: "Event Organiser",
  COORDINATOR: "Event Coordinator",
  VENUE_STAFF: "Venue Staff",
  TECH_SUPPORT: "Technical Support",
  ATTENDEE: "Attendee",
};
