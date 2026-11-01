import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getReadinessChecklist,
  type ReadinessChecklist,
} from "@/lib/event-readiness";
import { confirmEvent } from "@/app/(app)/events/actions";
import { OVERDUE_REFUSAL } from "@/lib/event-closing";
import { EVENT_STATUS_LABEL } from "@/lib/event-lifecycle";
import { formatDateTime } from "@/lib/datetime";

// SCRUM-81 — the assigned Coordinator confirms a Planning event whose
// SCRUM-110 checklist is complete. Test cases: docs/testing/SCRUM-81.md.
// Session, database and the checklist are mocked; the transaction runs its
// callback against a mock `tx`, as in event-status.test.ts.

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  notification: { createMany: vi.fn() },
  booking: { findMany: vi.fn() },
  registration: { findMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("@/lib/event-readiness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/event-readiness")>()),
  getReadinessChecklist: vi.fn(),
}));

const mockAuth = auth as unknown as Mock;
const mockFindUnique = prisma.event.findUnique as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;
const mockChecklist = getReadinessChecklist as unknown as Mock;

const ready: ReadinessChecklist = {
  ready: true,
  items: [
    {
      name: "Venue booking",
      complete: true,
      state: "Approved",
      reason: null,
    },
  ],
};
const notReady: ReadinessChecklist = {
  ready: false,
  items: [
    {
      name: "Venue booking",
      complete: false,
      state: "Pending",
      reason: null,
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

function eventRow(
  over: Partial<{
    status: EventStatus;
    coordinatorId: string | null;
    registrationRequired: boolean | null;
    startAt: Date | null;
  }> = {},
) {
  return {
    organiserId: "usr_organiser",
    coordinatorId: "usr_coordinator" as string | null,
    status: "PLANNING" as EventStatus,
    registrationRequired: null as boolean | null,
    startAt: new Date("2099-06-01T02:00:00Z") as Date | null,
    // SCRUM-85: never confirmed before, unless a case says otherwise.
    confirmedStartAt: null as Date | null,
    confirmedEndAt: null as Date | null,
    confirmedVenues: [] as string[],
    ...over,
  };
}

const coordinator = () => sessionFor("COORDINATOR", "usr_coordinator");

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(coordinator());
  mockFindUnique.mockResolvedValue(eventRow());
  tx.event.findUniqueOrThrow.mockResolvedValue(eventRow());
  tx.event.update.mockResolvedValue({});
  tx.auditLog.create.mockResolvedValue({});
  tx.booking.findMany.mockResolvedValue([]);
  tx.registration.findMany.mockResolvedValue([]);
  mockChecklist.mockResolvedValue(ready);
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

function expectNothingWritten() {
  expect(tx.event.update).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
}

describe("confirmEvent — SCRUM-81", () => {
  it("SCRUM-81 [AC5] TC-81-05: confirming a ready event makes it Confirmed, opens registration and records the confirming Coordinator in its history", async () => {
    const result = await confirmEvent({ eventId: "evt1" });

    expect(result).toEqual({ ok: true, data: { status: "CONFIRMED" } });
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: expect.objectContaining({
        status: "CONFIRMED",
        registrationEnabled: true,
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "Event",
        entityId: "evt1",
        action: "STATUS_CHANGED",
        actorId: "usr_coordinator",
        fieldName: "status",
        oldValue: "PLANNING",
        newValue: "CONFIRMED",
      }),
    });
  });

  it.each([
    { needed: "Yes", registrationRequired: true, opens: true },
    {
      needed: "not chosen (an older request)",
      registrationRequired: null,
      opens: true,
    },
    { needed: "No", registrationRequired: false, opens: false },
  ])(
    "SCRUM-81 [AC5] TC-81-13: with Registration needed $needed, confirming opens registration: $opens",
    async ({ registrationRequired, opens }) => {
      tx.event.findUniqueOrThrow.mockResolvedValue(
        eventRow({ registrationRequired }),
      );

      await confirmEvent({ eventId: "evt1" });

      expect(tx.event.update).toHaveBeenCalledWith({
        where: { id: "evt1" },
        data: expect.objectContaining({
          status: "CONFIRMED",
          registrationEnabled: opens,
        }),
      });
    },
  );

  it("SCRUM-45 [AC4, AC11] TC-45-04: with registration not needed, the Organiser is told it is confirmed, and no registration-closed notice is written", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue({
      ...eventRow({ registrationRequired: false }),
      name: "Gala",
      startAt: new Date("2031-06-01T01:00:00.000Z"),
      registrationClosesAt: null,
    });

    await confirmEvent({ eventId: "evt1" });

    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    expect(tx.notification.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        userId: "usr_organiser",
        eventId: "evt1",
        title: "Your event is confirmed",
        message: '"Gala" is confirmed.',
      }),
    ]);
  });

  it("SCRUM-45 [AC4, AC11] TC-45-07: with registration already closed, the confirmation says so and no closed notice is written to show at once", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue({
      ...eventRow(),
      name: "Gala",
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      registrationOpensAt: null,
      registrationClosesAt: new Date(Date.now() - 60 * 1000),
    });

    await confirmEvent({ eventId: "evt1" });

    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    expect(tx.notification.createMany.mock.calls[0][0].data[0].message).toBe(
      '"Gala" is confirmed, but its registration has already closed.',
    );
  });

  it("SCRUM-45 [AC4] TC-45-04: with registration opening later, the confirmation says when rather than that it is open", async () => {
    const opensAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    tx.event.findUniqueOrThrow.mockResolvedValue({
      ...eventRow(),
      name: "Gala",
      startAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      registrationOpensAt: opensAt,
      registrationClosesAt: null,
    });

    await confirmEvent({ eventId: "evt1" });

    expect(tx.notification.createMany.mock.calls[0][0].data[0].message).toBe(
      `"Gala" is confirmed. Registration opens at ${formatDateTime(opensAt)}.`,
    );
  });

  it("SCRUM-45 [AC11] TC-45-07: a registration window closing before the event starts shows its notice at the closing time", async () => {
    const closesAt = new Date("2031-05-30T10:00:00.000Z");
    tx.event.findUniqueOrThrow.mockResolvedValue({
      ...eventRow(),
      name: "Gala",
      startAt: new Date("2031-06-01T01:00:00.000Z"),
      registrationClosesAt: closesAt,
    });

    await confirmEvent({ eventId: "evt1" });

    const closed = tx.notification.createMany.mock.calls[1][0].data;
    expect(
      closed.map((n: { userId: string; showFromAt: Date }) => [
        n.userId,
        n.showFromAt,
      ]),
    ).toEqual([
      ["usr_organiser", closesAt],
      ["usr_coordinator", closesAt],
    ]);
    expect(closed[0].message).toBe(
      // How the time reads is lib/datetime's (SCRUM-129); this checks the notice
      // says it, without pinning the ICU's output (reviewer memory, #87).
      `Registration for "Gala" closed at ${formatDateTime(closesAt)}.`,
    );
  });

  it("SCRUM-81 [AC5, AC8]: readiness is checked inside the transaction, after the event is locked", async () => {
    await confirmEvent({ eventId: "evt1" });

    expect(mockChecklist).toHaveBeenCalledWith(tx, "evt1");
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockChecklist.mock.invocationCallOrder[0],
    );
  });

  it("SCRUM-81 [AC4] TC-81-04: an event that is not ready is refused, the outstanding items are named, and nothing changes", async () => {
    mockChecklist.mockResolvedValue(notReady);

    const result = await confirmEvent({ eventId: "evt1" });

    expect(result).toEqual({
      ok: false,
      error:
        "This event isn't ready to confirm yet. Outstanding: Venue booking (Pending), Equipment (Not fully reserved: Projector).",
    });
    expectNothingWritten();
  });

  it("SCRUM-131 [AC3] TC-131-10: a flagged booking is named in the refusal with Needs Reconsideration beside its status, and nothing changes", async () => {
    mockChecklist.mockResolvedValue({
      ready: false,
      items: [
        {
          name: "Venue booking",
          complete: false,
          state: "Approved",
          reason: "The event's expected attendance changed.",
          needsReconsideration: true,
        },
      ],
    } satisfies ReadinessChecklist);

    const result = await confirmEvent({ eventId: "evt1" });

    expect(result).toEqual({
      ok: false,
      error:
        "This event isn't ready to confirm yet. Outstanding: Venue booking (Approved – Needs Reconsideration).",
    });
    expectNothingWritten();
  });

  it.each([
    {
      when: "already Confirmed when first read",
      first: "CONFIRMED" as EventStatus,
    },
    {
      when: "confirmed by another request while this one waited for the lock",
      first: "PLANNING" as EventStatus,
    },
  ])(
    "SCRUM-81 [AC8] TC-81-09: an event $when is reported as confirmed, with no second confirmation recorded",
    async ({ first }) => {
      mockFindUnique.mockResolvedValue(eventRow({ status: first }));
      tx.event.findUniqueOrThrow.mockResolvedValue(
        eventRow({ status: "CONFIRMED" }),
      );

      const result = await confirmEvent({ eventId: "evt1" });

      expect(result).toEqual({ ok: true, data: { status: "CONFIRMED" } });
      expectNothingWritten();
      expect(mockChecklist).not.toHaveBeenCalled();
    },
  );

  it.each([
    "UNDER_REVIEW",
    "APPROVED",
    "CANCELLED",
    "COMPLETED",
  ] as EventStatus[])(
    "SCRUM-81 [AC5] TC-81-11, SCRUM-135 [AC11]: a %s event cannot be confirmed, and the refusal names its status",
    async (status) => {
      mockFindUnique.mockResolvedValue(eventRow({ status }));
      tx.event.findUniqueOrThrow.mockResolvedValue(eventRow({ status }));

      expect(await confirmEvent({ eventId: "evt1" })).toEqual({
        ok: false,
        error: `This event is ${EVENT_STATUS_LABEL[status]}, so it can't be confirmed.`,
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-81 [AC7]: an event reassigned to someone else while this request waited is refused, and nothing changes", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(
      eventRow({ coordinatorId: "usr_coordinator_2" }),
    );

    expect(await confirmEvent({ eventId: "evt1" })).toEqual({
      ok: false,
      error: "This event was updated by another user. Refresh and try again.",
    });
    expectNothingWritten();
  });

  it.each([
    { who: "the Organiser", session: sessionFor("ORGANISER", "usr_organiser") },
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
    "SCRUM-81 [AC7] TC-81-07: $who is refused and nothing changes",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);

      const result = await confirmEvent({ eventId: "evt1" });

      expect(result).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    { who: "another Coordinator", event: eventRow() },
    {
      who: "any Coordinator, when nobody is assigned",
      event: eventRow({ coordinatorId: null }),
    },
  ])(
    "SCRUM-81 [AC7] TC-81-07: $who is told the event was not found, and nothing changes",
    async ({ event }) => {
      mockAuth.mockResolvedValue(
        sessionFor("COORDINATOR", "usr_coordinator_2"),
      );
      mockFindUnique.mockResolvedValue(event);

      expect(await confirmEvent({ eventId: "evt1" })).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-81 [AC7] TC-81-07: a missing event gives the same answer as one the Coordinator may not confirm", async () => {
    mockFindUnique.mockResolvedValue(null);

    expect(await confirmEvent({ eventId: "evt_missing" })).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-81: a request without an event id is refused before anything is read", async () => {
    expect(await confirmEvent({})).toEqual({
      ok: false,
      error: "Please provide a valid event to confirm.",
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-81 [Exit path]: an unexpected database failure propagates instead of being reported as a refusal", async () => {
    mockTransaction.mockRejectedValue(new Error("connection lost"));

    await expect(confirmEvent({ eventId: "evt1" })).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("confirmEvent — what registered Attendees are told (SCRUM-85)", () => {
  const START = new Date("2031-06-01T01:00:00Z");
  const END = new Date("2031-06-01T05:00:00Z");
  const HALL = { venue: { name: "Main Hall", location: "Level 1" } };
  const ROOM = { venue: { name: "Room 2", location: "Level 2" } };
  const lastConfirmed = {
    confirmedStartAt: START,
    confirmedEndAt: END,
    confirmedVenues: ["Main Hall — Level 1"],
  };
  const changedNotices = () =>
    tx.notification.createMany.mock.calls
      .map(([arg]) => arg.data)
      .flat()
      .filter((n: { type: string }) => n.type === "REGISTERED_EVENT_CHANGED");

  function planning(over: Record<string, unknown>) {
    tx.event.findUniqueOrThrow.mockResolvedValue({
      ...eventRow(),
      name: "Gala",
      startAt: START,
      endAt: END,
      ...over,
    });
  }

  beforeEach(() => {
    tx.registration.findMany.mockResolvedValue([
      { userId: "usr_attendee" },
      { userId: "usr_attendee_2" },
    ]);
  });

  it("SCRUM-85 [AC2] TC-85-04: confirming records the date, time and every approved venue, oldest first, as what Attendees were last told", async () => {
    planning({});
    tx.booking.findMany.mockResolvedValue([HALL, ROOM]);

    await confirmEvent({ eventId: "evt1" });

    expect(tx.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: "evt1", status: "APPROVED" },
        orderBy: { createdAt: "asc" },
      }),
    );
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: expect.objectContaining({
        confirmedStartAt: START,
        confirmedEndAt: END,
        confirmedVenues: ["Main Hall — Level 1", "Room 2 — Level 2"],
      }),
    });
  });

  it("SCRUM-85 [AC2] TC-85-04: the first confirmation tells no Attendee of a change", async () => {
    planning({});
    tx.booking.findMany.mockResolvedValue([HALL]);

    await confirmEvent({ eventId: "evt1" });

    expect(changedNotices()).toEqual([]);
    expect(tx.registration.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["the start moved", { startAt: new Date("2031-06-02T01:00:00Z") }, [HALL]],
    ["the end moved", { endAt: new Date("2031-06-01T06:00:00Z") }, [HALL]],
    ["a venue was added", {}, [HALL, ROOM]],
    ["a venue was replaced", {}, [ROOM]],
  ] as const)(
    "SCRUM-85 [AC2, AC3, AC5, AC11] TC-85-02: confirmed again after %s, each Attendee still registered gets one notice with the new details and every venue",
    async (_, moved, bookings) => {
      planning({ ...lastConfirmed, ...moved });
      tx.booking.findMany.mockResolvedValue([...bookings]);

      await confirmEvent({ eventId: "evt1" });

      // AC5: only those still Registered are asked for.
      expect(tx.registration.findMany).toHaveBeenCalledWith({
        where: { eventId: "evt1", status: "REGISTERED" },
        select: { userId: true },
      });
      const notices = changedNotices();
      expect(notices.map((n: { userId: string }) => n.userId)).toEqual([
        "usr_attendee",
        "usr_attendee_2",
      ]);
      for (const venue of bookings) {
        expect(notices[0].message).toContain(venue.venue.name);
      }
      expect(notices[0]).toMatchObject({
        eventId: "evt1",
        message: expect.stringContaining("Your registration still stands."),
      });
    },
  );

  it("SCRUM-85 [AC2, AC11] TC-85-03: confirmed again with the same date, time and venues tells no Attendee anything", async () => {
    planning(lastConfirmed);
    tx.booking.findMany.mockResolvedValue([HALL]);

    await confirmEvent({ eventId: "evt1" });

    expect(changedNotices()).toEqual([]);
  });

  it("SCRUM-85 [AC6] TC-85-05: confirming an event that is already Confirmed tells nobody again", async () => {
    planning({ ...lastConfirmed, status: "CONFIRMED", startAt: new Date("2031-06-02T01:00:00Z") });

    await confirmEvent({ eventId: "evt1" });

    expect(tx.notification.createMany).not.toHaveBeenCalled();
    expect(tx.registration.findMany).not.toHaveBeenCalled();
  });
});

// SCRUM-249 — an overdue event can't be confirmed. Test cases:
// docs/testing/SCRUM-249.md. The rule's edge is one instant, so the clock is
// fixed; only Date is faked, so the mocked transaction's promises still run.
describe("confirmEvent — an overdue event, SCRUM-249", () => {
  const NOW = new Date("2031-06-01T02:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const startingAt = (startAt: Date) =>
    tx.event.findUniqueOrThrow.mockResolvedValue({ ...eventRow({ startAt }), name: "Gala" });

  it("SCRUM-249 [AC2, AC3] TC-249-05: one millisecond past its start, a ready event is refused and nothing is written", async () => {
    startingAt(new Date(NOW.getTime() - 1));

    expect(await confirmEvent({ eventId: "evt1" })).toEqual({
      ok: false,
      error: "This event is overdue: its start time has passed. It can be rejected or cancelled.",
      fieldErrors: undefined,
    });
    expect(tx.event.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-249 [AC2] TC-249-05: an overdue event is refused for being overdue even with arrangements outstanding", async () => {
    startingAt(new Date(NOW.getTime() - 1));
    mockChecklist.mockResolvedValue(notReady);

    expect(await confirmEvent({ eventId: "evt1" })).toMatchObject({ error: OVERDUE_REFUSAL });
  });

  it.each([
    ["exactly now", NOW],
    ["later", new Date(NOW.getTime() + 1)],
  ])("SCRUM-249 [AC3] TC-249-06: an event starting %s can still be confirmed", async (_, startAt) => {
    startingAt(startAt);

    expect(await confirmEvent({ eventId: "evt1" })).toEqual({
      ok: true,
      data: { status: "CONFIRMED" },
    });
    expect(tx.event.update).toHaveBeenCalledTimes(1);
  });

  it("SCRUM-249 [AC3] TC-249-05: the check reads the event after locking its row", async () => {
    startingAt(new Date(NOW.getTime() - 1));

    await confirmEvent({ eventId: "evt1" });

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.event.findUniqueOrThrow.mock.invocationCallOrder[0],
    );
  });
});
