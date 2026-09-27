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
import { submitBookingRequest } from "@/app/(app)/bookings/actions";

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

// Seeded events assigned to usr_coordinator (prisma/seed.ts).
const APPROVED_EVENT = "evt_approved";
const PLANNING_EVENT = "evt_planning";

/** A UTC instant on a far-future day, so nothing seeded is anywhere near. */
const at = (day: number, hour: number) =>
  new Date(Date.UTC(2032, 0, day, hour)).toISOString();

describe.skipIf(!usesLocalDatabase)(
  "venue booking flow — real database",
  () => {
    let venueId: string;

    const request = (overrides: Record<string, unknown> = {}) => ({
      eventId: APPROVED_EVENT,
      venueId,
      startAt: at(10, 6),
      endAt: at(10, 8),
      requestedAttendance: 40,
      requiredFacilities: ["projector"],
      requestedLayout: "classroom",
      ...overrides,
    });

    /** An existing APPROVED booking to collide with, written directly. */
    async function approvedBooking(startAt: string, endAt: string) {
      return prisma.booking.create({
        data: {
          eventId: PLANNING_EVENT,
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

    beforeAll(async () => {
      const venue = await prisma.venue.create({
        data: {
          name: `Booking test venue ${Date.now()}`,
          location: "Test block",
          capacity: 80,
          facilities: ["projector"],
          supportedLayouts: ["classroom"],
        },
      });
      venueId = venue.id;
    });

    beforeEach(async () => {
      mockAuth.mockResolvedValue(COORDINATOR);
      const ids = await prisma.booking.findMany({
        where: { venueId },
        select: { id: true },
      });
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "Booking",
          entityId: { in: ids.map((b) => b.id) },
        },
      });
      await prisma.booking.deleteMany({ where: { venueId } });
      await prisma.venueUnavailability.deleteMany({ where: { venueId } });
    });

    afterAll(async () => {
      const ids = await prisma.booking.findMany({
        where: { venueId },
        select: { id: true },
      });
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "Booking",
          entityId: { in: ids.map((b) => b.id) },
        },
      });
      await prisma.booking.deleteMany({ where: { venueId } });
      await prisma.venue.delete({ where: { id: venueId } });
    });

    describe("SCRUM-50 — submit a venue booking request", () => {
      it("SCRUM-50 AC1 & AC2 — a request for a free period is created PENDING with everything the staff need", async () => {
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
          eventId: APPROVED_EVENT,
          venueId,
          startAt: new Date(at(10, 6)),
          endAt: new Date(at(10, 8)),
          status: "PENDING",
          requestedAttendance: 40,
          requiredFacilities: ["projector"],
          requestedLayout: "classroom",
          requestNotes: "Needs a lectern.",
          requestedById: "usr_coordinator",
        });
      });

      it("SCRUM-50 AC3 — a request overlapping an approved booking is refused and nothing is written", async () => {
        await approvedBooking(at(10, 7), at(10, 9));
        const before = await bookingCount();

        const result = await submitBookingRequest(request());

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/is unavailable for that period/);
        expect(await bookingCount()).toBe(before);
      });

      it("SCRUM-50 AC3 — a request overlapping recorded unavailability (maintenance) is refused", async () => {
        await prisma.venueUnavailability.create({
          data: {
            venueId,
            startAt: new Date(at(10, 5)),
            endAt: new Date(at(10, 12)),
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

      it("SCRUM-50 AC3 — a PENDING request by someone else does not block a new request", async () => {
        await submitBookingRequest(request({ eventId: PLANNING_EVENT }));

        const result = await submitBookingRequest(request());

        expect(result.ok && result.data.created).toBe(true);
        expect(await bookingCount()).toBe(2);
      });

      it("SCRUM-50 AC4 — a period beginning exactly as an approved booking ends is accepted", async () => {
        await approvedBooking(at(10, 4), at(10, 6));

        const result = await submitBookingRequest(request());

        expect(result.ok && result.data.created).toBe(true);
      });

      it("SCRUM-50 AC4 — a period ending exactly as an approved booking begins is accepted", async () => {
        await approvedBooking(at(10, 8), at(10, 10));

        const result = await submitBookingRequest(request());

        expect(result.ok && result.data.created).toBe(true);
      });

      it("SCRUM-50 AC5 — an end before the start is refused as an invalid period", async () => {
        const result = await submitBookingRequest(
          request({ startAt: at(10, 8), endAt: at(10, 6) }),
        );

        expect(result).toMatchObject({
          ok: false,
          error:
            "The requested period is invalid: the end must be after the start.",
        });
        expect(await bookingCount()).toBe(0);
      });

      it("SCRUM-50 AC5 — an end equal to the start is refused as an invalid period", async () => {
        const result = await submitBookingRequest(
          request({ startAt: at(10, 6), endAt: at(10, 6) }),
        );

        expect(result).toMatchObject({
          ok: false,
          error:
            "The requested period is invalid: the end must be after the start.",
        });
        expect(await bookingCount()).toBe(0);
      });

      it("SCRUM-50 AC6 — submitting the same request twice leaves one request and shows the existing one", async () => {
        const first = await submitBookingRequest(request());
        const second = await submitBookingRequest(request());

        expect(first.ok && first.data.created).toBe(true);
        expect(second.ok && second.data.created).toBe(false);
        if (!first.ok || !second.ok) return;
        expect(second.data.booking.id).toBe(first.data.booking.id);
        expect(await bookingCount()).toBe(1);
      });

      it("SCRUM-50 AC6 — two identical requests submitted at the same instant still leave one", async () => {
        const results = await Promise.all([
          submitBookingRequest(request()),
          submitBookingRequest(request()),
        ]);

        expect(results.every((r) => r.ok)).toBe(true);
        const ids = new Set(results.map((r) => r.ok && r.data.booking.id));
        expect(ids.size).toBe(1);
        expect(await bookingCount()).toBe(1);
      });

      it("SCRUM-50 AC6 — a pending request for a different, non-overlapping period is a new request", async () => {
        await submitBookingRequest(request());
        const later = await submitBookingRequest(
          request({ startAt: at(10, 8), endAt: at(10, 10) }),
        );

        expect(later.ok && later.data.created).toBe(true);
        expect(await bookingCount()).toBe(2);
      });
    });
  },
);
