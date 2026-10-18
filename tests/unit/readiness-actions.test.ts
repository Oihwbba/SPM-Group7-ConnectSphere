import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getConfirmedArrangements,
  getReadinessChecklist,
  type ConfirmedArrangements,
  type ReadinessChecklist,
} from "@/lib/event-readiness";
import {
  getEventArrangements,
  getEventCoordinator,
  getEventReadiness,
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
}));

const mockAuth = auth as unknown as Mock;
const mockEventFindUnique = prisma.event.findUnique as unknown as Mock;
const mockAuditCount = prisma.auditLog.count as unknown as Mock;
const mockChecklist = getReadinessChecklist as unknown as Mock;
const mockArrangements = getConfirmedArrangements as unknown as Mock;

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
  venue: { name: "Exhibition Hall", location: "Level 1" },
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
