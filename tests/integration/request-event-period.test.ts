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
import { searchVenues } from "@/lib/venue-search";
import { getSearchEvent } from "@/app/(app)/venues/search/queries";
import {
  checkVenueAvailability,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";
import { createPlanningEvents, removeEvents } from "./test-events";
import { withHours } from "../venue-hours-fixture";

// SCRUM-188 against a real, seeded Postgres: a venue search lists as free for
// an event is requested for the same period, so the request agrees with the
// search. The event runs 10:10–11:50, off the half hour, between two approved
// bookings that end exactly at its start and begin exactly at its end. Under
// SCRUM-50 AC1's rounding the request was 10:00–12:00 and overlapped both.
//
// These WRITE (a throwaway venue at its own location, with its events and
// bookings, removed afterwards), so they only run against a localhost
// database — CI's service container, or the Docker DB — never against the
// shared Supabase database. Searching by that location keeps every other
// venue out of the results.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const LOCATION = "IT-188 Block R";
const DAY = "2033-04-12";
/** Singapore wall time on DAY, as a UTC instant. */
const sg = (hhmm: string) => new Date(`${DAY}T${hhmm}:00+08:00`);
const COORDINATOR = { id: "usr_coordinator", role: "COORDINATOR" as const };
const SESSION: Session = {
  user: { ...COORDINATOR, name: "usr_coordinator", email: "usr_coordinator@test.local" },
  expires: "2999-01-01T00:00:00.000Z",
};

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-188 — a venue request uses exactly the event's period (real database)",
  () => {
    let venueId: string;
    let eventId: string;
    let beforeId: string;
    let afterId: string;

    beforeAll(async () => {
      venueId = (
        await prisma.venue.create({
          data: {
            name: `IT-188 Room ${Date.now()}`,
            location: LOCATION,
            capacity: 60,
            ...withHours,
          },
          select: { id: true },
        })
      ).id;
      [eventId, beforeId, afterId] = await createPlanningEvents("IT-188", [
        { startAt: sg("10:10"), endAt: sg("11:50") },
        { startAt: sg("08:00"), endAt: sg("10:10") },
        { startAt: sg("11:50"), endAt: sg("13:00") },
      ]);
    });

    beforeEach(async () => {
      mockAuth.mockResolvedValue(SESSION);
      await prisma.booking.deleteMany({ where: { venueId } });
    });

    afterAll(async () => {
      await removeEvents([eventId, beforeId, afterId]);
      await prisma.venue.deleteMany({ where: { location: LOCATION } });
    });

    /** Another event's approved booking at the venue. */
    const approved = (otherEventId: string, from: string, to: string) =>
      prisma.booking.create({
        data: {
          eventId: otherEventId,
          venueId,
          startAt: sg(from),
          endAt: sg(to),
          status: "APPROVED",
          requestedById: "usr_coordinator",
          decidedById: "usr_venuestaff",
          decidedAt: new Date(),
        },
      });

    /** Is the venue in a search opened from the event? */
    async function searchFindsVenue() {
      const opened = await getSearchEvent(COORDINATOR, eventId);
      if (!opened.ok) throw new Error(opened.error);
      const results = await searchVenues(prisma, {
        period: opened.event.period,
        location: LOCATION,
        filters: { facilities: [], accessibilityFeatures: [] },
      });
      return results.some((v) => v.id === venueId);
    }

    /** What the request form fills in for the event (SCRUM-188 AC1). */
    async function formPeriod() {
      const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { startAt: true, endAt: true },
      });
      const period = eventBookingPeriod(event)!;
      return {
        venueId,
        startAt: period.startAt.toISOString(),
        endAt: period.endAt.toISOString(),
      };
    }

    const request = async () =>
      submitBookingRequest({
        ...(await formPeriod()),
        eventId,
        requestedAttendance: 40,
      });

    it("SCRUM-188 [AC1, AC2] TC-188-04: a venue search lists as free for the event, between bookings that touch the event's start and end, is free when checked and requested, and is booked for exactly the event's period", async () => {
      await approved(beforeId, "08:00", "10:10");
      await approved(afterId, "11:50", "13:00");

      expect(await searchFindsVenue()).toBe(true);
      expect(await formPeriod()).toEqual({
        venueId,
        startAt: sg("10:10").toISOString(),
        endAt: sg("11:50").toISOString(),
      });
      expect(await checkVenueAvailability(await formPeriod())).toEqual({
        ok: true,
        data: { available: true, clashes: [] },
      });

      const result = await request();

      expect(result.ok && result.data.created).toBe(true);
      const row = await prisma.booking.findFirstOrThrow({
        where: { venueId, eventId },
      });
      expect(row).toMatchObject({
        status: "PENDING",
        startAt: sg("10:10"),
        endAt: sg("11:50"),
      });
    });

    it.each([
      ["ends one minute into the event", "before", "08:00", "10:11"],
      ["begins one minute before the event ends", "after", "11:49", "13:00"],
    ] as const)(
      "SCRUM-188 [AC2] TC-188-05: a booking that %s takes the venue out of the search, and requesting it is refused too, writing nothing",
      async (_, side, from, to) => {
        await approved(side === "before" ? beforeId : afterId, from, to);

        expect(await searchFindsVenue()).toBe(false);
        expect(await checkVenueAvailability(await formPeriod())).toMatchObject({
          ok: true,
          data: { available: false },
        });

        const result = await request();

        expect(result).toMatchObject({
          ok: false,
          error: expect.stringMatching(/is unavailable for that period/),
        });
        expect(
          await prisma.booking.count({ where: { venueId, eventId } }),
        ).toBe(0);
      },
    );
  },
);
