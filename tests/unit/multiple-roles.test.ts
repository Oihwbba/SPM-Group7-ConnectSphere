import { describe, it, expect } from "vitest";
import type { Role } from "@prisma/client";

import { can, rolesOf, type SessionUser } from "@/lib/auth/can";
import { navFor, navForRoles, primaryRoleLabel, rolesLabel, ROLE_LABEL } from "@/lib/nav";

// SCRUM-121 — accounts can hold more than one role: the permissions and
// navigation are the union of the roles, relationship checks still apply per
// role, and nobody decides arrangements for their own event. The actions'
// refusals are in tests/unit/multiple-roles-actions.test.ts; against a real
// Postgres in tests/integration/multiple-roles.test.ts. Test cases:
// docs/testing/SCRUM-121.md.

const ALL_ROLES: Role[] = [
  "ORGANISER",
  "COORDINATOR",
  "VENUE_STAFF",
  "TECH_SUPPORT",
  "ATTENDEE",
  "COORDINATOR_LEAD",
  "SAFETY_OFFICER",
];

const user = (role: Role, additionalRoles?: Role[]): SessionUser => ({
  id: "usr_me",
  role,
  additionalRoles,
});

const event = (overrides: { organiserId?: string; coordinatorId?: string | null } = {}) => ({
  kind: "event" as const,
  organiserId: "usr_org",
  coordinatorId: "usr_coord",
  status: "PLANNING" as const,
  ...overrides,
});

describe("rolesOf — SCRUM-121 AC1", () => {
  it("SCRUM-121 [AC1] TC-121-01: every role the account holds, the primary one first, each once", () => {
    expect(rolesOf(user("COORDINATOR", ["ORGANISER", "VENUE_STAFF"]))).toEqual([
      "COORDINATOR",
      "ORGANISER",
      "VENUE_STAFF",
    ]);
    expect(rolesOf(user("COORDINATOR", ["COORDINATOR", "ORGANISER", "ORGANISER"]))).toEqual([
      "COORDINATOR",
      "ORGANISER",
    ]);
    expect(rolesOf(user("ATTENDEE"))).toEqual(["ATTENDEE"]);
    expect(rolesOf(user("ATTENDEE", []))).toEqual(["ATTENDEE"]);
  });
});

describe("can with several roles — SCRUM-121 AC2, AC3", () => {
  it("SCRUM-121 [AC2] TC-121-02: permissions are the union of the roles", () => {
    const both = user("COORDINATOR", ["VENUE_STAFF"]);
    expect(can(both, "booking:request")).toBe(true); // Coordinator's
    expect(can(both, "booking:decide")).toBe(true); // Venue Staff's
    expect(can(both, "equipment:reserve")).toBe(false); // neither's
    expect(can(user("COORDINATOR"), "booking:decide")).toBe(false);
  });

  it("SCRUM-121 [AC2] TC-121-02: a single role is unchanged: each action is allowed exactly as the role table says", () => {
    for (const role of ALL_ROLES) {
      for (const action of ["event:create", "event:review", "booking:decide", "equipment:reserve", "notification:read"] as const) {
        expect(can(user(role, []), action), `${role} ${action}`).toBe(can(user(role), action));
      }
    }
  });

  it("SCRUM-121 [AC3] TC-121-03: relationship checks still apply per role: a Coordinator who also organises can't edit an event assigned to someone else", () => {
    const both = user("COORDINATOR", ["ORGANISER"]);
    expect(can(both, "event:edit", event({ coordinatorId: "usr_other" }))).toBe(false);
    expect(can(both, "event:edit", event({ coordinatorId: "usr_me" }))).toBe(true);
  });

  it("SCRUM-121 [AC3] TC-121-03: each role reaches what its own relationship allows: their own organised event as Organiser, their assigned one as Coordinator", () => {
    const both = user("COORDINATOR", ["ORGANISER"]);
    expect(can(both, "event:read", event({ organiserId: "usr_me", coordinatorId: "usr_other" }))).toBe(true);
    expect(can(both, "event:read", event({ coordinatorId: "usr_me" }))).toBe(true);
    expect(can(both, "event:read", event({ organiserId: "usr_x", coordinatorId: "usr_y" }))).toBe(false);
    // The Organiser's relationship doesn't lend the Coordinator's actions.
    expect(can(both, "event:confirm", event({ organiserId: "usr_me", coordinatorId: "usr_other" }))).toBe(false);
  });
});

describe("no decisions on your own event — SCRUM-121 AC5", () => {
  const arrangement = (organiserId: string, coordinatorId: string | null) => ({
    kind: "arrangement" as const,
    organiserId,
    coordinatorId,
  });

  it("SCRUM-121 [AC5] TC-121-05: a Venue Staff member can't decide a booking for an event they coordinate or organise", () => {
    const both = user("VENUE_STAFF", ["COORDINATOR"]);
    expect(can(both, "booking:decide", arrangement("usr_org", "usr_me"))).toBe(false);
    expect(can(both, "booking:hold", arrangement("usr_org", "usr_me"))).toBe(false);
    const organiser = user("VENUE_STAFF", ["ORGANISER"]);
    expect(can(organiser, "booking:decide", arrangement("usr_me", null))).toBe(false);
  });

  it("SCRUM-121 [AC5] TC-121-05: Technical Support can't review or reserve equipment for an event they organise or coordinate", () => {
    const both = user("TECH_SUPPORT", ["ORGANISER"]);
    expect(can(both, "equipment-request:review", arrangement("usr_me", "usr_coord"))).toBe(false);
    expect(can(both, "equipment:reserve", arrangement("usr_me", "usr_coord"))).toBe(false);
    expect(can(user("TECH_SUPPORT", ["COORDINATOR"]), "equipment:reserve", arrangement("usr_org", "usr_me"))).toBe(false);
  });

  it("SCRUM-121 [AC5] TC-121-05: for anyone else's event they still decide, and a single-role member of staff always does", () => {
    expect(can(user("VENUE_STAFF", ["COORDINATOR"]), "booking:decide", arrangement("usr_org", "usr_coord"))).toBe(true);
    expect(can(user("VENUE_STAFF"), "booking:decide", arrangement("usr_org", null))).toBe(true);
    expect(can(user("TECH_SUPPORT"), "equipment:reserve", arrangement("usr_org", "usr_coord"))).toBe(true);
    // The role is still needed: a Coordinator alone holds no staff decision.
    expect(can(user("COORDINATOR"), "booking:decide", arrangement("usr_org", "usr_coord"))).toBe(false);
  });
});

describe("navigation with several roles — SCRUM-121 AC2", () => {
  it("SCRUM-121 [AC2] TC-121-02: the navigation shows the links of every role held, each page once", () => {
    const hrefs = navForRoles(["COORDINATOR", "VENUE_STAFF"]).map((item) => item.href);
    for (const href of [
      ...navFor("COORDINATOR").map((item) => item.href),
      ...navFor("VENUE_STAFF").map((item) => item.href),
    ]) {
      expect(hrefs).toContain(href);
    }
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("SCRUM-121 [AC2] TC-121-02: a page two roles reach is named as the primary role names it", () => {
    expect(navForRoles(["COORDINATOR", "ORGANISER"]).find((item) => item.href === "/events")).toEqual({
      href: "/events",
      label: "Events",
    });
    expect(navForRoles(["ORGANISER", "COORDINATOR"]).find((item) => item.href === "/events")).toEqual({
      href: "/events",
      label: "My Events",
    });
  });

  it("SCRUM-121 [AC2] TC-121-02: with one role, the navigation is exactly that role's", () => {
    for (const role of ALL_ROLES) expect(navForRoles([role])).toEqual(navFor(role));
  });

  it("SCRUM-121 [AC1] TC-121-01: the user menu names every role held, the primary first", () => {
    expect(rolesLabel(["COORDINATOR", "VENUE_STAFF"])).toBe("Event Coordinator · Venue Staff");
    expect(rolesLabel(["ATTENDEE"])).toBe(ROLE_LABEL.ATTENDEE);
  });

  it("SCRUM-121 [AC1] TC-121-01: the top bar names the primary role and how many more, and a single role alone", () => {
    expect(primaryRoleLabel(["VENUE_STAFF", "TECH_SUPPORT", "COORDINATOR", "ORGANISER"])).toBe("Venue Staff +3");
    expect(primaryRoleLabel(["COORDINATOR", "ORGANISER"])).toBe("Event Coordinator +1");
    expect(primaryRoleLabel(["ORGANISER"])).toBe("Event Organiser");
  });
});
