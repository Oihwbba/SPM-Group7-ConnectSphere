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
import { can } from "@/lib/auth/can";
import { eventBookingPeriod } from "@/lib/schemas/booking";
import { createPlanningEvents, removeEvents } from "./test-events";
import {
  checkVenueAvailability,
  decideBookingRequest,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";
import {
  getBookableEvents,
  getPendingBookingQueue,
  getRequestableVenues,
} from "@/app/(app)/bookings/queries";

// SCRUM-50 / SCRUM-53 against a real, seeded Postgres. The session is the only
// thing mocked, so "not created" and "the first decision stands" are proven by
// reading the rows back — not by a mock's memory. The simultaneous-approval
// case lives in concurrency.test.ts.
//
// These WRITE (a throwaway venue and its bookings, removed afterwards), so they
// only run against a localhost database — CI's service container, or the
// Docker DB — never against the shared Supabase database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

function sessionFor(id: string, role: "COORDINATOR" | "VENUE_STAFF"): Session {
  return {
    user: { id, role, name: id, email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}
const COORDINATOR = sessionFor("usr_coordinator", "COORDINATOR");
const VENUE_STAFF = sessionFor("usr_venuestaff", "VENUE_STAFF");

// Seeded events assigned to usr_coordinator (prisma/seed.ts). They already
// hold a venue booking each, so requests are made for this suite's own events.
const APPROVED_EVENT = "evt_approved";
const PLANNING_EVENT = "evt_planning";

const HOUR_MS = 60 * 60 * 1000;

describe.skipIf(!usesLocalDatabase)(
  "venue booking flow — real database",
  () => {
    let venueId: string;
    let otherVenueId: string;
    // The event requests are made for; one whose approved booking is
    // collided with; and one another coordinator has a pending request for.
    let eventId: string;
    let blockingEventId: string;
    let rivalEventId: string;
    // SCRUM-50 AC1: a request is for the event's own period and attendance,
    // so every other instant here is placed around the event's.
    let period: { startAt: Date; endAt: Date };
    let attendance: number;
    /** `hours` after the start of the event's period (negative: before). */
    const fromStart = (hours: number) =>
      new Date(period.startAt.getTime() + hours * HOUR_MS).toISOString();
    /** `hours` after the end of the event's period (negative: before). */
    const fromEnd = (hours: number) =>
      new Date(period.endAt.getTime() + hours * HOUR_MS).toISOString();

    const request = (overrides: Record<string, unknown> = {}) => ({
      eventId,
      venueId,
      startAt: fromStart(0),
      endAt: fromEnd(0),
      requestedAttendance: attendance,
      requiredFacilities: ["projector"],
      requestedLayout: "classroom",
      ...overrides,
    });

    /** An existing APPROVED booking to collide with, written directly. */
    async function approvedBooking(startAt: string, endAt: string) {
      return prisma.booking.create({
        data: {
          eventId: blockingEventId,
          venueId,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          status: "APPROVED",
          requestedById: "usr_coordinator",
          decidedById: "usr_venuestaff",
          decidedAt: new Date(),
        },
      });
    }

    const bookingCount = () => prisma.booking.count({ where: { venueId } });

    /** A PENDING request from the second seeded coordinator, written directly. */
    async function pendingFromAnotherCoordinator(start: string, end: string) {
      return prisma.booking.create({
        data: {
          eventId: rivalEventId,
          venueId,
          startAt: new Date(start),
          endAt: new Date(end),
          requestedById: "usr_coordinator_2",
        },
      });
    }

    beforeAll(async () => {
      // A far-future day, so nothing seeded is anywhere near.
      const event = {
        startAt: new Date("2032-01-10T06:00:00.000Z"),
        endAt: new Date("2032-01-10T08:00:00.000Z"),
        expectedAttendance: 40,
      };
      [eventId, blockingEventId, rivalEventId] = await createPlanningEvents(
        "Booking test event",
        [event, event, event],
      );
      period = eventBookingPeriod(event)!;
      attendance = event.expectedAttendance;

      const venue = await prisma.venue.create({
        data: {
          name: `Booking test venue ${Date.now()}`,
          location: "Test block",
          capacity: 500,
          facilities: ["projector"],
          supportedLayouts: ["classroom"],
        },
      });
      venueId = venue.id;
      const otherVenue = await prisma.venue.create({
        data: {
          name: `Booking test venue (other) ${Date.now()}`,
          location: "Test block",
          capacity: 500,
        },
      });
      otherVenueId = otherVenue.id;
    });

    async function clearBookings() {
      const where = { venueId: { in: [venueId, otherVenueId] } };
      const ids = await prisma.booking.findMany({
        where,
        select: { id: true },
      });
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "Booking",
          entityId: { in: ids.map((b) => b.id) },
        },
      });
      await prisma.booking.deleteMany({ where });
    }

    beforeEach(async () => {
      mockAuth.mockResolvedValue(COORDINATOR);
      await clearBookings();
      await prisma.venueUnavailability.deleteMany({ where: { venueId } });
    });

    afterAll(async () => {
      await clearBookings();
      await removeEvents([eventId, blockingEventId, rivalEventId]);
      await prisma.venue.deleteMany({
        where: { id: { in: [venueId, otherVenueId] } },
      });
    });

    describe("SCRUM-50 — submit a venue booking request", () => {
      it("SCRUM-50 [AC1, AC2] TC-50-01: a request for a free period is created PENDING with everything the staff need", async () => {
        const result = await submitBookingRequest(
          request({ requestNotes: "Needs a lectern." }),
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.created).toBe(true);
        expect(result.data.booking.status).toBe("PENDING");

        const row = await prisma.booking.findUniqueOrThrow({
          where: { id: result.data.booking.id },
        });
        expect(row).toMatchObject({
          eventId,
          venueId,
          startAt: new Date(fromStart(0)),
          endAt: new Date(fromEnd(0)),
          status: "PENDING",
          requestedAttendance: attendance,
          requiredFacilities: ["projector"],
          requestedLayout: "classroom",
          requestNotes: "Needs a lectern.",
          requestedById: "usr_coordinator",
        });
      });

      it("SCRUM-50 [AC3] TC-50-02: a request overlapping an approved booking is refused and nothing is written", async () => {
        await approvedBooking(fromStart(1), fromEnd(1));
        const before = await bookingCount();

        const result = await submitBookingRequest(request());

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/is unavailable for that period/);
        expect(await bookingCount()).toBe(before);
      });

      it("SCRUM-50 [AC3] TC-50-03: a request overlapping recorded unavailability (maintenance) is refused", async () => {
        await prisma.venueUnavailability.create({
          data: {
            venueId,
            startAt: new Date(fromStart(-1)),
            endAt: new Date(fromEnd(4)),
            reason: "MAINTENANCE",
            recordedById: "usr_venuestaff",
          },
        });

        const result = await submitBookingRequest(request());

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/unavailable \(maintenance\)/);
        expect(await bookingCount()).toBe(0);
      });

      it("SCRUM-50 [AC3, AC10] TC-50-04: a PENDING request by another coordinator does not block a new request", async () => {
        await pendingFromAnotherCoordinator(fromStart(0), fromEnd(0));

        const result = await submitBookingRequest(request());

        expect(result.ok && result.data.created).toBe(true);
        expect(await bookingCount()).toBe(2);
      });

      it("SCRUM-50 [AC4] TC-50-05: a period beginning exactly as an approved booking ends is accepted", async () => {
        await approvedBooking(fromStart(-2), fromStart(0));

        const result = await submitBookingRequest(request());

        expect(result.ok && result.data.created).toBe(true);
      });

      it("SCRUM-50 [AC4] TC-50-05: a period ending exactly as an approved booking begins is accepted", async () => {
        await approvedBooking(fromEnd(0), fromEnd(2));

        const result = await submitBookingRequest(request());

        expect(result.ok && result.data.created).toBe(true);
      });

      it("SCRUM-50 [AC5] TC-50-06: an end before the start is refused as an invalid period", async () => {
        const result = await submitBookingRequest(
          request({ startAt: fromEnd(0), endAt: fromStart(0) }),
        );

        expect(result).toMatchObject({
          ok: false,
          error:
            "The requested period is invalid: the end must be after the start.",
        });
        expect(await bookingCount()).toBe(0);
      });

      it("SCRUM-50 [AC5] TC-50-06: an end equal to the start is refused as an invalid period", async () => {
        const result = await submitBookingRequest(
          request({ startAt: fromStart(0), endAt: fromStart(0) }),
        );

        expect(result).toMatchObject({
          ok: false,
          error:
            "The requested period is invalid: the end must be after the start.",
        });
        expect(await bookingCount()).toBe(0);
      });

      it("SCRUM-50 [AC8] TC-50-07: submitting the same request twice leaves one request and shows the existing one", async () => {
        const first = await submitBookingRequest(request());
        const second = await submitBookingRequest(request());

        expect(first.ok && first.data.created).toBe(true);
        expect(second.ok && second.data.created).toBe(false);
        if (!first.ok || !second.ok) return;
        expect(second.data.booking.id).toBe(first.data.booking.id);
        expect(await bookingCount()).toBe(1);
      });

      it("SCRUM-50 [AC8] TC-50-08, SCRUM-162 [AC6] TC-162-10: two identical requests submitted at the same instant still leave one", async () => {
        const results = await Promise.all([
          submitBookingRequest(request()),
          submitBookingRequest(request()),
        ]);

        expect(results.every((r) => r.ok)).toBe(true);
        const ids = new Set(results.map((r) => r.ok && r.data.booking.id));
        expect(ids.size).toBe(1);
        expect(await bookingCount()).toBe(1);
      });

      it("SCRUM-162 [AC4] TC-162-06: a period that doesn't cover the event's whole period is refused against the start, and nothing is written", async () => {
        for (const changed of [
          { startAt: fromStart(1) },
          { endAt: fromEnd(-1) },
          { startAt: fromEnd(0), endAt: fromEnd(2) },
        ]) {
          const result = await submitBookingRequest(request(changed));
          expect(result).toMatchObject({
            ok: false,
            error: expect.stringMatching(/must cover the event's whole period/),
            fieldErrors: { startAt: [expect.any(String)] },
          });
        }
        expect(await bookingCount()).toBe(0);
      });

      it("SCRUM-162 [AC4] TC-162-05: a longer period that still covers the whole event is accepted", async () => {
        const result = await submitBookingRequest(
          request({ startAt: fromStart(-1), endAt: fromEnd(1) }),
        );

        expect(result.ok && result.data.created).toBe(true);
        expect(
          await prisma.booking.findFirstOrThrow({ where: { venueId } }),
        ).toMatchObject({
          startAt: new Date(fromStart(-1)),
          endAt: new Date(fromEnd(1)),
        });
      });

      it("SCRUM-162 [AC4] TC-162-07: attendance above the event's is refused; 1, part of the event, is accepted and recorded", async () => {
        const over = await submitBookingRequest(
          request({ requestedAttendance: attendance + 1 }),
        );
        expect(over).toMatchObject({
          ok: false,
          error: `The expected attendance for this venue must be from 1 to the event's ${attendance}.`,
        });
        expect(await bookingCount()).toBe(0);

        const one = await submitBookingRequest(
          request({ requestedAttendance: 1 }),
        );
        expect(one.ok && one.data.created).toBe(true);
        expect(
          await prisma.booking.findFirstOrThrow({ where: { venueId } }),
        ).toMatchObject({ requestedAttendance: 1 });
      });

      for (const status of ["PENDING", "APPROVED"] as const) {
        it(`SCRUM-162 [AC1] TC-162-01: an event with a ${status.toLowerCase()} booking at another venue gets a new request for this one, linked to the same event`, async () => {
          await prisma.booking.create({
            data: {
              eventId,
              venueId: otherVenueId,
              startAt: period.startAt,
              endAt: period.endAt,
              status,
              requestedById: "usr_coordinator",
            },
          });

          const result = await submitBookingRequest(request());

          expect(result.ok && result.data.created).toBe(true);
          expect(
            await prisma.booking.findMany({
              where: { eventId },
              select: { venueId: true },
              orderBy: { createdAt: "asc" },
            }),
          ).toEqual([{ venueId: otherVenueId }, { venueId }]);
        });
      }

      const holdUntil = () => new Date(Date.now() + 24 * HOUR_MS);
      const liveAtVenue = {
        PENDING: {},
        APPROVED: {},
        HELD: { heldAt: new Date(), holdExpiresAt: holdUntil(), holdNote: "Confirm the layout." },
      } as const;
      for (const status of ["PENDING", "HELD", "APPROVED"] as const) {
        it(`SCRUM-162 [AC2] TC-162-02: an event with a ${status.toLowerCase()} booking at this venue is shown it, and no request is created`, async () => {
          const existing = await prisma.booking.create({
            data: {
              eventId,
              venueId,
              startAt: period.startAt,
              endAt: period.endAt,
              status,
              requestedById: "usr_coordinator",
              ...liveAtVenue[status],
            },
          });

          const again = await submitBookingRequest(request());

          expect(again.ok && again.data.created).toBe(false);
          if (!again.ok) return;
          expect(again.data.booking).toMatchObject({ id: existing.id, status });
          expect(await bookingCount()).toBe(1);
        });
      }

      const endedAtVenue = {
        REJECTED: { decisionReason: "Room closed that week.", decidedById: "usr_venuestaff", decidedAt: new Date() },
        CANCELLED: {},
        EXPIRED: {
          heldAt: new Date(Date.now() - 2 * HOUR_MS),
          holdExpiresAt: new Date(Date.now() - HOUR_MS),
          holdNote: "Confirm the layout.",
        },
      } as const;
      for (const status of ["REJECTED", "CANCELLED", "EXPIRED"] as const) {
        it(`SCRUM-162 [AC2] TC-162-03: a ${status.toLowerCase()} booking at this venue doesn't stop a new request, and is kept`, async () => {
          await prisma.booking.create({
            data: {
              eventId,
              venueId,
              startAt: period.startAt,
              endAt: period.endAt,
              status,
              requestedById: "usr_coordinator",
              ...endedAtVenue[status],
            },
          });

          const result = await submitBookingRequest(request());

          expect(result.ok && result.data.created).toBe(true);
          expect(await bookingCount()).toBe(2);
        });
      }

      // Until SCRUM-172 the database held an event to one live booking at any
      // venue. It now holds it to one per venue (SCRUM-162 AC2), so an event
      // can book several venues (SCRUM-162 AC1).
      it("SCRUM-172 [AC9] TC-172-12: the database refuses a second pending, held or approved booking for one event at the same venue, but not at another", async () => {
        const row = (
          venue: string,
          status: "PENDING" | "HELD" | "APPROVED",
          startHours = 24,
        ) => ({
          data: {
            eventId,
            venueId: venue,
            startAt: new Date(fromEnd(startHours)),
            endAt: new Date(fromEnd(startHours + 2)),
            status,
            requestedById: "usr_coordinator",
            ...(status === "HELD" && {
              heldAt: new Date(),
              holdExpiresAt: new Date(fromEnd(startHours - 1)),
              holdNote: "Confirm the catering numbers.",
            }),
          },
        });
        await prisma.booking.create(row(venueId, "PENDING"));

        for (const status of ["PENDING", "HELD", "APPROVED"] as const) {
          await expect(
            prisma.booking.create(row(venueId, status, 30)),
          ).rejects.toThrow(/booking_one_per_venue_per_event/);
        }
        expect(await bookingCount()).toBe(1);

        await expect(
          prisma.booking.create(row(otherVenueId, "PENDING")),
        ).resolves.toBeDefined();
      });

      it("SCRUM-50 [AC3, AC10] TC-50-04: another event's pending request for the same venue and period blocks nobody", async () => {
        await prisma.booking.create({
          data: {
            eventId: rivalEventId,
            venueId,
            startAt: period.startAt,
            endAt: period.endAt,
            requestedById: "usr_coordinator",
          },
        });

        const result = await submitBookingRequest(request());

        expect(result.ok && result.data.created).toBe(true);
      });

      it("SCRUM-50 TC-50-10: attendance over the venue's capacity is refused and nothing is written; exactly at capacity is accepted", async () => {
        const setCapacity = (capacity: number) =>
          prisma.venue.update({ where: { id: venueId }, data: { capacity } });
        try {
          await setCapacity(attendance - 1);
          const over = await submitBookingRequest(request());
          expect(over).toMatchObject({
            ok: false,
            fieldErrors: {
              requestedAttendance: [
                expect.stringMatching(
                  `holds up to ${attendance - 1} people; ${attendance} expected`,
                ),
              ],
            },
          });
          expect(await bookingCount()).toBe(0);

          await setCapacity(attendance);
          const atCapacity = await submitBookingRequest(request());
          expect(atCapacity.ok && atCapacity.data.created).toBe(true);
        } finally {
          await setCapacity(500);
        }
      });

      it("SCRUM-50 [AC5] TC-50-11: a period that has already started is refused and nothing is written", async () => {
        const result = await submitBookingRequest(
          request({
            startAt: "2020-01-01T01:00:00.000Z",
            endAt: "2020-01-01T03:00:00.000Z",
          }),
        );

        expect(result).toMatchObject({
          ok: false,
          error: "The start time cannot be in the past.",
        });
        expect(await bookingCount()).toBe(0);
      });

      it("SCRUM-50 TC-50-09: the form offers only approved events the coordinator may act on, exactly as can() allows", async () => {
        const offered = await getBookableEvents("usr_coordinator");
        const ids = offered.map((e) => e.id);

        expect(ids).toEqual(
          expect.arrayContaining([APPROVED_EVENT, PLANNING_EVENT]),
        );
        const rows = await prisma.event.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            organiserId: true,
            coordinatorId: true,
            status: true,
          },
        });
        for (const row of rows) {
          expect(
            can(COORDINATOR.user, "booking:request", { kind: "event", ...row }),
          ).toBe(true);
          expect(["APPROVED", "PLANNING"]).toContain(row.status);
        }

        // Another coordinator is never offered usr_coordinator's events.
        const theirs = await getBookableEvents("usr_coordinator_2");
        expect(theirs.map((e) => e.id)).not.toContain(APPROVED_EVENT);
      });
    });

    describe("SCRUM-50 — venues offered on the request form", () => {
      it("SCRUM-50: a retired venue is never offered, and is refused if requested directly", async () => {
        const retired = await prisma.venue.create({
          data: {
            name: `Retired test venue ${Date.now()}`,
            location: "Test block",
            capacity: 30,
            isActive: false,
          },
        });
        try {
          const offered = await getRequestableVenues();
          expect(offered.map((v) => v.id)).toContain(venueId);
          expect(offered.map((v) => v.id)).not.toContain(retired.id);

          const result = await submitBookingRequest(
            request({ venueId: retired.id }),
          );
          expect(result).toEqual({ ok: false, error: "Venue not found." });
        } finally {
          await prisma.venue.delete({ where: { id: retired.id } });
        }
      });
    });

    describe("SCRUM-50 [AC3, AC4, AC5] TC-50-13: the live availability check in the form", () => {
      const check = (startAt: string, endAt: string) =>
        checkVenueAvailability({ venueId, startAt, endAt });

      it("SCRUM-50 [AC3] TC-50-13: the form is told an approved booking or recorded unavailability makes the venue unavailable, and the submission agrees", async () => {
        await approvedBooking(fromStart(1), fromEnd(1));
        await prisma.venueUnavailability.create({
          data: {
            venueId,
            startAt: new Date(fromStart(-2)),
            endAt: new Date(fromStart(0)),
            reason: "MAINTENANCE",
            recordedById: "usr_venuestaff",
          },
        });

        const live = await check(fromStart(-1), fromEnd(0));
        expect(live.ok && live.data.available).toBe(false);
        expect(live.ok && live.data.clashes).toHaveLength(2);

        const submitted = await submitBookingRequest(
          request({ startAt: fromStart(-1), endAt: fromEnd(0) }),
        );
        expect(submitted.ok).toBe(false);
      });

      it("SCRUM-50 [AC4] TC-50-13: periods touching a booking at either end are reported available", async () => {
        await approvedBooking(fromStart(1), fromEnd(1));

        for (const [start, end] of [
          [fromStart(-1), fromStart(1)],
          [fromEnd(1), fromEnd(3)],
        ]) {
          expect(await check(start, end)).toEqual({
            ok: true,
            data: { available: true, clashes: [] },
          });
        }
      });

      it("SCRUM-50 [AC3] TC-50-13: a pending request blocks nobody, so the venue still reads available", async () => {
        await pendingFromAnotherCoordinator(fromStart(0), fromEnd(0));

        expect(await check(fromStart(0), fromEnd(0))).toEqual({
          ok: true,
          data: { available: true, clashes: [] },
        });
      });

      it("SCRUM-50 [AC5] TC-50-11: a period that has already started is not called available, and submitting it is refused the same way", async () => {
        const live = await check(
          "2020-01-01T01:00:00.000Z",
          "2020-01-01T03:00:00.000Z",
        );
        expect(live).toMatchObject({
          ok: false,
          error: "The start time cannot be in the past.",
        });

        const submitted = await submitBookingRequest(
          request({
            startAt: "2020-01-01T01:00:00.000Z",
            endAt: "2020-01-01T03:00:00.000Z",
          }),
        );
        expect(submitted).toMatchObject({
          ok: false,
          error: live.ok ? "" : live.error,
        });
      });

      it("SCRUM-50 TC-50-13: the check writes nothing", async () => {
        const before = await bookingCount();
        await check(fromStart(0), fromEnd(0));
        expect(await bookingCount()).toBe(before);
      });

      it("SCRUM-50 TC-50-13: a retired venue reads as not found, as it does on submit", async () => {
        await prisma.venue.update({
          where: { id: venueId },
          data: { isActive: false },
        });
        try {
          expect(await check(fromStart(0), fromEnd(0))).toEqual({
            ok: false,
            error: "Venue not found.",
          });
        } finally {
          await prisma.venue.update({
            where: { id: venueId },
            data: { isActive: true },
          });
        }
      });
    });

    describe("SCRUM-50 AC9 — asking again after a rejection or cancellation", () => {
      for (const status of ["REJECTED", "CANCELLED"] as const) {
        it(`SCRUM-50 [AC9] TC-50-14: after a ${status.toLowerCase()} request, a new request creates a new booking record and the earlier one is kept`, async () => {
          const earlier = await prisma.booking.create({
            data: {
              eventId,
              venueId,
              startAt: new Date(fromStart(0)),
              endAt: new Date(fromEnd(0)),
              status,
              requestedById: "usr_coordinator",
              ...(status === "REJECTED" && {
                decidedById: "usr_venuestaff",
                decidedAt: new Date(),
                decisionReason: "The hall is closed that week.",
              }),
            },
          });

          const again = await submitBookingRequest(request());

          expect(again.ok && again.data.created).toBe(true);
          if (!again.ok) return;
          expect(again.data.booking.id).not.toBe(earlier.id);
          expect(again.data.booking.status).toBe("PENDING");
          expect(
            await prisma.booking.findUniqueOrThrow({
              where: { id: earlier.id },
              select: { status: true },
            }),
          ).toEqual({ status });
          expect(await bookingCount()).toBe(2);
        });
      }
    });

    describe("SCRUM-52 — review pending booking requests", () => {
      it("SCRUM-52 [AC1, AC2] TC-52-01: the queue lists pending requests with venue, timing, attendance, needs and the requesting coordinator", async () => {
        const submitted = await submitBookingRequest(
          request({ requestNotes: "Stage access from 8am." }),
        );
        if (!submitted.ok) throw new Error(submitted.error);

        const queue = await getPendingBookingQueue();
        const row = queue.find((b) => b.id === submitted.data.booking.id);

        expect(row).toMatchObject({
          startAt: new Date(fromStart(0)),
          endAt: new Date(fromEnd(0)),
          requestedAttendance: attendance,
          requiredFacilities: ["projector"],
          requestedLayout: "classroom",
          requestNotes: "Stage access from 8am.",
          event: { name: expect.any(String) },
          requestedBy: {
            name: expect.any(String),
            email: "coordinator@test.local",
          },
          venue: {
            id: venueId,
            capacity: 500,
            facilities: ["projector"],
            supportedLayouts: ["classroom"],
          },
          blockers: [],
        });
      });

      it("SCRUM-52 [AC1] TC-52-03: decided requests leave the queue", async () => {
        const approved = await approvedBooking(fromEnd(46), fromEnd(48));

        const queue = await getPendingBookingQueue();

        expect(queue.map((b) => b.id)).not.toContain(approved.id);
      });

      it("SCRUM-52 [AC3] TC-52-02: each request carries the venue's current availability for its period", async () => {
        const submitted = await submitBookingRequest(request());
        if (!submitted.ok) throw new Error(submitted.error);
        // Another request for the slot is approved after this one was made.
        const clash = await approvedBooking(fromStart(1), fromEnd(1));

        const queue = await getPendingBookingQueue();
        const row = queue.find((b) => b.id === submitted.data.booking.id);

        expect(row?.blockers).toEqual([
          expect.objectContaining({ kind: "booking", id: clash.id }),
        ]);
      });
    });

    describe("SCRUM-53 — approve or reject a booking request", () => {
      async function pending(overrides: Record<string, unknown> = {}) {
        mockAuth.mockResolvedValue(COORDINATOR);
        const result = await submitBookingRequest(request(overrides));
        if (!result.ok) throw new Error(result.error);
        mockAuth.mockResolvedValue(VENUE_STAFF);
        return result.data.booking.id;
      }

      it("SCRUM-162 [AC3, AC5] TC-162-08: Venue Staff decide each of an event's requests separately; rejecting one leaves the other unchanged", async () => {
        const kept = await pending({ venueId: otherVenueId });
        const rejected = await pending();

        const result = await decideBookingRequest({
          bookingId: rejected,
          decision: "REJECTED",
          reason: "Too small for the breakout.",
        });

        expect(result).toEqual({ ok: true, data: { status: "REJECTED" } });
        expect(
          await prisma.booking.findUniqueOrThrow({
            where: { id: kept },
            select: { status: true, decidedAt: true },
          }),
        ).toEqual({ status: "PENDING", decidedAt: null });
      });

      it("SCRUM-53 [AC1, AC2] TC-53-02: rejecting with a reason saves the rejection, the reason, and an audit entry", async () => {
        const id = await pending();

        const result = await decideBookingRequest({
          bookingId: id,
          decision: "REJECTED",
          reason: "  Room is being refitted that week.  ",
        });

        expect(result).toEqual({ ok: true, data: { status: "REJECTED" } });
        const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
        expect(row).toMatchObject({
          status: "REJECTED",
          decisionReason: "Room is being refitted that week.",
          decidedById: "usr_venuestaff",
        });
        expect(row.decidedAt).toBeInstanceOf(Date);
        expect(
          await prisma.auditLog.count({
            where: { entityType: "Booking", entityId: id, action: "REJECTED" },
          }),
        ).toBe(1);
      });

      it("SCRUM-53 [AC2] TC-53-03: rejecting with a blank reason is refused and the request stays pending", async () => {
        const id = await pending();

        for (const reason of [undefined, "", "   "]) {
          const result = await decideBookingRequest({
            bookingId: id,
            decision: "REJECTED",
            reason,
          });
          expect(result).toMatchObject({
            ok: false,
            error: "A reason is required to reject a booking request.",
          });
        }

        const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
        expect(row.status).toBe("PENDING");
        expect(row.decisionReason).toBeNull();
      });

      it("SCRUM-53 [AC2] TC-53-03: the database itself refuses a rejection without a reason", async () => {
        const id = await pending();

        await expect(
          prisma.booking.update({
            where: { id },
            data: { status: "REJECTED", decisionReason: " " },
          }),
        ).rejects.toThrow(/booking_rejection_has_reason/);
      });

      it("SCRUM-53 [AC1, AC4] TC-53-01: approving makes the venue unavailable: a later overlapping request is refused", async () => {
        const id = await pending();

        const result = await decideBookingRequest({
          bookingId: id,
          decision: "APPROVED",
        });
        expect(result).toEqual({ ok: true, data: { status: "APPROVED" } });

        mockAuth.mockResolvedValue(COORDINATOR);
        const later = await submitBookingRequest(
          request({ eventId: rivalEventId }),
        );
        expect(later.ok).toBe(false);
        if (later.ok) return;
        expect(later.error).toMatch(/already booked/);
      });

      it("SCRUM-53 [AC8] TC-53-04: approving a request that overlaps an already-approved booking is returned as conflicting", async () => {
        const first = await pending();
        // Overlapping pending requests come from different coordinators.
        const { id: second } = await pendingFromAnotherCoordinator(
          fromStart(1),
          fromEnd(1),
        );
        await decideBookingRequest({ bookingId: first, decision: "APPROVED" });

        const result = await decideBookingRequest({
          bookingId: second,
          decision: "APPROVED",
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/^Conflicting:/);
        const row = await prisma.booking.findUniqueOrThrow({
          where: { id: second },
        });
        expect(row.status).toBe("PENDING");
      });

      it("SCRUM-53 [AC8] TC-53-04: approving over recorded unavailability is returned as conflicting", async () => {
        const id = await pending();
        await prisma.venueUnavailability.create({
          data: {
            venueId,
            startAt: new Date(fromStart(1)),
            endAt: new Date(fromEnd(0)),
            reason: "RENOVATION",
            recordedById: "usr_venuestaff",
          },
        });

        const result = await decideBookingRequest({
          bookingId: id,
          decision: "APPROVED",
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(
          /^Conflicting: .* unavailable \(renovation\)/,
        );
      });

      it("SCRUM-53 [AC6] TC-53-06: two requests that touch at an endpoint can both be approved", async () => {
        const morning = await pending();
        const { id: afternoon } = await pendingFromAnotherCoordinator(
          fromEnd(0),
          fromEnd(2),
        );

        const results = [
          await decideBookingRequest({
            bookingId: morning,
            decision: "APPROVED",
          }),
          await decideBookingRequest({
            bookingId: afternoon,
            decision: "APPROVED",
          }),
        ];

        expect(results.every((r) => r.ok)).toBe(true);
        expect(
          await prisma.booking.count({
            where: { venueId, status: "APPROVED" },
          }),
        ).toBe(2);
      });

      it("SCRUM-53 [AC7] TC-53-07: deciding an already-approved request leaves the approval standing and records no second outcome", async () => {
        const id = await pending();
        await decideBookingRequest({ bookingId: id, decision: "APPROVED" });

        const second = await decideBookingRequest({
          bookingId: id,
          decision: "REJECTED",
          reason: "Changed my mind.",
        });

        expect(second).toMatchObject({
          ok: false,
          error:
            "This request has already been approved; the original decision stands.",
        });
        const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
        expect(row).toMatchObject({ status: "APPROVED", decisionReason: null });
        expect(
          await prisma.auditLog.count({
            where: { entityType: "Booking", entityId: id },
          }),
        ).toBe(1);
      });

      it("SCRUM-53 [AC7] TC-53-07: deciding an already-rejected request leaves the rejection standing", async () => {
        const id = await pending();
        await decideBookingRequest({
          bookingId: id,
          decision: "REJECTED",
          reason: "Too small.",
        });

        const second = await decideBookingRequest({
          bookingId: id,
          decision: "APPROVED",
        });

        expect(second).toMatchObject({
          ok: false,
          error:
            "This request has already been rejected; the original decision stands.",
        });
        const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
        expect(row).toMatchObject({
          status: "REJECTED",
          decisionReason: "Too small.",
        });
      });

      it("SCRUM-53 [AC7] TC-53-07: an approve and a reject of the same request at the same instant: exactly one outcome is recorded", async () => {
        const id = await pending();

        const results = await Promise.all([
          decideBookingRequest({ bookingId: id, decision: "APPROVED" }),
          decideBookingRequest({
            bookingId: id,
            decision: "REJECTED",
            reason: "No.",
          }),
        ]);

        expect(results.filter((r) => r.ok)).toHaveLength(1);
        expect(
          await prisma.auditLog.count({
            where: { entityType: "Booking", entityId: id },
          }),
        ).toBe(1);
      });
    });
  },
);
