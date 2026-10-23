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
import { findVenueCalendar } from "@/lib/venue-availability";
import {
  checkVenueAvailability,
  decideBookingRequest,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";
import { recordUnavailability } from "@/app/(app)/venues/availability/actions";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-159 against a real, seeded Postgres: a venue's setup and turnaround
// time count wherever availability is checked, an approval keeps the minutes
// it was approved with, and the database refuses what the application would.
// The simultaneous approvals (AC5) are in concurrency.test.ts.
//
// These WRITE (a throwaway venue, its events and bookings, removed
// afterwards), so they only run against a localhost database — CI's service
// container, or the Docker DB — never against the shared Supabase database.
//
// A request's period is exactly its event's (SCRUM-188), so each request
// here has its own event; the criterion's own 10:00–12:00 / 13:15 example is
// proven exactly in tests/unit/venue-availability.test.ts.
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

/** Singapore wall time on 15 Mar 2032, as a UTC instant. */
const sg = (hhmm: string) => new Date(`2032-03-15T${hhmm}:00+08:00`);

describe.skipIf(!usesLocalDatabase)(
  "setup and turnaround time (SCRUM-159) — real database",
  () => {
    let venueId: string;
    // One event per request: an event holds one live booking per venue.
    const events: Record<string, { id: string; start: string; end: string }> = {
      tenToNoon: { id: "", start: "10:00", end: "12:00" },
      oneToThree: { id: "", start: "13:00", end: "15:00" },
      halfPastTwelve: { id: "", start: "12:30", end: "14:30" },
      oneToTwo: { id: "", start: "13:00", end: "14:00" },
    };

    const request = (name: keyof typeof events) => ({
      eventId: events[name].id,
      venueId,
      startAt: sg(events[name].start).toISOString(),
      endAt: sg(events[name].end).toISOString(),
      requestedAttendance: 40,
      requiredFacilities: [],
    });

    /** Request the venue for an event and have Venue Staff approve it. */
    async function approve(name: keyof typeof events) {
      mockAuth.mockResolvedValue(COORDINATOR);
      const submitted = await submitBookingRequest(request(name));
      if (!submitted.ok) throw new Error(submitted.error);
      mockAuth.mockResolvedValue(VENUE_STAFF);
      const decided = await decideBookingRequest({
        bookingId: submitted.data.booking.id,
        decision: "APPROVED",
      });
      if (!decided.ok) throw new Error(decided.error);
      mockAuth.mockResolvedValue(COORDINATOR);
      return submitted.data.booking.id;
    }

    const setVenueTimes = (setupMinutes: number, turnaroundMinutes: number) =>
      prisma.venue.update({
        where: { id: venueId },
        data: { setupMinutes, turnaroundMinutes },
      });

    beforeAll(async () => {
      const ids = await createPlanningEvents(
        "Setup and turnaround test event",
        Object.values(events).map((e) => ({
          startAt: sg(e.start),
          endAt: sg(e.end),
          expectedAttendance: 40,
        })),
      );
      Object.values(events).forEach((e, i) => (e.id = ids[i]));

      const venue = await prisma.venue.create({
        data: {
          name: `Setup and turnaround test venue ${Date.now()}`,
          location: "Test block",
          capacity: 100,
        },
        select: { id: true },
      });
      venueId = venue.id;
    });

    async function clearBookings() {
      const ids = await prisma.booking.findMany({
        where: { venueId },
        select: { id: true },
      });
      await prisma.auditLog.deleteMany({
        where: { entityType: "Booking", entityId: { in: ids.map((b) => b.id) } },
      });
      await prisma.booking.deleteMany({ where: { venueId } });
    }

    beforeEach(async () => {
      mockAuth.mockResolvedValue(COORDINATOR);
      await clearBookings();
      await prisma.venueUnavailability.deleteMany({ where: { venueId } });
      // 15 minutes' setup and 45 minutes' turnaround: the 10:00–12:00
      // booking occupies the venue from 09:45 to 12:45.
      await setVenueTimes(15, 45);
    });

    afterAll(async () => {
      await clearBookings();
      await prisma.venueUnavailability.deleteMany({ where: { venueId } });
      await removeEvents(Object.values(events).map((e) => e.id));
      await prisma.venue.delete({ where: { id: venueId } });
    });

    it("SCRUM-159 [AC1] TC-159-03: venues that existed before this story start with no setup or turnaround time", async () => {
      const seeded = await prisma.venue.findMany({
        where: {
          id: {
            in: ["ven_auditorium", "ven_seminar", "ven_hall", "ven_boardroom"],
          },
        },
        select: { setupMinutes: true, turnaroundMinutes: true },
      });

      expect(seeded).toHaveLength(4);
      expect(
        seeded.every((v) => v.setupMinutes === 0 && v.turnaroundMinutes === 0),
      ).toBe(true);
    });

    it("SCRUM-159 [AC1] TC-159-02: the database refuses setup or turnaround time outside 0 to 1,440 minutes", async () => {
      for (const data of [
        { setupMinutes: -1 },
        { setupMinutes: 1441 },
        { turnaroundMinutes: 1441 },
      ]) {
        await expect(
          prisma.venue.update({ where: { id: venueId }, data }),
        ).rejects.toThrow(/venue_setup_turnaround_range/);
      }
      // Both ends of the range are allowed.
      await expect(setVenueTimes(0, 1440)).resolves.toBeTruthy();
    });

    it("SCRUM-159 [AC3, AC4] TC-159-05, TC-159-08: a request is refused where its setup reaches an approved booking's turnaround, and accepted where the two only touch", async () => {
      await approve("tenToNoon");
      const before = await prisma.booking.count({ where: { venueId } });

      // 12:30–14:30 is clear of 10:00–12:00 as booked, but its setup starts
      // at 12:15, inside the turnaround that runs to 12:45.
      const refused = await submitBookingRequest(request("halfPastTwelve"));
      expect(refused).toMatchObject({
        ok: false,
        error: expect.stringContaining("including setup and turnaround"),
      });
      expect(await prisma.booking.count({ where: { venueId } })).toBe(before);

      // 13:00–15:00's setup starts at 12:45, exactly where the turnaround ends.
      const accepted = await submitBookingRequest(request("oneToThree"));
      expect(accepted).toMatchObject({ ok: true });
    });

    it("SCRUM-159 [AC3] TC-159-06: the live check and an approval refuse the same occupied-period clash", async () => {
      await approve("tenToNoon");
      // A pending request for 12:30–14:30, written directly, as if made before
      // the venue's times were set.
      const pending = await prisma.booking.create({
        data: {
          eventId: events.halfPastTwelve.id,
          venueId,
          startAt: sg("12:30"),
          endAt: sg("14:30"),
          requestedById: "usr_coordinator",
        },
        select: { id: true },
      });

      const live = await checkVenueAvailability({
        venueId,
        startAt: sg("12:30").toISOString(),
        endAt: sg("14:30").toISOString(),
      });
      expect(live).toMatchObject({ ok: true, data: { available: false } });

      mockAuth.mockResolvedValue(VENUE_STAFF);
      const decided = await decideBookingRequest({
        bookingId: pending.id,
        decision: "APPROVED",
      });
      expect(decided).toMatchObject({
        ok: false,
        error: expect.stringMatching(/^Conflicting:/),
      });
      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: pending.id },
        select: { status: true },
      });
      expect(row.status).toBe("PENDING");
    });

    it("SCRUM-159 [AC8] TC-159-12, TC-159-13: an approval keeps the minutes it was approved with; a later change to the venue's times doesn't move it", async () => {
      const bookingId = await approve("tenToNoon");

      expect(
        await prisma.booking.findUniqueOrThrow({
          where: { id: bookingId },
          select: { setupMinutes: true, turnaroundMinutes: true },
        }),
      ).toEqual({ setupMinutes: 15, turnaroundMinutes: 45 });

      // Venue Staff later give the venue no setup and two hours' turnaround.
      await setVenueTimes(0, 120);

      // The approved booking still occupies only until 12:45, so 13:00–14:00
      // (now with no setup) is free. Had it taken the venue's new two hours,
      // it would reach 14:00 and refuse this.
      const accepted = await submitBookingRequest(request("oneToTwo"));
      expect(accepted).toMatchObject({ ok: true });
      expect(
        await prisma.booking.findUniqueOrThrow({
          where: { id: bookingId },
          select: { setupMinutes: true, turnaroundMinutes: true },
        }),
      ).toEqual({ setupMinutes: 15, turnaroundMinutes: 45 });
    });

    /** A HELD booking for the 10:00–12:00 event, written directly (SCRUM-163 places holds). */
    const heldBooking = (holdExpiresAt: Date, heldAt: Date) =>
      prisma.booking.create({
        data: {
          eventId: events.tenToNoon.id,
          venueId,
          startAt: sg("10:00"),
          endAt: sg("12:00"),
          status: "HELD",
          requestedById: "usr_coordinator",
          heldAt,
          holdExpiresAt,
          holdNote: "Confirm the AV needs.",
          setupMinutes: 15,
          turnaroundMinutes: 45,
        },
        select: { id: true },
      });
    const HOUR_MS = 60 * 60 * 1000;

    it("SCRUM-159 [AC3] TC-159-15: a hold that hasn't expired blocks a request and the live check wherever its occupied period reaches", async () => {
      await heldBooking(
        new Date(Date.now() + 24 * HOUR_MS),
        new Date(Date.now() - HOUR_MS),
      );
      const before = await prisma.booking.count({ where: { venueId } });

      const refused = await submitBookingRequest(request("halfPastTwelve"));
      expect(refused).toMatchObject({
        ok: false,
        error: expect.stringMatching(/: held from .*including setup and turnaround/),
      });
      expect(await prisma.booking.count({ where: { venueId } })).toBe(before);

      const live = await checkVenueAvailability({
        venueId,
        startAt: sg("12:30").toISOString(),
        endAt: sg("14:30").toISOString(),
      });
      expect(live).toMatchObject({ ok: true, data: { available: false } });
    });

    it("SCRUM-159 [AC3] TC-159-16: a hold whose expiry has passed blocks nothing, even before anything marks it Expired", async () => {
      await heldBooking(
        new Date(Date.now() - HOUR_MS),
        new Date(Date.now() - 48 * HOUR_MS),
      );

      const live = await checkVenueAvailability({
        venueId,
        startAt: sg("12:30").toISOString(),
        endAt: sg("14:30").toISOString(),
      });
      expect(live).toMatchObject({ ok: true, data: { available: true } });

      const accepted = await submitBookingRequest(request("halfPastTwelve"));
      expect(accepted).toMatchObject({ ok: true });
    });

    // SCRUM-161 replaced the refusal: the booking is shown as affected first.
    it("SCRUM-159 [AC3] TC-159-07: unavailability over only an approved booking's turnaround is not recorded until that booking is confirmed", async () => {
      const bookingId = await approve("tenToNoon");
      mockAuth.mockResolvedValue(VENUE_STAFF);

      const result = await recordUnavailability({
        venueId,
        startAt: sg("12:30").toISOString(),
        endAt: sg("13:00").toISOString(),
        reason: "MAINTENANCE",
      });

      expect(result).toEqual({
        ok: true,
        data: {
          recorded: false,
          affected: [expect.objectContaining({ bookingId })],
        },
      });
      expect(
        await prisma.venueUnavailability.count({ where: { venueId } }),
      ).toBe(0);
    });

    it("SCRUM-159 [AC7] TC-159-10: the calendar's entries carry the approved booking's setup and turnaround", async () => {
      await approve("tenToNoon");

      const entries = await findVenueCalendar(prisma, venueId, {
        startAt: sg("00:00"),
        endAt: new Date(sg("00:00").getTime() + 24 * 60 * 60 * 1000),
      });

      expect(entries.map((e) => [e.kind, e.startAt, e.endAt])).toEqual([
        ["setup", sg("09:45"), sg("10:00")],
        ["booking", sg("10:00"), sg("12:00")],
        ["turnaround", sg("12:00"), sg("12:45")],
      ]);
    });
  },
);
