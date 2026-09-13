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
});
