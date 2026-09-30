import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getReadinessChecklist,
  type ReadinessChecklist,
} from "@/lib/event-readiness";
import { confirmEvent } from "@/app/(app)/events/actions";

// SCRUM-81 — the assigned Coordinator confirms a Planning event whose
// SCRUM-110 checklist is complete. Test cases: docs/testing/SCRUM-81.md.
// Session, database and the checklist are mocked; the transaction runs its
// callback against a mock `tx`, as in event-status.test.ts.

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
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
      lines: [],
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
      lines: [],
    },
    {
      name: "Equipment",
      complete: false,
      state: "Not fully reserved",
      reason: null,
      lines: ["Projector 3/5 reserved"],
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
  over: Partial<{ status: EventStatus; coordinatorId: string | null }> = {},
) {
  return {
    organiserId: "usr_organiser",
    coordinatorId: "usr_coordinator" as string | null,
    status: "PLANNING" as EventStatus,
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
  mockChecklist.mockResolvedValue(ready);
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

function expectNothingWritten() {
  expect(tx.event.update).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
}

describe("confirmEvent — SCRUM-81", () => {
  it("SCRUM-81 [AC4] TC-81-05: confirming a ready event makes it Confirmed and records the confirming Coordinator in its history", async () => {
    const result = await confirmEvent({ eventId: "evt1" });

    expect(result).toEqual({ ok: true, data: { status: "CONFIRMED" } });
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: { status: "CONFIRMED" },
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

  it("SCRUM-81 [AC4, AC7]: readiness is checked inside the transaction, after the event is locked", async () => {
    await confirmEvent({ eventId: "evt1" });

    expect(mockChecklist).toHaveBeenCalledWith(tx, "evt1");
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockChecklist.mock.invocationCallOrder[0],
    );
  });

  it("SCRUM-81 [AC3] TC-81-04: an event that is not ready is refused, the outstanding items are named, and nothing changes", async () => {
    mockChecklist.mockResolvedValue(notReady);

    const result = await confirmEvent({ eventId: "evt1" });

    expect(result).toEqual({
      ok: false,
      error:
        "This event isn't ready to confirm yet. Outstanding: Venue booking (Pending), Equipment (Not fully reserved).",
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
    "SCRUM-81 [AC7] TC-81-09: an event $when is reported as confirmed, with no second confirmation recorded",
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
    "SCRUM-81 [AC4] TC-81-11: a %s event cannot be confirmed",
    async (status) => {
      mockFindUnique.mockResolvedValue(eventRow({ status }));
      tx.event.findUniqueOrThrow.mockResolvedValue(eventRow({ status }));

      expect(await confirmEvent({ eventId: "evt1" })).toEqual({
        ok: false,
        error: "Only an event in Planning can be confirmed.",
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-81 [AC6]: an event reassigned to someone else while this request waited is refused, and nothing changes", async () => {
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
    "SCRUM-81 [AC6] TC-81-07: $who is refused and nothing changes",
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
    "SCRUM-81 [AC6] TC-81-07: $who is told the event was not found, and nothing changes",
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

  it("SCRUM-81 [AC6] TC-81-07: a missing event gives the same answer as one the Coordinator may not confirm", async () => {
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
