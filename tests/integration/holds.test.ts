import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { eventBookingPeriod } from "@/lib/schemas/booking";
import { findVenueCalendar } from "@/lib/venue-availability";
import { getReadinessChecklist } from "@/lib/event-readiness";
import {
  confirmHold,
  decideBookingRequest,
  holdBookingRequest,
  releaseHold,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";
import { getPendingBookingQueue } from "@/app/(app)/bookings/queries";
import { rejectPlanningEvent } from "@/app/(app)/events/actions";

// SCRUM-163 against a real, seeded Postgres: what holding, confirming,
// releasing and rejecting write, what a live or lapsed hold blocks, and two
// holds placed at the same moment. Only the session is mocked. These write
// (their own events, a venue and its bookings), so they only run on a
// localhost database. The events belong to the second seeded Coordinator:
// bookings.test.ts reads usr_coordinator's bookable events in two steps, and
// rejecting one of these between them would fail it. A throwaway Coordinator
// won't do either, since automatic assignment (SCRUM-20) in a suite running
// alongside could hand it an event and stop it being deleted.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const session = (
  id: string,
  role: "COORDINATOR" | "VENUE_STAFF",
): Session => ({
  user: { id, role, name: id, email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const COORDINATOR_ID = "usr_coordinator_2";
const STAMP = Date.now();
const COORDINATOR = session(COORDINATOR_ID, "COORDINATOR");
const VENUE_STAFF = session("usr_venuestaff", "VENUE_STAFF");

const HOUR = 60 * 60 * 1000;
const fromNow = (ms: number) => new Date(Date.now() + ms);

describe.skipIf(!usesLocalDatabase)(
  "tentative venue holds — real database (SCRUM-163)",
  () => {
    let venueId: string;
    // Three events at the same time, so their requests for the venue overlap.
    let eventIds: string[];
    let period: { startAt: Date; endAt: Date };

    const pending = (eventId: string) =>
      prisma.booking.create({
        data: {
          eventId,
          venueId,
          ...period,
          status: "PENDING",
          requestedAttendance: 40,
          requestedById: COORDINATOR_ID,
        },
        select: { id: true },
      });
    /**
     * A hold written directly, placed two hours ago with this expiry; with
     * `approved`, Venue Staff approved it an hour ago (AC7).
     */
    const heldUntil = (eventId: string, holdExpiresAt: Date, approved = false) =>
      prisma.booking.create({
        data: {
          eventId,
          venueId,
          ...period,
          status: "HELD",
          requestedAttendance: 40,
          requestedById: COORDINATOR_ID,
          heldAt: fromNow(-2 * HOUR),
          holdExpiresAt,
          holdNote: "Confirm numbers.",
          ...(approved && {
            holdApprovedAt: fromNow(-HOUR),
            holdApprovedById: "usr_venuestaff",
          }),
        },
        select: { id: true },
      });
    const approve = (bookingId: string) =>
      decideBookingRequest({ bookingId, decision: "APPROVED" });
    const hold = (bookingId: string, holdExpiresAt = fromNow(48 * HOUR)) =>
      holdBookingRequest({
        bookingId,
        holdExpiresAt: holdExpiresAt.toISOString(),
        holdNote: "Confirm catering numbers.",
      });
    const statusOf = async (id: string) =>
      (
        await prisma.booking.findUniqueOrThrow({
          where: { id },
          select: { status: true },
        })
      ).status;
    const noticesOf = (bookingId: string) =>
      prisma.notification.findMany({
        where: { bookingId },
        select: {
          type: true,
          userId: true,
          showFromAt: true,
          withdrawnAt: true,
        },
        orderBy: { showFromAt: "asc" },
      });

    async function clear() {
      const ids = (
        await prisma.booking.findMany({
          where: { venueId },
          select: { id: true },
        })
      ).map((b) => b.id);
      await prisma.notification.deleteMany({
        where: { OR: [{ bookingId: { in: ids } }, { eventId: { in: eventIds } }] },
      });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: [...ids, ...eventIds] } },
      });
      await prisma.booking.deleteMany({ where: { venueId } });
      await prisma.event.updateMany({
        where: { id: { in: eventIds } },
        data: {
          status: "PLANNING",
          decidedAt: null,
          decidedById: null,
          decisionReason: null,
          rejectionOutcome: null,
        },
      });
    }

    beforeAll(async () => {
      const start = new Date(Date.UTC(2034, 6, 3, 2));
      const row = {
        startAt: start,
        endAt: new Date(start.getTime() + 4 * HOUR),
        expectedAttendance: 40,
      };
      eventIds = [];
      for (const n of [1, 2, 3]) {
        const event = await prisma.event.create({
          data: {
            name: `Hold test event ${n} ${STAMP}`,
            status: "PLANNING",
            organiserId: "usr_organiser",
            coordinatorId: COORDINATOR_ID,
            ...row,
          },
          select: { id: true },
        });
        eventIds.push(event.id);
      }
      period = eventBookingPeriod(row)!;
      venueId = (
        await prisma.venue.create({
          data: {
            name: `Hold test venue ${Date.now()}`,
            location: "Test block",
            capacity: 500,
          },
        })
      ).id;
    });

    beforeEach(async () => {
      mockAuth.mockResolvedValue(VENUE_STAFF);
      await clear();
    });

    afterAll(async () => {
      await clear();
      await prisma.venue.delete({ where: { id: venueId } });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    });

    it("SCRUM-163 [AC1, AC5] TC-163-01, TC-163-09: holding a pending request saves its expiry and note, and writes the Coordinator's three notices", async () => {
      const { id } = await pending(eventIds[0]);
      const expiry = fromNow(48 * HOUR);

      expect((await hold(id, expiry)).ok).toBe(true);

      const saved = await prisma.booking.findUniqueOrThrow({
        where: { id },
        select: { status: true, holdExpiresAt: true, holdNote: true, heldAt: true },
      });
      expect(saved).toMatchObject({
        status: "HELD",
        holdExpiresAt: expiry,
        holdNote: "Confirm catering numbers.",
      });
      const notices = await noticesOf(id);
      expect(notices.map((n) => [n.type, n.userId, n.withdrawnAt])).toEqual([
        ["BOOKING_HELD", COORDINATOR_ID, null],
        ["HOLD_EXPIRY_REMINDER", COORDINATOR_ID, null],
        ["HOLD_EXPIRED", COORDINATOR_ID, null],
      ]);
      expect(notices[0].showFromAt).toEqual(saved.heldAt);
      expect(notices[1].showFromAt).toEqual(
        new Date(expiry.getTime() - 24 * HOUR),
      );
      expect(notices[2].showFromAt).toEqual(expiry);
      expect(
        await prisma.auditLog.count({
          where: { entityId: id, action: "HELD", actorId: "usr_venuestaff" },
        }),
      ).toBe(1);
    });

    it("SCRUM-163 [AC1] TC-163-02: an expiry at or after the booking's start is refused, and nothing is written", async () => {
      const { id } = await pending(eventIds[0]);

      expect((await hold(id, period.startAt)).ok).toBe(false);

      expect(await statusOf(id)).toBe("PENDING");
      expect(await noticesOf(id)).toEqual([]);
    });

    it("SCRUM-163 [AC2, AC7] TC-163-04, TC-163-12: a live hold blocks overlapping approvals and holds, stays in the queue with its expiry, and shows on the calendar as held", async () => {
      const held = await pending(eventIds[0]);
      const other = await pending(eventIds[1]);
      const expiry = fromNow(48 * HOUR);
      await hold(held.id, expiry);

      for (const attempt of [
        () => decideBookingRequest({ bookingId: other.id, decision: "APPROVED" }),
        () => hold(other.id),
      ]) {
        expect(await attempt()).toMatchObject({
          ok: false,
          error: expect.stringMatching(/^Conflicting: .* is held from /),
        });
      }
      expect(await statusOf(other.id)).toBe("PENDING");

      const queue = (await getPendingBookingQueue()).filter(
        (b) => b.venue.id === venueId,
      );
      expect(
        queue.map((b) => [b.id, b.status, b.holdExpiresAt, b.blockers.length]),
      ).toEqual(
        expect.arrayContaining([
          [held.id, "HELD", expiry, 0],
          [other.id, "PENDING", null, 1],
        ]),
      );
      const calendar = await findVenueCalendar(prisma, venueId, period);
      expect(calendar.map((b) => b.kind === "booking" && b.heldUntil)).toEqual([
        expiry,
      ]);
    });

    it("SCRUM-163 [AC2] TC-163-05: two overlapping requests held at the same moment: exactly one is held", async () => {
      const a = await pending(eventIds[0]);
      const b = await pending(eventIds[1]);

      const results = await Promise.all([hold(a.id), hold(b.id)]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({
        error: expect.stringMatching(/^Conflicting: /),
      });
      expect(
        [await statusOf(a.id), await statusOf(b.id)].sort(),
      ).toEqual(["HELD", "PENDING"]);
    });

    it("SCRUM-163 [AC3, AC5, AC7] TC-163-06, TC-163-10, TC-163-12, TC-163-16: a hold is confirmed only once Venue Staff approve it, and only once, and confirming withdraws only its notices not yet shown", async () => {
      const { id } = await pending(eventIds[0]);
      await hold(id);
      mockAuth.mockResolvedValue(COORDINATOR);

      expect(await confirmHold({ bookingId: id })).toEqual({
        ok: false,
        error:
          "Venue Staff haven't approved this hold yet. You can confirm it once they have.",
      });
      expect(await statusOf(id)).toBe("HELD");

      mockAuth.mockResolvedValue(VENUE_STAFF);
      expect((await approve(id)).ok).toBe(true);
      mockAuth.mockResolvedValue(COORDINATOR);
      expect(await confirmHold({ bookingId: id })).toEqual({
        ok: true,
        data: { status: "APPROVED" },
      });
      expect(await confirmHold({ bookingId: id })).toEqual({
        ok: false,
        error: "This hold has already been confirmed.",
      });

      expect(await statusOf(id)).toBe("APPROVED");
      const notices = await noticesOf(id);
      expect(notices.map((n) => [n.type, n.withdrawnAt !== null])).toEqual([
        ["BOOKING_HELD", false],
        ["HOLD_APPROVED", false],
        ["HOLD_EXPIRY_REMINDER", true],
        ["HOLD_EXPIRED", true],
      ]);
      expect(
        await prisma.auditLog.count({
          where: { entityId: id, action: "HOLD_CONFIRMED" },
        }),
      ).toBe(1);
    });

    it("SCRUM-163 [AC3] TC-163-07: releasing a hold cancels it and frees the period for another request", async () => {
      const held = await pending(eventIds[0]);
      const other = await pending(eventIds[1]);
      await hold(held.id);
      mockAuth.mockResolvedValue(COORDINATOR);

      expect((await releaseHold({ bookingId: held.id })).ok).toBe(true);
      expect(await releaseHold({ bookingId: held.id })).toEqual({
        ok: false,
        error: "This hold has already been released.",
      });

      mockAuth.mockResolvedValue(VENUE_STAFF);
      expect(
        await decideBookingRequest({ bookingId: other.id, decision: "APPROVED" }),
      ).toEqual({ ok: true, data: { status: "APPROVED" } });
      expect(await statusOf(held.id)).toBe("CANCELLED");
    });

    it("SCRUM-163 [AC4] TC-163-08: from its expiry, a hold no longer reserves the venue, leaves the queue, reads Expired and can't be confirmed", async () => {
      const lapsed = await heldUntil(eventIds[0], fromNow(-HOUR));
      const other = await pending(eventIds[1]);
      mockAuth.mockResolvedValue(COORDINATOR);

      expect(await confirmHold({ bookingId: lapsed.id })).toMatchObject({
        ok: false,
        error: expect.stringMatching(/^This hold expired at /),
      });
      const checklist = await getReadinessChecklist(prisma, eventIds[0]);
      expect(checklist!.items[0].state).toBe("Hold expired");
      expect(
        (await getPendingBookingQueue()).some((b) => b.id === lapsed.id),
      ).toBe(false);

      // Nobody acted at the expiry, yet another request can be approved; the
      // database marks the lapsed hold Expired as it does.
      mockAuth.mockResolvedValue(VENUE_STAFF);
      expect(
        await decideBookingRequest({ bookingId: other.id, decision: "APPROVED" }),
      ).toEqual({ ok: true, data: { status: "APPROVED" } });
      expect(await statusOf(lapsed.id)).toBe("EXPIRED");
    });

    it("SCRUM-163 [AC4] TC-163-08: after its hold lapses, the event can request the same venue again, even before anything marks it Expired", async () => {
      const lapsed = await heldUntil(eventIds[0], fromNow(-HOUR));
      mockAuth.mockResolvedValue(COORDINATOR);

      const result = await submitBookingRequest({
        eventId: eventIds[0],
        venueId,
        startAt: period.startAt.toISOString(),
        endAt: period.endAt.toISOString(),
        requestedAttendance: 40,
      });

      expect(result).toMatchObject({ ok: true, data: { created: true } });
      expect(await statusOf(lapsed.id)).toBe("EXPIRED");
    });

    it("SCRUM-163 [AC8] TC-163-14: a confirmation the database receives after the expiry is refused there, so the booking is never Approved", async () => {
      // A hold Venue Staff approved, which expired a minute ago by the
      // database's clock.
      const { id } = await heldUntil(eventIds[0], fromNow(-60 * 1000), true);
      mockAuth.mockResolvedValue(COORDINATOR);
      // The application's clock runs an hour behind, so its own check still
      // sees a live hold: only the database's expiry guard stands between the
      // confirmation and an Approved booking (the race at the expiry instant).
      vi.useFakeTimers({ toFake: ["Date"], now: Date.now() - HOUR });
      try {
        expect(await confirmHold({ bookingId: id })).toMatchObject({
          ok: false,
          error: expect.stringMatching(/^This hold expired at /),
        });
      } finally {
        vi.useRealTimers();
      }

      expect(await statusOf(id)).toBe("HELD");
      expect(
        await prisma.auditLog.count({
          where: { entityId: id, action: "HOLD_CONFIRMED" },
        }),
      ).toBe(0);
    });

    it("SCRUM-163 [AC4] TC-163-08: a live hold is still the event's booking when it asks again", async () => {
      const { id } = await heldUntil(eventIds[0], fromNow(HOUR));
      mockAuth.mockResolvedValue(COORDINATOR);

      const result = await submitBookingRequest({
        eventId: eventIds[0],
        venueId,
        startAt: period.startAt.toISOString(),
        endAt: period.endAt.toISOString(),
        requestedAttendance: 40,
      });

      expect(result).toMatchObject({
        ok: true,
        data: { created: false, booking: { id, status: "HELD" } },
      });
    });

    it("SCRUM-163 [AC7, AC5] TC-163-12, TC-163-10: Venue Staff reject a live hold with a reason, which withdraws its notices still to come", async () => {
      const { id } = await pending(eventIds[0]);
      await hold(id);

      expect(
        await decideBookingRequest({
          bookingId: id,
          decision: "REJECTED",
          reason: "Roof repairs.",
        }),
      ).toEqual({ ok: true, data: { status: "REJECTED" } });

      expect(await statusOf(id)).toBe("REJECTED");
      expect(
        (await noticesOf(id)).filter((n) => n.withdrawnAt !== null),
      ).toHaveLength(2);
      mockAuth.mockResolvedValue(COORDINATOR);
      expect(await confirmHold({ bookingId: id })).toEqual({
        ok: false,
        error: "Venue Staff rejected this hold.",
      });
    });

    it("SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC4, AC14] TC-124-04: Venue Staff approve a hold: it stays Held and in the queue as approved, its Coordinator is told once, and approving again changes nothing", async () => {
      const { id } = await pending(eventIds[0]);
      const expiry = fromNow(48 * HOUR);
      await hold(id, expiry);
      const before = new Date();

      expect(await approve(id)).toEqual({ ok: true, data: { status: "HELD" } });
      expect(await approve(id)).toEqual({
        ok: false,
        error:
          "Venue Staff have already approved this hold. It is waiting for its Coordinator to confirm it.",
      });

      const row = await prisma.booking.findUniqueOrThrow({
        where: { id },
        select: { status: true, holdApprovedAt: true, holdApprovedById: true },
      });
      expect(row).toMatchObject({
        status: "HELD",
        holdApprovedById: "usr_venuestaff",
      });
      expect(row.holdApprovedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1000,
      );
      expect(
        (await getPendingBookingQueue()).find((b) => b.id === id),
      ).toMatchObject({ status: "HELD", holdExpiresAt: expiry });
      const checklist = await getReadinessChecklist(prisma, eventIds[0]);
      expect(checklist!.items[0].bookings).toEqual([
        expect.objectContaining({ id, held: true, holdApproved: true }),
      ]);

      const approvals = await prisma.notification.findMany({
        where: { bookingId: id, type: "HOLD_APPROVED" },
        select: { userId: true, eventId: true, withdrawnAt: true },
      });
      expect(approvals).toEqual([
        { userId: COORDINATOR_ID, eventId: eventIds[0], withdrawnAt: null },
      ]);
      expect(
        await prisma.auditLog.count({
          where: { entityId: id, action: "HOLD_APPROVED" },
        }),
      ).toBe(1);
    });

    it("SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC14] TC-124-04: one hold approved twice at the same moment is approved once, with one notice and one history entry", async () => {
      const { id } = await pending(eventIds[0]);
      await hold(id);

      const results = await Promise.all([approve(id), approve(id)]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({
        error: expect.stringMatching(/^Venue Staff have already approved/),
      });
      expect(
        await prisma.notification.count({
          where: { bookingId: id, type: "HOLD_APPROVED" },
        }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityId: id, action: "HOLD_APPROVED" },
        }),
      ).toBe(1);
    });

    it("SCRUM-163 [AC9] TC-163-13: rejecting the event releases its live hold and withdraws its notices still to come", async () => {
      const { id } = await pending(eventIds[2]);
      await hold(id);
      mockAuth.mockResolvedValue(COORDINATOR);

      expect(
        (
          await rejectPlanningEvent({
            eventId: eventIds[2],
            decisionReason: "The venue can't be secured.",
            rejectionOutcome: "AMEND_AND_RESUBMIT",
          })
        ).ok,
      ).toBe(true);

      expect(await statusOf(id)).toBe("CANCELLED");
      expect(
        (await noticesOf(id)).filter((n) => n.withdrawnAt !== null),
      ).toHaveLength(2);
    });
  },
);
