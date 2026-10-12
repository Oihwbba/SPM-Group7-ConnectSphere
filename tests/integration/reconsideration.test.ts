import { describe, it, expect, afterAll, afterEach, vi, type Mock } from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { flagArrangements } from "@/lib/reconsideration";
import { findVenueBlockers } from "@/lib/venue-availability";
import { resolveReconsiderationFlag } from "@/app/(app)/events/reconsideration-actions";
import { decideBookingRequest } from "@/app/(app)/bookings/actions";

// SCRUM-26 — Needs Reconsideration flags against a real database: a flag
// leaves the status and period alone and keeps blocking, Still stands checks
// the real venue, and Cancel releases exactly once. Test cases:
// docs/testing/SCRUM-26.md.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const session = (id: string, role: "COORDINATOR" | "VENUE_STAFF"): Session => ({
  user: { id, role, name: id, email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const asCoordinator = () =>
  (auth as unknown as Mock).mockResolvedValue(session("usr_coordinator", "COORDINATOR"));

// One day per test, far enough ahead that nothing seeded overlaps it.
const day = (n: number) => ({
  startAt: new Date(`2032-08-${String(n).padStart(2, "0")}T02:00:00Z`), // 10:00 am SGT
  endAt: new Date(`2032-08-${String(n).padStart(2, "0")}T04:00:00Z`), // 12:00 pm SGT
});

const created: string[] = [];

async function eventWith(
  period: { startAt: Date; endAt: Date },
  status: "PLANNING" | "CONFIRMED" = "PLANNING",
) {
  const event = await prisma.event.create({
    data: {
      name: `SCRUM-26 ${Date.now()} ${created.length}`,
      status,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      expectedAttendance: 40,
      ...period,
    },
    select: { id: true },
  });
  created.push(event.id);
  return event.id;
}

async function booking(
  eventId: string,
  period: { startAt: Date; endAt: Date },
  status: "PENDING" | "APPROVED" = "APPROVED",
) {
  const row = await prisma.booking.create({
    data: {
      eventId,
      venueId: "ven_hall",
      ...period,
      status,
      requestedAttendance: 40,
      requestedById: "usr_coordinator",
      ...(status === "APPROVED" && {
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      }),
    },
    select: { id: true },
  });
  return row.id;
}

async function flagged(eventId: string, reason = "The event's date changed.") {
  await prisma.$transaction((tx) => flagArrangements(tx, { eventId }, reason));
}

describe.skipIf(!usesLocalDatabase)("SCRUM-26 — Needs Reconsideration", () => {
  afterEach(async () => {
    const bookings = await prisma.booking.findMany({
      where: { eventId: { in: created } },
      select: { id: true },
    });
    const reservations = await prisma.reservation.findMany({
      where: { eventId: { in: created } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: {
          in: [...created, ...bookings.map((b) => b.id), ...reservations.map((r) => r.id)],
        },
      },
    });
    await prisma.safetyCheck.deleteMany({ where: { eventId: { in: created } } });
    await prisma.registration.deleteMany({ where: { eventId: { in: created } } });
    await prisma.reservation.deleteMany({ where: { eventId: { in: created } } });
    await prisma.booking.deleteMany({ where: { eventId: { in: created } } });
    await prisma.event.deleteMany({ where: { id: { in: created } } });
    await prisma.venueUnavailability.deleteMany({
      where: { venueId: "ven_hall", note: "SCRUM-26 test" },
    });
    created.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("SCRUM-26 [AC2, AC6, AC11, AC13] TC-26-12: flagging leaves the status, the period and the event's registrations unchanged, and cancels nothing", async () => {
    const eventId = await eventWith(day(2));
    const bookingId = await booking(eventId, day(2));
    const reservation = await prisma.reservation.create({
      data: {
        eventId,
        equipmentId: "eqp_projector",
        quantity: 1,
        ...day(2),
        reservedById: "usr_techsupport",
      },
      select: { id: true },
    });
    await prisma.registration.create({ data: { eventId, userId: "usr_attendee" } });

    await flagged(eventId);
    // The event then moves a day later; nothing follows it (AC6).
    await prisma.event.update({ where: { id: eventId }, data: day(3) });

    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b).toMatchObject({
      status: "APPROVED",
      needsReconsideration: true,
      reconsiderationReason: "The event's date changed.",
      ...day(2),
    });
    expect(b.reconsiderationFlaggedAt).toBeInstanceOf(Date);
    expect(
      await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } }),
    ).toMatchObject({ status: "CONFIRMED", needsReconsideration: true, ...day(2) });
    expect(
      await prisma.registration.findFirstOrThrow({ where: { eventId } }),
    ).toMatchObject({ status: "REGISTERED", needsReconsideration: false });
  });

  it("SCRUM-26 [AC4] TC-26-04: a flagged Approved booking keeps blocking its venue period, and a flagged reservation keeps its stock", async () => {
    const eventId = await eventWith(day(4));
    const bookingId = await booking(eventId, day(4));
    await prisma.reservation.create({
      data: {
        eventId,
        equipmentId: "eqp_projector",
        quantity: 3,
        ...day(4),
        reservedById: "usr_techsupport",
      },
    });
    await flagged(eventId);

    const blockers = await findVenueBlockers(prisma, "ven_hall", day(4));
    expect(blockers.map((b) => b.id)).toContain(bookingId);
    // Equipment availability subtracts every CONFIRMED reservation (SCRUM-29).
    const { _sum } = await prisma.reservation.aggregate({
      where: { eventId, status: "CONFIRMED", equipmentId: "eqp_projector" },
      _sum: { quantity: true },
    });
    expect(_sum.quantity).toBe(3);
  });

  it("SCRUM-26 [AC5] TC-26-09: Venue Staff can't approve a flagged Pending request, and it stays Pending", async () => {
    const eventId = await eventWith(day(5));
    const bookingId = await booking(eventId, day(5), "PENDING");
    await flagged(eventId);
    (auth as unknown as Mock).mockResolvedValue(session("usr_venuestaff", "VENUE_STAFF"));

    const result = await decideBookingRequest({ bookingId, decision: "APPROVED" });

    expect(result).toMatchObject({ ok: false });
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status,
    ).toBe("PENDING");
  });

  it("SCRUM-26 [AC7, AC8] TC-26-06: Still stands on a booking that still fits clears the flag and records who and when", async () => {
    const eventId = await eventWith(day(6));
    const bookingId = await booking(eventId, day(6));
    await flagged(eventId);
    asCoordinator();

    const result = await resolveReconsiderationFlag({
      kind: "booking",
      id: bookingId,
      decision: "STILL_STANDS",
    });

    expect(result).toEqual({
      ok: true,
      data: { decision: "STILL_STANDS", returnedToPlanning: false },
    });
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b).toMatchObject({
      status: "APPROVED",
      needsReconsideration: false,
      reconsiderationResolvedById: "usr_coordinator",
    });
    expect(b.reconsiderationResolvedAt).toBeInstanceOf(Date);
    expect(
      await prisma.auditLog.count({
        where: { entityId: bookingId, action: "RECONSIDERATION_RESOLVED" },
      }),
    ).toBe(1);
  });

  it("SCRUM-26 [AC8] TC-26-08: Still stands is refused when unavailability was recorded over the booking, and the flag stays", async () => {
    const eventId = await eventWith(day(7));
    const bookingId = await booking(eventId, day(7));
    // Week 7 allows unavailability over a booking (SCRUM-161 AC1).
    await prisma.venueUnavailability.create({
      data: {
        venueId: "ven_hall",
        ...day(7),
        reason: "MAINTENANCE",
        note: "SCRUM-26 test",
        recordedById: "usr_venuestaff",
      },
    });
    await flagged(eventId, "Exhibition Hall closed for maintenance.");
    asCoordinator();

    const result = await resolveReconsiderationFlag({
      kind: "booking",
      id: bookingId,
      decision: "STILL_STANDS",
    });

    expect(result).toEqual({
      ok: false,
      error:
        "It can't stand as it is: Exhibition Hall is unavailable (maintenance) from 7 Aug 2032, 10:00 am SGT to 7 Aug 2032, 12:00 pm SGT. Cancel the arrangement and request again.",
    });
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }),
    ).toMatchObject({ status: "APPROVED", needsReconsideration: true });
  });

  it("SCRUM-26 [AC9] TC-26-15: two simultaneous cancels release the booking once; the event's other booking is untouched", async () => {
    const eventId = await eventWith(day(8));
    const bookingId = await booking(eventId, day(8));
    await prisma.$transaction((tx) =>
      flagArrangements(tx, { bookingIds: [bookingId], reservationIds: [] }, "Moved."),
    );
    const other = await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_hall",
        startAt: new Date("2032-08-08T06:00:00Z"),
        endAt: new Date("2032-08-08T07:00:00Z"),
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      },
      select: { id: true },
    });
    asCoordinator();

    const results = await Promise.all([
      resolveReconsiderationFlag({ kind: "booking", id: bookingId, decision: "CANCEL" }),
      resolveReconsiderationFlag({ kind: "booking", id: bookingId, decision: "CANCEL" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({
      ok: false,
      error: "This arrangement no longer needs reconsideration. Refresh to see where it stands.",
    });
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }),
    ).toMatchObject({
      status: "CANCELLED",
      needsReconsideration: false,
      reconsiderationResolvedById: "usr_coordinator",
    });
    expect(
      await prisma.auditLog.count({ where: { entityId: bookingId, newValue: "CANCELLED" } }),
    ).toBe(1);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: other.id } })).status,
    ).toBe("APPROVED");
    // Released: the venue is free for that period again.
    expect(
      (await findVenueBlockers(prisma, "ven_hall", day(8))).map((b) => b.id),
    ).not.toContain(bookingId);
  });

  it("SCRUM-26 [AC9, AC10] TC-26-11: cancelling a flagged reservation of a Confirmed event returns its stock, the event to Planning and its safety check to Outdated", async () => {
    const eventId = await eventWith(day(9), "CONFIRMED");
    const reservation = await prisma.reservation.create({
      data: {
        eventId,
        equipmentId: "eqp_projector",
        quantity: 2,
        ...day(9),
        reservedById: "usr_techsupport",
      },
      select: { id: true },
    });
    const check = await prisma.safetyCheck.create({
      data: {
        eventId,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_coordinator",
        decidedAt: new Date(),
      },
      select: { id: true },
    });
    await flagged(eventId, "Technical Support: the projectors are needed elsewhere.");
    asCoordinator();

    const result = await resolveReconsiderationFlag({
      kind: "reservation",
      id: reservation.id,
      decision: "CANCEL",
    });

    expect(result).toEqual({
      ok: true,
      data: { decision: "CANCEL", returnedToPlanning: true },
    });
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(r.status).toBe("CANCELLED");
    expect(r.cancelledAt).toBeInstanceOf(Date);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).status,
    ).toBe("PLANNING");
    const outdated = await prisma.safetyCheck.findUniqueOrThrow({ where: { id: check.id } });
    expect(outdated.status).toBe("OUTDATED");
    expect(outdated.outdatedAt).toBeInstanceOf(Date);
    expect(
      await prisma.auditLog.count({
        where: { entityId: eventId, oldValue: "CONFIRMED", newValue: "PLANNING" },
      }),
    ).toBe(1);
  });
});
