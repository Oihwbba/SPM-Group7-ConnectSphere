import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { prisma } from "@/lib/db";
import { searchVenues, type VenueSearch } from "@/lib/venue-search";
import { getSearchEvent } from "@/app/(app)/venues/search/queries";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-38 against a real, seeded Postgres: which venues a search finds once
// bookings, holds and recorded unavailability are real rows, with setup and
// turnaround counted (SCRUM-159).
//
// These WRITE (throwaway venues at their own location, with their events and
// bookings, removed afterwards), so they only run against a localhost
// database — CI's service container, or the Docker DB — never against the
// shared Supabase database. Searching by that location keeps seeded venues
// out of every result.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const LOCATION = "IT-38 Block Q";
const DAY = "2033-03-15";
/** Singapore wall time on DAY, as a UTC instant. */
const sg = (hhmm: string) => new Date(`${DAY}T${hhmm}:00+08:00`);
const COORDINATOR = { id: "usr_coordinator", role: "COORDINATOR" as const };

describe.skipIf(!usesLocalDatabase)(
  "venue search (SCRUM-38) — real database",
  () => {
    const venue = { busy: "", plain: "", retired: "" };
    let eventId: string;

    beforeAll(async () => {
      const make = (name: string, data: Record<string, unknown> = {}) =>
        prisma.venue.create({
          data: {
            name: `IT-38 ${name}`,
            location: LOCATION,
            capacity: 60,
            facilities: ["projector"],
            accessibilityFeatures: ["wheelchair-access"],
            supportedLayouts: ["classroom"],
            ...data,
          },
          select: { id: true },
        });
      // Busy has 30 minutes' setup and turnaround (SCRUM-159).
      venue.busy = (
        await make("Busy Room", {
          setupMinutes: 30,
          turnaroundMinutes: 30,
          facilities: ["projector", "stage"],
        })
      ).id;
      venue.plain = (await make("Plain Room")).id;
      venue.retired = (await make("Retired Room", { isActive: false })).id;
      [eventId] = await createPlanningEvents("IT-38 search", [
        { startAt: sg("10:00"), endAt: sg("12:00"), expectedAttendance: 40 },
      ]);
    });

    afterEach(async () => {
      const venueIds = Object.values(venue);
      await prisma.booking.deleteMany({ where: { venueId: { in: venueIds } } });
      await prisma.venueUnavailability.deleteMany({
        where: { venueId: { in: venueIds } },
      });
    });

    afterAll(async () => {
      await removeEvents([eventId]);
      await prisma.venue.deleteMany({ where: { location: LOCATION } });
    });

    /** Another event's booking at Busy, 14:00 to 16:00, with its own 30 minutes either side. */
    async function bookBusy(data: Record<string, unknown>) {
      const [otherEvent] = await createPlanningEvents("IT-38 other", [
        { startAt: sg("14:00"), endAt: sg("16:00") },
      ]);
      await prisma.booking.create({
        data: {
          eventId: otherEvent,
          venueId: venue.busy,
          startAt: sg("14:00"),
          endAt: sg("16:00"),
          setupMinutes: 30,
          turnaroundMinutes: 30,
          requestedById: "usr_coordinator",
          ...data,
        },
      });
      return otherEvent;
    }

    const found = async (search: Partial<VenueSearch> = {}) =>
      (
        await searchVenues(prisma, {
          period: null,
          location: LOCATION,
          filters: { facilities: [], accessibilityFeatures: [] },
          ...search,
        })
      ).map((v) => v.name);

    const between = (from: string, to: string) => ({
      period: { startAt: sg(from), endAt: sg(to) },
    });

    it("SCRUM-38 [AC3] TC-38-05: an Approved booking excludes the venue where the occupied periods overlap", async () => {
      const other = await bookBusy({ status: "APPROVED" });
      try {
        // The booking occupies 13:30–16:30; a search from 16:15 would occupy
        // Busy from 15:45.
        expect(await found(between("16:15", "17:00"))).toEqual([
          "IT-38 Plain Room",
        ]);
        // AC2: a period over several days that takes in the booking.
        expect(
          await found({
            period: {
              startAt: new Date("2033-03-14T18:00:00+08:00"),
              endAt: new Date("2033-03-16T12:00:00+08:00"),
            },
          }),
        ).toEqual(["IT-38 Plain Room"]);
        // …and one over two days that ends at 13:00: with Busy's 30 minutes'
        // turnaround it occupies Busy until 13:30, when the booking's setup
        // begins, so the two only touch.
        expect(
          await found({
            period: {
              startAt: new Date("2033-03-14T18:00:00+08:00"),
              endAt: sg("13:00"),
            },
          }),
        ).toEqual(["IT-38 Busy Room", "IT-38 Plain Room"]);
      } finally {
        await removeEvents([other]);
      }
    });

    it("SCRUM-38 [AC5] TC-38-06: occupied periods that only touch don't overlap; one minute more does", async () => {
      const other = await bookBusy({ status: "APPROVED" });
      try {
        // 17:00–18:00 occupies 16:30–18:30, touching the booking's 16:30.
        expect(await found(between("17:00", "18:00"))).toEqual([
          "IT-38 Busy Room",
          "IT-38 Plain Room",
        ]);
        expect(await found(between("16:59", "18:00"))).toEqual([
          "IT-38 Plain Room",
        ]);
      } finally {
        await removeEvents([other]);
      }
    });

    it("SCRUM-38 [AC3] TC-38-05: a live hold excludes the venue; an expired one doesn't", async () => {
      const now = new Date();
      const hold = {
        status: "HELD",
        heldAt: new Date(now.getTime() - 2 * 3600_000),
        holdNote: "Confirm the menu",
      };
      const live = await bookBusy({
        ...hold,
        holdExpiresAt: new Date(now.getTime() + 24 * 3600_000),
      });
      try {
        expect(await found(between("15:00", "17:00"))).toEqual([
          "IT-38 Plain Room",
        ]);
      } finally {
        await removeEvents([live]);
      }

      const expired = await bookBusy({
        ...hold,
        holdExpiresAt: new Date(now.getTime() - 3600_000),
      });
      try {
        expect(await found(between("15:00", "17:00"))).toEqual([
          "IT-38 Busy Room",
          "IT-38 Plain Room",
        ]);
      } finally {
        await removeEvents([expired]);
      }
    });

    it("SCRUM-38 [AC3] TC-38-05: a Pending request blocks nobody", async () => {
      const other = await bookBusy({ status: "PENDING" });
      try {
        expect(await found(between("15:00", "17:00"))).toEqual([
          "IT-38 Busy Room",
          "IT-38 Plain Room",
        ]);
      } finally {
        await removeEvents([other]);
      }
    });

    it("SCRUM-38 [AC3, AC5] TC-38-05, TC-38-06: recorded unavailability excludes the venue it overlaps, not one it only touches", async () => {
      await prisma.venueUnavailability.create({
        data: {
          venueId: venue.plain,
          startAt: sg("18:00"),
          endAt: sg("20:00"),
          recordedById: "usr_venuestaff",
        },
      });

      // Plain has no setup or turnaround, so its occupied period is the search's.
      expect(await found(between("17:00", "18:30"))).toEqual([
        "IT-38 Busy Room",
      ]);
      expect(await found(between("17:00", "18:00"))).toEqual([
        "IT-38 Busy Room",
        "IT-38 Plain Room",
      ]);
    });

    it("SCRUM-38 [AC2, AC7] TC-38-04, TC-38-08: a location finds the venues there, and a retired venue never appears", async () => {
      expect(await found({ location: LOCATION })).toEqual([
        "IT-38 Busy Room",
        "IT-38 Plain Room",
      ]);
      // Locations are picked from a list of the venues' own, so they match exactly.
      expect(await found({ location: "IT-38 Block" })).toEqual([]);
      expect(
        await prisma.venue.count({
          where: { id: venue.retired, isActive: false },
        }),
      ).toBe(1);
    });

    it("SCRUM-38 [AC11, AC13] TC-38-12: filters narrow a real search", async () => {
      const filtered = (filters: Partial<VenueSearch["filters"]>) =>
        found({
          filters: { facilities: [], accessibilityFeatures: [], ...filters },
        });

      expect(await filtered({ facilities: ["projector", "stage"] })).toEqual([
        "IT-38 Busy Room",
      ]);
      expect(
        await filtered({ accessibilityFeatures: ["hearing-loop"] }),
      ).toEqual([]);
      expect(await filtered({ attendance: 61 })).toEqual([]);
    });

    it("SCRUM-38 [AC9] TC-38-10: a venue the event has a live booking at is already requested; a cancelled one isn't", async () => {
      await prisma.booking.create({
        data: {
          eventId,
          venueId: venue.plain,
          startAt: sg("10:00"),
          endAt: sg("12:00"),
          status: "PENDING",
          requestedById: "usr_coordinator",
        },
      });
      await prisma.booking.create({
        data: {
          eventId,
          venueId: venue.busy,
          startAt: sg("10:00"),
          endAt: sg("12:00"),
          status: "CANCELLED",
          requestedById: "usr_coordinator",
        },
      });

      const results = await searchVenues(prisma, {
        period: null,
        location: LOCATION,
        filters: { facilities: [], accessibilityFeatures: [] },
        eventId,
      });

      expect(results.map((v) => [v.name, v.alreadyRequested])).toEqual([
        ["IT-38 Busy Room", false],
        ["IT-38 Plain Room", true],
      ]);
    });

    it("SCRUM-38 [AC1] TC-38-02: Find a replacement venue starts from the flagged booking request", async () => {
      const booking = await prisma.booking.create({
        data: {
          eventId,
          venueId: venue.busy,
          startAt: sg("10:00"),
          endAt: sg("12:00"),
          status: "APPROVED",
          requestedAttendance: 35,
          requiredFacilities: ["stage"],
          requestedLayout: "classroom",
          requestedById: "usr_coordinator",
          needsReconsideration: true,
          reconsiderationReason: "The event's expected attendance changed.",
          reconsiderationFlaggedAt: new Date(),
        },
        select: { id: true },
      });

      await expect(
        getSearchEvent(COORDINATOR, eventId, booking.id),
      ).resolves.toEqual({
        ok: true,
        event: expect.objectContaining({
          period: { startAt: sg("10:00"), endAt: sg("12:00") },
          replacing: { id: booking.id, venueName: "IT-38 Busy Room" },
          prefill: {
            attendance: 35,
            facilities: ["stage"],
            layout: "classroom",
          },
        }),
      });

      // Once resolved, the booking is no longer flagged: nothing to replace.
      await prisma.booking.update({
        where: { id: booking.id },
        data: { needsReconsideration: false },
      });
      const resolved = await getSearchEvent(COORDINATOR, eventId, booking.id);
      expect(resolved.ok).toBe(false);
    });
  },
);
