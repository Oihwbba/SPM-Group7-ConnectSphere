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
import {
  decideBookingRequest,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";
import { changeVenueTimes } from "@/app/(app)/venues/times-actions";
import {
  TIMES_CHANGED_REASON,
  findTimeClashes,
  listTimeClashFlags,
} from "@/lib/venue-time-clashes";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-160 against a real, seeded Postgres: lengthening a venue's setup or
// turnaround time shows, then flags, the bookings it makes clash, and never
// moves or cancels them. Test cases: docs/testing/SCRUM-160.md.
//
// These WRITE (a throwaway venue, its events, bookings and unavailability,
// removed afterwards), so they only run against a localhost database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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

/** Singapore wall time on 16 Mar 2032, as a UTC instant. */
const sg = (hhmm: string) => new Date(`2032-03-16T${hhmm}:00+08:00`);

describe.skipIf(!usesLocalDatabase)(
  "clashes after a setup or turnaround change (SCRUM-160) — real database",
  () => {
    let venueId: string;
    const events = {
      tenToNoon: { id: "", start: "10:00", end: "12:00" },
      oneToThree: { id: "", start: "13:00", end: "15:00" },
    };
    const bookings: Record<keyof typeof events, string> = {
      tenToNoon: "",
      oneToThree: "",
    };

    async function approve(name: keyof typeof events) {
      mockAuth.mockResolvedValue(COORDINATOR);
      const submitted = await submitBookingRequest({
        eventId: events[name].id,
        venueId,
        startAt: sg(events[name].start).toISOString(),
        endAt: sg(events[name].end).toISOString(),
        requestedAttendance: 40,
        requiredFacilities: [],
      });
      if (!submitted.ok) throw new Error(submitted.error);
      mockAuth.mockResolvedValue(VENUE_STAFF);
      const decided = await decideBookingRequest({
        bookingId: submitted.data.booking.id,
        decision: "APPROVED",
      });
      if (!decided.ok) throw new Error(decided.error);
      return submitted.data.booking.id;
    }

    const change = (setupMinutes: number, turnaroundMinutes: number, confirmed = false) => {
      mockAuth.mockResolvedValue(VENUE_STAFF);
      return changeVenueTimes({ venueId, setupMinutes, turnaroundMinutes, confirmed });
    };

    async function clear() {
      const ids = Object.values(events).map((e) => e.id);
      await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
      const rows = await prisma.booking.findMany({ where: { venueId }, select: { id: true } });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: [venueId, ...rows.map((b) => b.id)] } },
      });
      await prisma.booking.deleteMany({ where: { venueId } });
      await prisma.venueUnavailability.deleteMany({ where: { venueId } });
    }

    beforeAll(async () => {
      const ids = await createPlanningEvents(
        "Setup and turnaround clash test event",
        Object.values(events).map((e) => ({ startAt: sg(e.start), endAt: sg(e.end) })),
      );
      Object.values(events).forEach((e, i) => (e.id = ids[i]));
      const venue = await prisma.venue.create({
        data: {
          name: `Setup and turnaround clash test venue ${Date.now()}`,
          location: "Test block",
          capacity: 100,
        },
        select: { id: true },
      });
      venueId = venue.id;
    });

    beforeEach(async () => {
      await clear();
      await prisma.venue.update({
        where: { id: venueId },
        data: { setupMinutes: 0, turnaroundMinutes: 0 },
      });
      // Approved in this order, with no setup or turnaround: they don't touch.
      bookings.tenToNoon = await approve("tenToNoon");
      bookings.oneToThree = await approve("oneToThree");
      // Free with no turnaround; reached by the 13:00–15:00 booking's at 45.
      await prisma.venueUnavailability.create({
        data: {
          venueId,
          startAt: sg("15:30"),
          endAt: sg("16:30"),
          reason: "MAINTENANCE",
          recordedById: "usr_venuestaff",
        },
      });
    });

    afterAll(async () => {
      await clear();
      await removeEvents(Object.values(events).map((e) => e.id));
      await prisma.venue.delete({ where: { id: venueId } });
    });

    it("SCRUM-160 [AC1] TC-160-01: lengthening shows the booking approved later and what it clashes with, and saves nothing yet", async () => {
      const result = await change(30, 45);

      expect(result.ok && result.data).toMatchObject({
        saved: false,
        clashes: [
          { bookingId: bookings.oneToThree, clashesWith: expect.stringContaining("'s booking from") },
          { bookingId: bookings.oneToThree, clashesWith: expect.stringContaining("unavailability (maintenance)") },
        ],
      });
      expect(
        await prisma.venue.findUniqueOrThrow({ where: { id: venueId }, select: { setupMinutes: true } }),
      ).toEqual({ setupMinutes: 0 });
      expect(await prisma.booking.count({ where: { venueId, needsReconsideration: true } })).toBe(0);
    });

    it("SCRUM-160 [AC2, AC3, AC5] TC-160-07: confirmed, the times are saved and the booking is flagged once, unchanged, with its Coordinator and Venue Staff told and the clash listed", async () => {
      const result = await change(30, 45, true);
      expect(result).toEqual({ ok: true, data: { saved: true, flagged: 1 } });

      const flagged = await prisma.booking.findUniqueOrThrow({ where: { id: bookings.oneToThree } });
      expect(flagged).toMatchObject({
        status: "APPROVED",
        startAt: sg("13:00"),
        endAt: sg("15:00"),
        setupMinutes: 0,
        turnaroundMinutes: 0,
        needsReconsideration: true,
        reconsiderationReason: TIMES_CHANGED_REASON,
      });
      expect(
        await prisma.booking.findUniqueOrThrow({
          where: { id: bookings.tenToNoon },
          select: { needsReconsideration: true },
        }),
      ).toEqual({ needsReconsideration: false });

      const notices = await prisma.notification.findMany({
        where: { eventId: events.oneToThree.id, type: "ARRANGEMENT_FLAGGED" },
        select: { userId: true },
      });
      const staff = await prisma.user.count({ where: { role: "VENUE_STAFF" } });
      expect(notices).toHaveLength(staff + 1);
      expect(notices.map((n) => n.userId)).toContain("usr_coordinator");

      const listed = (await listTimeClashFlags(prisma)).find((f) => f.bookingId === bookings.oneToThree);
      expect(listed?.clashesWith).toHaveLength(2);
    });

    it("SCRUM-160 [AC6, AC7] TC-160-08: saving the same times again, or lengthening again after the flag is resolved, flags nothing new", async () => {
      await change(30, 45, true);
      expect(await change(30, 45, true)).toEqual({ ok: true, data: { saved: true, flagged: 0 } });

      // The Coordinator decides it still stands (SCRUM-26).
      await prisma.booking.update({
        where: { id: bookings.oneToThree },
        data: {
          needsReconsideration: false,
          reconsiderationResolvedAt: new Date(),
          reconsiderationResolvedById: "usr_coordinator",
        },
      });
      await change(0, 0, true);
      expect(await change(30, 45, true)).toEqual({ ok: true, data: { saved: true, flagged: 0 } });
      expect(
        await prisma.auditLog.count({
          where: { entityId: bookings.oneToThree, action: "RECONSIDERATION_FLAGGED" },
        }),
      ).toBe(2);
    });

    it("SCRUM-160 [AC6] TC-160-06: shortening flags nothing", async () => {
      await prisma.venue.update({
        where: { id: venueId },
        data: { setupMinutes: 0, turnaroundMinutes: 20 },
      });

      expect(await change(0, 10)).toEqual({ ok: true, data: { saved: true, flagged: 0 } });
      expect(await prisma.booking.count({ where: { venueId, needsReconsideration: true } })).toBe(0);
    });

    it("SCRUM-160 [AC4] TC-160-13: the seeded venues' times create no clash between seeded bookings", async () => {
      const seeded = await prisma.venue.findMany({
        where: { id: { in: ["ven_auditorium", "ven_seminar", "ven_hall", "ven_boardroom"] } },
        select: { id: true, setupMinutes: true, turnaroundMinutes: true },
      });
      for (const venue of seeded) {
        expect(await findTimeClashes(prisma, venue.id, venue), venue.id).toEqual([]);
      }
    });
  },
);
