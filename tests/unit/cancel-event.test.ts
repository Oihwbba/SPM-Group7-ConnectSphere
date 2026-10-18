import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { cancelEvent } from "@/app/(app)/events/cancel-actions";
import { EVENT_STATUS_LABEL } from "@/lib/event-lifecycle";

// SCRUM-82 — the assigned Coordinator cancels an event, releasing everything
// held for it. Test cases: docs/testing/SCRUM-82.md. Session and database are
// mocked; the transaction runs its callback against a mock `tx`.

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  booking: { updateMany: vi.fn() },
  reservation: { updateMany: vi.fn() },
  equipmentRequest: { findMany: vi.fn(), updateMany: vi.fn() },
  equipmentRequestUpdate: { createMany: vi.fn() },
  safetyCheck: { updateMany: vi.fn() },
  registration: { findMany: vi.fn(), updateMany: vi.fn() },
  eventChangeRequest: { updateMany: vi.fn() },
  auditLog: { createMany: vi.fn() },
  notification: { createMany: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;
const mockEvent = prisma.event.findUnique as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const eventRow = (status: EventStatus = "CONFIRMED", coordinatorId = "usr_coord") => ({
  organiserId: "usr_org",
  coordinatorId,
  status,
  name: "Concert",
});

const REASON = "The keynote speaker withdrew.";
const valid = { eventId: "evt1", reason: REASON };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
  mockEvent.mockResolvedValue(eventRow());
  tx.event.findUniqueOrThrow.mockResolvedValue({ status: "CONFIRMED", coordinatorId: "usr_coord" });
  tx.booking.updateMany.mockResolvedValue({ count: 2 });
  tx.reservation.updateMany.mockResolvedValue({ count: 3 });
  tx.equipmentRequest.findMany.mockResolvedValue([{ id: "eqr1", status: "APPROVED" }]);
  tx.equipmentRequest.updateMany.mockResolvedValue({ count: 1 });
  tx.safetyCheck.updateMany.mockResolvedValue({ count: 1 });
  tx.registration.findMany.mockResolvedValue([{ userId: "usr_att1" }, { userId: "usr_att2" }]);
  tx.registration.updateMany.mockResolvedValue({ count: 2 });
  tx.eventChangeRequest.updateMany.mockResolvedValue({ count: 1 });
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

function expectNothingWritten() {
  expect(tx.event.update).not.toHaveBeenCalled();
  expect(tx.booking.updateMany).not.toHaveBeenCalled();
  expect(tx.reservation.updateMany).not.toHaveBeenCalled();
  expect(tx.registration.updateMany).not.toHaveBeenCalled();
  expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  expect(tx.notification.createMany).not.toHaveBeenCalled();
}

describe("cancelEvent — SCRUM-82 AC1", () => {
  it.each(["UNDER_REVIEW", "PLANNING", "CONFIRMED"] as EventStatus[])(
    "SCRUM-82 [AC1] TC-82-01: a %s event becomes Cancelled with the reason, who and when",
    async (status) => {
      tx.event.findUniqueOrThrow.mockResolvedValue({ status, coordinatorId: "usr_coord" });

      expect(await cancelEvent(valid)).toEqual({ ok: true, data: { status: "CANCELLED" } });
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(tx.event.update).toHaveBeenCalledWith({
        where: { id: "evt1" },
        data: {
          status: "CANCELLED",
          cancelledAt: expect.any(Date),
          cancelledById: "usr_coord",
          cancellationReason: REASON,
        },
      });
      expect(tx.auditLog.createMany.mock.calls[0][0].data[0]).toEqual({
        entityType: "Event",
        entityId: "evt1",
        action: "STATUS_CHANGED",
        actorId: "usr_coord",
        fieldName: "status",
        oldValue: status,
        newValue: "CANCELLED",
        summary: REASON,
      });
    },
  );

  it("SCRUM-82 [AC1] TC-82-02: a reason is required", async () => {
    for (const reason of [undefined, "", "   "]) {
      expect(await cancelEvent({ eventId: "evt1", reason })).toEqual({
        ok: false,
        error: "A cancellation reason is required.",
        fieldErrors: { reason: ["A cancellation reason is required."] },
      });
    }
    expect(await cancelEvent({})).toEqual({
      ok: false,
      error: "Please provide a valid event to cancel.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each(["DRAFT", "SUBMITTED", "COMPLETED", "REJECTED"] as EventStatus[])(
    "SCRUM-82 [AC1] TC-82-02, SCRUM-135 [AC11]: a %s event can't be cancelled, the refusal names its status, and nothing is written",
    async (status) => {
      tx.event.findUniqueOrThrow.mockResolvedValue({ status, coordinatorId: "usr_coord" });

      expect(await cancelEvent(valid)).toEqual({
        ok: false,
        error: `This event is ${EVENT_STATUS_LABEL[status]}, so it can't be cancelled.`,
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-82 [AC1] TC-82-03: only the event's assigned Coordinator may cancel it", async () => {
    for (const role of ["ORGANISER", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE", "SAFETY_OFFICER"] as Role[]) {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_x"));
      expect(await cancelEvent(valid)).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
    }
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockEvent.mockResolvedValue(eventRow("CONFIRMED", "usr_other"));
    expect(await cancelEvent(valid)).toEqual({ ok: false, error: "Event not found." });
    mockEvent.mockResolvedValue(null);
    expect(await cancelEvent(valid)).toEqual({ ok: false, error: "Event not found." });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-82 [AC1] TC-82-03: an event reassigned before the lock is refused with nothing written", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue({ status: "PLANNING", coordinatorId: "usr_other" });

    expect(await cancelEvent(valid)).toEqual({
      ok: false,
      error: "This event was updated by another user. Refresh and try again.",
    });
    expectNothingWritten();
  });
});

describe("cancelEvent — SCRUM-82 AC3", () => {
  it("SCRUM-82 [AC3, AC6] TC-82-04: notices written ahead for the event (a hold's reminder and expiry, registration closing) are withdrawn, since none will happen", async () => {
    await cancelEvent(valid);

    expect(tx.notification.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt1",
        bookingId: { not: null },
        withdrawnAt: null,
        showFromAt: { gt: expect.any(Date) },
      },
      data: { withdrawnAt: expect.any(Date) },
    });
    expect(tx.notification.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt1",
        title: "Registration closed",
        withdrawnAt: null,
        showFromAt: { gt: expect.any(Date) },
      },
      data: { withdrawnAt: expect.any(Date) },
    });
  });
  it("SCRUM-82 [AC3] TC-82-04: in the same operation, bookings, holds and requests, reservations, open equipment requests and registrations are cancelled, an awaiting safety check is Outdated and submitted change requests are rejected with the reason", async () => {
    await cancelEvent(valid);

    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: { in: ["PENDING", "HELD", "APPROVED"] } },
      data: { status: "CANCELLED" },
    });
    // Cancelling a reservation is what returns its stock (SCRUM-29).
    expect(tx.reservation.updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: "CONFIRMED" },
      data: { status: "CANCELLED", cancelledAt: expect.any(Date) },
    });
    expect(tx.equipmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["eqr1"] } },
      data: { status: "CANCELLED" },
    });
    expect(tx.equipmentRequestUpdate.createMany).toHaveBeenCalledWith({
      data: [
        {
          requestId: "eqr1",
          actorId: "usr_coord",
          fromStatus: "APPROVED",
          toStatus: "CANCELLED",
          note: `Cancelled because the event was cancelled: ${REASON}`,
        },
      ],
    });
    expect(tx.safetyCheck.updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: "AWAITING_REVIEW" },
      data: { status: "OUTDATED", outdatedAt: expect.any(Date) },
    });
    expect(tx.registration.updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: "REGISTERED" },
      data: { status: "CANCELLED" },
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
    expect(tx.auditLog.createMany.mock.calls[0][0].data[1]).toMatchObject({
      action: "ARRANGEMENTS_RELEASED",
      summary:
        "Cancelled (SCRUM-82): 2 venue booking(s), 3 equipment reservation(s), 1 equipment request(s) and 2 registration(s) cancelled; 1 safety check(s) outdated; 1 change request(s) rejected.",
    });
  });
});

describe("cancelEvent — SCRUM-82 AC4, AC6", () => {
  it("SCRUM-82 [AC4] TC-82-05: cancelling an event that is already Cancelled changes nothing", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue({ status: "CANCELLED", coordinatorId: "usr_coord" });

    expect(await cancelEvent(valid)).toEqual({ ok: true, data: { status: "CANCELLED" } });
    expectNothingWritten();
  });

  it("SCRUM-82 [AC6] TC-82-06: the Organiser, the Coordinator and each Attendee whose registration was cancelled are notified with the reason", async () => {
    await cancelEvent(valid);

    const message = `"Concert" was cancelled: ${REASON}`;
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        ...["usr_org", "usr_coord"].map((userId) => ({
          userId,
          type: "EVENT_STATUS_CHANGED",
          title: "Event cancelled",
          message,
          eventId: "evt1",
        })),
        ...["usr_att1", "usr_att2"].map((userId) => ({
          userId,
          type: "REGISTERED_EVENT_CANCELLED",
          title: "An event you registered for was cancelled",
          message,
          eventId: "evt1",
        })),
      ],
    });
  });

  it("does not swallow an unexpected database error", async () => {
    mockTransaction.mockRejectedValue(new Error("connection lost"));
    await expect(cancelEvent(valid)).rejects.toThrow("connection lost");
  });
});
