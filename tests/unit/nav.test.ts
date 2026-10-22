import { describe, it, expect, vi, afterEach } from "vitest";
import type { Role } from "@prisma/client";

import {
  NAV_BY_ROLE,
  LANDING_ROUTE_BY_ROLE,
  ROLE_LABEL,
  navFor,
} from "@/lib/nav";
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

  // SCRUM-27 — coordinators raise equipment requests from their own page;
  // the equipment pool itself stays Technical Support's.
  it("shows a coordinator equipment requests but not the equipment pool", () => {
    const hrefs = hrefsFor("COORDINATOR");
    expect(hrefs).toContain("/equipment-requests");
    expect(hrefs).not.toContain("/equipment");
    expect(LANDING_ROUTE_BY_ROLE.COORDINATOR).toBe("/events");
  });

  // SCRUM-28 — Technical Support reviews the requests coordinators raise.
  it("shows Technical Support the equipment pool and the requests to review", () => {
    const hrefs = hrefsFor("TECH_SUPPORT");
    expect(hrefs).toContain("/equipment");
    expect(hrefs).toContain("/equipment-requests");
    expect(LANDING_ROUTE_BY_ROLE.TECH_SUPPORT).toBe("/equipment");
  });

  // SCRUM-34 AC2: Venues is every internal role's last link, so granting it
  // moved nobody's landing page.
  it("SCRUM-34 [AC2] TC-34-02: every internal role has Venues last, and lands where it did before", () => {
    for (const role of [
      "COORDINATOR",
      "VENUE_STAFF",
      "TECH_SUPPORT",
    ] as const) {
      expect(hrefsFor(role).at(-1)).toBe("/venues");
    }
    expect(LANDING_ROUTE_BY_ROLE.COORDINATOR).toBe("/events");
    expect(LANDING_ROUTE_BY_ROLE.VENUE_STAFF).toBe("/bookings");
    expect(hrefsFor("ORGANISER")).not.toContain("/venues");
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
    { href: "/venues/search", actions: ["venue:search"] },
    { href: "/bookings", actions: ["booking:review"] },
    { href: "/bookings/new", actions: ["booking:request"] },
    { href: "/venues/availability", actions: ["venue:availability"] },
    { href: "/equipment", actions: ["equipment:read"] },
    { href: "/equipment-requests", actions: ["equipment-request:list"] },
    { href: "/registrations", actions: ["registration:read"] },
    { href: "/safety-checks", actions: ["safety-check:review"] },
    { href: "/queue", actions: ["event:assign"] },
    { href: "/all-events", actions: ["event:view-all"] },
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
        expect(
          route,
          `${href} is in the menu with no action behind it`,
        ).toBeDefined();
        expect(route!.actions.some((action) => roleAllows(role, action))).toBe(
          true,
        );
      }
    }
  });

  it("lands each role on the first link it is allowed to see", () => {
    for (const role of ROLES) {
      expect(LANDING_ROUTE_BY_ROLE[role]).toBe(navFor(role)[0].href);
    }
  });

  it("SCRUM-207 TC-207-15: gives every role its notifications from the bell, not from the menu", () => {
    for (const role of ROLES) {
      expect(roleAllows(role, "notification:read")).toBe(true);
      expect(hrefsFor(role)).not.toContain("/notifications");
    }
  });
});

// SCRUM-66: "granting a role an action shows the matching link with no second
// edit here". The menus are built when lib/nav.ts loads, so each case reloads
// it against a changed permission model.
describe("navigation follows a permission change — SCRUM-66", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/auth/can");
    vi.resetModules();
  });

  async function navWith(allows: (role: Role, action: Action) => boolean) {
    vi.resetModules();
    vi.doMock("@/lib/auth/can", () => ({ roleAllows: allows }));
    return import("@/lib/nav");
  }

  it("shows a newly granted route to a role that has no label of its own for it", async () => {
    const nav = await navWith(
      (role, action) =>
        roleAllows(role, action) ||
        (role === "VENUE_STAFF" && action === "event:list"),
    );

    expect(nav.NAV_BY_ROLE.VENUE_STAFF).toContainEqual({
      href: "/events",
      label: "events",
    });
  });

  it("lands a role with no links on its notifications", async () => {
    const nav = await navWith(() => false);

    expect(nav.NAV_BY_ROLE.ATTENDEE).toEqual([]);
    expect(nav.LANDING_ROUTE_BY_ROLE.ATTENDEE).toBe("/notifications");
  });
});

// SCRUM-172 AC1 — the Week 7 roles sign in to their notifications, the only
// page they have until SCRUM-164 gives them their own.
describe("navigation for the Week 7 roles — SCRUM-172", () => {
  // SCRUM-165 gave the Lead their own page, the Unassigned queue, which comes first.
  it("SCRUM-172 [AC1] TC-172-01, SCRUM-164 [AC1] TC-164-01, SCRUM-165 [AC10] TC-165-13: COORDINATOR_LEAD is labelled and lands on the Unassigned queue", () => {
    expect(ROLE_LABEL.COORDINATOR_LEAD).toBe("Event Coordinator Lead");
    // SCRUM-34 AC2 added the venue catalogue, listed last.
    expect(hrefsFor("COORDINATOR_LEAD")).toEqual([
      "/queue",
      "/all-events",

      "/venues",
    ]);
    expect(LANDING_ROUTE_BY_ROLE.COORDINATOR_LEAD).toBe("/queue");
  });

  // SCRUM-166 gave the Safety Officer their own page, which comes first.
  it("SCRUM-172 [AC1] TC-172-01, SCRUM-166 [AC1] TC-166-03: SAFETY_OFFICER is labelled and lands on the safety check queue", () => {
    expect(ROLE_LABEL.SAFETY_OFFICER).toBe("Safety Officer");
    expect(hrefsFor("SAFETY_OFFICER")).toEqual(["/safety-checks", "/venues"]);
    expect(LANDING_ROUTE_BY_ROLE.SAFETY_OFFICER).toBe("/safety-checks");
  });
});

describe("the all-events list in the menu — SCRUM-141", () => {
  it("SCRUM-141 [AC1, AC6] TC-141-09: Coordinators, the Lead, Venue Staff and Technical Support see All Events; Organisers, Attendees and Safety Officers don't", () => {
    for (const role of [
      "COORDINATOR",
      "COORDINATOR_LEAD",
      "VENUE_STAFF",
      "TECH_SUPPORT",
    ] as const) {
      expect(hrefsFor(role)).toContain("/all-events");
    }
    for (const role of ["ORGANISER", "ATTENDEE", "SAFETY_OFFICER"] as const) {
      expect(hrefsFor(role)).not.toContain("/all-events");
    }
  });

  it("SCRUM-141: each role still lands on its own first page, not the list", () => {
    expect(LANDING_ROUTE_BY_ROLE.COORDINATOR).toBe("/events");
    expect(LANDING_ROUTE_BY_ROLE.COORDINATOR_LEAD).toBe("/queue");
    expect(LANDING_ROUTE_BY_ROLE.VENUE_STAFF).not.toBe("/all-events");
    expect(LANDING_ROUTE_BY_ROLE.TECH_SUPPORT).not.toBe("/all-events");
  });
});
