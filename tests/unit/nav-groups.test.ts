import { describe, it, expect, vi, afterEach } from "vitest";
import type { Role } from "@prisma/client";

import {
  LANDING_ROUTE_BY_ROLE,
  navFor,
  navGroupsFor,
  navGroupsForRoles,
  type NavGroup,
} from "@/lib/nav";
import { roleAllows, type Action } from "@/lib/auth/can";

// SCRUM-210 — each role's menu is grouped by task, still built from the
// permission table (SCRUM-66), with every landing page as it was. Test cases:
// docs/testing/SCRUM-210.md.

const ALL_ROLES: Role[] = [
  "ORGANISER",
  "COORDINATOR",
  "VENUE_STAFF",
  "TECH_SUPPORT",
  "ATTENDEE",
  "COORDINATOR_LEAD",
  "SAFETY_OFFICER",
];

/** A group as heading and labels, to read the expected menus at a glance. */
const shape = (groups: NavGroup[]) =>
  groups.map((group) => [group.heading, group.items.map((item) => item.label)]);

describe("SCRUM-210 — menus grouped by task", () => {
  it.each<[Role, ReturnType<typeof shape>]>([
    ["ORGANISER", [[null, ["My Events"]]]],
    [
      "COORDINATOR",
      [
        [null, ["Events"]],
        ["Venues", ["Venue Search", "Request Venue", "Availability", "Venue Catalogue"]],
        [null, ["Equipment Requests"]],
        [null, ["All Events"]],
      ],
    ],
    [
      "VENUE_STAFF",
      [
        [null, ["Bookings"]],
        ["Venues", ["Availability", "Venue Catalogue"]],
        [null, ["All Events"]],
      ],
    ],
    [
      "TECH_SUPPORT",
      [
        ["My work", ["Equipment", "Equipment Requests"]],
        [null, ["Venue Catalogue"]],
        [null, ["All Events"]],
      ],
    ],
    ["ATTENDEE", [["My work", ["Browse Events", "My Registrations"]]]],
    [
      "COORDINATOR_LEAD",
      [
        [null, ["Unassigned Queue"]],
        [null, ["Venue Catalogue"]],
        [null, ["All Events"]],
      ],
    ],
    [
      "SAFETY_OFFICER",
      [
        [null, ["Safety Checks"]],
        [null, ["Venue Catalogue"]],
      ],
    ],
  ])("SCRUM-210 [AC1] TC-210-01: %s sees its links grouped by task, in order", (role, expected) => {
    expect(shape(navGroupsFor(role))).toEqual(expected);
  });

  it("SCRUM-210 [AC1] TC-210-01: every link keeps its address, Request Venue and Equipment Requests included", () => {
    const hrefs = navFor("COORDINATOR").map((item) => item.href);
    expect(hrefs).toEqual([
      "/events",
      "/venues/search",
      "/bookings/new",
      "/venues/availability",
      "/venues",
      "/equipment-requests",
      "/all-events",
    ]);
  });

  it("SCRUM-210 [AC1] TC-210-02: a group with a single link shows no heading; one with more has its heading", () => {
    for (const role of ALL_ROLES) {
      for (const group of navGroupsFor(role)) {
        expect(group.heading === null, `${role}: ${group.heading}`).toBe(
          group.items.length === 1,
        );
      }
    }
  });

  it("SCRUM-210 [AC1] TC-210-03: Notifications is in no role's menu, alone or combined; it is reached from the bell", () => {
    for (const roles of [...ALL_ROLES.map((role) => [role]), ALL_ROLES]) {
      const hrefs = navGroupsForRoles(roles).flatMap((group) => group.items.map((item) => item.href));
      expect(hrefs).not.toContain("/notifications");
    }
  });

  // Pinned: today's landing pages, so any change to the menu that moves one
  // fails here.
  it.each<[Role, string]>([
    ["ORGANISER", "/events"],
    ["COORDINATOR", "/events"],
    ["COORDINATOR_LEAD", "/queue"],
    ["VENUE_STAFF", "/bookings"],
    ["TECH_SUPPORT", "/equipment"],
    ["SAFETY_OFFICER", "/safety-checks"],
    ["ATTENDEE", "/events"],
  ])("SCRUM-210 [AC3] TC-210-06: %s still lands on %s, the first link of its My work", (role, href) => {
    expect(LANDING_ROUTE_BY_ROLE[role]).toBe(href);
    expect(navGroupsFor(role)[0].items[0].href).toBe(href);
  });

  it("SCRUM-210 [AC4] TC-210-07: a Coordinator who is also Venue Staff sees each group once, Venues merged, no link twice", () => {
    const groups = navGroupsForRoles(["COORDINATOR", "VENUE_STAFF"]);
    expect(shape(groups)).toEqual([
      ["My work", ["Events", "Bookings"]],
      ["Venues", ["Venue Search", "Request Venue", "Availability", "Venue Catalogue"]],
      [null, ["Equipment Requests"]],
      [null, ["All Events"]],
    ]);
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("SCRUM-210 [AC4] TC-210-08: the seeded several-role user (Venue Staff, Technical Support, Coordinator, Organiser) sees one menu, and lands where Venue Staff does", () => {
    const roles: Role[] = ["VENUE_STAFF", "TECH_SUPPORT", "COORDINATOR", "ORGANISER"];
    expect(shape(navGroupsForRoles(roles))).toEqual([
      ["My work", ["Events", "Bookings", "Equipment", "Equipment Requests"]],
      ["Venues", ["Venue Search", "Request Venue", "Availability", "Venue Catalogue"]],
      [null, ["All Events"]],
    ]);
    // The app root sends a user where their primary role lands, as before.
    expect(LANDING_ROUTE_BY_ROLE[roles[0]]).toBe("/bookings");
  });
});

// SCRUM-210 AC2: the groups are headings over the permission table's links.
// Each case reloads lib/nav.ts against a changed permission model, and
// nothing else is edited.
describe("SCRUM-210 — the grouped menu follows the permission table", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/auth/can");
    vi.resetModules();
  });

  async function navWithout(role: Role, removed: Action[]) {
    vi.resetModules();
    vi.doMock("@/lib/auth/can", () => ({
      roleAllows: (held: Role, action: Action) =>
        !(held === role && removed.includes(action)) && roleAllows(held, action),
    }));
    return import("@/lib/nav");
  }

  it("SCRUM-210 [AC2] TC-210-04: removing a permission removes its link, and the group keeps the rest", async () => {
    const nav = await navWithout("COORDINATOR", ["venue:availability"]);

    expect(shape(nav.navGroupsFor("COORDINATOR"))[1]).toEqual([
      "Venues",
      ["Venue Search", "Request Venue", "Venue Catalogue"],
    ]);
  });

  it("SCRUM-210 [AC2] TC-210-05: a group left empty disappears, and one left with a single link loses its heading", async () => {
    const nav = await navWithout("VENUE_STAFF", ["venue:availability", "venue:read"]);
    expect(shape(nav.navGroupsFor("VENUE_STAFF"))).toEqual([
      [null, ["Bookings"]],
      [null, ["All Events"]],
    ]);

    const single = await navWithout("VENUE_STAFF", ["venue:availability"]);
    expect(shape(single.navGroupsFor("VENUE_STAFF"))[1]).toEqual([null, ["Venue Catalogue"]]);
  });

  it("SCRUM-210 [AC2] TC-210-05: Equipment Requests joins My work only while the role may review them", async () => {
    const nav = await navWithout("TECH_SUPPORT", ["equipment-request:review"]);

    expect(shape(nav.navGroupsFor("TECH_SUPPORT"))).toEqual([
      [null, ["Equipment"]],
      [null, ["Venue Catalogue"]],
      [null, ["Equipment Requests"]],
      [null, ["All Events"]],
    ]);
  });
});
