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
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { eventBookingPeriod } from "@/lib/schemas/booking";
import { createPlanningEvents, removeEvents } from "./test-events";
import { recordUnavailability } from "@/app/(app)/venues/availability/actions";
import {
  decideBookingRequest,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";

// SCRUM-37 against a real, seeded Postgres: recording unavailability, what it
// does to requests and approvals, and the database's occupancy triggers
// (ADR 0010). Only the session is mocked. The simultaneous approval-vs-
// maintenance race lives in concurrency.test.ts.
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

describe.skipIf(!usesLocalDatabase)(
  "recorded venue unavailability — real database (SCRUM-37)",
  () => {
    let venueId: string;
    // The event requests are made for, and one whose approved booking is
    // collided with: since SCRUM-50 AC8 each holds at most one live booking.
    let requestEventId: string;
    let blockingEventId: string;
    // SCRUM-50 AC1: a request is always for its event's period and
    // attendance, so maintenance that should meet it is placed around those.
    let event: { startAt: Date; endAt: Date; attendance: number };
    const hoursFrom = (instant: Date, hours: number) =>
      new Date(instant.getTime() + hours * 60 * 60 * 1000).toISOString();

    const record = (start: string, end: string, reason = "MAINTENANCE") =>
      recordUnavailability({ venueId, startAt: start, endAt: end, reason });

    /** A request for the suite's event, which covers its own period. */
    const request = () =>
      submitBookingRequest({
        eventId: requestEventId,
        venueId,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt.toISOString(),
        requestedAttendance: event.attendance,
      });

    /** An approved booking to collide with, written directly. */
    const approvedBooking = (start: string, end: string) =>
      prisma.booking.create({
        data: {
          eventId: blockingEventId,
          venueId,
          startAt: new Date(start),
          endAt: new Date(end),
          status: "APPROVED",
          requestedById: "usr_coordinator",
          decidedById: "usr_venuestaff",
          decidedAt: new Date(),
        },
      });

    const unavailabilityCount = () =>
      prisma.venueUnavailability.count({ where: { venueId } });

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
      await prisma.booking.deleteMany({ where: { venueId } });
      await prisma.venueUnavailability.deleteMany({ where: { venueId } });
    }

    beforeAll(async () => {
      const row = {
        startAt: new Date(at(20, 2)),
        endAt: new Date(at(20, 6)),
        expectedAttendance: 40,
      };
      [requestEventId, blockingEventId] = await createPlanningEvents(
        "Unavailability test event",
        [row, row],
      );
      event = {
        ...eventBookingPeriod(row)!,
        attendance: row.expectedAttendance,
      };

      const venue = await prisma.venue.create({
        data: {
          name: `Unavailability test venue ${Date.now()}`,
          location: "Test block",
          capacity: 500,
        },
      });
      venueId = venue.id;
    });

    beforeEach(async () => {
      mockAuth.mockResolvedValue(VENUE_STAFF);
      await clear();
    });

    afterAll(async () => {
      await clear();
      await removeEvents([requestEventId, blockingEventId]);
      await prisma.venue.delete({ where: { id: venueId } });
    });

    it("SCRUM-37 AC2 — venue staff record a period and a reason, and it is saved", async () => {
      const result = await recordUnavailability({
        venueId,
        startAt: at(3, 1),
        endAt: at(3, 9),
        reason: "SAFETY_CONCERN",
        note: "  Fire exit blocked.  ",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
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

    it("SCRUM-37 AC2 — an end at or before the start is refused as an invalid period", async () => {
      const result = await record(at(3, 9), at(3, 9));

      expect(result).toMatchObject({
        ok: false,
        error:
          "The requested period is invalid: the end must be after the start.",
      });
      expect(await unavailabilityCount()).toBe(0);
    });

    it("SCRUM-37 AC3 — a request over recorded maintenance is refused, with the same message shape as a booking clash", async () => {
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

    it("SCRUM-37 AC3 — a pending request over recorded maintenance cannot then be approved", async () => {
      const pending = await prisma.booking.create({
        data: {
          eventId: requestEventId,
          venueId,
          startAt: new Date(at(5, 1)),
          endAt: new Date(at(5, 5)),
          requestedById: "usr_coordinator",
        },
      });
      await record(at(5, 3), at(5, 9));

      const result = await decideBookingRequest({
        bookingId: pending.id,
        decision: "APPROVED",
      });

      expect(result).toMatchObject({
        ok: false,
        error: expect.stringMatching(
          /^Conflicting: .*unavailable \(maintenance\)/,
        ),
      });
    });

    it("SCRUM-37 AC4 — recording over an approved booking surfaces the clash and saves nothing", async () => {
      await approvedBooking(at(6, 1), at(6, 5));

      const result = await record(at(6, 3), at(6, 9));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(
        /^Not recorded: .* is already booked from .+ to .+\.$/,
      );
      expect(await unavailabilityCount()).toBe(0);
    });

    it("SCRUM-37 AC4 — recording over a period already recorded is refused too", async () => {
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

    it("SCRUM-37 AC5 — maintenance ending exactly as a request begins does not clash", async () => {
      await record(hoursFrom(event.startAt, -4), event.startAt.toISOString());
      mockAuth.mockResolvedValue(COORDINATOR);

      const result = await request();

      expect(result.ok && result.data.created).toBe(true);
    });

    it("SCRUM-37 AC5 — maintenance starting exactly as a booking ends is recorded", async () => {
      await approvedBooking(at(9, 1), at(9, 5));

      const result = await record(at(9, 5), at(9, 9));

      expect(result.ok).toBe(true);
    });

    describe("the database's own guarantee (ADR 0010)", () => {
      // Until SCRUM-172 the database refused this too. It now accepts it, so
      // SCRUM-161 can save unavailability over bookings and flag them; the
      // refusal above is the action's alone, made under the venue lock.
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

      it("SCRUM-37 AC3 — the database alone refuses approving a booking over recorded maintenance", async () => {
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

      it("SCRUM-37 AC5 — the database accepts periods that only touch at an endpoint", async () => {
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
