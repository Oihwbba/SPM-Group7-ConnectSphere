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

  // The Venue Catalogue (venue:read) is Coordinator-only. Pin both sides so a
  // one-line re-grant of venue:read to VENUE_STAFF can't silently re-open it.
  it("does not let venue staff read the venue catalogue", () => {
    expect(can({ id: "vs", role: "VENUE_STAFF" }, "venue:read")).toBe(false);
  });

  it("lets a coordinator read the venue catalogue", () => {
    expect(can(coordinator, "venue:read")).toBe(true);
  });

  // SCRUM-27 — "As an Event Coordinator, I want to create an equipment
  // request". Only coordinators raise requests; Technical Support reviews them.
  it("lets a coordinator create and list equipment requests", () => {
    expect(can(coordinator, "equipment-request:create")).toBe(true);
    expect(can(coordinator, "equipment-request:list")).toBe(true);
  });

  it.each(["ORGANISER", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE"] as const)(
    "does not let %s create an equipment request",
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

  it("SCRUM-50 — a coordinator may request a venue for an event assigned to them", () => {
    expect(can(coordinator, "booking:request", assignedEvent)).toBe(true);
  });

  it("SCRUM-50 — a coordinator may not request a venue for another coordinator's event", () => {
    expect(
      can(coordinator, "booking:request", {
        ...assignedEvent,
        coordinatorId: "someone-else",
      }),
    ).toBe(false);
  });

  it("SCRUM-50 — no other role may request a venue", () => {
    for (const user of [organiserA, venueStaff, techSupport, attendee]) {
      expect(can(user, "booking:request")).toBe(false);
    }
  });

  it("SCRUM-52 — only venue staff may read the pending-request queue", () => {
    expect(can(venueStaff, "booking:review")).toBe(true);
    for (const user of [organiserA, coordinator, techSupport, attendee]) {
      expect(can(user, "booking:review")).toBe(false);
    }
  });

  it("SCRUM-53 — only venue staff may approve or reject a request", () => {
    expect(can(venueStaff, "booking:decide")).toBe(true);
    for (const user of [organiserA, coordinator, techSupport, attendee]) {
      expect(can(user, "booking:decide")).toBe(false);
    }
  });
});
