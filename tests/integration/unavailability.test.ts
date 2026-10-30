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
import { Prisma, type BookingStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { eventBookingPeriod } from "@/lib/schemas/booking";
import { createPlanningEvents, removeEvents } from "./test-events";
import { recordUnavailability } from "@/app/(app)/venues/availability/actions";
import { submitBookingRequest } from "@/app/(app)/bookings/actions";
import { withHours } from "../venue-hours-fixture";

// SCRUM-37 and SCRUM-161 against a real, seeded Postgres: recording
// unavailability, what it does to requests and approvals, how it flags the
// bookings it overlaps, and the database's occupancy triggers (ADR 0010).
// Only the session is mocked. The simultaneous approval-vs-unavailability
// race lives in concurrency.test.ts.
//
// These WRITE (a throwaway venue, its bookings and unavailability, removed
// afterwards), so they only run against a localhost database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const session = (id: string, role: "COORDINATOR" | "VENUE_STAFF"): Session => ({
  user: { id, role, name: id, email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const COORDINATOR = session("usr_coordinator", "COORDINATOR");
const VENUE_STAFF = session("usr_venuestaff", "VENUE_STAFF");

/** A UTC instant on a far-future day, clear of anything seeded. */
const at = (day: number, hour: number) =>
  new Date(Date.UTC(2034, 4, day, hour)).toISOString();

const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!usesLocalDatabase)(
  "recorded venue unavailability — real database (SCRUM-37, SCRUM-161)",
  () => {
    let venueId: string;
    let venueName: string;
    // The event requests are made for, and others to hang bookings on: each
    // event holds at most one live booking per venue (SCRUM-172).
    let requestEventId: string;
    let blockingEventId: string;
    let otherEventIds: string[];
    // SCRUM-50 AC1: a request is always for its event's period and
    // attendance, so maintenance that should meet it is placed around those.
    let event: { startAt: Date; endAt: Date; attendance: number };
    const hoursFrom = (instant: Date, hours: number) =>
      new Date(instant.getTime() + hours * 60 * 60 * 1000).toISOString();

    const record = (
      start: string,
      end: string,
      reason = "MAINTENANCE",
      confirmedBookingIds: string[] = [],
      note?: string,
    ) =>
      recordUnavailability({
        venueId,
        startAt: start,
        endAt: end,
        reason,
        note,
        confirmedBookingIds,
      });

    /** Record, confirming the affected bookings shown (SCRUM-161 AC2). */
    async function recordConfirmed(
      start: string,
      end: string,
      reason = "MAINTENANCE",
      note?: string,
    ) {
      const first = await record(start, end, reason, [], note);
      if (!first.ok || first.data.recorded) return first;
      return record(
        start,
        end,
        reason,
        first.data.affected.map((b) => b.bookingId),
        note,
      );
    }

    /** A request for the suite's event, which covers its own period. */
    const request = () =>
      submitBookingRequest({
        eventId: requestEventId,
        venueId,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt.toISOString(),
        requestedAttendance: event.attendance,
      });

    /** A booking at the suite's venue, written directly; Approved unless told. */
    const booking = (
      eventId: string,
      start: string,
      end: string,
      data: Partial<Prisma.BookingUncheckedCreateInput> = {},
    ) =>
      prisma.booking.create({
        data: {
          eventId,
          venueId,
          startAt: new Date(start),
          endAt: new Date(end),
          status: "APPROVED",
          requestedById: "usr_coordinator",
          decidedById: "usr_venuestaff",
          decidedAt: new Date(),
          ...data,
        },
      });
    const approvedBooking = (start: string, end: string) =>
      booking(blockingEventId, start, end);
    /** A live hold, expiring in two days. */
    const held = (eventId: string, start: string, end: string) =>
      booking(eventId, start, end, {
        status: "HELD",
        heldAt: new Date(),
        holdExpiresAt: new Date(Date.now() + 2 * DAY_MS),
        holdNote: "Confirm the catering numbers.",
      });

    const unavailabilityCount = () =>
      prisma.venueUnavailability.count({ where: { venueId } });
    const flagOf = (id: string) =>
      prisma.booking.findUniqueOrThrow({
        where: { id },
        select: {
          status: true,
          startAt: true,
          endAt: true,
          holdExpiresAt: true,
          needsReconsideration: true,
          reconsiderationReason: true,
          reconsiderationFlaggedAt: true,
        },
      });
    const allEventIds = () => [
      requestEventId,
      blockingEventId,
      ...otherEventIds,
    ];
    const notificationsFor = (eventIds: string[]) =>
      prisma.notification.findMany({
        where: { eventId: { in: eventIds }, type: "ARRANGEMENT_FLAGGED" },
        orderBy: { userId: "asc" },
      });
    const venueStaffIds = async () =>
      (
        await prisma.user.findMany({
          where: {
            OR: [{ role: "VENUE_STAFF" }, { additionalRoles: { has: "VENUE_STAFF" } }],
          },
          select: { id: true },
        })
      ).map((u) => u.id);

    /**
     * SCRUM-161 AC4: every Venue Staff member is told once per flagged event.
     * Test files share the database and run in parallel, so the staff can
     * change while this runs: "every member" is checked against the staff
     * there both before and after recording, and no one outside the staff at
     * either moment may be told.
     */
    async function expectVenueStaffToldOnce(
      eventIds: string[],
      staffBefore: string[],
    ) {
      const staffAfter = await venueStaffIds();
      const throughout = staffBefore.filter((id) => staffAfter.includes(id));
      const atEitherMoment = new Set([...staffBefore, ...staffAfter]);
      const toStaff = (await notificationsFor(eventIds)).filter(
        (n) => n.title === "Booking needs reconsideration",
      );
      expect(throughout).toContain(VENUE_STAFF.user.id);
      for (const eventId of eventIds) {
        const told = toStaff
          .filter((n) => n.eventId === eventId)
          .map((n) => n.userId);
        expect(new Set(told).size).toBe(told.length);
        expect(told).toEqual(expect.arrayContaining(throughout));
        expect(told.filter((id) => !atEitherMoment.has(id))).toEqual([]);
      }
    }

    async function clear() {
      const ids = (
        await prisma.booking.findMany({
          where: { venueId },
          select: { id: true },
        })
      ).map((b) => b.id);
      await prisma.auditLog.deleteMany({
        where: { entityType: "Booking", entityId: { in: ids } },
      });
      await prisma.notification.deleteMany({
        where: { eventId: { in: allEventIds() } },
      });
      await prisma.booking.deleteMany({ where: { venueId } });
      await prisma.venueUnavailability.deleteMany({ where: { venueId } });
      await prisma.venue.update({
        where: { id: venueId },
        data: { setupMinutes: 0, turnaroundMinutes: 0 },
      });
    }

    beforeAll(async () => {
      const row = {
        startAt: new Date(at(20, 2)),
        endAt: new Date(at(20, 6)),
        expectedAttendance: 40,
      };
      [requestEventId, blockingEventId, ...otherEventIds] =
        await createPlanningEvents("Unavailability test event", [
          row,
          row,
          row,
          row,
          row,
        ]);
      event = {
        ...eventBookingPeriod(row)!,
        attendance: row.expectedAttendance,
      };

      venueName = `Unavailability test venue ${Date.now()}`;
      const venue = await prisma.venue.create({
        data: { name: venueName, location: "Test block", capacity: 500, ...withHours },
      });
      venueId = venue.id;
    });

    beforeEach(async () => {
      mockAuth.mockResolvedValue(VENUE_STAFF);
      await clear();
    });

    afterAll(async () => {
      await clear();
      await removeEvents(allEventIds());
      await prisma.venue.delete({ where: { id: venueId } });
    });

    it("SCRUM-37 [AC1] TC-37-02: venue staff record a period and a reason, and it is saved", async () => {
      const result = await recordUnavailability({
        venueId,
        startAt: at(3, 1),
        endAt: at(3, 9),
        reason: "SAFETY_CONCERN",
        note: "  Fire exit blocked.  ",
      });

      expect(result).toMatchObject({
        ok: true,
        data: { recorded: true, created: true, flagged: 0 },
      });
      if (!result.ok || !result.data.recorded) return;
      const row = await prisma.venueUnavailability.findUniqueOrThrow({
        where: { id: result.data.id },
      });
      expect(row).toMatchObject({
        venueId,
        startAt: new Date(at(3, 1)),
        endAt: new Date(at(3, 9)),
        reason: "SAFETY_CONCERN",
        note: "Fire exit blocked.",
        recordedById: "usr_venuestaff",
      });
    });

    it("SCRUM-37 [AC1] TC-37-03: an end at or before the start is refused as an invalid period", async () => {
      const result = await record(at(3, 9), at(3, 9));

      expect(result).toMatchObject({
        ok: false,
        error:
          "The requested period is invalid: the end must be after the start.",
      });
      expect(await unavailabilityCount()).toBe(0);
    });

    it("SCRUM-37 [AC2] TC-37-04: a request over recorded maintenance is refused, with the same message shape as a booking clash", async () => {
      await record(hoursFrom(event.startAt, -1), hoursFrom(event.startAt, 1));
      mockAuth.mockResolvedValue(COORDINATOR);

      const result = await request();

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(
        /is unavailable for that period: unavailable \(maintenance\) from .+ to .+\.$/,
      );
      expect(await prisma.booking.count({ where: { venueId } })).toBe(0);
    });

    it("SCRUM-37 [AC3] TC-37-05: recording over a period already recorded is refused too", async () => {
      await record(at(7, 1), at(7, 5));

      const result = await record(at(7, 4), at(7, 8), "EQUIPMENT_FAILURE");

      expect(result).toMatchObject({
        ok: false,
        error: expect.stringMatching(
          /^Not recorded: .* unavailable \(maintenance\)/,
        ),
      });
      expect(await unavailabilityCount()).toBe(1);
    });

    it("SCRUM-37 [AC5] TC-37-07: maintenance ending exactly as a request begins does not clash", async () => {
      await record(hoursFrom(event.startAt, -4), event.startAt.toISOString());
      mockAuth.mockResolvedValue(COORDINATOR);

      const result = await request();

      expect(result.ok && result.data.created).toBe(true);
    });

    it("SCRUM-37 [AC5] TC-37-07: maintenance starting exactly as a booking ends is recorded without asking to confirm", async () => {
      await approvedBooking(at(9, 1), at(9, 5));

      const result = await record(at(9, 5), at(9, 9));

      expect(result).toMatchObject({
        ok: true,
        data: { recorded: true, created: true, flagged: 0 },
      });
    });

    describe("over existing bookings (SCRUM-161)", () => {
      it("SCRUM-161 [AC1, AC2] TC-161-01: over an approved booking, the booking is shown first and the period saved once confirmed", async () => {
        const approved = await approvedBooking(at(6, 1), at(6, 5));

        const first = await record(at(6, 3), at(6, 9), "EQUIPMENT_FAILURE");

        expect(first).toEqual({
          ok: true,
          data: {
            recorded: false,
            affected: [
              {
                bookingId: approved.id,
                eventName: expect.stringMatching(
                  /^Unavailability test event 2 /,
                ),
                coordinatorName: "Cody Coordinator",
                status: "Approved",
                startAt: new Date(at(6, 1)),
                endAt: new Date(at(6, 5)),
              },
            ],
          },
        });
        expect(await unavailabilityCount()).toBe(0);
        expect((await flagOf(approved.id)).needsReconsideration).toBe(false);

        const confirmed = await record(
          at(6, 3),
          at(6, 9),
          "EQUIPMENT_FAILURE",
          [approved.id],
        );

        expect(confirmed).toMatchObject({
          ok: true,
          data: { recorded: true, created: true, flagged: 1 },
        });
        expect(await unavailabilityCount()).toBe(1);
      });

      it("SCRUM-161 [AC1] TC-161-03: over unavailability already recorded, nothing is saved or flagged, even with a booking under both", async () => {
        await record(at(7, 1), at(7, 5));
        // Starts as the maintenance ends, so it wasn't affected by it.
        const approved = await approvedBooking(at(7, 5), at(7, 8));

        const result = await record(at(7, 4), at(7, 8), "RENOVATION", [
          approved.id,
        ]);

        expect(result).toMatchObject({
          ok: false,
          error: expect.stringMatching(
            /^Not recorded: .* is unavailable \(maintenance\) from 7 May 2034, 9:00 am SGT to 7 May 2034, 1:00 pm SGT\.$/,
          ),
        });
        expect(await unavailabilityCount()).toBe(1);
        expect((await flagOf(approved.id)).needsReconsideration).toBe(false);
        expect(await notificationsFor(allEventIds())).toHaveLength(0);
      });

      it("SCRUM-161 [AC3] TC-161-04: pending, held and approved bookings are all flagged, and their status, times and events don't change", async () => {
        const [e3, e4, e5] = otherEventIds;
        const pending = await booking(e3, at(8, 1), at(8, 3), {
          status: "PENDING",
          decidedById: null,
          decidedAt: null,
        });
        const hold = await held(e4, at(8, 3), at(8, 5));
        const approved = await booking(e5, at(8, 5), at(8, 7));
        const before = await Promise.all(
          [pending, hold, approved].map((b) => flagOf(b.id)),
        );
        const eventsBefore = await prisma.event.findMany({
          where: { id: { in: [e3, e4, e5] } },
          select: {
            id: true,
            status: true,
            startAt: true,
            endAt: true,
            expectedAttendance: true,
          },
          orderBy: { id: "asc" },
        });

        const result = await recordConfirmed(
          at(8, 2),
          at(8, 6),
          "SAFETY_CONCERN",
          "Fire exit blocked",
        );

        expect(result).toMatchObject({ ok: true, data: { flagged: 3 } });
        const reason = `${venueName} is unavailable: Safety concern from 8 May 2034, 10:00 am SGT to 8 May 2034, 2:00 pm SGT. Note: Fire exit blocked`;
        for (const [i, b] of [pending, hold, approved].entries()) {
          const after = await flagOf(b.id);
          expect(after).toEqual({
            ...before[i],
            needsReconsideration: true,
            reconsiderationReason: reason,
            reconsiderationFlaggedAt: expect.any(Date),
          });
        }
        expect(
          (
            await Promise.all(
              [pending, hold, approved].map((b) => flagOf(b.id)),
            )
          ).map((b) => b.status),
        ).toEqual(["PENDING", "HELD", "APPROVED"] satisfies BookingStatus[]);
        expect(
          await prisma.event.findMany({
            where: { id: { in: [e3, e4, e5] } },
            select: {
              id: true,
              status: true,
              startAt: true,
              endAt: true,
              expectedAttendance: true,
            },
            orderBy: { id: "asc" },
          }),
        ).toEqual(eventsBefore);
        expect(
          await prisma.auditLog.count({
            where: {
              entityType: "Booking",
              entityId: { in: [pending.id, hold.id, approved.id] },
              action: "RECONSIDERATION_FLAGGED",
            },
          }),
        ).toBe(3);
      });

      it("SCRUM-161 [AC3] TC-161-05: bookings that only touch it, and ones that don't occupy the venue, are not flagged", async () => {
        const [e3, e4, e5] = otherEventIds;
        const before = await booking(requestEventId, at(9, 1), at(9, 3));
        const after = await booking(blockingEventId, at(9, 7), at(9, 9));
        const rejected = await booking(e3, at(9, 4), at(9, 5), {
          status: "REJECTED",
          decisionReason: "Room too small.",
        });
        const cancelled = await booking(e4, at(9, 4), at(9, 5), {
          status: "CANCELLED",
        });
        // A hold whose expiry has passed, not yet marked Expired.
        const lapsed = await booking(e5, at(9, 5), at(9, 6), {
          status: "HELD",
          heldAt: new Date(Date.now() - 2 * DAY_MS),
          holdExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
          holdNote: "Confirm the catering numbers.",
        });

        const result = await record(at(9, 3), at(9, 7));

        expect(result).toMatchObject({
          ok: true,
          data: { recorded: true, created: true, flagged: 0 },
        });
        for (const b of [before, after, rejected, cancelled, lapsed]) {
          expect((await flagOf(b.id)).needsReconsideration).toBe(false);
        }
      });

      it("SCRUM-161 [AC3] TC-161-05: a booking whose setup time reaches into the period is affected", async () => {
        await prisma.venue.update({
          where: { id: venueId },
          data: { setupMinutes: 30 },
        });
        // Starts as the period ends, but would occupy the venue 30 minutes before.
        const pending = await booking(requestEventId, at(10, 5), at(10, 7), {
          status: "PENDING",
          decidedById: null,
          decidedAt: null,
        });

        const result = await record(at(10, 3), at(10, 5));

        expect(result).toMatchObject({
          ok: true,
          data: { recorded: false, affected: [{ bookingId: pending.id }] },
        });
      });

      it("SCRUM-161 [AC4] TC-161-06: each affected event's Coordinator, and every Venue Staff member, is notified once", async () => {
        const [e3] = otherEventIds;
        await prisma.event.update({
          where: { id: e3 },
          data: { coordinatorId: "usr_coordinator_2" },
        });
        const approved = await booking(blockingEventId, at(11, 1), at(11, 3));
        const pending = await booking(e3, at(11, 3), at(11, 5), {
          status: "PENDING",
          decidedById: null,
          decidedAt: null,
        });

        const staffBefore = await venueStaffIds();
        await recordConfirmed(at(11, 2), at(11, 4), "RENOVATION");

        const period =
          "Renovation from 11 May 2034, 10:00 am SGT to 11 May 2034, 12:00 pm SGT";
        const toCoordinators = (
          await notificationsFor([blockingEventId, e3])
        ).filter((n) => n.title === "Alternative venue arrangements required");
        expect(
          toCoordinators.map((n) => [n.userId, n.bookingId, n.message]),
        ).toEqual([
          [
            "usr_coordinator",
            approved.id,
            expect.stringContaining(
              `${venueName} is unavailable (${period}), which overlaps your approved booking there. Alternative arrangements are required`,
            ),
          ],
          [
            "usr_coordinator_2",
            pending.id,
            expect.stringContaining(
              `${venueName} is unavailable (${period}), which overlaps your pending booking there. Alternative arrangements are required`,
            ),
          ],
        ]);

        await expectVenueStaffToldOnce([blockingEventId, e3], staffBefore);
      });

      it("SCRUM-161 [AC2] TC-161-07: a booking that became affected since is shown before anything is saved", async () => {
        const approved = await approvedBooking(at(12, 1), at(12, 3));
        const shown = await record(at(12, 2), at(12, 6));
        expect(shown).toMatchObject({
          ok: true,
          data: { recorded: false, affected: [{ bookingId: approved.id }] },
        });
        const newer = await booking(otherEventIds[0], at(12, 4), at(12, 5), {
          status: "PENDING",
          decidedById: null,
          decidedAt: null,
        });

        const result = await record(at(12, 2), at(12, 6), "MAINTENANCE", [
          approved.id,
        ]);

        expect(result).toMatchObject({
          ok: true,
          data: {
            recorded: false,
            affected: [{ bookingId: approved.id }, { bookingId: newer.id }],
          },
        });
        expect(await unavailabilityCount()).toBe(0);
        expect((await flagOf(approved.id)).needsReconsideration).toBe(false);
        expect((await flagOf(newer.id)).needsReconsideration).toBe(false);
      });

      it("SCRUM-161 [AC6] TC-161-13: recording the same unavailability twice saves it once and flags nothing new", async () => {
        const approved = await approvedBooking(at(14, 1), at(14, 3));
        const first = await recordConfirmed(at(14, 2), at(14, 6));
        const flaggedAt = (await flagOf(approved.id)).reconsiderationFlaggedAt;
        const notices = (await notificationsFor(allEventIds())).length;

        const again = await recordConfirmed(at(14, 2), at(14, 6));

        expect(first).toMatchObject({
          ok: true,
          data: { created: true, flagged: 1 },
        });
        expect(again).toEqual({
          ok: true,
          data: {
            recorded: true,
            id: first.ok && first.data.recorded ? first.data.id : "",
            created: false,
            flagged: 0,
          },
        });
        expect(await unavailabilityCount()).toBe(1);
        expect((await flagOf(approved.id)).reconsiderationFlaggedAt).toEqual(
          flaggedAt,
        );
        expect((await notificationsFor(allEventIds())).length).toBe(notices);
        expect(
          await prisma.auditLog.count({
            where: { entityId: approved.id, action: "RECONSIDERATION_FLAGGED" },
          }),
        ).toBe(1);
      });

      it("SCRUM-161 [AC3, AC4] TC-161-15: a booking already flagged keeps its first reason, and its Coordinator is still told", async () => {
        const flaggedAt = new Date("2026-10-01T00:00:00.000Z");
        const approved = await booking(blockingEventId, at(15, 1), at(15, 3), {
          needsReconsideration: true,
          reconsiderationFlaggedAt: flaggedAt,
          reconsiderationReason: "Event date changed",
        });

        const result = await recordConfirmed(at(15, 2), at(15, 6));

        expect(result).toMatchObject({
          ok: true,
          data: { created: true, flagged: 0 },
        });
        expect(await flagOf(approved.id)).toMatchObject({
          needsReconsideration: true,
          reconsiderationReason: "Event date changed",
          reconsiderationFlaggedAt: flaggedAt,
        });
        expect(
          (await notificationsFor([blockingEventId])).map((n) => [
            n.userId,
            n.title,
          ]),
        ).toEqual([
          ["usr_coordinator", "Alternative venue arrangements required"],
        ]);
        expect(
          await prisma.auditLog.count({
            where: { entityId: approved.id, action: "RECONSIDERATION_FLAGGED" },
          }),
        ).toBe(0);
      });
    });

    describe("the database's own guarantee (ADR 0010)", () => {
      it("SCRUM-172 [AC9] TC-172-11: the database accepts unavailability written over an approved booking", async () => {
        await approvedBooking(at(10, 1), at(10, 5));

        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO "VenueUnavailability" ("id", "venueId", "startAt", "endAt", "recordedById", "updatedAt")
          VALUES (${`vun_raw_${Date.now()}`}, ${venueId}, ${new Date(at(10, 4))}, ${new Date(at(10, 8))}, 'usr_venuestaff', now())
        `);

        expect(await unavailabilityCount()).toBe(1);
        expect(
          await prisma.booking.count({
            where: { venueId, status: "APPROVED" },
          }),
        ).toBe(1);
      });

      it("SCRUM-37 [AC2] TC-37-04: the database alone refuses approving a booking over recorded maintenance", async () => {
        await record(at(11, 3), at(11, 9));
        const pending = await prisma.booking.create({
          data: {
            eventId: requestEventId,
            venueId,
            startAt: new Date(at(11, 1)),
            endAt: new Date(at(11, 4)),
            requestedById: "usr_coordinator",
          },
        });

        await expect(
          prisma.$executeRaw(Prisma.sql`
            UPDATE "Booking" SET "status" = 'APPROVED' WHERE "id" = ${pending.id}
          `),
        ).rejects.toThrow(/booking_overlaps_unavailability/);
      });

      it("SCRUM-37 [AC5] TC-37-07: the database accepts periods that only touch at an endpoint", async () => {
        await record(at(12, 1), at(12, 5));

        await expect(
          approvedBooking(at(12, 5), at(12, 9)),
        ).resolves.toBeDefined();
      });

      it("a pending request over recorded maintenance is still allowed to exist — only approval is refused", async () => {
        await record(at(13, 1), at(13, 9));

        await expect(
          prisma.booking.create({
            data: {
              eventId: requestEventId,
              venueId,
              startAt: new Date(at(13, 2)),
              endAt: new Date(at(13, 4)),
              requestedById: "usr_coordinator",
            },
          }),
        ).resolves.toBeDefined();
      });
    });
  },
);
