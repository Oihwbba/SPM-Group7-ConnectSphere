import { describe, it, expect } from "vitest";
import type { Role } from "@prisma/client";

import { NAV_BY_ROLE, LANDING_ROUTE_BY_ROLE, ROLE_LABEL, navFor } from "@/lib/nav";
import { roleAllows, type Action } from "@/lib/auth/can";

// SCRUM-66 — each role is shown only the functions its role allows, and lands
// on the right page. The menu is derived from ROLE_ACTIONS in lib/auth/can.ts,
// so there is one source of truth: these tests pin both the resulting menus and
// the derivation itself, without rendering anything.
const ROLES: Role[] = [
  "ORGANISER",
  "COORDINATOR",
  "VENUE_STAFF",
  "TECH_SUPPORT",
  "ATTENDEE",
];

function hrefsFor(role: Role): string[] {
  return NAV_BY_ROLE[role].map((item) => item.href);
}

describe("role-based navigation — SCRUM-66", () => {
  it("lands every role on a page that is in its own nav", () => {
    for (const role of ROLES) {
      expect(hrefsFor(role)).toContain(LANDING_ROUTE_BY_ROLE[role]);
    }
  });

  it("keeps venue, equipment and booking work out of an organiser's nav", () => {
    const hrefs = hrefsFor("ORGANISER");
    expect(hrefs).not.toContain("/venues");
    expect(hrefs).not.toContain("/equipment");
    expect(hrefs).not.toContain("/bookings");
  });

  it("shows each internal role its own work", () => {
    expect(hrefsFor("VENUE_STAFF")).toContain("/bookings");
    expect(hrefsFor("TECH_SUPPORT")).toContain("/equipment");
    expect(hrefsFor("COORDINATOR")).toContain("/venues");
    expect(hrefsFor("COORDINATOR")).toContain("/bookings/new");
  });

  it("gives an attendee only their events and registrations", () => {
    const hrefs = hrefsFor("ATTENDEE");
    expect(hrefs).toContain("/events");
    expect(hrefs).toContain("/registrations");
    expect(hrefs).not.toContain("/venues");
    expect(hrefs).not.toContain("/equipment");
  });

  it("gives every role a human-readable label for the header", () => {
    for (const role of ROLES) {
      expect(ROLE_LABEL[role]).toBeTruthy();
    }
  });
});

// SCRUM-66 AC: "navigation is derived from the central permission model" and
// "changing a role's permissions updates the derived action set without
// separate per-screen logic". These pin the derivation, not just its output:
// a second hand-maintained role table would fail them.
describe("navigation derives from the permission model — SCRUM-66", () => {
  // Every route in the menu, and the action lib/auth/can.ts requires for it.
  const ROUTE_ACTION: Array<{ href: string; actions: Action[] }> = [
    { href: "/events", actions: ["event:list", "event:browse"] },
    { href: "/venues", actions: ["venue:read"] },
    { href: "/bookings", actions: ["booking:review"] },
    { href: "/bookings/new", actions: ["booking:request"] },
    { href: "/equipment", actions: ["equipment:read"] },
    { href: "/registrations", actions: ["registration:read"] },
    { href: "/notifications", actions: ["notification:read"] },
  ];

  it("shows a link only to a role that holds the action behind it", () => {
    for (const role of ROLES) {
      const hrefs = hrefsFor(role);

      for (const { href, actions } of ROUTE_ACTION) {
        const permitted = actions.some((action) => roleAllows(role, action));
        expect(
          hrefs.includes(href),
          `${role} ${permitted ? "should" : "should not"} see ${href}`,
        ).toBe(permitted);
      }
    }
  });

  it("never shows a link a role has no action for", () => {
    for (const role of ROLES) {
      for (const href of hrefsFor(role)) {
        const route = ROUTE_ACTION.find((entry) => entry.href === href);
        expect(route, `${href} is in the menu with no action behind it`).toBeDefined();
        expect(
          route!.actions.some((action) => roleAllows(role, action)),
        ).toBe(true);
      }
    }
  });

  it("lands each role on the first link it is allowed to see", () => {
    for (const role of ROLES) {
      expect(LANDING_ROUTE_BY_ROLE[role]).toBe(navFor(role)[0].href);
    }
  });

  it("gives every role its notifications, the one link every role holds", () => {
    for (const role of ROLES) {
      expect(roleAllows(role, "notification:read")).toBe(true);
      expect(hrefsFor(role)).toContain("/notifications");
    }
  });
});
