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
import {
  decideBookingRequest,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";
import {
  getBookableEvents,
  getPendingBookingQueue,
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

      it("SCRUM-50 — the form offers only approved events the coordinator may act on, exactly as can() allows", async () => {
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

    describe("SCRUM-52 — review pending booking requests", () => {
      it("SCRUM-52 AC1 & AC2 — the queue lists pending requests with venue, timing, attendance, needs and the requesting coordinator", async () => {
        const submitted = await submitBookingRequest(
          request({ requestNotes: "Stage access from 8am." }),
        );
        if (!submitted.ok) throw new Error(submitted.error);

        const queue = await getPendingBookingQueue();
        const row = queue.find((b) => b.id === submitted.data.booking.id);

        expect(row).toMatchObject({
          startAt: new Date(at(10, 6)),
          endAt: new Date(at(10, 8)),
          requestedAttendance: 40,
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
            capacity: 80,
            facilities: ["projector"],
            supportedLayouts: ["classroom"],
          },
          blockers: [],
        });
      });

      it("SCRUM-52 AC1 — decided requests leave the queue", async () => {
        const approved = await approvedBooking(at(12, 6), at(12, 8));

        const queue = await getPendingBookingQueue();

        expect(queue.map((b) => b.id)).not.toContain(approved.id);
      });

      it("SCRUM-52 AC3 — each request carries the venue's current availability for its period", async () => {
        const submitted = await submitBookingRequest(request());
        if (!submitted.ok) throw new Error(submitted.error);
        // Another request for the slot is approved after this one was made.
        const clash = await approvedBooking(at(10, 7), at(10, 9));

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

      it("SCRUM-53 AC1 & AC2 — rejecting with a reason saves the rejection, the reason, and an audit entry", async () => {
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

      it("SCRUM-53 AC2 — rejecting with a blank reason is refused and the request stays pending", async () => {
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

      it("SCRUM-53 AC2 — the database itself refuses a rejection without a reason", async () => {
        const id = await pending();

        await expect(
          prisma.booking.update({
            where: { id },
            data: { status: "REJECTED", decisionReason: " " },
          }),
        ).rejects.toThrow(/booking_rejection_has_reason/);
      });

      it("SCRUM-53 AC1 & AC3 — approving makes the venue unavailable: a later overlapping request is refused", async () => {
        const id = await pending();

        const result = await decideBookingRequest({
          bookingId: id,
          decision: "APPROVED",
        });
        expect(result).toEqual({ ok: true, data: { status: "APPROVED" } });

        mockAuth.mockResolvedValue(COORDINATOR);
        const later = await submitBookingRequest(
          request({
            eventId: PLANNING_EVENT,
            startAt: at(10, 7),
            endAt: at(10, 9),
          }),
        );
        expect(later.ok).toBe(false);
        if (later.ok) return;
        expect(later.error).toMatch(/already booked/);
      });

      it("SCRUM-53 AC4 — approving a request that overlaps an already-approved booking is returned as conflicting", async () => {
        const first = await pending();
        const second = await pending({
          eventId: PLANNING_EVENT,
          startAt: at(10, 7),
          endAt: at(10, 9),
        });
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

      it("SCRUM-53 AC4 — approving over recorded unavailability is returned as conflicting", async () => {
        const id = await pending();
        await prisma.venueUnavailability.create({
          data: {
            venueId,
            startAt: new Date(at(10, 7)),
            endAt: new Date(at(10, 8)),
            reason: "CLOSURE",
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
          /^Conflicting: .* unavailable \(closure\)/,
        );
      });

      it("SCRUM-53 AC5 — two requests that touch at an endpoint can both be approved", async () => {
        const morning = await pending();
        const afternoon = await pending({
          eventId: PLANNING_EVENT,
          startAt: at(10, 8),
          endAt: at(10, 10),
        });

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

      it("SCRUM-53 AC6 — deciding an already-approved request leaves the approval standing and records no second outcome", async () => {
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

      it("SCRUM-53 AC6 — deciding an already-rejected request leaves the rejection standing", async () => {
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

      it("SCRUM-53 AC6 — an approve and a reject of the same request at the same instant: exactly one outcome is recorded", async () => {
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
