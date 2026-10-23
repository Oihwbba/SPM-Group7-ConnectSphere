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

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { searchVenues } from "@/lib/venue-search";
import { getSearchEvent } from "@/app/(app)/venues/search/queries";
import {
  checkVenueAvailability,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-188 AC3 against a real, seeded Postgres: a venue that search lists as
// free for an event is requested for the same period, so it isn't refused
// unless something was booked there in between. The event runs 10:10–11:50,
// off the half hour, with approved bookings touching it at both ends: the
// rounding SCRUM-188 replaced asked for 10:00–12:00, which overlapped them.
//
// These WRITE (throwaway venues at their own location, with their events and
// bookings, removed afterwards), so they only run against a localhost
// database — CI's service container, or the Docker DB — never against the
// shared Supabase database. Their own location and day keep every other
// suite's rows out of the results.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const LOCATION = "IT-188 Block E";
/** Singapore wall time on 19 Sep 2034, as a UTC instant. */
const sg = (hhmm: string) => new Date(`2034-09-19T${hhmm}:00+08:00`);
const COORDINATOR = { id: "usr_coordinator", role: "COORDINATOR" as const };
const SESSION: Session = {
  user: { ...COORDINATOR, name: "usr_coordinator", email: "c@test.local" },
  expires: "2999-01-01T00:00:00.000Z",
};

describe.skipIf(!usesLocalDatabase)(
  "a venue request uses the period venue search checked (SCRUM-188) — real database",
  () => {
    const venue = { plain: "", turnaround: "" };
    let eventId: string;
    let otherEventIds: string[];

    beforeAll(async () => {
      const make = (name: string, minutes: number) =>
        prisma.venue.create({
          data: {
            name: `IT-188 ${name}`,
            location: LOCATION,
            capacity: 100,
            setupMinutes: minutes,
            turnaroundMinutes: minutes,
          },
          select: { id: true },
        });
      venue.plain = (await make("Plain Room", 0)).id;
      // SCRUM-159: 15 minutes either side, so a booking that only touches the
      // event's period still occupies part of it here.
      venue.turnaround = (await make("Turnaround Room", 15)).id;
      [eventId] = await createPlanningEvents("IT-188 event", [
        { startAt: sg("10:10"), endAt: sg("11:50"), expectedAttendance: 40 },
      ]);
      otherEventIds = await createPlanningEvents("IT-188 other", [
        { startAt: sg("08:00"), endAt: sg("10:10") },
        { startAt: sg("11:50"), endAt: sg("13:00") },
        { startAt: sg("11:50"), endAt: sg("13:00") },
        { startAt: sg("11:00"), endAt: sg("11:30") },
      ]);
      mockAuth.mockResolvedValue(SESSION);
    });

    afterEach(async () => {
      await prisma.booking.deleteMany({
        where: { venueId: { in: Object.values(venue) } },
      });
    });

    afterAll(async () => {
      await removeEvents([eventId, ...otherEventIds]);
      await prisma.venue.deleteMany({ where: { location: LOCATION } });
    });

    /** Another event's approved booking, written directly. */
    const approved = (
      otherEventId: string,
      venueId: string,
      from: string,
      to: string,
      minutes = 0,
    ) =>
      prisma.booking.create({
        data: {
          eventId: otherEventId,
          venueId,
          startAt: sg(from),
          endAt: sg(to),
          setupMinutes: minutes,
          turnaroundMinutes: minutes,
          status: "APPROVED",
          requestedById: "usr_coordinator",
          decidedById: "usr_venuestaff",
          decidedAt: new Date(),
        },
      });

    /** Search as the page does when opened from the event (SCRUM-38 AC1, AC2). */
    async function searchFromEvent() {
      const resolved = await getSearchEvent(COORDINATOR, eventId);
      if (!resolved.ok) throw new Error(resolved.error);
      const found = await searchVenues(prisma, {
        period: resolved.event.period,
        location: LOCATION,
        filters: { facilities: [], accessibilityFeatures: [] },
        eventId,
      });
      return { period: resolved.event.period, names: found.map((v) => v.name) };
    }

    const requestFor = (
      venueId: string,
      period: { startAt: Date; endAt: Date },
    ) =>
      submitBookingRequest({
        eventId,
        venueId,
        startAt: period.startAt.toISOString(),
        endAt: period.endAt.toISOString(),
        requestedAttendance: 40,
      });

    const eventBookings = () => prisma.booking.count({ where: { eventId } });

    it("SCRUM-188 [AC3] TC-188-05: a venue search lists as free is requested for the same period and accepted, though bookings touch it at both ends", async () => {
      await approved(otherEventIds[0], venue.plain, "08:00", "10:10");
      await approved(otherEventIds[1], venue.plain, "11:50", "13:00");

      const searched = await searchFromEvent();
      expect(searched.period).toEqual({
        startAt: sg("10:10"),
        endAt: sg("11:50"),
      });
      expect(searched.names).toContain("IT-188 Plain Room");
      // The half-hour period the rounding used to ask for was not free.
      const rounded = await checkVenueAvailability({
        venueId: venue.plain,
        startAt: sg("10:00").toISOString(),
        endAt: sg("12:00").toISOString(),
      });
      expect(rounded.ok && rounded.data.available).toBe(false);

      const result = await requestFor(venue.plain, searched.period);

      expect(result.ok && result.data.created).toBe(true);
      expect(
        await prisma.booking.findFirstOrThrow({
          where: { eventId, venueId: venue.plain },
          select: { startAt: true, endAt: true, status: true },
        }),
      ).toEqual({
        startAt: sg("10:10"),
        endAt: sg("11:50"),
        status: "PENDING",
      });
    });

    it("SCRUM-188 [AC3] TC-188-05: a venue that search leaves out over setup and turnaround is refused by the request the same way", async () => {
      // With its 15 minutes' setup it occupies the Turnaround Room from
      // 11:35, inside the event's period, though its own times only touch it.
      await approved(otherEventIds[2], venue.turnaround, "11:50", "13:00", 15);

      const searched = await searchFromEvent();
      expect(searched.names).not.toContain("IT-188 Turnaround Room");

      const result = await requestFor(venue.turnaround, searched.period);

      expect(result).toMatchObject({
        ok: false,
        error: expect.stringMatching(
          /^IT-188 Turnaround Room is unavailable for that period: already booked/,
        ),
      });
      expect(await eventBookings()).toBe(0);
    });

    it("SCRUM-188 [AC3] TC-188-06: a venue booked after the search listed it as free is refused, and nothing is written", async () => {
      const searched = await searchFromEvent();
      expect(searched.names).toContain("IT-188 Plain Room");

      // Approved for another event between the search and the request.
      await approved(otherEventIds[3], venue.plain, "11:00", "11:30");
      const result = await requestFor(venue.plain, searched.period);

      expect(result).toMatchObject({
        ok: false,
        error: expect.stringMatching(
          /^IT-188 Plain Room is unavailable for that period: already booked/,
        ),
      });
      expect(await eventBookings()).toBe(0);
    });
  },
);
