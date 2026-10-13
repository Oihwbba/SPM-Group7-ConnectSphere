import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { rejectPlanningEvent } from "@/app/(app)/events/actions";

// SCRUM-117 — the assigned Coordinator rejects a Planning event whose
// arrangements can't be secured, releasing everything held for it. Test
// cases: docs/testing/SCRUM-117.md. Session and database are mocked; the
// transaction runs its callback against a mock `tx`.

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  booking: { updateMany: vi.fn() },
  reservation: { updateMany: vi.fn() },
  equipmentRequest: { findMany: vi.fn(), updateMany: vi.fn() },
  equipmentRequestUpdate: { createMany: vi.fn() },
  eventChangeRequest: { updateMany: vi.fn() },
  auditLog: { count: vi.fn(), createMany: vi.fn() },
  notification: { create: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;
const mockFindUnique = prisma.event.findUnique as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

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
    organiserId: "usr_org",
    coordinatorId: "usr_coord" as string | null,
    status: "PLANNING" as EventStatus,
    name: "Concert",
    ...over,
  };
}

const REASON = "No venue large enough is free on that date.";
const valid = {
  eventId: "evt1",
  decisionReason: REASON,
  rejectionOutcome: "NEW_REQUEST",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
  mockFindUnique.mockResolvedValue(eventRow());
  tx.event.findUniqueOrThrow.mockResolvedValue(eventRow());
  tx.event.update.mockResolvedValue({});
  tx.booking.updateMany.mockResolvedValue({ count: 2 });
  tx.reservation.updateMany.mockResolvedValue({ count: 3 });
  tx.equipmentRequest.findMany.mockResolvedValue([
    { id: "eqr1", status: "IN_REVIEW" },
  ]);
  tx.equipmentRequest.updateMany.mockResolvedValue({ count: 1 });
  tx.equipmentRequestUpdate.createMany.mockResolvedValue({ count: 1 });
  tx.eventChangeRequest.updateMany.mockResolvedValue({ count: 1 });
  tx.auditLog.count.mockResolvedValue(0);
  tx.auditLog.createMany.mockResolvedValue({ count: 3 });
  tx.notification.create.mockResolvedValue({});
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

function expectNothingWritten() {
  expect(tx.event.update).not.toHaveBeenCalled();
  expect(tx.booking.updateMany).not.toHaveBeenCalled();
  expect(tx.reservation.updateMany).not.toHaveBeenCalled();
  expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  expect(tx.notification.create).not.toHaveBeenCalled();
}

describe("rejectPlanningEvent — SCRUM-117", () => {
  it("SCRUM-117 [AC1, AC2] TC-117-01: a Planning event never Confirmed becomes Rejected with its reason and outcome", async () => {
    const result = await rejectPlanningEvent(valid);

    expect(result).toEqual({ ok: true, data: { status: "REJECTED" } });
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: {
        status: "REJECTED",
        decidedAt: expect.any(Date),
        decidedById: "usr_coord",
        decisionReason: REASON,
        rejectionOutcome: "NEW_REQUEST",
      },
    });
  });

  it("SCRUM-117 [AC3] TC-117-03: in the same operation, venue bookings and requests, reservations and open equipment requests are cancelled, and submitted change requests rejected with the reason", async () => {
    await rejectPlanningEvent(valid);

    // SCRUM-163 AC9: an unexpired hold is released too, and its notices
    // still to come are withdrawn; a lapsed one stays Expired.
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt1",
        OR: [
          { status: { in: ["PENDING", "APPROVED"] } },
          { status: "HELD", holdExpiresAt: { gt: expect.any(Date) } },
        ],
      },
      data: { status: "CANCELLED" },
    });
    expect(tx.notification.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt1",
        bookingId: { not: null },
        withdrawnAt: null,
        showFromAt: { gt: expect.any(Date) },
      },
      data: { withdrawnAt: expect.any(Date) },
    });
    // Cancelling a reservation is what returns its stock: availability counts
    // only CONFIRMED reservations (SCRUM-29).
    expect(tx.reservation.updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: "CONFIRMED" },
      data: { status: "CANCELLED", cancelledAt: expect.any(Date) },
    });
    expect(tx.equipmentRequest.findMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt1",
        status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] },
      },
      select: { id: true, status: true },
    });
    expect(tx.equipmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["eqr1"] } },
      data: { status: "CANCELLED" },
    });
    // The request's own history (SCRUM-28) records who cancelled it and why.
    expect(tx.equipmentRequestUpdate.createMany).toHaveBeenCalledWith({
      data: [
        {
          requestId: "eqr1",
          actorId: "usr_coord",
          fromStatus: "IN_REVIEW",
          toStatus: "CANCELLED",
          note: `Cancelled because the event was rejected: ${REASON}`,
        },
      ],
    });
    expect(tx.eventChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: "PENDING_REVIEW" },
      data: {
        status: "REJECTED",
        decidedById: "usr_coord",
        decidedAt: expect.any(Date),
        decisionReason: REASON,
      },
    });
    // All of it inside the one transaction, after the event row is locked.
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.booking.updateMany.mock.invocationCallOrder[0],
    );
  });

  it("SCRUM-117 [AC6] TC-117-06: the Organiser is notified and the rejection is recorded with who and when", async () => {
    await rejectPlanningEvent(valid);

    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_org",
        type: "EVENT_STATUS_CHANGED",
        title: "Your event was rejected",
        message: `"Concert" couldn't be arranged and was rejected: ${REASON}`,
        eventId: "evt1",
      },
    });
    const entries = tx.auditLog.createMany.mock.calls[0][0].data;
    expect(entries).toEqual([
      expect.objectContaining({
        action: "STATUS_CHANGED",
        actorId: "usr_coord",
        oldValue: "PLANNING",
        newValue: "REJECTED",
        summary: REASON,
      }),
      expect.objectContaining({
        fieldName: "rejectionOutcome",
        actorId: "usr_coord",
        newValue: "NEW_REQUEST",
      }),
      expect.objectContaining({
        action: "ARRANGEMENTS_RELEASED",
        actorId: "usr_coord",
        summary:
          "Rejected from Planning (SCRUM-117): 2 venue booking(s), 3 equipment reservation(s) and 1 equipment request(s) cancelled; 1 change request(s) rejected.",
      }),
    ]);
  });

  it.each([
    {
      when: "the reason is blank",
      input: { ...valid, decisionReason: "   " },
      error: "A rejection reason is required.",
      field: "decisionReason",
    },
    {
      when: "no outcome is chosen",
      input: { eventId: "evt1", decisionReason: REASON },
      error: "Choose what the organiser can do next.",
      field: "rejectionOutcome",
    },
  ])(
    "SCRUM-117 [AC2] TC-117-02: refused when $when, before anything is read",
    async ({ input, error, field }) => {
      expect(await rejectPlanningEvent(input)).toEqual({
        ok: false,
        error,
        fieldErrors: { [field]: [error] },
      });
      expect(mockFindUnique).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-117 [AC2]: an outcome that isn't one of the two choices, or no event id, is refused", async () => {
    expect(
      await rejectPlanningEvent({ ...valid, rejectionOutcome: "CANCEL" }),
    ).toEqual({ ok: false, error: "Please provide a valid event to reject." });
    expect(await rejectPlanningEvent({})).toEqual({
      ok: false,
      error: "Please provide a valid event to reject.",
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-117 [AC4] TC-117-05: an event that was ever Confirmed is refused (cancel it instead) and nothing changes", async () => {
    tx.auditLog.count.mockResolvedValue(1);

    expect(await rejectPlanningEvent(valid)).toEqual({
      ok: false,
      error:
        "This event has been confirmed before, so it can't be rejected. Cancel it instead.",
    });
    expect(tx.auditLog.count).toHaveBeenCalledWith({
      where: {
        entityType: "Event",
        entityId: "evt1",
        fieldName: "status",
        newValue: "CONFIRMED",
      },
    });
    expectNothingWritten();
  });

  it.each([
    "UNDER_REVIEW",
    "CONFIRMED",
    "REJECTED",
    "CANCELLED",
  ] as EventStatus[])(
    "SCRUM-117 [AC1] TC-117-04: a %s event can't be rejected here and nothing changes",
    async (status) => {
      tx.event.findUniqueOrThrow.mockResolvedValue(eventRow({ status }));

      expect(await rejectPlanningEvent(valid)).toEqual({
        ok: false,
        error: "Only an event in Planning can be rejected here.",
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-117 [AC5]: an event reassigned while the request waited for the lock is refused, and nothing changes", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(
      eventRow({ coordinatorId: "usr_other" }),
    );

    expect(await rejectPlanningEvent(valid)).toEqual({
      ok: false,
      error: "This event was updated by another user. Refresh and try again.",
    });
    expectNothingWritten();
  });

  it.each([
    { who: "the Organiser", session: sessionFor("ORGANISER", "usr_org") },
    {
      who: "Technical Support",
      session: sessionFor("TECH_SUPPORT", "usr_tech"),
    },
    { who: "a signed-out visitor", session: null },
  ])(
    "SCRUM-117 [AC5] TC-117-07: $who is refused before anything is read",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);

      const result = await rejectPlanningEvent(valid);

      expect(result).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
      expect(mockFindUnique).not.toHaveBeenCalled();
    },
  );

  it.each([
    { who: "another Coordinator", event: eventRow() },
    {
      who: "any Coordinator, when nobody is assigned",
      event: eventRow({ coordinatorId: null }),
    },
    { who: "anyone, for a missing event", event: null },
  ])(
    "SCRUM-117 [AC5] TC-117-07: $who is told the event was not found",
    async ({ event }) => {
      mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_other"));
      mockFindUnique.mockResolvedValue(event);

      expect(await rejectPlanningEvent(valid)).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-117 [Exit path]: an unexpected database failure propagates instead of being reported as a refusal", async () => {
    mockTransaction.mockRejectedValue(new Error("connection lost"));

    await expect(rejectPlanningEvent(valid)).rejects.toThrow("connection lost");
  });
});
