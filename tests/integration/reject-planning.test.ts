import { describe, it, expect, afterAll, vi, type Mock } from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { rejectPlanningEvent } from "@/app/(app)/events/actions";

// SCRUM-117 — rejecting a Planning event releases everything held for it in
// one transaction, against a real database. Test cases:
// docs/testing/SCRUM-117.md.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const COORDINATOR: Session = {
  user: {
    id: "usr_coordinator",
    role: "COORDINATOR",
    name: "Cody Coordinator",
    email: "coordinator@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

// Far enough ahead that nothing seeded overlaps it.
const START = new Date("2032-03-01T01:00:00Z");
const END = new Date("2032-03-01T09:00:00Z");

// Projectors held for this period: what equipment availability subtracts
// from the pool (SCRUM-29 counts only CONFIRMED reservations).
async function projectorsHeld(): Promise<number> {
  const { _sum } = await prisma.reservation.aggregate({
    where: {
      equipmentId: "eqp_projector",
      status: "CONFIRMED",
      startAt: { lt: END },
      endAt: { gt: START },
    },
    _sum: { quantity: true },
  });
  return _sum.quantity ?? 0;
}

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-117 — rejecting a Planning event",
  () => {
    afterAll(async () => {
      await prisma.$disconnect();
    });

    it("SCRUM-117 [AC1, AC3, AC6] TC-117-08: the event is Rejected and its booking, reservation, equipment request and change request are released together, returning the stock", async () => {
      (auth as unknown as Mock).mockResolvedValue(COORDINATOR);
      const event = await prisma.event.create({
        data: {
          name: `SCRUM-117 release ${Date.now()}`,
          status: "PLANNING",
          organiserId: "usr_organiser",
          coordinatorId: "usr_coordinator",
          startAt: START,
          endAt: END,
          expectedAttendance: 50,
        },
        select: { id: true },
      });
      const eventId = event.id;
      try {
        await prisma.booking.create({
          data: {
            eventId,
            venueId: "ven_hall",
            startAt: START,
            endAt: END,
            status: "APPROVED",
            requestedById: "usr_coordinator",
            decidedById: "usr_venuestaff",
            decidedAt: new Date(),
          },
        });
        const request = await prisma.equipmentRequest.create({
          data: {
            eventId,
            requestedById: "usr_coordinator",
            status: "APPROVED",
            lines: { create: [{ equipmentId: "eqp_projector", quantity: 2 }] },
          },
          select: { id: true },
        });
        await prisma.reservation.create({
          data: {
            eventId,
            equipmentId: "eqp_projector",
            quantity: 2,
            startAt: START,
            endAt: END,
            status: "CONFIRMED",
            reservedById: "usr_techsupport",
            requestId: request.id,
          },
        });
        await prisma.eventChangeRequest.create({
          data: { eventId, requestedById: "usr_organiser", reason: "Move it" },
        });
        // SCRUM-166 AC13: a check awaiting review (TC-166-17).
        await prisma.safetyCheck.create({
          data: { eventId, requestedById: "usr_coordinator" },
        });
        const before = await projectorsHeld();

        const result = await rejectPlanningEvent({
          eventId,
          decisionReason: "No venue can take it after all.",
          rejectionOutcome: "AMEND_AND_RESUBMIT",
        });

        expect(result).toEqual({ ok: true, data: { status: "REJECTED" } });
        const after = await prisma.event.findUniqueOrThrow({
          where: { id: eventId },
          select: {
            status: true,
            decisionReason: true,
            rejectionOutcome: true,
            bookings: { select: { status: true } },
            reservations: { select: { status: true } },
            equipmentRequests: { select: { status: true } },
            changeRequests: { select: { status: true, decisionReason: true } },
            safetyChecks: { select: { status: true } },
          },
        });
        expect(after).toEqual({
          status: "REJECTED",
          decisionReason: "No venue can take it after all.",
          rejectionOutcome: "AMEND_AND_RESUBMIT",
          bookings: [{ status: "CANCELLED" }],
          reservations: [{ status: "CANCELLED" }],
          equipmentRequests: [{ status: "CANCELLED" }],
          changeRequests: [
            {
              status: "REJECTED",
              decisionReason: "No venue can take it after all.",
            },
          ],
          safetyChecks: [{ status: "OUTDATED" }],
        });
        // The request's own history says who cancelled it and why.
        expect(
          await prisma.equipmentRequestUpdate.findMany({
            where: { requestId: request.id, toStatus: "CANCELLED" },
            select: { actorId: true, fromStatus: true, note: true },
          }),
        ).toEqual([
          {
            actorId: "usr_coordinator",
            fromStatus: "APPROVED",
            note: "Cancelled because the event was rejected: No venue can take it after all.",
          },
        ]);
        // The two projectors are back in the pool for that period.
        expect(await projectorsHeld()).toBe(before - 2);
        expect(
          await prisma.notification.count({
            where: { eventId, userId: "usr_organiser" },
          }),
        ).toBe(1);
      } finally {
        await prisma.notification.deleteMany({ where: { eventId } });
        await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
        await prisma.reservation.deleteMany({ where: { eventId } });
        await prisma.equipmentRequest.deleteMany({ where: { eventId } });
        await prisma.booking.deleteMany({ where: { eventId } });
        await prisma.safetyCheck.deleteMany({ where: { eventId } });
        await prisma.event.deleteMany({ where: { id: eventId } });
      }
    });
  },
);
