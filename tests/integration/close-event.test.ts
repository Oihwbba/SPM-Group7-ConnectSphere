import { describe, it, expect, afterAll, afterEach, vi, type Mock } from "vitest";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { cancelEvent } from "@/app/(app)/events/cancel-actions";
import { completeFinishedEvents } from "@/lib/event-closing";

// SCRUM-82 — closing an event against a real database: cancelling releases
// everything in one transaction and only once, and finished events complete
// once, without a job. Test cases: docs/testing/SCRUM-82.md.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const asCoordinator = () =>
  (auth as unknown as Mock).mockResolvedValue({
    user: { id: "usr_coordinator", role: "COORDINATOR", name: "Cody", email: "coordinator@test.local" },
    expires: "2999-01-01T00:00:00.000Z",
  });

const created: string[] = [];

async function event(
  status: "PLANNING" | "CONFIRMED" | "CANCELLED",
  period: { startAt: Date; endAt: Date },
) {
  const row = await prisma.event.create({
    data: {
      name: `SCRUM-82 ${Date.now()} ${created.length}`,
      status,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      expectedAttendance: 40,
      ...period,
    },
    select: { id: true },
  });
  created.push(row.id);
  return row.id;
}

describe.skipIf(!usesLocalDatabase)("SCRUM-82 — closing an event", () => {
  afterEach(async () => {
    const bookings = await prisma.booking.findMany({
      where: { eventId: { in: created } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...created, ...bookings.map((b) => b.id)] } },
    });
    await prisma.notification.deleteMany({ where: { eventId: { in: created } } });
    await prisma.equipmentRequest.deleteMany({ where: { eventId: { in: created } } });
    await prisma.registration.deleteMany({ where: { eventId: { in: created } } });
    await prisma.reservation.deleteMany({ where: { eventId: { in: created } } });
    await prisma.booking.deleteMany({ where: { eventId: { in: created } } });
    await prisma.event.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("SCRUM-82 [AC3, AC6] TC-82-04: cancelling releases the booking, the hold, the reservation and its stock, the equipment request, the registration, the awaiting safety check and the change request together", async () => {
    const period = {
      startAt: new Date("2032-12-01T02:00:00Z"),
      endAt: new Date("2032-12-01T06:00:00Z"),
    };
    const eventId = await event("CONFIRMED", period);
    await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_hall",
        ...period,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      },
    });
    await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_seminar",
        ...period,
        status: "HELD",
        requestedById: "usr_coordinator",
        heldAt: new Date("2032-11-01T00:00:00Z"),
        holdExpiresAt: new Date("2032-11-20T00:00:00Z"),
        holdNote: "Confirm the second room by 20 Nov.",
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
        ...period,
        reservedById: "usr_techsupport",
        requestId: request.id,
      },
    });
    await prisma.safetyCheck.create({ data: { eventId, requestedById: "usr_coordinator" } });
    await prisma.registration.create({ data: { eventId, userId: "usr_attendee" } });
    await prisma.eventChangeRequest.create({
      data: { eventId, requestedById: "usr_organiser", reason: "Move it" },
    });
    asCoordinator();

    expect(await cancelEvent({ eventId, reason: "Venue flooded." })).toEqual({
      ok: true,
      data: { status: "CANCELLED" },
    });

    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      status: "CANCELLED",
      cancellationReason: "Venue flooded.",
      cancelledById: "usr_coordinator",
    });
    expect(
      (await prisma.booking.findMany({ where: { eventId }, select: { status: true } })).map((b) => b.status),
    ).toEqual(["CANCELLED", "CANCELLED"]);
    expect(
      (await prisma.reservation.findFirstOrThrow({ where: { eventId } })).status,
    ).toBe("CANCELLED");
    expect(
      (await prisma.equipmentRequest.findUniqueOrThrow({ where: { id: request.id } })).status,
    ).toBe("CANCELLED");
    expect((await prisma.safetyCheck.findFirstOrThrow({ where: { eventId } })).status).toBe(
      "OUTDATED",
    );
    expect((await prisma.registration.findFirstOrThrow({ where: { eventId } })).status).toBe(
      "CANCELLED",
    );
    expect(
      await prisma.eventChangeRequest.findFirstOrThrow({ where: { eventId } }),
    ).toMatchObject({ status: "REJECTED", decisionReason: "Venue flooded." });
    expect(
      await prisma.notification.count({
        where: { eventId, userId: "usr_attendee", type: "REGISTERED_EVENT_CANCELLED" },
      }),
    ).toBe(1);
  });

  it("SCRUM-82 [AC4] TC-82-07: two cancels at the same moment cancel the event once", async () => {
    const eventId = await event("PLANNING", {
      startAt: new Date("2032-12-02T02:00:00Z"),
      endAt: new Date("2032-12-02T06:00:00Z"),
    });
    asCoordinator();

    const results = await Promise.all([
      cancelEvent({ eventId, reason: "First." }),
      cancelEvent({ eventId, reason: "Second." }),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(
      await prisma.auditLog.count({ where: { entityId: eventId, newValue: "CANCELLED" } }),
    ).toBe(1);
  });

  it("SCRUM-82 [AC7, AC8, AC9] TC-82-10: a finished Confirmed event completes once, even when two pages load at the same moment; at its end time it is still Confirmed, and a Cancelled one never completes", async () => {
    // Dates in 2001, so nothing any other suite writes has ended this early.
    const end = new Date("2001-01-01T10:00:00.000Z");
    const finished = await event("CONFIRMED", { startAt: new Date("2001-01-01T08:00:00Z"), endAt: end });
    const cancelled = await event("CANCELLED", { startAt: new Date("2001-01-01T08:00:00Z"), endAt: end });

    // AC7: at exactly the end it is still Confirmed.
    expect(await completeFinishedEvents(prisma, end)).not.toContain(finished);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: finished } })).status).toBe(
      "CONFIRMED",
    );

    const justAfter = new Date(end.getTime() + 1);
    const runs = await Promise.all([
      completeFinishedEvents(prisma, justAfter),
      completeFinishedEvents(prisma, justAfter),
    ]);

    expect(runs.flat().filter((id) => id === finished)).toHaveLength(1);
    expect(await prisma.event.findUniqueOrThrow({ where: { id: finished } })).toMatchObject({
      status: "COMPLETED",
      completedAt: justAfter,
    });
    expect(
      await prisma.auditLog.count({ where: { entityId: finished, newValue: "COMPLETED" } }),
    ).toBe(1);
    // AC8: checking again changes nothing. AC9: Cancelled stays Cancelled.
    expect(await completeFinishedEvents(prisma, justAfter)).not.toContain(finished);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: cancelled } })).status).toBe(
      "CANCELLED",
    );
  });
});
