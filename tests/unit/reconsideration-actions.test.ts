import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  bookingStillStandsRefusal,
  reservationStillStandsRefusal,
} from "@/lib/reconsideration";
import {
  getFlaggedArrangements,
  resolveReconsiderationFlag,
} from "@/app/(app)/events/reconsideration-actions";

// SCRUM-26 AC7–AC10 — the assigned Coordinator resolves a flag. Test cases:
// docs/testing/SCRUM-26.md. Session and database are mocked; the transaction
// runs its callback against a mock `tx`. The Still stands rules themselves
// are covered by reconsideration.test.ts, so here they are fixed answers.

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  booking: { findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
  reservation: { findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
  safetyCheck: { updateMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn() },
    reservation: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/reconsideration", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reconsideration")>()),
  bookingStillStandsRefusal: vi.fn(),
  reservationStillStandsRefusal: vi.fn(),
}));

const mockAuth = auth as unknown as Mock;
const mockEvent = prisma.event.findUnique as unknown as Mock;
const mockBooking = prisma.booking.findUnique as unknown as Mock;
const mockReservation = prisma.reservation.findUnique as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;
const mockBookingRefusal = bookingStillStandsRefusal as unknown as Mock;
const mockReservationRefusal = reservationStillStandsRefusal as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const owner = (status: EventStatus = "PLANNING", coordinatorId = "usr_coord") => ({
  eventId: "evt1",
  event: { organiserId: "usr_org", coordinatorId, status },
});

const START = new Date("2032-05-01T02:00:00Z");
const END = new Date("2032-05-01T04:00:00Z");

function eventNow(status: EventStatus = "PLANNING", coordinatorId = "usr_coord") {
  return { status, coordinatorId, startAt: START, endAt: END, expectedAttendance: 40 };
}

const flaggedBooking = {
  id: "bkg1",
  status: "APPROVED",
  needsReconsideration: true,
  startAt: START,
  endAt: END,
  setupMinutes: 0,
  turnaroundMinutes: 0,
  requestedAttendance: 40,
  venueId: "ven_hall",
  venue: { name: "Exhibition Hall", isActive: true, capacity: 200, setupMinutes: 0, turnaroundMinutes: 0 },
};

const flaggedReservation = {
  id: "res1",
  eventId: "evt1",
  equipmentId: "eqp_projector",
  quantity: 2,
  status: "CONFIRMED",
  needsReconsideration: true,
  startAt: START,
  endAt: END,
  equipment: { type: "Projector" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
  mockBooking.mockResolvedValue(owner());
  mockReservation.mockResolvedValue(owner());
  tx.event.findUniqueOrThrow.mockResolvedValue(eventNow());
  tx.booking.findUniqueOrThrow.mockResolvedValue(flaggedBooking);
  tx.booking.updateMany.mockResolvedValue({ count: 1 });
  tx.reservation.findUniqueOrThrow.mockResolvedValue(flaggedReservation);
  tx.reservation.updateMany.mockResolvedValue({ count: 1 });
  tx.safetyCheck.updateMany.mockResolvedValue({ count: 0 });
  mockBookingRefusal.mockResolvedValue(null);
  mockReservationRefusal.mockResolvedValue(null);
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

function expectNothingWritten() {
  expect(tx.booking.updateMany).not.toHaveBeenCalled();
  expect(tx.reservation.updateMany).not.toHaveBeenCalled();
  expect(tx.event.update).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
  expect(tx.safetyCheck.updateMany).not.toHaveBeenCalled();
}

const resolvedBy = {
  needsReconsideration: false,
  reconsiderationResolvedAt: expect.any(Date),
  reconsiderationResolvedById: "usr_coord",
};

describe("resolveReconsiderationFlag — Still stands (SCRUM-26 AC7, AC8)", () => {
  it("SCRUM-26 [AC7, AC8] TC-26-06: a booking that still fits keeps its status, loses its flag, and records who and when", async () => {
    const result = await resolveReconsiderationFlag({
      kind: "booking",
      id: "bkg1",
      decision: "STILL_STANDS",
    });

    expect(result).toEqual({
      ok: true,
      data: { decision: "STILL_STANDS", returnedToPlanning: false },
    });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: "bkg1",
        needsReconsideration: true,
        status: { in: ["PENDING", "HELD", "APPROVED"] },
      },
      data: resolvedBy,
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "Booking",
        entityId: "bkg1",
        action: "RECONSIDERATION_RESOLVED",
        actorId: "usr_coord",
        fieldName: "needsReconsideration",
        oldValue: "true",
        newValue: "false",
        summary: "Still stands (SCRUM-26)",
      },
    });
    expect(mockBookingRefusal).toHaveBeenCalledWith(tx, flaggedBooking, eventNow());
    // Locked first, so a confirm and a resolution take turns.
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.safetyCheck.updateMany).not.toHaveBeenCalled();
    expect(tx.event.update).not.toHaveBeenCalled();
  });

  it("SCRUM-26 [AC7, AC8] TC-26-06: a reservation that is still sufficient stands", async () => {
    const result = await resolveReconsiderationFlag({
      kind: "reservation",
      id: "res1",
      decision: "STILL_STANDS",
    });

    expect(result).toMatchObject({ ok: true });
    expect(tx.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: "res1", needsReconsideration: true, status: "CONFIRMED" },
      data: resolvedBy,
    });
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      entityType: "Reservation",
      entityId: "res1",
      action: "RECONSIDERATION_RESOLVED",
    });
  });

  it("SCRUM-26 [AC8] TC-26-07: a booking that no longer fits is refused with the reason, and nothing is written", async () => {
    mockBookingRefusal.mockResolvedValue("Exhibition Hall has been retired.");

    expect(
      await resolveReconsiderationFlag({ kind: "booking", id: "bkg1", decision: "STILL_STANDS" }),
    ).toEqual({
      ok: false,
      error:
        "It can't stand as it is: Exhibition Hall has been retired. Cancel the arrangement and request again.",
    });
    expectNothingWritten();
  });

  it("SCRUM-26 [AC8] TC-26-08: a reservation that is no longer enough is refused with the reason", async () => {
    mockReservationRefusal.mockResolvedValue(
      "Only 2 Projector reserved for the event's period; its requests need 3.",
    );

    expect(
      await resolveReconsiderationFlag({ kind: "reservation", id: "res1", decision: "STILL_STANDS" }),
    ).toMatchObject({ ok: false, error: expect.stringContaining("its requests need 3.") });
    expectNothingWritten();
  });
});

describe("resolveReconsiderationFlag — Cancel arrangement (SCRUM-26 AC9, AC10)", () => {
  it("SCRUM-26 [AC9] TC-26-10: a booking becomes Cancelled, releasing its venue, and only that booking is written", async () => {
    const result = await resolveReconsiderationFlag({
      kind: "booking",
      id: "bkg1",
      decision: "CANCEL",
    });

    expect(result).toEqual({
      ok: true,
      data: { decision: "CANCEL", returnedToPlanning: false },
    });
    expect(tx.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: "bkg1",
        needsReconsideration: true,
        status: { in: ["PENDING", "HELD", "APPROVED"] },
      },
      data: { ...resolvedBy, status: "CANCELLED" },
    });
    expect(tx.reservation.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "Booking",
        entityId: "bkg1",
        action: "STATUS_CHANGED",
        actorId: "usr_coord",
        fieldName: "status",
        oldValue: "APPROVED",
        newValue: "CANCELLED",
        summary:
          "Cancelled by the assigned coordinator after it was flagged for reconsideration (SCRUM-26)",
      },
    });
    // Cancelling doesn't ask whether it would still stand.
    expect(mockBookingRefusal).not.toHaveBeenCalled();
    expect(tx.event.update).not.toHaveBeenCalled();
  });

  it("SCRUM-26 [AC9] TC-26-10: a reservation becomes Cancelled with the time, returning its stock", async () => {
    await resolveReconsiderationFlag({ kind: "reservation", id: "res1", decision: "CANCEL" });

    expect(tx.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: "res1", needsReconsideration: true, status: "CONFIRMED" },
      data: { ...resolvedBy, status: "CANCELLED", cancelledAt: expect.any(Date) },
    });
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      entityType: "Reservation",
      oldValue: "CONFIRMED",
      newValue: "CANCELLED",
    });
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-26 [AC10] TC-26-11: cancelling an arrangement makes an Approved or awaiting safety check Outdated", async () => {
    await resolveReconsiderationFlag({ kind: "booking", id: "bkg1", decision: "CANCEL" });

    expect(tx.safetyCheck.updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: { in: ["AWAITING_REVIEW", "APPROVED"] } },
      data: { status: "OUTDATED", outdatedAt: expect.any(Date) },
    });
  });

  it("SCRUM-26 [AC10] TC-26-11: cancelling an arrangement of a Confirmed event returns the event to Planning, with an audit entry", async () => {
    mockBooking.mockResolvedValue(owner("CONFIRMED"));
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("CONFIRMED"));

    const result = await resolveReconsiderationFlag({
      kind: "booking",
      id: "bkg1",
      decision: "CANCEL",
    });

    expect(result).toEqual({
      ok: true,
      data: { decision: "CANCEL", returnedToPlanning: true },
    });
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: { status: "PLANNING" },
    });
    expect(tx.auditLog.create).toHaveBeenLastCalledWith({
      data: {
        entityType: "Event",
        entityId: "evt1",
        action: "STATUS_CHANGED",
        actorId: "usr_coord",
        fieldName: "status",
        oldValue: "CONFIRMED",
        newValue: "PLANNING",
        summary: "A flagged arrangement was cancelled (SCRUM-26)",
      },
    });
  });

  it("SCRUM-26 [AC10] TC-26-11: Still stands on a Confirmed event leaves it Confirmed", async () => {
    mockBooking.mockResolvedValue(owner("CONFIRMED"));
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("CONFIRMED"));

    await resolveReconsiderationFlag({ kind: "booking", id: "bkg1", decision: "STILL_STANDS" });

    expect(tx.event.update).not.toHaveBeenCalled();
    expect(tx.safetyCheck.updateMany).not.toHaveBeenCalled();
  });
});

describe("resolveReconsiderationFlag — who and when (SCRUM-26 AC7)", () => {
  it("SCRUM-26 [AC7] TC-26-05: every role but Coordinator is refused before anything is read", async () => {
    for (const role of [
      "ORGANISER",
      "VENUE_STAFF",
      "TECH_SUPPORT",
      "ATTENDEE",
      "COORDINATOR_LEAD",
      "SAFETY_OFFICER",
    ] as Role[]) {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_x"));
      expect(
        await resolveReconsiderationFlag({ kind: "booking", id: "bkg1", decision: "CANCEL" }),
      ).toEqual({ ok: false, error: "You do not have permission to do that." });
    }
    mockAuth.mockResolvedValue(null);
    expect(
      await resolveReconsiderationFlag({ kind: "booking", id: "bkg1", decision: "CANCEL" }),
    ).toMatchObject({ ok: false });
    expect(mockBooking).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-26 [AC7] TC-26-05: a Coordinator who isn't assigned to the event gets not found, and nothing is written", async () => {
    mockBooking.mockResolvedValue(owner("PLANNING", "usr_other"));

    expect(
      await resolveReconsiderationFlag({ kind: "booking", id: "bkg1", decision: "CANCEL" }),
    ).toEqual({ ok: false, error: "Arrangement not found." });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-26 [AC7] TC-26-05: an unknown arrangement is not found", async () => {
    mockReservation.mockResolvedValue(null);

    expect(
      await resolveReconsiderationFlag({ kind: "reservation", id: "res_x", decision: "CANCEL" }),
    ).toEqual({ ok: false, error: "Arrangement not found." });
  });

  it("SCRUM-26 [AC7] TC-26-05: an event reassigned before the lock is refused with nothing written", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("PLANNING", "usr_other"));

    expect(
      await resolveReconsiderationFlag({ kind: "booking", id: "bkg1", decision: "CANCEL" }),
    ).toEqual({
      ok: false,
      error: "This event was updated by another user. Refresh and try again.",
    });
    expectNothingWritten();
  });

  it("SCRUM-26 [AC7]: a missing or invalid choice is refused", async () => {
    for (const input of [
      null,
      { kind: "booking", id: "bkg1" },
      { kind: "registration", id: "reg1", decision: "CANCEL" },
      { kind: "booking", id: "", decision: "CANCEL" },
    ]) {
      expect(await resolveReconsiderationFlag(input)).toEqual({
        ok: false,
        error: "Please choose Still stands or Cancel arrangement.",
      });
    }
  });
});

describe("resolveReconsiderationFlag — exactly once (SCRUM-26 AC9)", () => {
  const NOT_FLAGGED =
    "This arrangement no longer needs reconsideration. Refresh to see where it stands.";

  it("SCRUM-26 [AC9] TC-26-10: a booking already resolved, or no longer live, is refused with nothing written", async () => {
    for (const row of [
      { ...flaggedBooking, needsReconsideration: false },
      { ...flaggedBooking, status: "CANCELLED" },
    ]) {
      tx.booking.findUniqueOrThrow.mockResolvedValue(row);
      expect(
        await resolveReconsiderationFlag({ kind: "booking", id: "bkg1", decision: "CANCEL" }),
      ).toEqual({ ok: false, error: NOT_FLAGGED });
    }
    expectNothingWritten();
  });

  it("SCRUM-26 [AC9] TC-26-10: a reservation already resolved, or cancelled, is refused with nothing written", async () => {
    for (const row of [
      { ...flaggedReservation, needsReconsideration: false },
      { ...flaggedReservation, status: "CANCELLED" },
    ]) {
      tx.reservation.findUniqueOrThrow.mockResolvedValue(row);
      expect(
        await resolveReconsiderationFlag({ kind: "reservation", id: "res1", decision: "CANCEL" }),
      ).toEqual({ ok: false, error: NOT_FLAGGED });
    }
    expectNothingWritten();
  });

  it("SCRUM-26 [AC9] TC-26-10: when the conditional update finds the row already resolved, no audit entry or event change follows", async () => {
    tx.booking.updateMany.mockResolvedValue({ count: 0 });
    tx.reservation.updateMany.mockResolvedValue({ count: 0 });

    for (const kind of ["booking", "reservation"] as const) {
      expect(
        await resolveReconsiderationFlag({ kind, id: "x", decision: "CANCEL" }),
      ).toEqual({ ok: false, error: NOT_FLAGGED });
    }
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.safetyCheck.updateMany).not.toHaveBeenCalled();
  });

  it("does not swallow an unexpected database error", async () => {
    mockTransaction.mockRejectedValue(new Error("connection lost"));
    await expect(
      resolveReconsiderationFlag({ kind: "booking", id: "bkg1", decision: "CANCEL" }),
    ).rejects.toThrow("connection lost");
  });
});

describe("getFlaggedArrangements — SCRUM-26 AC7", () => {
  const flaggedAt = new Date("2032-04-01T00:00:00Z");
  const eventRow = (coordinatorId = "usr_coord") => ({
    organiserId: "usr_org",
    coordinatorId,
    status: "PLANNING",
    bookings: [
      {
        id: "bkg1",
        status: "APPROVED",
        reconsiderationReason: "The event moved to 2 May.",
        reconsiderationFlaggedAt: flaggedAt,
        venue: { name: "Exhibition Hall" },
      },
    ],
    reservations: [
      {
        id: "res1",
        quantity: 2,
        reconsiderationReason: "Technical Support: one projector is broken.",
        reconsiderationFlaggedAt: flaggedAt,
        equipment: { type: "Projector" },
      },
    ],
  });

  it("SCRUM-26 [AC7, AC12] TC-26-14: the assigned Coordinator sees each flagged arrangement with its reason and when it was flagged", async () => {
    mockEvent.mockResolvedValue(eventRow());

    expect(await getFlaggedArrangements("evt1")).toEqual({
      ok: true,
      data: [
        {
          kind: "booking",
          id: "bkg1",
          label: "Exhibition Hall (Approved)",
          reason: "The event moved to 2 May.",
          flaggedAt,
        },
        {
          kind: "reservation",
          id: "res1",
          label: "Projector × 2",
          reason: "Technical Support: one projector is broken.",
          flaggedAt,
        },
      ],
    });
    const { select } = mockEvent.mock.calls[0][0];
    expect(select.bookings.where).toEqual({
      needsReconsideration: true,
      status: { in: ["PENDING", "HELD", "APPROVED"] },
    });
    expect(select.reservations.where).toEqual({
      needsReconsideration: true,
      status: "CONFIRMED",
    });
  });

  it("SCRUM-26 [AC7] TC-26-05: anyone else, a missing event, or no session gets not found", async () => {
    mockEvent.mockResolvedValue(eventRow("usr_other"));
    expect(await getFlaggedArrangements("evt1")).toEqual({
      ok: false,
      error: "Event not found.",
    });

    mockEvent.mockResolvedValue(eventRow());
    for (const role of ["ORGANISER", "VENUE_STAFF"] as Role[]) {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_org"));
      expect(await getFlaggedArrangements("evt1")).toMatchObject({ ok: false });
    }

    mockAuth.mockResolvedValue(null);
    expect(await getFlaggedArrangements("evt1")).toMatchObject({ ok: false });

    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockEvent.mockResolvedValue(null);
    expect(await getFlaggedArrangements("evt_missing")).toMatchObject({ ok: false });
  });
});
