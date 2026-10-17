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
import type { NotificationType, Role } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { eventBookingPeriod } from "@/lib/schemas/booking";
import { flagArrangements } from "@/lib/reconsideration";
import {
  confirmHold,
  decideBookingRequest,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";
import { createEquipmentRequest } from "@/app/(app)/equipment-requests/actions";
import { resolveReconsiderationFlag } from "@/app/(app)/events/reconsideration-actions";
import { getMyNotifications } from "@/app/(app)/notifications/queries";

// SCRUM-124 against a real, seeded Postgres: each trigger writes exactly one
// notice for each person it concerns, even when the same action arrives twice
// at the same moment (AC14), and the notices land in the same list as every
// other (AC15). Test cases: docs/testing/SCRUM-124.md. Only the session is
// mocked. These write their own events, venue, bookings and requests, so they
// only run on a localhost database. Other suites run alongside and may add a
// Venue Staff member of their own for a while, so the checks are per person
// ("once each, and the seeded member among them"), not a fixed total.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const session = (id: string, role: Role): Session => ({
  user: { id, role, name: id, email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
// The second seeded Coordinator, as tests/integration/holds.test.ts explains.
const COORDINATOR_ID = "usr_coordinator_2";
const COORDINATOR = session(COORDINATOR_ID, "COORDINATOR");
const VENUE_STAFF = session("usr_venuestaff", "VENUE_STAFF");
const STAMP = Date.now();
const HOUR = 60 * 60 * 1000;
const fromNow = (ms: number) => new Date(Date.now() + ms);

describe.skipIf(!usesLocalDatabase)(
  "staff and arrangement notifications — real database (SCRUM-124)",
  () => {
    let venueId: string;
    let eventIds: string[];
    let equipmentId: string;
    let period: { startAt: Date; endAt: Date };

    const notices = (eventId: string, type: NotificationType) =>
      prisma.notification.findMany({
        where: { eventId, type },
        select: { userId: true, title: true, link: true, user: { select: { role: true } } },
      });

    /**
     * AC13, AC14: every notice went to someone with `role`, nobody got two,
     * and the seeded member of the role got theirs.
     */
    async function expectOncePerPerson(
      eventId: string,
      type: NotificationType,
      role: Role,
      seeded: string,
    ) {
      const rows = await notices(eventId, type);
      const users = rows.map((r) => r.userId);
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(users).size).toBe(users.length);
      expect(users).toContain(seeded);
      expect(rows.every((r) => r.user.role === role)).toBe(true);
      return rows;
    }

    const pending = (eventId: string) =>
      prisma.booking.create({
        data: {
          eventId,
          venueId,
          ...period,
          status: "PENDING",
          requestedAttendance: 40,
          requestedById: COORDINATOR_ID,
        },
        select: { id: true },
      });

    async function clear() {
      const bookingIds = (
        await prisma.booking.findMany({ where: { venueId }, select: { id: true } })
      ).map((b) => b.id);
      await prisma.notification.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: [...bookingIds, ...eventIds] } },
      });
      await prisma.booking.deleteMany({ where: { venueId } });
      const requests = { request: { eventId: { in: eventIds } } };
      await prisma.equipmentRequestUpdate.deleteMany({ where: requests });
      await prisma.equipmentRequestLine.deleteMany({ where: requests });
      await prisma.equipmentRequest.deleteMany({ where: { eventId: { in: eventIds } } });
    }

    beforeAll(async () => {
      const start = new Date(Date.UTC(2035, 7, 6, 2));
      const row = {
        startAt: start,
        endAt: new Date(start.getTime() + 4 * HOUR),
        expectedAttendance: 40,
      };
      eventIds = [];
      for (const n of [1, 2]) {
        const event = await prisma.event.create({
          data: {
            name: `Staff notice event ${n} ${STAMP}`,
            status: "PLANNING",
            organiserId: "usr_organiser",
            coordinatorId: COORDINATOR_ID,
            ...row,
          },
          select: { id: true },
        });
        eventIds.push(event.id);
      }
      period = eventBookingPeriod(row)!;
      venueId = (
        await prisma.venue.create({
          data: {
            name: `Staff notice venue ${STAMP}`,
            location: "Test block",
            capacity: 500,
          },
        })
      ).id;
      equipmentId = (
        await prisma.equipment.findFirstOrThrow({
          where: { isActive: true },
          select: { id: true },
          orderBy: { id: "asc" },
        })
      ).id;
    });

    beforeEach(clear);

    afterAll(async () => {
      await clear();
      await prisma.venue.delete({ where: { id: venueId } });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    });

    it("SCRUM-124 [AC1, AC13, AC15] TC-124-01: a venue request tells every Venue Staff member once, in their own notification list", async () => {
      mockAuth.mockResolvedValue(COORDINATOR);

      const result = await submitBookingRequest({
        eventId: eventIds[0],
        venueId,
        startAt: period.startAt.toISOString(),
        endAt: period.endAt.toISOString(),
        requestedAttendance: 40,
        requiredFacilities: [],
      });
      expect(result).toMatchObject({ ok: true, data: { created: true } });

      await expectOncePerPerson(eventIds[0], "BOOKING_REQUESTED", "VENUE_STAFF", "usr_venuestaff");
      mockAuth.mockResolvedValue(VENUE_STAFF);
      const mine = (await getMyNotifications()).filter(
        (n) => n.title === "A venue was requested" && n.message.includes(`Staff notice event 1 ${STAMP}`),
      );
      expect(mine).toHaveLength(1);
      expect(mine[0].href).toBe("/bookings");
    });

    it("SCRUM-124 [AC1, AC14] TC-124-01: the same request sent twice at the same moment makes one booking and tells each Venue Staff member once", async () => {
      mockAuth.mockResolvedValue(COORDINATOR);
      const request = {
        eventId: eventIds[0],
        venueId,
        startAt: period.startAt.toISOString(),
        endAt: period.endAt.toISOString(),
        requestedAttendance: 40,
        requiredFacilities: [],
      };

      const results = await Promise.all([
        submitBookingRequest(request),
        submitBookingRequest(request),
      ]);

      expect(results.every((r) => r.ok)).toBe(true);
      expect(await prisma.booking.count({ where: { eventId: eventIds[0] } })).toBe(1);
      await expectOncePerPerson(eventIds[0], "BOOKING_REQUESTED", "VENUE_STAFF", "usr_venuestaff");
    });

    it("SCRUM-124 [AC2, AC14] TC-124-02: the same equipment request sent twice at the same moment tells each Technical Support member once", async () => {
      mockAuth.mockResolvedValue(COORDINATOR);
      const request = {
        eventId: eventIds[0],
        notes: "",
        lines: [{ equipmentId, quantity: "1", technicalRequirements: "" }],
      };

      const results = await Promise.all([
        createEquipmentRequest(request),
        createEquipmentRequest(request),
      ]);

      expect(results.every((r) => r.ok)).toBe(true);
      expect(await prisma.equipmentRequest.count({ where: { eventId: eventIds[0] } })).toBe(1);
      await expectOncePerPerson(
        eventIds[0],
        "EQUIPMENT_REQUEST_SUBMITTED",
        "TECH_SUPPORT",
        "usr_techsupport",
      );
    });

    it("SCRUM-124 [AC4, AC14] TC-124-04: two approvals of the same request at the same moment tell the Coordinator once", async () => {
      const { id } = await pending(eventIds[0]);
      mockAuth.mockResolvedValue(VENUE_STAFF);

      const results = await Promise.all([
        decideBookingRequest({ bookingId: id, decision: "APPROVED" }),
        decideBookingRequest({ bookingId: id, decision: "APPROVED" }),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const sent = await notices(eventIds[0], "BOOKING_DECISION");
      expect(sent.map((n) => [n.userId, n.title])).toEqual([
        [COORDINATOR_ID, "Your venue request was approved"],
      ]);
    });

    it("SCRUM-124 [AC6, AC13] TC-124-06: confirming a hold tells every Venue Staff member once, linking to their queue", async () => {
      const { id } = await prisma.booking.create({
        data: {
          eventId: eventIds[0],
          venueId,
          ...period,
          status: "HELD",
          requestedAttendance: 40,
          requestedById: COORDINATOR_ID,
          heldAt: fromNow(-2 * HOUR),
          holdExpiresAt: fromNow(48 * HOUR),
          holdNote: "Confirm numbers.",
          holdApprovedAt: fromNow(-HOUR),
          holdApprovedById: "usr_venuestaff",
        },
        select: { id: true },
      });
      mockAuth.mockResolvedValue(COORDINATOR);

      expect(await confirmHold({ bookingId: id })).toEqual({
        ok: true,
        data: { status: "APPROVED" },
      });

      const rows = await expectOncePerPerson(eventIds[0], "HOLD_CONFIRMED", "VENUE_STAFF", "usr_venuestaff");
      expect(rows.every((r) => r.link === "/bookings")).toBe(true);
    });

    it("SCRUM-124 [AC8, AC14] TC-124-08: flagging an arrangement twice tells its Coordinator and each Venue Staff member once", async () => {
      await prisma.booking.update({
        where: { id: (await pending(eventIds[1])).id },
        data: { status: "APPROVED", decidedAt: new Date(), decidedById: "usr_venuestaff" },
      });
      const flag = () =>
        prisma.$transaction((tx) =>
          flagArrangements(tx, { eventId: eventIds[1] }, "The event's expected attendance changed."),
        );

      expect(await flag()).toEqual({ bookings: 1, reservations: 0 });
      expect(await flag()).toEqual({ bookings: 0, reservations: 0 });

      const rows = await notices(eventIds[1], "ARRANGEMENT_FLAGGED");
      expect(rows.filter((r) => r.userId === COORDINATOR_ID)).toHaveLength(1);
      await expect(
        prisma.notification.count({
          where: { eventId: eventIds[1], type: "ARRANGEMENT_FLAGGED", userId: "usr_venuestaff" },
        }),
      ).resolves.toBe(1);
    });

    it("SCRUM-124 [AC9, AC14] TC-124-09: two cancellations of a flagged booking at the same moment tell each Venue Staff member once", async () => {
      const { id } = await pending(eventIds[1]);
      await prisma.$transaction((tx) =>
        flagArrangements(tx, { bookingIds: [id], reservationIds: [] }, "The event moved."),
      );
      mockAuth.mockResolvedValue(COORDINATOR);

      const results = await Promise.all([
        resolveReconsiderationFlag({ kind: "booking", id, decision: "CANCEL" }),
        resolveReconsiderationFlag({ kind: "booking", id, decision: "CANCEL" }),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const rows = await expectOncePerPerson(
        eventIds[1],
        "ARRANGEMENT_FLAG_RESOLVED",
        "VENUE_STAFF",
        "usr_venuestaff",
      );
      expect(rows[0].title).toBe("A flagged booking was cancelled");
    });
  },
);
