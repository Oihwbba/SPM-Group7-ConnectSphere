import { describe, it, expect } from "vitest";

import { can, type SessionUser } from "@/lib/auth/can";

// Pure unit test — no mocks, no database. `can()` is the security core, so it
// is worth pinning both of the checks it makes: role and relationship.
const organiserA: SessionUser = { id: "orgA", role: "ORGANISER" };
const organiserB: SessionUser = { id: "orgB", role: "ORGANISER" };
const coordinator: SessionUser = { id: "coord", role: "COORDINATOR" };
const attendee: SessionUser = { id: "att", role: "ATTENDEE" };

describe("can — role gate", () => {
  it("lets an organiser create events", () => {
    expect(can(organiserA, "event:create")).toBe(true);
  });

  it("does not let an attendee create events", () => {
    expect(can(attendee, "event:create")).toBe(false);
  });

  it("does not let a venue-staff member review events", () => {
    expect(can({ id: "vs", role: "VENUE_STAFF" }, "event:review")).toBe(false);
  });

  // SCRUM-34 AC2: any internal user views the venue catalogue; the external
  // roles don't. Pin both sides.
  it.each(["VENUE_STAFF", "TECH_SUPPORT", "COORDINATOR_LEAD", "SAFETY_OFFICER"] as const)(
    "SCRUM-34 [AC2] TC-34-02: %s, an internal user, reads the venue catalogue",
    (role) => {
      expect(can({ id: "u", role }, "venue:read")).toBe(true);
    },
  );

  it.each(["ORGANISER", "ATTENDEE"] as const)(
    "SCRUM-34 [AC2] TC-34-02: %s, an external user, doesn't read the venue catalogue",
    (role) => {
      expect(can({ id: "u", role }, "venue:read")).toBe(false);
    },
  );

  it("lets a coordinator read the venue catalogue", () => {
    expect(can(coordinator, "venue:read")).toBe(true);
  });

  // SCRUM-27 — "As an Event Coordinator, I want to create an equipment
  // request". Only coordinators raise requests; Technical Support reviews them.
  it("lets a coordinator create and list equipment requests", () => {
    expect(can(coordinator, "equipment-request:create")).toBe(true);
    expect(can(coordinator, "equipment-request:list")).toBe(true);
  });

  // SCRUM-28 — "As a Technical Support Staff member, I want to review
  // equipment requests and update them".
  it("lets Technical Support list and review equipment requests", () => {
    const tech = { id: "tech", role: "TECH_SUPPORT" } as const;
    expect(can(tech, "equipment-request:list")).toBe(true);
    expect(can(tech, "equipment-request:review")).toBe(true);
  });

  it.each(["ORGANISER", "COORDINATOR", "VENUE_STAFF", "ATTENDEE"] as const)(
    "SCRUM-28 TC-28-11: does not let %s review an equipment request",
    (role) => {
      expect(can({ id: "x", role }, "equipment-request:review")).toBe(false);
    },
  );

  it.each(["ORGANISER", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE"] as const)(
    "SCRUM-27 TC-27-12: does not let %s create an equipment request",
    (role) => {
      expect(can({ id: "x", role }, "equipment-request:create")).toBe(false);
    },
  );
});

describe("can — relationship gate", () => {
  const eventOwnedByA = {
    kind: "event" as const,
    organiserId: "orgA",
    coordinatorId: "coord",
    status: "SUBMITTED" as const,
  };

  it("lets an organiser read their own event", () => {
    expect(can(organiserA, "event:read", eventOwnedByA)).toBe(true);
  });

  it("does not let a different organiser read someone else's event", () => {
    expect(can(organiserB, "event:read", eventOwnedByA)).toBe(false);
  });

  it("lets the assigned coordinator read the event", () => {
    expect(can(coordinator, "event:read", eventOwnedByA)).toBe(true);
  });

  it("does not let an unassigned coordinator read the event", () => {
    expect(
      can({ id: "other", role: "COORDINATOR" }, "event:read", eventOwnedByA),
    ).toBe(false);
  });

  it("lets any coordinator read a submitted request nobody has picked up yet", () => {
    const unassigned = { ...eventOwnedByA, coordinatorId: null };
    expect(can(coordinator, "event:read", unassigned)).toBe(true);
  });

  it("hides an unassigned draft from coordinators", () => {
    const draft = {
      ...eventOwnedByA,
      coordinatorId: null,
      status: "DRAFT" as const,
    };
    expect(can(coordinator, "event:read", draft)).toBe(false);
  });

  it("lets an attendee read only their own registration", () => {
    const ownReg = { kind: "registration" as const, userId: "att" };
    const otherReg = { kind: "registration" as const, userId: "someone" };
    expect(can(attendee, "registration:read", ownReg)).toBe(true);
    expect(can(attendee, "registration:read", otherReg)).toBe(false);
  });

  it("lets a user read only their own notifications", () => {
    const own = { kind: "notification" as const, userId: "att" };
    const other = { kind: "notification" as const, userId: "someone" };
    expect(can(attendee, "notification:read", own)).toBe(true);
    expect(can(attendee, "notification:read", other)).toBe(false);
  });

  // SCRUM-27 — a request is raised for the coordinator's own event, so the
  // create action carries the same event relationship as reading it.
  it("lets a coordinator request equipment only for an event they coordinate", () => {
    expect(can(coordinator, "equipment-request:create", eventOwnedByA)).toBe(true);
    expect(
      can(
        { id: "other", role: "COORDINATOR" },
        "equipment-request:create",
        eventOwnedByA,
      ),
    ).toBe(false);
  });

  it("gives no event relationship to a role that holds an event action but isn't the organiser or coordinator", () => {
    // ATTENDEE holds event:browse, so the role gate passes and the event
    // relationship check runs — and must return false (the security fallback).
    expect(
      can(attendee, "event:browse", {
        kind: "event",
        organiserId: "someone-else",
        coordinatorId: null,
        status: "CONFIRMED",
      }),
    ).toBe(false);
  });
});

// SCRUM-81 AC 7 — confirming is stricter than reviewing: only the event's
// assigned Coordinator, never any Coordinator looking at an unassigned request.
describe("can — confirming an event (SCRUM-81)", () => {
  const planning = {
    kind: "event" as const,
    organiserId: "orgA",
    coordinatorId: "coord",
    status: "PLANNING" as const,
  };

  it("SCRUM-81 [AC7] TC-81-07: only the event's assigned Coordinator may confirm it", () => {
    expect(can(coordinator, "event:confirm", planning)).toBe(true);
    expect(can({ id: "other", role: "COORDINATOR" }, "event:confirm", planning)).toBe(false);
    expect(can(organiserA, "event:confirm", planning)).toBe(false);
    expect(can({ id: "vs", role: "VENUE_STAFF" }, "event:confirm", planning)).toBe(false);
    expect(can(attendee, "event:confirm", planning)).toBe(false);
  });

  it("SCRUM-81: no Coordinator may confirm an event nobody is assigned to, though any may still read it", () => {
    const unassigned = { ...planning, coordinatorId: null };
    expect(can(coordinator, "event:confirm", unassigned)).toBe(false);
    expect(can(coordinator, "event:read", unassigned)).toBe(true);
  });
});

// SCRUM-117 AC 5 — rejecting a Planning event follows the same rule as
// confirming it: only the event's assigned Coordinator.
describe("can — rejecting a Planning event (SCRUM-117)", () => {
  const planning = {
    kind: "event" as const,
    organiserId: "orgA",
    coordinatorId: "coord",
    status: "PLANNING" as const,
  };

  it("SCRUM-117 [AC5] TC-117-07: only the event's assigned Coordinator may reject it, and never an unassigned one", () => {
    expect(can(coordinator, "event:reject", planning)).toBe(true);
    expect(can({ id: "other", role: "COORDINATOR" }, "event:reject", planning)).toBe(false);
    expect(can(organiserA, "event:reject", planning)).toBe(false);
    expect(can({ id: "ts", role: "TECH_SUPPORT" }, "event:reject", planning)).toBe(false);
    expect(can(coordinator, "event:reject", { ...planning, coordinatorId: null })).toBe(false);
  });
});

// SCRUM-26 AC7 — resolving a Needs Reconsideration flag follows the same rule
// as confirming: only the event's assigned Coordinator.
describe("can — resolving a flagged arrangement (SCRUM-26)", () => {
  const planning = {
    kind: "event" as const,
    organiserId: "orgA",
    coordinatorId: "coord",
    status: "PLANNING" as const,
  };

  it("SCRUM-26 [AC7] TC-26-05: only the event's assigned Coordinator may resolve a flag, and never an unassigned one", () => {
    expect(can(coordinator, "arrangement:reconsider", planning)).toBe(true);
    expect(can(coordinator, "arrangement:reconsider", { ...planning, status: "CONFIRMED" })).toBe(true);
    expect(can({ id: "other", role: "COORDINATOR" }, "arrangement:reconsider", planning)).toBe(false);
    expect(can(coordinator, "arrangement:reconsider", { ...planning, coordinatorId: null })).toBe(false);
    for (const user of [
      organiserA,
      attendee,
      { id: "vs", role: "VENUE_STAFF" },
      { id: "ts", role: "TECH_SUPPORT" },
      { id: "lead", role: "COORDINATOR_LEAD" },
      { id: "so", role: "SAFETY_OFFICER" },
    ] as SessionUser[]) {
      expect(can(user, "arrangement:reconsider")).toBe(false);
    }
  });
});

// SCRUM-50/52/53 — who may take part in a venue booking. The booking actions
// are new capabilities, so they are pinned here alongside the rest.
describe("can — venue booking capabilities (SCRUM-50/52/53)", () => {
  const venueStaff: SessionUser = { id: "vs", role: "VENUE_STAFF" };
  const techSupport: SessionUser = { id: "ts", role: "TECH_SUPPORT" };
  const assignedEvent = {
    kind: "event" as const,
    organiserId: "orgA",
    coordinatorId: "coord",
    status: "APPROVED" as const,
  };

  it("SCRUM-50 TC-50-09: a coordinator may request a venue for an event assigned to them", () => {
    expect(can(coordinator, "booking:request", assignedEvent)).toBe(true);
  });

  it("SCRUM-50 TC-50-09: a coordinator may not request a venue for another coordinator's event", () => {
    expect(
      can(coordinator, "booking:request", {
        ...assignedEvent,
        coordinatorId: "someone-else",
      }),
    ).toBe(false);
  });

  it("SCRUM-50 TC-50-09: no other role may request a venue", () => {
    for (const user of [organiserA, venueStaff, techSupport, attendee]) {
      expect(can(user, "booking:request")).toBe(false);
    }
  });

  it("SCRUM-52 TC-52-04: only venue staff may read the pending-request queue", () => {
    expect(can(venueStaff, "booking:review")).toBe(true);
    for (const user of [organiserA, coordinator, techSupport, attendee]) {
      expect(can(user, "booking:review")).toBe(false);
    }
  });

  it("SCRUM-53 TC-53-08: only venue staff may approve or reject a request", () => {
    expect(can(venueStaff, "booking:decide")).toBe(true);
    for (const user of [organiserA, coordinator, techSupport, attendee]) {
      expect(can(user, "booking:decide")).toBe(false);
    }
  });
});

// SCRUM-37 — only Venue Staff record non-booking unavailability.
describe("can — recording venue unavailability (SCRUM-37)", () => {
  const venueStaff: SessionUser = { id: "vs", role: "VENUE_STAFF" };
  const techSupport: SessionUser = { id: "ts", role: "TECH_SUPPORT" };

  it("SCRUM-37 [AC6] TC-37-03: venue staff may record unavailability", () => {
    expect(can(venueStaff, "unavailability:record")).toBe(true);
  });

  it("SCRUM-37 [AC6] TC-37-03: no other role may record unavailability", () => {
    for (const user of [organiserA, coordinator, techSupport, attendee]) {
      expect(can(user, "unavailability:record")).toBe(false);
    }
  });
});

// SCRUM-36 — the availability calendar is for the internal roles that plan
// venues: Coordinators requesting them and Venue Staff deciding on them.
describe("can — viewing venue availability (SCRUM-36)", () => {
  const venueStaff: SessionUser = { id: "vs", role: "VENUE_STAFF" };
  const techSupport: SessionUser = { id: "ts", role: "TECH_SUPPORT" };

  it("SCRUM-36 [AC7] TC-36-07: coordinators and venue staff may view venue availability", () => {
    expect(can(coordinator, "venue:availability")).toBe(true);
    expect(can(venueStaff, "venue:availability")).toBe(true);
  });

  it("SCRUM-36 [AC7] TC-36-07: organisers, tech support and attendees may not", () => {
    for (const user of [organiserA, techSupport, attendee]) {
      expect(can(user, "venue:availability")).toBe(false);
    }
  });
});

// SCRUM-172 AC1 — the two Week 7 roles exist before the stories that give
// them work. Until SCRUM-165 and SCRUM-166 grant more, each may only read its
// own notifications, and neither can decide, plan or edit an event (SCRUM-164
// AC2).
describe("can — the Week 7 roles before their stories", () => {
  it.each(["COORDINATOR_LEAD", "SAFETY_OFFICER"] as const)(
    "SCRUM-172 [AC1] TC-172-01: %s reads only its own notifications and can't decide, plan or edit an event",
    (role) => {
      const user: SessionUser = { id: "usr_new", role };
      expect(can(user, "notification:read", { kind: "notification", userId: "usr_new" })).toBe(true);
      expect(can(user, "notification:read", { kind: "notification", userId: "someone" })).toBe(false);
      for (const action of [
        "event:create",
        "event:review",
        "event:confirm",
        "event:reject",
        "booking:decide",
        "unavailability:record",
        "equipment:reserve",
      ] as const) {
        expect(can(user, action)).toBe(false);
      }
    },
  );
});

// SCRUM-82 AC1 — cancelling follows the same rule as confirming and rejecting.
describe("can — cancelling an event (SCRUM-82)", () => {
  const confirmed = {
    kind: "event" as const,
    organiserId: "orgA",
    coordinatorId: "coord",
    status: "CONFIRMED" as const,
  };

  it("SCRUM-82 [AC1] TC-82-03: only the event's assigned Coordinator may cancel it, never an unassigned one", () => {
    expect(can(coordinator, "event:cancel", confirmed)).toBe(true);
    expect(can({ id: "other", role: "COORDINATOR" }, "event:cancel", confirmed)).toBe(false);
    expect(can(coordinator, "event:cancel", { ...confirmed, coordinatorId: null })).toBe(false);
    for (const user of [organiserA, attendee, { id: "so", role: "SAFETY_OFFICER" }] as SessionUser[]) {
      expect(can(user, "event:cancel")).toBe(false);
    }
  });
});

// SCRUM-166 — the Coordinator requests a check for their own event; a Safety
// Officer reviews any event's check except one they organise or coordinate.
describe("can — the operational safety check (SCRUM-166)", () => {
  const planning = {
    kind: "event" as const,
    organiserId: "orgA",
    coordinatorId: "coord",
    status: "PLANNING" as const,
  };
  const officer: SessionUser = { id: "safety", role: "SAFETY_OFFICER" };

  it("SCRUM-166 [AC1] TC-166-03: only the event's assigned Coordinator may request its safety check", () => {
    expect(can(coordinator, "safety-check:request", planning)).toBe(true);
    expect(can({ id: "other", role: "COORDINATOR" }, "safety-check:request", planning)).toBe(false);
    expect(can(coordinator, "safety-check:request", { ...planning, coordinatorId: null })).toBe(false);
    for (const user of [organiserA, attendee, officer, { id: "vs", role: "VENUE_STAFF" }] as SessionUser[]) {
      expect(can(user, "safety-check:request")).toBe(false);
    }
  });

  it("SCRUM-166 [AC6] TC-166-09: only a Safety Officer reviews a check, and never for an event they organise or coordinate", () => {
    expect(can(officer, "safety-check:review", planning)).toBe(true);
    expect(can(officer, "safety-check:review", { ...planning, organiserId: "safety" })).toBe(false);
    expect(can(officer, "safety-check:review", { ...planning, coordinatorId: "safety" })).toBe(false);
    for (const user of [
      organiserA,
      coordinator,
      attendee,
      { id: "vs", role: "VENUE_STAFF" },
      { id: "ts", role: "TECH_SUPPORT" },
      { id: "lead", role: "COORDINATOR_LEAD" },
    ] as SessionUser[]) {
      expect(can(user, "safety-check:review")).toBe(false);
    }
  });
});
