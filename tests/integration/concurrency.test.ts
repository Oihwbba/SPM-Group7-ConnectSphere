import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { reserveEquipmentRequest } from "@/app/(app)/equipment/actions";
import {
  confirmEvent,
  transitionEventStatus,
  submitEventRequest,
} from "@/app/(app)/events/actions";
import {
  requestClarification,
  respondToClarification,
} from "@/app/(app)/events/clarification-actions";
import {
  registerForEvent,
  withdrawRegistration,
} from "@/app/(app)/events/registration-actions";
import { decideBookingRequest } from "@/app/(app)/bookings/actions";
import { createPlanningEvents, removeEvents } from "./test-events";
import { recordUnavailability } from "@/app/(app)/venues/availability/actions";

// The "at the same moment" cases (SCRUM-31/53/74). These are the acceptance
// criteria the database constraints and row locks exist to satisfy, so each one
// needs a real concurrent test against a live Postgres — see
// docs/data-model.md, decision 4.4. Replace each `it.todo` as the feature lands.
describe("concurrency", () => {
  // Enforced by the `booking_no_double_booking` EXCLUDE constraint.
  it.todo("rejects the second of two simultaneous overlapping approvals (SCRUM-53)");
  it.todo("allows a booking that starts exactly when another ends (SCRUM-38/50)");

  // SCRUM-74's version of this landed — see the
  // "concurrency — registration capacity (SCRUM-74)" describe block below.
});

// SCRUM-31 — enforced by SELECT ... FOR UPDATE on the Equipment row; a counted
// pool cannot use an exclusion constraint. These WRITE to the database (a
// throwaway Equipment row and its reservations, removed afterwards), so they only
// run against a localhost database — CI's service container, or the Docker DB —
// and never against the shared Supabase database that `.env` points at.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

// SCRUM-53 — a one-shot barrier around the approval's conflict check. When
// armed with `parties = 2`, each approval waits after its check until the other
// has checked too, so BOTH have seen "no conflict" before EITHER writes. That
// is the exact interleaving a check-then-write design gets wrong, forced every
// run instead of left to timing. Disarmed (the default), it changes nothing.
// SCRUM-161: recording unavailability first reads the bookings it affects, and
// that read waits at the same barrier.
const approvalBarrier = vi.hoisted(() => ({
  parties: 0,
  waiting: [] as Array<() => void>,
  async wait() {
    if (this.parties === 0) return;
    await new Promise<void>((release) => {
      this.waiting.push(release);
      if (this.waiting.length === this.parties) {
        this.parties = 0;
        this.waiting.splice(0).forEach((go) => go());
      }
    });
  },
}));
vi.mock("@/lib/venue-availability", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/venue-availability")>();
  return {
    ...actual,
    findVenueBlockers: async (
      ...args: Parameters<typeof actual.findVenueBlockers>
    ) => {
      const blockers = await actual.findVenueBlockers(...args);
      await approvalBarrier.wait();
      return blockers;
    },
  };
});
vi.mock("@/lib/venue-unavailability", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/venue-unavailability")>();
  return {
    ...actual,
    findAffectedBookings: async (
      ...args: Parameters<typeof actual.findAffectedBookings>
    ) => {
      const affected = await actual.findAffectedBookings(...args);
      await approvalBarrier.wait();
      return affected;
    },
  };
});

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const TECH_SUPPORT: Session = {
  user: {
    id: "usr_techsupport",
    role: "TECH_SUPPORT",
    name: "Theo Tech",
    email: "techsupport@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

describe.skipIf(!usesLocalDatabase)("concurrency — equipment pool (SCRUM-31)", () => {
  let equipmentId: string;
  const eventIds: string[] = [];

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue(TECH_SUPPORT);
    // A pool of exactly ONE unit, so any over-allocation is unmistakable.
    const pool = await prisma.equipment.create({
      data: { type: `Concurrency test pool ${Date.now()}`, totalQuantity: 1 },
      select: { id: true },
    });
    equipmentId = pool.id;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { equipmentId } });
    await prisma.equipmentRequest.deleteMany({ where: { eventId: { in: eventIds } } });
    await removeEvents(eventIds);
    await prisma.equipment.delete({ where: { id: equipmentId } });
  });

  // Since SCRUM-156 equipment is reserved only from an approved request, so
  // each period gets an event with a request for the one unit.
  async function approvedRequestsFor(periods: { startAt: string; endAt: string }[]) {
    const ids = await createPlanningEvents(
      "Concurrency pool",
      periods.map((p) => ({ startAt: new Date(p.startAt), endAt: new Date(p.endAt) })),
    );
    eventIds.push(...ids);
    return Promise.all(
      ids.map(async (eventId, index) => {
        const request = await prisma.equipmentRequest.create({
          data: {
            eventId,
            requestedById: "usr_coordinator",
            status: "APPROVED",
            lines: { create: [{ equipmentId, quantity: 1 }] },
          },
          select: { id: true },
        });
        return {
          requestId: request.id,
          ...periods[index],
          lines: [{ equipmentId, quantity: 1 }],
        };
      }),
    );
  }

  it("SCRUM-31 [AC5] TC-31-06: does not over-allocate equipment when two staff reserve the last unit", async () => {
    const period = {
      startAt: "2031-03-01T01:00:00.000Z",
      endAt: "2031-03-01T05:00:00.000Z",
    };
    const [first, second] = await approvedRequestsFor([period, period]);

    const results = await Promise.all([
      reserveEquipmentRequest(first),
      reserveEquipmentRequest(second),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);

    const reserved = await prisma.reservation.aggregate({
      where: {
        equipmentId,
        status: "CONFIRMED",
        startAt: { lt: new Date(period.endAt) },
        endAt: { gt: new Date(period.startAt) },
      },
      _sum: { quantity: true },
    });
    expect(reserved._sum.quantity).toBe(1);
  });

  it("SCRUM-31 [AC4] TC-31-05: accepts reservations that touch at an endpoint — periods sharing an endpoint do not overlap", async () => {
    // One unit, three back-to-back periods: each ends exactly when the next begins.
    const [morning, midday, dawn] = await approvedRequestsFor([
      { startAt: "2031-04-01T01:00:00.000Z", endAt: "2031-04-01T03:00:00.000Z" },
      { startAt: "2031-04-01T03:00:00.000Z", endAt: "2031-04-01T05:00:00.000Z" },
      { startAt: "2031-03-31T23:00:00.000Z", endAt: "2031-04-01T01:00:00.000Z" },
    ]);

    expect((await reserveEquipmentRequest(morning)).ok).toBe(true);
    expect((await reserveEquipmentRequest(midday)).ok).toBe(true);
    expect((await reserveEquipmentRequest(dawn)).ok).toBe(true);
  });
});

// SCRUM-53 AC5 — "two pending requests for the same venue cover overlapping
// periods, Venue Staff approve both at the same moment, only one approval
// succeeds and the other is returned as conflicting — the venue is never
// double-booked." Enforced by the `booking_no_double_booking` EXCLUDE
// constraint (docs/adr/0010). A mock cannot race, so this needs real Postgres.
describe.skipIf(!usesLocalDatabase)(
  "concurrency — venue double-booking (SCRUM-53)",
  () => {
    let venueId: string;
    // Two events, one request each: since SCRUM-50 AC8 an event holds at
    // most one live booking, and the seeded events already hold theirs.
    let firstEventId: string;
    let secondEventId: string;
    const SECOND_STAFF_ID = `usr_venuestaff_concurrency_${Date.now()}`;

    const staff = (id: string): Session => ({
      user: { id, role: "VENUE_STAFF", name: id, email: `${id}@test.local` },
      expires: "2999-01-01T00:00:00.000Z",
    });

    /** A PENDING request on the test venue, written directly. */
    async function pendingRequest(
      eventId: string,
      start: string,
      end: string,
      requestedById = "usr_coordinator",
    ) {
      const row = await prisma.booking.create({
        data: {
          eventId,
          venueId,
          startAt: new Date(start),
          endAt: new Date(end),
          requestedById,
        },
        select: { id: true },
      });
      return row.id;
    }

    const approvedCount = () =>
      prisma.booking.count({ where: { venueId, status: "APPROVED" } });

    beforeAll(async () => {
      // Two different members of Venue Staff, as the criterion describes. The
      // session says Venue Staff; the row doesn't, because other test files
      // notify every Venue Staff member (SCRUM-161 AC4, SCRUM-142) and would
      // race this user's delete. Nothing here reads the row's role.
      await prisma.user.create({
        data: {
          id: SECOND_STAFF_ID,
          email: `${SECOND_STAFF_ID}@test.local`,
          name: "Second Venue Staff",
          passwordHash: "not-a-real-hash-test-user-cannot-sign-in",
          role: "ORGANISER",
        },
      });
      const period = {
        startAt: new Date("2033-01-01T00:00:00.000Z"),
        endAt: new Date("2033-01-01T02:00:00.000Z"),
      };
      [firstEventId, secondEventId] = await createPlanningEvents(
        "Concurrency test event",
        [period, period],
      );
      const venue = await prisma.venue.create({
        data: {
          name: `Concurrency test venue ${Date.now()}`,
          location: "Test block",
          capacity: 50,
        },
        select: { id: true },
      });
      venueId = venue.id;
    });

    afterEach(async () => {
      approvalBarrier.parties = 0;
      const ids = await prisma.booking.findMany({
        where: { venueId },
        select: { id: true },
      });
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "Booking",
          entityId: { in: ids.map((b) => b.id) },
        },
      });
      await prisma.booking.deleteMany({ where: { venueId } });
    });

    afterAll(async () => {
      await removeEvents([firstEventId, secondEventId]);
      await prisma.venue.delete({ where: { id: venueId } });
      await prisma.user.delete({ where: { id: SECOND_STAFF_ID } });
    });

    it("SCRUM-53 [AC5] TC-53-05: two staff approve overlapping requests at the same moment: one succeeds, one is returned as conflicting", async () => {
      const first = await pendingRequest(
        firstEventId,
        "2033-02-01T02:00:00.000Z",
        "2033-02-01T06:00:00.000Z",
      );
      const second = await pendingRequest(
        secondEventId,
        "2033-02-01T04:00:00.000Z",
        "2033-02-01T08:00:00.000Z",
        "usr_coordinator_2",
      );
      (auth as unknown as Mock)
        .mockResolvedValueOnce(staff("usr_venuestaff"))
        .mockResolvedValueOnce(staff(SECOND_STAFF_ID));

      // Both approvals pass the application's own conflict check before either
      // writes — only the database can now tell them apart.
      approvalBarrier.parties = 2;
      const results = await Promise.all([
        decideBookingRequest({ bookingId: first, decision: "APPROVED" }),
        decideBookingRequest({ bookingId: second, decision: "APPROVED" }),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const refused = results.filter((r) => !r.ok);
      expect(refused).toHaveLength(1);
      expect(refused[0]).toMatchObject({
        error: expect.stringMatching(/^Conflicting:/),
      });

      // Never double-booked, and the loser is still pending for staff to reject.
      expect(await approvedCount()).toBe(1);
      const statuses = await prisma.booking.findMany({
        where: { id: { in: [first, second] } },
        select: { status: true },
      });
      expect(statuses.map((b) => b.status).sort()).toEqual([
        "APPROVED",
        "PENDING",
      ]);
      // One decision, one audit entry.
      expect(
        await prisma.auditLog.count({
          where: { entityType: "Booking", entityId: { in: [first, second] } },
        }),
      ).toBe(1);
    });

    it("SCRUM-53 [AC5] TC-53-05: the database alone refuses the second of two simultaneous overlapping approvals, however the rows are written", async () => {
      const first = await pendingRequest(
        firstEventId,
        "2033-03-01T02:00:00.000Z",
        "2033-03-01T06:00:00.000Z",
      );
      const second = await pendingRequest(
        secondEventId,
        "2033-03-01T05:00:00.000Z",
        "2033-03-01T09:00:00.000Z",
        "usr_coordinator_2",
      );

      // No application code at all: two raw transactions. The first approves
      // and holds its transaction open; the second approves an overlapping row
      // while the first is still uncommitted, then the first commits.
      let firstWrote!: () => void;
      const firstHasWritten = new Promise<void>((r) => (firstWrote = r));
      const approve = (id: string) =>
        Prisma.sql`UPDATE "Booking" SET "status" = 'APPROVED' WHERE "id" = ${id}`;

      const results = await Promise.allSettled([
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw(approve(first));
          firstWrote();
          await new Promise((r) => setTimeout(r, 300));
        }),
        firstHasWritten.then(() =>
          prisma.$transaction((tx) => tx.$executeRaw(approve(second))),
        ),
      ]);

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
      expect(String((results[1] as PromiseRejectedResult).reason)).toMatch(
        /booking_no_double_booking/,
      );
      expect(await approvedCount()).toBe(1);
    });

    it("SCRUM-53 [AC6] TC-53-06: two staff approve requests that touch at an endpoint at the same moment: both succeed", async () => {
      const morning = await pendingRequest(
        firstEventId,
        "2033-04-01T02:00:00.000Z",
        "2033-04-01T06:00:00.000Z",
      );
      const afternoon = await pendingRequest(
        secondEventId,
        "2033-04-01T06:00:00.000Z",
        "2033-04-01T10:00:00.000Z",
        "usr_coordinator_2",
      );
      (auth as unknown as Mock)
        .mockResolvedValueOnce(staff("usr_venuestaff"))
        .mockResolvedValueOnce(staff(SECOND_STAFF_ID));

      approvalBarrier.parties = 2;
      const results = await Promise.all([
        decideBookingRequest({ bookingId: morning, decision: "APPROVED" }),
        decideBookingRequest({ bookingId: afternoon, decision: "APPROVED" }),
      ]);

      expect(results.every((r) => r.ok)).toBe(true);
      expect(await approvedCount()).toBe(2);
    });

    // SCRUM-159 AC5 — the same race, where the two requests' booked periods
    // don't overlap but their occupied periods do. The application's check is
    // passed by both (the barrier); the database compares occupied periods
    // with the minutes each approval copies onto its booking (AC8).
    it("SCRUM-159 [AC5] TC-159-09: two staff approve requests whose setup and turnaround overlap at the same moment: only one succeeds, the other is returned as conflicting", async () => {
      await prisma.venue.update({
        where: { id: venueId },
        data: { setupMinutes: 30, turnaroundMinutes: 45 },
      });
      try {
        // 10:00–12:00 and 13:00–15:00 SGT: an hour apart as booked, but the
        // first's turnaround runs to 12:45 and the second's setup from 12:30.
        const morning = await pendingRequest(
          firstEventId,
          "2033-05-01T02:00:00.000Z",
          "2033-05-01T04:00:00.000Z",
        );
        const afternoon = await pendingRequest(
          secondEventId,
          "2033-05-01T05:00:00.000Z",
          "2033-05-01T07:00:00.000Z",
          "usr_coordinator_2",
        );
        (auth as unknown as Mock)
          .mockResolvedValueOnce(staff("usr_venuestaff"))
          .mockResolvedValueOnce(staff(SECOND_STAFF_ID));

        approvalBarrier.parties = 2;
        const results = await Promise.all([
          decideBookingRequest({ bookingId: morning, decision: "APPROVED" }),
          decideBookingRequest({ bookingId: afternoon, decision: "APPROVED" }),
        ]);

        expect(results.filter((r) => r.ok)).toHaveLength(1);
        expect(results.find((r) => !r.ok)).toMatchObject({
          error: expect.stringMatching(/^Conflicting:/),
        });
        expect(await approvedCount()).toBe(1);
      } finally {
        await prisma.venue.update({
          where: { id: venueId },
          data: { setupMinutes: 0, turnaroundMinutes: 0 },
        });
      }
    });
  },
);

// SCRUM-161 AC5 (replacing SCRUM-37 AC4) — an approval and an unavailability
// record for the same venue and overlapping periods, at the same moment. The
// unavailability is always saved; the booking ends up either refused (still
// Pending) or Approved and flagged, never Approved without a flag. No EXCLUDE
// constraint spans the two tables, so the venue lock both take in the
// occupancy triggers decides the order (ADR 0010).
describe.skipIf(!usesLocalDatabase)(
  "concurrency — approval vs recorded unavailability (SCRUM-161)",
  () => {
    let venueId: string;
    const eventIds: string[] = [];
    const staff: Session = {
      user: {
        id: "usr_venuestaff",
        role: "VENUE_STAFF",
        name: "Vera Venue",
        email: "venuestaff@test.local",
      },
      expires: "2999-01-01T00:00:00.000Z",
    };

    beforeAll(async () => {
      const venue = await prisma.venue.create({
        data: {
          name: `Occupancy race venue ${Date.now()}`,
          location: "Test block",
          capacity: 50,
        },
        select: { id: true },
      });
      venueId = venue.id;
    });

    afterEach(() => {
      approvalBarrier.parties = 0;
    });

    afterAll(async () => {
      approvalBarrier.parties = 0;
      const ids = (
        await prisma.booking.findMany({ where: { venueId }, select: { id: true } })
      ).map((b) => b.id);
      await prisma.auditLog.deleteMany({
        where: { entityType: "Booking", entityId: { in: ids } },
      });
      await prisma.notification.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await prisma.booking.deleteMany({ where: { venueId } });
      await prisma.venueUnavailability.deleteMany({ where: { venueId } });
      await removeEvents(eventIds);
      await prisma.venue.delete({ where: { id: venueId } });
    });

    /** A pending request on `day`, 10:00 am to 2:00 pm SGT, for its own event. */
    async function pendingOn(day: number) {
      const period = {
        startAt: new Date(Date.UTC(2033, 4, day, 2)),
        endAt: new Date(Date.UTC(2033, 4, day, 6)),
      };
      const [eventId] = await createPlanningEvents("Occupancy race event", [
        period,
      ]);
      eventIds.push(eventId);
      return prisma.booking.create({
        data: { eventId, venueId, ...period, requestedById: "usr_coordinator" },
        select: { id: true },
      });
    }

    /** Approve it while unavailability over it is recorded and confirmed. */
    async function race(day: number, forced: boolean) {
      const pending = await pendingOn(day);
      (auth as unknown as Mock).mockResolvedValue(staff);
      if (forced) approvalBarrier.parties = 2;
      const [approval, unavailability] = await Promise.all([
        decideBookingRequest({ bookingId: pending.id, decision: "APPROVED" }),
        recordUnavailability({
          venueId,
          startAt: new Date(Date.UTC(2033, 4, day, 4)).toISOString(),
          endAt: new Date(Date.UTC(2033, 4, day, 8)).toISOString(),
          reason: "MAINTENANCE",
          confirmedBookingIds: [pending.id],
        }),
      ]);
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: pending.id },
        select: { status: true, needsReconsideration: true },
      });
      return { approval, unavailability, booking };
    }

    it("SCRUM-161 [AC5] TC-161-12: both past their own checks before either writes: the unavailability is saved, and the booking is refused or flagged", async () => {
      const { approval, unavailability, booking } = await race(1, true);

      expect(unavailability).toMatchObject({
        ok: true,
        data: { recorded: true, created: true },
      });
      // One of the two outcomes AC5 allows, and nothing else.
      expect([
        { approved: false, status: "PENDING", flagged: true },
        { approved: true, status: "APPROVED", flagged: true },
      ]).toContainEqual({
        approved: approval.ok,
        status: booking.status,
        flagged: booking.needsReconsideration,
      });
      expect(
        await prisma.venueUnavailability.count({ where: { venueId } }),
      ).toBe(1);
    });

    it("SCRUM-161 [AC5] TC-161-12: never Approved without a flag, over repeated unforced races", async () => {
      for (const day of [2, 3, 4, 5, 6]) {
        const { approval, unavailability, booking } = await race(day, false);

        expect(unavailability.ok).toBe(true);
        expect(booking.needsReconsideration).toBe(true);
        expect(booking.status).toBe(approval.ok ? "APPROVED" : "PENDING");
      }
      // Five real races take about 5 s alone, Vitest's default limit, and
      // longer while the other test files run beside this one.
    }, 30_000);
  },
);

describe.skipIf(!usesLocalDatabase)("concurrency — status transitions (SCRUM-24)", () => {
  let eventId: string | undefined;

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue(TECH_SUPPORT);
    const event = await prisma.event.create({
      data: {
        name: `SCRUM-24 Concurrency Event ${Date.now()}`,
        status: "SUBMITTED",
        organiserId: "usr_organiser",
      },
      select: { id: true },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    if (eventId) {
      await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
      await prisma.event.delete({ where: { id: eventId } });
    }
  });

  it("SCRUM-24: the loser of two simultaneous decisions is told to refresh, and no audit entry is written", async () => {
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_coordinator", role: "COORDINATOR", name: "Cody", email: "coordinator@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });

    const results = await Promise.all([
      transitionEventStatus({ eventId, nextStatus: "APPROVED" }),
      transitionEventStatus({ eventId, nextStatus: "REJECTED", decisionReason: "Too large", rejectionOutcome: "AMEND_AND_RESUBMIT" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);

    // Exactly one decision is recorded. An approval also records the move to
    // Planning (SCRUM-81), so the entries leaving SUBMITTED are what count.
    expect(
      await prisma.auditLog.count({ where: { entityId: eventId, oldValue: "SUBMITTED" } }),
    ).toBe(1);
  });
});

// SCRUM-81 AC 8 — two confirms of one ready event at the same moment record one
// confirmation. confirmEvent locks the event row, so the second waits, then
// finds it already Confirmed.
describe.skipIf(!usesLocalDatabase)("concurrency — confirming an event (SCRUM-81)", () => {
  let eventId: string | undefined;
  const period = {
    startAt: new Date("2031-08-01T01:00:00Z"),
    endAt: new Date("2031-08-01T09:00:00Z"),
  };

  beforeAll(async () => {
    const event = await prisma.event.create({
      data: {
        name: `SCRUM-81 Concurrency Event ${Date.now()}`,
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        // SCRUM-170 AC4: no equipment, decided, so the venue makes it ready.
        noEquipmentNeededAt: new Date(),
        noEquipmentNeededById: "usr_coordinator",
        ...period,
      },
      select: { id: true },
    });
    eventId = event.id;
    await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_auditorium",
        ...period,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      },
    });
    // SCRUM-166 AC9: confirming also needs an approved safety check.
    await prisma.safetyCheck.create({
      data: {
        eventId,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_safetyofficer",
        decidedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (eventId) {
      await prisma.booking.deleteMany({ where: { eventId } });
      await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
      await prisma.event.delete({ where: { id: eventId } });
    }
  });

  it("SCRUM-81 [AC8] TC-81-10: two confirms at the same moment confirm the event once", async () => {
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_coordinator", role: "COORDINATOR", name: "Cody", email: "coordinator@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });

    const results = await Promise.all([confirmEvent({ eventId }), confirmEvent({ eventId })]);

    expect(results).toEqual([
      { ok: true, data: { status: "CONFIRMED" } },
      { ok: true, data: { status: "CONFIRMED" } },
    ]);
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      status: "CONFIRMED",
    });
    expect(
      await prisma.auditLog.count({ where: { entityId: eventId, newValue: "CONFIRMED" } }),
    ).toBe(1);
  });
});


// SCRUM-14 — a repeat submission must not create a second request or send
// another notification. It lives in this file, ahead of the SCRUM-20 block,
// because it triggers a coordinator assignment: within one file the blocks run
// in order, so it cannot interleave with the SCRUM-20 test's assignments the
// way a separate (parallel) test file could.
describe.skipIf(!usesLocalDatabase)("event submission — repeat submission (SCRUM-14)", () => {
  const name = `SCRUM-14 Repeat Submission ${Date.now()}`;
  let eventId: string;

  const submission = (id: string, eventName: string) => ({
    id,
    name: eventName,
    purpose: "Repeat submission coverage",
    description: "SCRUM-14 integration coverage",
    startAt: "2031-07-01T09:00:00.000Z",
    endAt: "2031-07-01T17:00:00.000Z",
    expectedAttendance: 10,
    venueRequirements: "Any room",
    accessibilityNeeds: "None",
    preferredLayout: "Classroom",
    equipmentRequirements: "None",
    registrationRequired: "yes",
    registrationNotes: "None",
  });

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_organiser", role: "ORGANISER", name: "Olivia Organiser", email: "organiser@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });
    const draft = await prisma.event.create({
      data: { name, status: "DRAFT", organiserId: "usr_organiser" },
      select: { id: true },
    });
    eventId = draft.id;
  });

  afterAll(async () => {
    // Every event this block creates is named `${name}…`.
    const ids = (
      await prisma.event.findMany({
        where: { name: { startsWith: name } },
        select: { id: true },
      })
    ).map((e) => e.id);
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  it("SCRUM-14 AC: submitting the same event again is refused, creates no second request and sends no additional notification", async () => {
    const first = await submitEventRequest(submission(eventId, name));
    expect(first.ok).toBe(true);

    const notificationsBefore = await prisma.notification.count({ where: { eventId } });

    const second = await submitEventRequest(submission(eventId, name));

    expect(second.ok).toBe(false);
    expect(await prisma.event.count({ where: { name } })).toBe(1);
    expect(await prisma.notification.count({ where: { eventId } })).toBe(notificationsBefore);
  });

  it("SCRUM-14 AC: two simultaneous submissions of one draft succeed once and notify once", async () => {
    const raceName = `${name} (simultaneous)`;
    const draft = await prisma.event.create({
      data: { name: raceName, status: "DRAFT", organiserId: "usr_organiser" },
      select: { id: true },
    });

    const results = await Promise.all([
      submitEventRequest(submission(draft.id, raceName)),
      submitEventRequest(submission(draft.id, raceName)),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    // One submission: the organiser's submission notice (SCRUM-45 AC1), one
    // assignment notice each for the organiser and the coordinator, and a
    // single ASSIGNED audit row.
    expect(await prisma.notification.count({ where: { eventId: draft.id } })).toBe(3);
    expect(
      await prisma.auditLog.count({
        where: { entityId: draft.id, action: "ASSIGNED" },
      }),
    ).toBe(1);
  });
});

describe.skipIf(!usesLocalDatabase)("concurrency — coordinator auto-assignment (SCRUM-20)", () => {
  let coordinatorAId: string;
  let coordinatorBId: string;

  const ORGANISER: Session = {
    user: {
      id: "usr_organiser",
      role: "ORGANISER",
      name: "Olivia Organiser",
      email: "organiser@test.local",
    },
    expires: "2999-01-01T00:00:00.000Z",
  };

  beforeAll(async () => {
    // Two throwaway coordinators, both starting at zero active events, so the
    // fairness rule has an actual tie to resolve under concurrency.
    const [a, b] = await Promise.all([
      prisma.user.create({
        data: {
          email: `concurrency-coord-a-${Date.now()}@test.local`,
          name: "Concurrency Coord A",
          role: "COORDINATOR",
          passwordHash: "not-used-in-this-test",
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `concurrency-coord-b-${Date.now()}@test.local`,
          name: "Concurrency Coord B",
          role: "COORDINATOR",
          passwordHash: "not-used-in-this-test",
        },
        select: { id: true },
      }),
    ]);
    coordinatorAId = a.id;
    coordinatorBId = b.id;
  });

  afterAll(async () => {
    // Dependents first: the assignment notifications reference the throwaway
    // coordinators through the required Notification.user FK, so deleting the
    // users while they exist throws P2003.
    const eventIds = (
      await prisma.event.findMany({
        where: { name: { startsWith: "SCRUM-20 Concurrency Event" } },
        select: { id: true },
      })
    ).map((e) => e.id);
    const coordinatorIds = [coordinatorAId, coordinatorBId];

    await prisma.notification.deleteMany({
      where: {
        OR: [{ eventId: { in: eventIds } }, { userId: { in: coordinatorIds } }],
      },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: coordinatorIds } } });
  });

  it("SCRUM-20: two events submitted at the same instant each end up with exactly one coordinator, and neither is left unassigned", async () => {
    (auth as unknown as Mock).mockResolvedValue(ORGANISER);

    const base = {
      purpose: "Concurrency test",
      description: "SCRUM-20 concurrency coverage",
      startAt: "2031-05-01T09:00:00.000Z",
      endAt: "2031-05-01T17:00:00.000Z",
      expectedAttendance: 10,
      venueRequirements: "Any room",
      accessibilityNeeds: "None",
      preferredLayout: "Classroom",
      equipmentRequirements: "None",
      registrationRequired: "yes",
      registrationNotes: "None",
    };

    const results = await Promise.all([
      submitEventRequest({ ...base, name: `SCRUM-20 Concurrency Event A ${Date.now()}` }),
      submitEventRequest({ ...base, name: `SCRUM-20 Concurrency Event B ${Date.now()}` }),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);

    const events = await prisma.event.findMany({
      where: { name: { startsWith: "SCRUM-20 Concurrency Event" } },
      select: { id: true, coordinatorId: true, status: true },
    });

    expect(events).toHaveLength(2);
    // AC: "An event has at most one assigned Coordinator at any moment" —
    // both submissions found a coordinator (there were two available) and
    // neither was left unassigned.
    for (const event of events) {
      expect(event.coordinatorId).not.toBeNull();
      expect(event.status).toBe("UNDER_REVIEW");
    }

    // Fairness under concurrency: pickCoordinator holds an advisory lock
    // until the assignment commits, so the second submission sees the first's
    // load. At least two coordinators (the throwaway pair) start at zero
    // active events, so a fair rule cannot hand both events to one of them.
    expect(new Set(events.map((e) => e.coordinatorId)).size).toBe(2);
  });
});

// SCRUM-18 — enforced by SELECT ... FOR UPDATE on the Event row (requesting)
// and a conditional `status: "OPEN"` claim (responding). The unit tests only
// prove the calls are made; these prove the database actually serialises them.
describe.skipIf(!usesLocalDatabase)("concurrency — clarification (SCRUM-18)", () => {
  let eventId: string;
  const raceEventName = `SCRUM-18 Decision Race Event ${Date.now()}`;

  const asCoordinator = () =>
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_coordinator", role: "COORDINATOR", name: "Cody", email: "coordinator@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });
  const asOrganiser = () =>
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_organiser", role: "ORGANISER", name: "Olivia Organiser", email: "organiser@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });

  beforeAll(async () => {
    const event = await prisma.event.create({
      data: {
        name: `SCRUM-18 Concurrency Event ${Date.now()}`,
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
      },
      select: { id: true },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    const raceIds = (
      await prisma.event.findMany({
        where: { name: raceEventName },
        select: { id: true },
      })
    ).map((e) => e.id);
    const ids = [eventId, ...raceIds];
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.clarificationRequest.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  it("SCRUM-18: two simultaneous requests on one event create exactly one OPEN clarification and refuse the other", async () => {
    asCoordinator();

    const results = await Promise.all([
      requestClarification({ eventId, message: "Question one" }),
      requestClarification({ eventId, message: "Question two" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    expect(
      await prisma.clarificationRequest.count({ where: { eventId, status: "OPEN" } }),
    ).toBe(1);
  });

  it("SCRUM-18: two simultaneous replies leave one ANSWERED row, refuse the other, and notify the coordinator once", async () => {
    asOrganiser();
    const open = await prisma.clarificationRequest.findFirstOrThrow({
      where: { eventId, status: "OPEN" },
      select: { id: true },
    });

    const results = await Promise.all([
      respondToClarification({ clarificationId: open.id, response: "Reply one" }),
      respondToClarification({ clarificationId: open.id, response: "Reply two" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok);
    expect(loser && !loser.ok && loser.error).toMatch(/already been answered/i);

    const row = await prisma.clarificationRequest.findUniqueOrThrow({
      where: { id: open.id },
    });
    expect(row.status).toBe("ANSWERED");
    // The winner's reply was kept, not overwritten by the loser's.
    const winnerIndex = results.findIndex((r) => r.ok);
    expect(row.response).toBe(winnerIndex === 0 ? "Reply one" : "Reply two");

    expect(
      await prisma.notification.count({
        where: { eventId, userId: "usr_coordinator", title: "Clarification answered" },
      }),
    ).toBe(1);
  });

  it("SCRUM-18: a question asked at the same instant as a decision never leaves an OPEN clarification on the decided event", async () => {
    asCoordinator();
    const event = await prisma.event.create({
      data: {
        name: raceEventName,
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
      },
      select: { id: true },
    });

    // Either order is legal: the question lands first and the decision closes
    // it, or the decision lands first and the question is refused. What must
    // never happen is the question slipping in after the decision.
    await Promise.all([
      requestClarification({ eventId: event.id, message: "Question during a decision" }),
      transitionEventStatus({ eventId: event.id, nextStatus: "APPROVED" }),
    ]);

    // SCRUM-81: approval moves the event straight to Planning.
    expect(
      await prisma.event.findUniqueOrThrow({ where: { id: event.id } }),
    ).toMatchObject({ status: "PLANNING" });
    expect(
      await prisma.clarificationRequest.count({
        where: { eventId: event.id, status: "OPEN" },
      }),
    ).toBe(0);
  });
});

// SCRUM-74 — "Given an event with remaining capacity of one, when two
// Attendees register at the same moment, then exactly one succeeds and the
// other is told the event is full." Uses the seeded evt_last_seat (2 of 3
// places taken) and the two accounts the seed itself notes are free to
// compete for that last place (prisma/seed.ts: "attendee3 and attendee4 are
// both free to take the last place, which is what the simultaneous-
// registration test needs").
describe.skipIf(!usesLocalDatabase)("concurrency — registration capacity (SCRUM-74)", () => {
  const LAST_SEAT_EVENT_ID = "evt_last_seat";

  afterAll(async () => {
    await prisma.registration.deleteMany({
      where: {
        eventId: LAST_SEAT_EVENT_ID,
        userId: { in: ["usr_attendee_3", "usr_attendee_4"] },
      },
    });
  });

  it("SCRUM-74: exactly one of two simultaneous registrations for the last place succeeds", async () => {
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_attendee_3", role: "ATTENDEE", name: "Attendee Three", email: "attendee3@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });
    const registerAsAttendee3 = registerForEvent({ eventId: LAST_SEAT_EVENT_ID });

    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_attendee_4", role: "ATTENDEE", name: "Attendee Four", email: "attendee4@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });
    const registerAsAttendee4 = registerForEvent({ eventId: LAST_SEAT_EVENT_ID });

    const results = await Promise.all([registerAsAttendee3, registerAsAttendee4]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok);
    expect(loser && !loser.ok && loser.error).toMatch(/full/i);

    expect(
      await prisma.registration.count({
        where: { eventId: LAST_SEAT_EVENT_ID, status: "REGISTERED" },
      }),
    ).toBe(3);
  });
});

// SCRUM-74 — "Given a full event, when an existing Attendee withdraws, then
// remaining capacity increases by one and registration reopens." A dedicated
// throwaway event (capacity 1), not a shared seeded fixture: this test both
// fills and then re-opens the event, which would corrupt any fixture other
// tests in this file also rely on.
describe.skipIf(!usesLocalDatabase)("concurrency — withdrawal reopens capacity (SCRUM-74)", () => {
  let eventId: string;
  let firstRegistrationId: string;

  const asAttendee = (id: string, email: string) =>
    (auth as unknown as Mock).mockResolvedValue({
      user: { id, role: "ATTENDEE", name: "Concurrency Attendee", email },
      expires: "2999-01-01T00:00:00.000Z",
    });

  beforeAll(async () => {
    const event = await prisma.event.create({
      data: {
        name: `SCRUM-74 Withdrawal Concurrency Event ${Date.now()}`,
        status: "CONFIRMED",
        organiserId: "usr_organiser",
        expectedAttendance: 1,
        registrationEnabled: true,
      },
      select: { id: true },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.event.delete({ where: { id: eventId } });
  });

  it("withdrawing the sole registration on a full event lets a new registration succeed", async () => {
    asAttendee("usr_attendee_3", "attendee3@test.local");
    const first = await registerForEvent({ eventId });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    firstRegistrationId = first.data.id;

    asAttendee("usr_attendee_4", "attendee4@test.local");
    const whileFull = await registerForEvent({ eventId });
    expect(whileFull.ok).toBe(false);
    if (!whileFull.ok) expect(whileFull.error).toMatch(/full/i);

    asAttendee("usr_attendee_3", "attendee3@test.local");
    const withdrawal = await withdrawRegistration({
      registrationId: firstRegistrationId,
    });
    expect(withdrawal.ok).toBe(true);

    asAttendee("usr_attendee_4", "attendee4@test.local");
    const afterWithdrawal = await registerForEvent({ eventId });
    expect(afterWithdrawal.ok).toBe(true);

    expect(
      await prisma.registration.count({
        where: { eventId, status: "REGISTERED" },
      }),
    ).toBe(1);
    expect(
      await prisma.registration.findUniqueOrThrow({
        where: { id: firstRegistrationId },
      }),
    ).toMatchObject({ status: "WITHDRAWN" });
  });
});
