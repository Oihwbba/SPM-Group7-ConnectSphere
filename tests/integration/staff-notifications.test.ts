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
import { submitEventRequest } from "@/app/(app)/events/actions";
import { requestSafetyCheck } from "@/app/(app)/events/safety-check-actions";
import { recordSafetyCheckOutcome } from "@/app/(app)/safety-checks/actions";

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
        select: {
          userId: true,
          title: true,
          link: true,
          user: { select: { role: true, additionalRoles: true } },
        },
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
      // SCRUM-121: held as the primary role or an additional one.
      expect(
        rows.every((r) => r.user.role === role || r.user.additionalRoles.includes(role)),
      ).toBe(true);
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
      // SCRUM-201: its own pool, never another suite's throwaway equipment.
      equipmentId = (
        await prisma.equipment.create({
          data: { type: `Staff notice equipment ${STAMP}`, totalQuantity: 5 },
          select: { id: true },
        })
      ).id;
    });

    beforeEach(clear);

    afterAll(async () => {
      await clear();
      await prisma.venue.delete({ where: { id: venueId } });
      await prisma.equipment.delete({ where: { id: equipmentId } });
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

    it("SCRUM-124 [AC10, AC12, AC14] TC-124-10: a submitted request tells every Lead once that it waits in the Unassigned queue, and opens it there", async () => {
      mockAuth.mockResolvedValue(session("usr_organiser", "ORGANISER"));
      const result = await submitEventRequest({
        name: `Staff notice submission ${STAMP}`,
        purpose: "SCRUM-124 AC10",
        description: "A request for the Lead's queue.",
        startAt: "2036-11-03T01:00:00.000Z",
        endAt: "2036-11-03T03:00:00.000Z",
        expectedAttendance: 20,
        venueRequirements: "A room",
        accessibilityNeeds: "None",
        preferredLayout: "Classroom",
        equipmentRequirements: "None",
        registrationRequired: "no",
        registrationNotes: "",
      });
      if (!result.ok) throw new Error(result.error);
      const eventId = result.data.id;
      try {
        await expectOncePerPerson(
          eventId,
          "REQUEST_AWAITING_ASSIGNMENT",
          "COORDINATOR_LEAD",
          "usr_coordinatorlead",
        );
        mockAuth.mockResolvedValue(session("usr_coordinatorlead", "COORDINATOR_LEAD"));
        const mine = (await getMyNotifications()).filter((n) =>
          n.message.includes(`Staff notice submission ${STAMP}`),
        );
        expect(mine.map((n) => [n.title, n.href])).toEqual([
          ["A request is waiting to be assigned", `/queue/${eventId}`],
        ]);
      } finally {
        await prisma.notification.deleteMany({ where: { eventId } });
        await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
        await prisma.event.delete({ where: { id: eventId } });
      }
    });

    it("SCRUM-124 [AC8, AC11, AC14] TC-124-08, TC-124-11: a safety check's Changes requested flags the booking, and tells its Coordinator and each Venue Staff member once", async () => {
      const { id: eventId } = await prisma.event.create({
        data: {
          name: `Staff notice safety check ${STAMP}`,
          status: "PLANNING",
          organiserId: "usr_organiser",
          coordinatorId: COORDINATOR_ID,
          expectedAttendance: 40,
          noEquipmentNeededAt: new Date(),
          noEquipmentNeededById: COORDINATOR_ID,
          startAt: new Date("2036-11-04T01:00:00.000Z"),
          endAt: new Date("2036-11-04T03:00:00.000Z"),
        },
        select: { id: true },
      });
      try {
        const { id: bookingId } = await prisma.booking.create({
          data: {
            eventId,
            venueId,
            startAt: new Date("2036-11-04T01:00:00.000Z"),
            endAt: new Date("2036-11-04T03:00:00.000Z"),
            status: "APPROVED",
            requestedAttendance: 40,
            requestedById: COORDINATOR_ID,
            decidedById: "usr_venuestaff",
            decidedAt: new Date(),
          },
          select: { id: true },
        });
        mockAuth.mockResolvedValue(COORDINATOR);
        const requested = await requestSafetyCheck({ eventId });
        if (!requested.ok) throw new Error(requested.error);
        // AC11: every Safety Officer, once.
        await expectOncePerPerson(eventId, "SAFETY_CHECK_REQUESTED", "SAFETY_OFFICER", "usr_safetyofficer");
        // SCRUM-48 AC5, TC-48-08: in the officer's own list, it opens the check.
        mockAuth.mockResolvedValue(session("usr_safetyofficer", "SAFETY_OFFICER"));
        expect(
          (await getMyNotifications())
            .filter((n) => n.title === "Safety check requested" && n.message.includes(`Staff notice safety check ${STAMP}`))
            .map((n) => n.href),
        ).toEqual([`/safety-checks/${requested.data.checkId}`]);

        mockAuth.mockResolvedValue(session("usr_safetyofficer", "SAFETY_OFFICER"));
        expect(
          await recordSafetyCheckOutcome({
            checkId: requested.data.checkId,
            outcome: "CHANGES_REQUESTED",
            note: "Move the stage away from the east exit.",
            bookingIds: [bookingId],
          }),
        ).toMatchObject({ ok: true });

        // AC8: the flag tells its Coordinator, with the reason, and each
        // member of Venue Staff. AC11: the Coordinator also has the outcome.
        const flagged = await notices(eventId, "ARRANGEMENT_FLAGGED");
        expect(
          flagged.filter((n) => n.userId === COORDINATOR_ID).map((n) => n.title),
        ).toEqual(["Arrangements flagged for reconsideration"]);
        const staff = flagged.filter((n) => n.user.role === "VENUE_STAFF").map((n) => n.userId);
        expect(staff).toContain("usr_venuestaff");
        expect(new Set(staff).size).toBe(staff.length);
        expect(
          await prisma.notification.findMany({
            where: { eventId, type: "SAFETY_CHECK_OUTCOME" },
            select: { userId: true, message: true },
          }),
        ).toEqual([
          {
            userId: COORDINATOR_ID,
            message: expect.stringContaining("Move the stage away from the east exit."),
          },
        ]);
      } finally {
        const checks = await prisma.safetyCheck.findMany({ where: { eventId }, select: { id: true } });
        const bookings = await prisma.booking.findMany({ where: { eventId }, select: { id: true } });
        await prisma.notification.deleteMany({ where: { eventId } });
        await prisma.auditLog.deleteMany({
          where: { entityId: { in: [eventId, ...checks.map((c) => c.id), ...bookings.map((b) => b.id)] } },
        });
        await prisma.safetyCheck.deleteMany({ where: { eventId } });
        await prisma.booking.deleteMany({ where: { eventId } });
        await prisma.event.delete({ where: { id: eventId } });
      }
    });
  },
);
