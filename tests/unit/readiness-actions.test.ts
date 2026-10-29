import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getConfirmedArrangements,
  getEventVenueBookings,
  getReadinessChecklist,
  type ConfirmedArrangements,
  type ReadinessChecklist,
} from "@/lib/event-readiness";
import {
  getEquipmentCatalogue,
  getEventEquipmentRequests,
} from "@/lib/equipment/request-queries";
import {
  getEventArrangements,
  getEventBookings,
  getEventCoordinator,
  getEventEquipment,
  getEventReadiness,
  isEventStillVisible,
} from "@/app/(app)/events/readiness-actions";

// SCRUM-110 AC 6 — who may read an event's readiness checklist, and how much of
// it. Session and database are mocked; the checklist itself is covered by
// event-readiness.test.ts, so here it is a fixed answer with a reason in it.

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: { findUnique: vi.fn() }, auditLog: { count: vi.fn() } },
}));
vi.mock("@/lib/event-readiness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/event-readiness")>()),
  getReadinessChecklist: vi.fn(),
  getConfirmedArrangements: vi.fn(),
  getEventVenueBookings: vi.fn(),
}));
vi.mock("@/lib/equipment/request-queries", () => ({
  getEquipmentCatalogue: vi.fn(),
  getEventEquipmentRequests: vi.fn(),
}));

const mockAuth = auth as unknown as Mock;
const mockEventFindUnique = prisma.event.findUnique as unknown as Mock;
const mockAuditCount = prisma.auditLog.count as unknown as Mock;
const mockChecklist = getReadinessChecklist as unknown as Mock;
const mockArrangements = getConfirmedArrangements as unknown as Mock;
const mockVenueBookings = getEventVenueBookings as unknown as Mock;
const mockCatalogue = getEquipmentCatalogue as unknown as Mock;
const mockEventRequests = getEventEquipmentRequests as unknown as Mock;

const REASON = "Boardroom seats 14; the event expects 55 attendees.";
const checklist: ReadinessChecklist = {
  ready: false,
  items: [
    {
      name: "Venue booking",
      complete: false,
      state: "Rejected",
      reason: REASON,
    },
    {
      name: "Equipment",
      complete: false,
      state: "Not fully reserved: Projector",
      reason: null,
    },
  ],
};

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

function eventRow(status: EventStatus = "PLANNING") {
  return {
    organiserId: "usr_organiser",
    coordinatorId: "usr_coordinator",
    status,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEventFindUnique.mockResolvedValue(eventRow());
  mockChecklist.mockResolvedValue(checklist);
  mockAuditCount.mockResolvedValue(0);
});

describe("isEventStillVisible — SCRUM-24, SCRUM-208", () => {
  it.each([
    { who: "its Organiser", session: sessionFor("ORGANISER", "usr_organiser"), visible: true },
    { who: "its Coordinator", session: sessionFor("COORDINATOR", "usr_coordinator"), visible: true },
    { who: "a Coordinator it was reassigned away from", session: sessionFor("COORDINATOR", "usr_coordinator_2"), visible: false },
    { who: "a signed-out visitor", session: null, visible: false },
  ])("SCRUM-208 TC-208-16: for $who, the open page is still visible: $visible", async ({ session, visible }) => {
    mockAuth.mockResolvedValue(session);

    expect(await isEventStillVisible("evt_test")).toBe(visible);
  });

  it("SCRUM-208 TC-208-16: an event that was removed is no longer visible", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockEventFindUnique.mockResolvedValue(null);

    expect(await isEventStillVisible("evt_test")).toBe(false);
  });
});

describe("getEventReadiness — SCRUM-110", () => {
  it("SCRUM-110 [AC6] TC-110-11: the assigned Coordinator gets the full checklist, internal reasons included", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));

    const result = await getEventReadiness("evt_test");

    expect(result).toEqual({
      ok: true,
      data: {
        ...checklist,
        canConfirm: true,
        canReject: true,
        canSettleHold: true,
        canWithdrawBooking: true,
        canRecordNoEquipment: true,
        canRequestSafetyCheck: false,
        // SCRUM-209 AC1: Find a venue, for the assigned Coordinator in Planning.
        canRequestVenue: true,
      },
    });
    expect(mockChecklist).toHaveBeenCalledWith(prisma, "evt_test");
  });

  it("SCRUM-110 [AC6] TC-110-12: the Organiser gets the same items and states, without internal reasons", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    const result = await getEventReadiness("evt_test");

    expect(result).toEqual({
      ok: true,
      data: {
        ready: false,
        items: [{ ...checklist.items[0], reason: null }, checklist.items[1]],
        canConfirm: false,
        canReject: false,
        canSettleHold: false,
        canWithdrawBooking: false,
        canRecordNoEquipment: false,
        canRequestSafetyCheck: false,
        canRequestVenue: false,
      },
    });
  });

  it.each([
    {
      who: "another Organiser",
      session: sessionFor("ORGANISER", "usr_organiser2"),
    },
    {
      who: "another Coordinator",
      session: sessionFor("COORDINATOR", "usr_coordinator2"),
    },
    {
      who: "Venue Staff",
      session: sessionFor("VENUE_STAFF", "usr_venuestaff"),
    },
    {
      who: "Technical Support",
      session: sessionFor("TECH_SUPPORT", "usr_techsupport"),
    },
    { who: "an Attendee", session: sessionFor("ATTENDEE", "usr_attendee") },
    { who: "a signed-out visitor", session: null },
  ])(
    "SCRUM-110 [AC6] TC-110-13: $who is told the event was not found, and nothing is read",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);

      const result = await getEventReadiness("evt_test");

      expect(result).toEqual({ ok: false, error: "Event not found." });
      expect(mockChecklist).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-110 [AC6] TC-110-13: a missing event gives the same answer as one the viewer may not see", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));
    mockEventFindUnique.mockResolvedValue(null);

    const result = await getEventReadiness("evt_missing");

    expect(result).toEqual({ ok: false, error: "Event not found." });
    expect(mockChecklist).not.toHaveBeenCalled();
  });

  it("SCRUM-110 [AC6] TC-110-13: the event vanishing between the two reads is also not found", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));
    mockChecklist.mockResolvedValue(null);

    expect(await getEventReadiness("evt_test")).toEqual({
      ok: false,
      error: "Event not found.",
    });
  });
});

const arrangements: ConfirmedArrangements = {
  venues: [{ name: "Exhibition Hall", location: "Level 1" }],
  startAt: new Date("2031-06-02T01:00:00Z"),
  endAt: new Date("2031-06-02T09:00:00Z"),
  timezone: "Asia/Singapore",
  equipment: ["Projector × 2"],
};

describe("getEventReadiness — SCRUM-81 Confirm action", () => {
  it("SCRUM-81 [AC3, AC7] TC-81-02, TC-81-08: only the event's assigned Coordinator is offered Confirm", async () => {
    const offered = async (
      session: Session,
      event: {
        organiserId: string;
        coordinatorId: string | null;
        status: EventStatus;
      } = eventRow(),
    ) => {
      mockAuth.mockResolvedValue(session);
      mockEventFindUnique.mockResolvedValue(event);
      const result = await getEventReadiness("evt_test");
      return result.ok && result.data.canConfirm;
    };

    expect(await offered(sessionFor("COORDINATOR", "usr_coordinator"))).toBe(
      true,
    );
    expect(await offered(sessionFor("ORGANISER", "usr_organiser"))).toBe(false);
    expect(
      await offered(sessionFor("COORDINATOR", "usr_coordinator"), {
        ...eventRow(),
        coordinatorId: null,
      }),
    ).toBe(false);
  });
});

describe("getEventReadiness — SCRUM-117 Reject action", () => {
  const offered = async (
    session: Session,
    event: {
      organiserId: string;
      coordinatorId: string | null;
      status: EventStatus;
    } = eventRow(),
  ) => {
    mockAuth.mockResolvedValue(session);
    mockEventFindUnique.mockResolvedValue(event);
    const result = await getEventReadiness("evt_test");
    return result.ok && result.data.canReject;
  };

  it("SCRUM-117 [AC5] TC-117-07: only the event's assigned Coordinator is offered Reject", async () => {
    expect(await offered(sessionFor("COORDINATOR", "usr_coordinator"))).toBe(
      true,
    );
    expect(await offered(sessionFor("ORGANISER", "usr_organiser"))).toBe(false);
    expect(
      await offered(sessionFor("COORDINATOR", "usr_coordinator"), {
        ...eventRow(),
        coordinatorId: null,
      }),
    ).toBe(false);
  });

  it("SCRUM-117 [AC4] TC-117-05: an event that was ever Confirmed is not offered Reject", async () => {
    mockAuditCount.mockResolvedValue(1);

    expect(await offered(sessionFor("COORDINATOR", "usr_coordinator"))).toBe(
      false,
    );
    expect(mockAuditCount).toHaveBeenCalledWith({
      where: {
        entityType: "Event",
        entityId: "evt_test",
        fieldName: "status",
        newValue: "CONFIRMED",
      },
    });
  });
});

describe("getEventArrangements — SCRUM-81 AC6", () => {
  beforeEach(() => {
    mockArrangements.mockResolvedValue(arrangements);
    mockEventFindUnique.mockResolvedValue(eventRow("CONFIRMED"));
  });

  it.each([
    { who: "its Organiser", session: sessionFor("ORGANISER", "usr_organiser") },
    {
      who: "its Coordinator",
      session: sessionFor("COORDINATOR", "usr_coordinator"),
    },
  ])(
    "SCRUM-81 [AC6] TC-81-06: $who sees the confirmed venue, date/time and reserved equipment",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);

      expect(await getEventArrangements("evt_test")).toEqual({
        ok: true,
        data: arrangements,
      });
      expect(mockArrangements).toHaveBeenCalledWith(prisma, "evt_test");
    },
  );

  it.each([
    {
      who: "another Organiser",
      session: sessionFor("ORGANISER", "usr_organiser2"),
    },
    { who: "an Attendee", session: sessionFor("ATTENDEE", "usr_attendee") },
    { who: "a signed-out visitor", session: null },
  ])(
    "SCRUM-81 [AC6]: $who is told the event was not found",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);

      expect(await getEventArrangements("evt_test")).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expect(mockArrangements).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-81 [AC6]: a missing event, or one that vanishes between the reads, is not found", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockEventFindUnique.mockResolvedValueOnce(null);
    expect(await getEventArrangements("evt_missing")).toEqual({
      ok: false,
      error: "Event not found.",
    });

    mockArrangements.mockResolvedValue(null);
    expect(await getEventArrangements("evt_test")).toEqual({
      ok: false,
      error: "Event not found.",
    });
  });
});

describe("getEventReadiness — SCRUM-166 Request safety check", () => {
  const arranged = (safetyState: string): ReadinessChecklist => ({
    ready: false,
    items: [
      { name: "Venue booking", complete: true, state: "Approved", reason: null },
      { name: "Equipment", complete: true, state: "Reserved", reason: null },
      { name: "Safety check", complete: false, state: safetyState, reason: null },
    ],
  });
  const offered = async (session: Session, status: EventStatus = "PLANNING") => {
    mockAuth.mockResolvedValue(session);
    mockEventFindUnique.mockResolvedValue(eventRow(status));
    const result = await getEventReadiness("evt_test");
    return result.ok && result.data.canRequestSafetyCheck;
  };
  const coordinator = sessionFor("COORDINATOR", "usr_coordinator");

  it("SCRUM-166 [AC1, AC12] TC-166-01: offered to the assigned Coordinator once the venue and equipment are complete, with no check, or after Changes requested, Rejected or Outdated", async () => {
    for (const state of ["Not requested", "Changes requested", "Rejected", "Outdated"]) {
      mockChecklist.mockResolvedValue(arranged(state));
      expect(await offered(coordinator)).toBe(true);
    }
  });

  it("SCRUM-166 [AC1, AC7] TC-166-02: not offered while a check awaits review or is approved, before the venue and equipment are complete, outside Planning, or to anyone but the assigned Coordinator", async () => {
    mockChecklist.mockResolvedValue(arranged("Awaiting review"));
    expect(await offered(coordinator)).toBe(false);
    mockChecklist.mockResolvedValue(arranged("Approved"));
    expect(await offered(coordinator)).toBe(false);

    mockChecklist.mockResolvedValue(checklist);
    expect(await offered(coordinator)).toBe(false);

    mockChecklist.mockResolvedValue(arranged("Not requested"));
    expect(await offered(coordinator, "CONFIRMED")).toBe(false);
    expect(await offered(sessionFor("ORGANISER", "usr_organiser"))).toBe(false);
  });
});

describe("getEventReadiness — SCRUM-170 No equipment needed", () => {
  it("SCRUM-170 [AC4] TC-170-10: only the event's assigned Coordinator is offered No equipment needed", async () => {
    const offered = async (
      session: Session,
      event:
        | ReturnType<typeof eventRow>
        | {
            organiserId: string;
            coordinatorId: null;
            status: EventStatus;
          } = eventRow(),
    ) => {
      mockAuth.mockResolvedValue(session);
      mockEventFindUnique.mockResolvedValue(event);
      const result = await getEventReadiness("evt_test");
      return result.ok && result.data.canRecordNoEquipment;
    };

    expect(await offered(sessionFor("COORDINATOR", "usr_coordinator"))).toBe(
      true,
    );
    expect(await offered(sessionFor("ORGANISER", "usr_organiser"))).toBe(false);
    expect(
      await offered(sessionFor("COORDINATOR", "usr_coordinator"), {
        ...eventRow(),
        coordinatorId: null,
      }),
    ).toBe(false);
  });
});

describe("getEventBookings — SCRUM-162 AC7", () => {
  const bookings = [
    {
      id: "b1",
      venueName: "Main Hall",
      attendance: 200,
      status: "APPROVED",
      startAt: new Date("2031-06-02T01:00:00Z"),
      endAt: new Date("2031-06-02T09:00:00Z"),
    },
  ];

  beforeEach(() => {
    mockVenueBookings.mockResolvedValue(bookings);
  });

  it.each([
    { who: "its Organiser", session: sessionFor("ORGANISER", "usr_organiser") },
    {
      who: "its Coordinator",
      session: sessionFor("COORDINATOR", "usr_coordinator"),
    },
  ])(
    "SCRUM-162 [AC7] TC-162-11: $who sees every venue booking of the event",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);

      expect(await getEventBookings("evt_test")).toEqual({
        ok: true,
        data: bookings,
      });
      expect(mockVenueBookings).toHaveBeenCalledWith(prisma, "evt_test");
    },
  );

  it.each([
    {
      who: "another Organiser",
      session: sessionFor("ORGANISER", "usr_organiser2"),
    },
    {
      who: "a Coordinator it isn't assigned to",
      session: sessionFor("COORDINATOR", "usr_coordinator_2"),
    },
    { who: "an Attendee", session: sessionFor("ATTENDEE", "usr_attendee") },
    { who: "a signed-out visitor", session: null },
  ])(
    "SCRUM-162 [AC7] TC-162-11: $who is told the event was not found, and no booking is read",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);

      expect(await getEventBookings("evt_test")).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expect(mockVenueBookings).not.toHaveBeenCalled();
    },
  );
});

describe("getEventCoordinator — SCRUM-21 AC8", () => {
  it.each([
    { who: "its Organiser", session: sessionFor("ORGANISER", "usr_organiser") },
    {
      who: "its Coordinator",
      session: sessionFor("COORDINATOR", "usr_coordinator"),
    },
  ])(
    "SCRUM-21 [AC8] TC-21-08: $who sees the current Coordinator's name",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);
      mockEventFindUnique
        .mockResolvedValueOnce(eventRow())
        .mockResolvedValueOnce({ coordinator: { name: "Cara Coordinator" } });

      expect(await getEventCoordinator("evt_test")).toEqual({
        ok: true,
        data: { name: "Cara Coordinator" },
      });
    },
  );

  it("SCRUM-21 [AC8] TC-21-08: an event with no Coordinator reads as none", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockEventFindUnique
      .mockResolvedValueOnce({ ...eventRow("SUBMITTED"), coordinatorId: null })
      .mockResolvedValueOnce({ coordinator: null });

    expect(await getEventCoordinator("evt_test")).toEqual({
      ok: true,
      data: { name: null },
    });
  });

  it.each([
    { who: "another Organiser", session: sessionFor("ORGANISER", "usr_organiser2") },
    { who: "an Attendee", session: sessionFor("ATTENDEE", "usr_attendee") },
    { who: "a signed-out visitor", session: null },
  ])(
    "SCRUM-21 [AC8] TC-21-08: $who is told the event was not found",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);

      expect(await getEventCoordinator("evt_test")).toEqual({
        ok: false,
        error: "Event not found.",
      });
    },
  );
});

describe("getEventEquipment — SCRUM-209 AC2, AC4", () => {
  const details = {
    id: "evt_test",
    name: "Spring Gala",
    startAt: new Date("2031-06-02T01:00:00Z"),
    endAt: new Date("2031-06-02T09:00:00Z"),
    equipmentRequirements: "Two projectors",
  };
  const request = {
    id: "req_1",
    status: "PENDING_REVIEW",
    notes: "Projector bulb on order.",
    updates: [{ id: "upd_1" }],
  };
  const catalogue = [{ id: "eq_projector", name: "Projector" }];

  function eventIs(status: EventStatus) {
    mockEventFindUnique
      .mockReset()
      .mockResolvedValueOnce(eventRow(status))
      .mockResolvedValueOnce(details);
  }

  beforeEach(() => {
    eventIs("PLANNING");
    mockEventRequests.mockResolvedValue([request]);
    mockCatalogue.mockResolvedValue(catalogue);
  });

  it("SCRUM-209 [AC2] TC-209-03: the assigned Coordinator gets the request in full, with its history and the catalogue, and may request and change", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));

    expect(await getEventEquipment("evt_test")).toEqual({
      ok: true,
      data: {
        requests: [request],
        canCreate: true,
        canChange: true,
        event: details,
        equipment: catalogue,
      },
    });
    expect(mockEventRequests).toHaveBeenCalledWith("evt_test");
  });

  it.each([
    // SCRUM-233: no event stays Approved, so SCRUM-27 no longer offers it.
    { status: "APPROVED" as const, offered: false },
    { status: "PLANNING" as const, offered: true },
    { status: "UNDER_REVIEW" as const, offered: false },
    { status: "CONFIRMED" as const, offered: false },
  ])(
    "SCRUM-209 [AC2, AC4] TC-209-03: at $status, a new request offered is $offered (SCRUM-27's own rule)",
    async ({ status, offered }) => {
      mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));
      eventIs(status);

      const result = await getEventEquipment("evt_test");

      expect(result.ok && result.data.canCreate).toBe(offered);
    },
  );

  it("SCRUM-209 [AC2] TC-209-03: the event vanishing between the two reads is not found, and no request is read", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));
    mockEventFindUnique.mockReset().mockResolvedValueOnce(eventRow()).mockResolvedValueOnce(null);

    expect(await getEventEquipment("evt_test")).toEqual({ ok: false, error: "Event not found." });
    expect(mockEventRequests).not.toHaveBeenCalled();
  });

  it("SCRUM-209 [AC4] TC-209-08: the Organiser reads the lines and status only: no notes, no history, no catalogue, no actions", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    expect(await getEventEquipment("evt_test")).toEqual({
      ok: true,
      data: {
        requests: [{ ...request, notes: null, updates: [] }],
        canCreate: false,
        canChange: false,
        event: details,
        equipment: [],
      },
    });
    expect(mockCatalogue).not.toHaveBeenCalled();
  });

  it.each([
    {
      who: "a Coordinator it isn't assigned to",
      session: sessionFor("COORDINATOR", "usr_coordinator_2"),
    },
    { who: "another Organiser", session: sessionFor("ORGANISER", "usr_organiser2") },
    { who: "a signed-out visitor", session: null },
  ])(
    "SCRUM-209 [AC4] TC-209-09: $who is told the event was not found, and no request is read",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);

      expect(await getEventEquipment("evt_test")).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expect(mockEventRequests).not.toHaveBeenCalled();
    },
  );
});

describe("getEventReadiness — SCRUM-209 AC1 Find a venue", () => {
  it.each([
    { who: "the assigned Coordinator in Approved", id: "usr_coordinator", role: "COORDINATOR" as const, status: "APPROVED" as const, offered: true },
    { who: "the assigned Coordinator in Confirmed", id: "usr_coordinator", role: "COORDINATOR" as const, status: "CONFIRMED" as const, offered: false },
    { who: "the Organiser", id: "usr_organiser", role: "ORGANISER" as const, status: "PLANNING" as const, offered: false },
  ])(
    "SCRUM-209 [AC1, AC4] TC-209-01: Find a venue for $who is offered: $offered",
    async ({ id, role, status, offered }) => {
      mockAuth.mockResolvedValue(sessionFor(role, id));
      mockEventFindUnique.mockResolvedValue(eventRow(status));

      const result = await getEventReadiness("evt_test");

      expect(result.ok && result.data.canRequestVenue).toBe(offered);
    },
  );
});
