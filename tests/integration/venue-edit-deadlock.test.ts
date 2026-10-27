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
import { updateVenue } from "@/app/(app)/venues/actions";
import { lockVenueTimes } from "@/lib/venue-availability";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-202 against a real, seeded Postgres: a venue edit that flags a
// booking (SCRUM-34 AC10) at the same moment as that booking's approval.
// The approval locks the booking and then the venue (ADR 0007); the edit
// locks the venue and then flags the booking. Test cases:
// docs/testing/SCRUM-202.md.
//
// These WRITE (a throwaway venue, its event and booking, removed
// afterwards), so they only run against a localhost database.
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

/** Singapore wall time on 17 Mar 2032, as a UTC instant. */
const sg = (hhmm: string) => new Date(`2032-03-17T${hhmm}:00+08:00`);

/**
 * Resolves once another session is waiting on a lock held by `blocker` (a
 * backend pid), so other test files' sessions can't be mistaken for it.
 */
async function someoneWaitsOn(blocker: number) {
  for (let tries = 0; tries < 100; tries++) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE ${blocker}::int = ANY (pg_blocking_pids(pid))`;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("the venue edit never waited on the booking");
}

describe.skipIf(!usesLocalDatabase)(
  "a venue edit meeting a booking decision (SCRUM-202) — real database",
  () => {
    let venueId: string;
    let eventId: string;
    let bookingId: string;

    const venueName = `Venue edit deadlock test venue ${Date.now()}`;
    const hours = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      closed: false,
      opensAt: "08:00",
      closesAt: "22:00",
    }));
    /** Venue Staff lower the capacity to 30, below the booking's 40, and confirm the flag. */
    const lowerCapacity = () => {
      mockAuth.mockResolvedValue(VENUE_STAFF);
      return updateVenue({
        venueId,
        name: venueName,
        location: "Test block",
        capacity: 30,
        facilities: "",
        accessibilityFeatures: "",
        supportedLayouts: "",
        openingHours: hours,
        setupMinutes: 0,
        turnaroundMinutes: 0,
        confirmedBookingIds: [bookingId],
      });
    };

    async function clear() {
      await prisma.notification.deleteMany({ where: { eventId } });
      const rows = await prisma.booking.findMany({ where: { venueId }, select: { id: true } });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: [venueId, ...rows.map((b) => b.id)] } },
      });
      await prisma.booking.deleteMany({ where: { venueId } });
    }

    beforeAll(async () => {
      [eventId] = await createPlanningEvents("Venue edit deadlock test event", [
        { startAt: sg("10:00"), endAt: sg("12:00") },
      ]);
      const venue = await prisma.venue.create({
        data: {
          name: venueName,
          location: "Test block",
          capacity: 100,
          openingHours: {
            create: hours.map(({ weekday }) => ({ weekday, opensMinute: 480, closesMinute: 1320 })),
          },
        },
        select: { id: true },
      });
      venueId = venue.id;
    });

    beforeEach(async () => {
      await clear();
      await prisma.venue.update({ where: { id: venueId }, data: { capacity: 100 } });
      mockAuth.mockResolvedValue(COORDINATOR);
      const submitted = await submitBookingRequest({
        eventId,
        venueId,
        startAt: sg("10:00").toISOString(),
        endAt: sg("12:00").toISOString(),
        requestedAttendance: 40,
        requiredFacilities: [],
      });
      if (!submitted.ok) throw new Error(submitted.error);
      bookingId = submitted.data.booking.id;
    });

    afterAll(async () => {
      await clear();
      await removeEvents([eventId]);
      await prisma.venueOpeningHours.deleteMany({ where: { venueId } });
      await prisma.venue.delete({ where: { id: venueId } });
    });

    it("SCRUM-202 [AC1, AC2] TC-202-02: an edit caught in a deadlock with an approval's locks is run again and saved once", async () => {
      let edit!: ReturnType<typeof lowerCapacity>;
      // The approval's lock order (ADR 0007), held open: the booking first...
      const approval = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
          // ...then the edit locks the venue and waits on the booking...
          edit = lowerCapacity();
          await someoneWaitsOn(pid);
          // ...and the approval asks for the venue the edit holds: a deadlock.
          // The edit has waited longest, so Postgres aborts it.
          await lockVenueTimes(tx, venueId);
        },
        { timeout: 20_000 },
      );

      await expect(approval).resolves.toBeUndefined();
      expect(await edit).toEqual({ ok: true, data: { id: venueId, flagged: 1 } });

      expect(
        await prisma.venue.findUniqueOrThrow({ where: { id: venueId }, select: { capacity: true } }),
      ).toEqual({ capacity: 30 });
      expect(
        await prisma.booking.findUniqueOrThrow({
          where: { id: bookingId },
          select: { status: true, needsReconsideration: true, reconsiderationReason: true },
        }),
      ).toEqual({
        status: "PENDING",
        needsReconsideration: true,
        reconsiderationReason: `${venueName} changed: Capacity 30 < attendance 40`,
      });
      // The aborted attempt wrote nothing: the edit is recorded once.
      expect(
        await prisma.auditLog.count({ where: { entityId: venueId, action: "UPDATED" } }),
      ).toBe(1);
    });

    it("SCRUM-202 [AC2] TC-202-03: an edit and an approval of the same booking at the same moment both end in a defined outcome", async () => {
      const approve = () => {
        mockAuth.mockResolvedValue(VENUE_STAFF);
        return decideBookingRequest({ bookingId, decision: "APPROVED" });
      };
      const [edited, decided] = await Promise.allSettled([lowerCapacity(), approve()]);

      // Neither throws: each is saved, or refused with a reason.
      expect(edited).toEqual({
        status: "fulfilled",
        value: { ok: true, data: { id: venueId, flagged: 1 } },
      });
      expect(decided.status).toBe("fulfilled");
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: { status: true, needsReconsideration: true },
      });
      // Whichever went first, the booking ends flagged: approved and then
      // flagged, or flagged first, when the approval is refused (SCRUM-26 AC5).
      expect(booking.needsReconsideration).toBe(true);
      expect((decided as PromiseFulfilledResult<{ ok: boolean }>).value.ok).toBe(
        booking.status === "APPROVED",
      );
    });
  },
);
