import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Prisma, type BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-172 against a real Postgres: the columns, tables and booking rules the
// Week 7 migration adds, written directly as the stories that build on it
// will write them. No action exists for most of these yet; the database is
// what is under test. Expected values come from the criteria, and SCRUM-159
// AC4's own example (10:00–12:00 with 30 and 45 minutes) is used as written.
//
// These WRITE (a throwaway venue, events and their rows, removed afterwards),
// so they only run against a localhost database.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

/** A UTC instant on a far-future day, clear of anything seeded. */
const at = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2037, 2, day, hour, minute));

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-172 — Week 7 schema and booking rules",
  () => {
    let venueId: string;
    let otherVenueId: string;
    let eventIds: string[];
    let reservationEventId: string;

    type BookingInput = {
      event?: number;
      venue?: string;
      start: Date;
      end: Date;
      status?: BookingStatus;
      setup?: number;
      turnaround?: number;
      hold?: { heldAt: Date; expiresAt: Date; note?: string | null };
      reason?: string;
    };

    const booking = ({
      event = 0,
      venue = venueId,
      start,
      end,
      status = "APPROVED",
      setup = 0,
      turnaround = 0,
      hold,
      reason,
    }: BookingInput) =>
      prisma.booking.create({
        data: {
          eventId: eventIds[event],
          venueId: venue,
          startAt: start,
          endAt: end,
          status,
          setupMinutes: setup,
          turnaroundMinutes: turnaround,
          requestedById: "usr_coordinator",
          decisionReason: reason,
          ...(hold && {
            heldAt: hold.heldAt,
            holdExpiresAt: hold.expiresAt,
            holdNote:
              hold.note === undefined ? "Confirm the AV needs." : hold.note,
          }),
        },
      });

    /** A hold placed now that expires well before `start`. */
    const liveHold = (start: Date) => ({
      heldAt: new Date(),
      expiresAt: new Date(start.getTime() - 60 * 60 * 1000),
    });

    const unavailability = (start: Date, end: Date) =>
      prisma.venueUnavailability.create({
        data: {
          venueId,
          startAt: start,
          endAt: end,
          recordedById: "usr_venuestaff",
        },
      });

    async function clear() {
      const where = { venueId: { in: [venueId, otherVenueId] } };
      const bookings = (
        await prisma.booking.findMany({ where, select: { id: true } })
      ).map((b) => b.id);
      await prisma.notification.deleteMany({
        where: { bookingId: { in: bookings } },
      });
      await prisma.safetyCheck.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await prisma.booking.deleteMany({ where });
      await prisma.venueUnavailability.deleteMany({ where });
      await prisma.reservation.deleteMany({
        where: { eventId: reservationEventId },
      });
      await prisma.event.updateMany({
        where: { id: { in: eventIds } },
        data: { noEquipmentNeededAt: null, noEquipmentNeededById: null },
      });
    }

    beforeAll(async () => {
      const period = { startAt: at(1, 9), endAt: at(1, 12) };
      eventIds = await createPlanningEvents("Week 7 rules event", [
        period,
        period,
        period,
      ]);
      [reservationEventId] = await createPlanningEvents(
        "Week 7 reservation event",
        [period],
      );
      const venue = (name: string) =>
        prisma.venue.create({
          data: {
            name: `${name} ${Date.now()}`,
            location: "Test block",
            capacity: 200,
          },
        });
      venueId = (await venue("Week 7 test venue")).id;
      otherVenueId = (await venue("Week 7 second venue")).id;
    });

    beforeEach(clear);

    afterAll(async () => {
      await clear();
      await removeEvents([...eventIds, reservationEventId]);
      await prisma.venue.deleteMany({
        where: { id: { in: [venueId, otherVenueId] } },
      });
    });

    describe("AC1 — roles", () => {
      it("SCRUM-172 [AC1] TC-172-01: users can hold the Event Coordinator Lead and Safety Officer roles", async () => {
        const labels = await prisma.$queryRaw<{ label: string }[]>`
        SELECT e.enumlabel::text AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'Role' ORDER BY e.enumsortorder`;

        expect(labels.map((row) => row.label)).toEqual([
          "ORGANISER",
          "COORDINATOR",
          "VENUE_STAFF",
          "TECH_SUPPORT",
          "ATTENDEE",
          "COORDINATOR_LEAD",
          "SAFETY_OFFICER",
        ]);
      });
    });

    describe("AC2 — venue setup and turnaround time, and known restrictions", () => {
      it("SCRUM-172 [AC2] TC-172-02: a new venue starts at 0 and 0 minutes with no restrictions, and keeps the restrictions it is given", async () => {
        const venue = await prisma.venue.findUniqueOrThrow({
          where: { id: venueId },
        });
        expect(venue).toMatchObject({
          setupMinutes: 0,
          turnaroundMinutes: 0,
          knownRestrictions: null,
        });

        const updated = await prisma.venue.update({
          where: { id: venueId },
          data: { knownRestrictions: "One emergency exit." },
        });
        expect(updated.knownRestrictions).toBe("One emergency exit.");
        await prisma.venue.update({
          where: { id: venueId },
          data: { knownRestrictions: null },
        });
      });

      it("SCRUM-172 [AC2] TC-172-02: setup and turnaround accept 0 to 1,440 minutes and refuse one either side", async () => {
        for (const minutes of [0, 1440]) {
          await expect(
            prisma.venue.update({
              where: { id: venueId },
              data: { setupMinutes: minutes, turnaroundMinutes: minutes },
            }),
          ).resolves.toBeDefined();
        }
        for (const data of [
          { setupMinutes: -1 },
          { setupMinutes: 1441 },
          { turnaroundMinutes: -1 },
          { turnaroundMinutes: 1441 },
        ]) {
          await expect(
            prisma.venue.update({ where: { id: venueId }, data }),
          ).rejects.toThrow(/venue_setup_turnaround_range/);
        }
        await prisma.venue.update({
          where: { id: venueId },
          data: { setupMinutes: 0, turnaroundMinutes: 0 },
        });
      });
    });

    describe("AC3 — Held and Expired bookings, and a booking's own minutes", () => {
      it("SCRUM-172 [AC3] TC-172-03: a booking starts with 0 and 0 minutes, and its minutes are refused outside 0 to 1,440", async () => {
        const row = await booking({
          start: at(2, 10),
          end: at(2, 12),
          status: "PENDING",
        });
        expect(row).toMatchObject({ setupMinutes: 0, turnaroundMinutes: 0 });

        for (const minutes of [-1, 1441]) {
          await expect(
            booking({
              event: 1,
              start: at(2, 10),
              end: at(2, 12),
              status: "PENDING",
              setup: minutes,
            }),
          ).rejects.toThrow(/booking_setup_turnaround_range/);
          await expect(
            booking({
              event: 1,
              start: at(2, 10),
              end: at(2, 12),
              status: "PENDING",
              turnaround: minutes,
            }),
          ).rejects.toThrow(/booking_setup_turnaround_range/);
        }
      });

      it("SCRUM-172 [AC3] TC-172-03: a Held booking is saved with its expiry and note", async () => {
        const start = at(3, 10);
        const row = await booking({
          start,
          end: at(3, 12),
          status: "HELD",
          hold: liveHold(start),
        });

        expect(row).toMatchObject({
          status: "HELD",
          holdExpiresAt: new Date(start.getTime() - 60 * 60 * 1000),
          holdNote: "Confirm the AV needs.",
        });
      });

      it("SCRUM-172 [AC3] TC-172-03: a Held or Expired booking without an expiry or a note is refused", async () => {
        const start = at(3, 10);
        for (const status of ["HELD", "EXPIRED"] as const) {
          await expect(
            booking({ start, end: at(3, 12), status }),
          ).rejects.toThrow(/booking_hold_complete/);
          for (const note of [null, "   "]) {
            await expect(
              booking({
                start,
                end: at(3, 12),
                status,
                hold: { ...liveHold(start), note },
              }),
            ).rejects.toThrow(/booking_hold_complete/);
          }
        }
        expect(await prisma.booking.count({ where: { venueId } })).toBe(0);
      });

      it("SCRUM-172 [AC3] TC-172-03: a hold must expire after it was placed and before the booking starts", async () => {
        const start = at(4, 10);
        const heldAt = at(1, 0);
        const refused = [
          { heldAt, expiresAt: start }, // at the start
          { heldAt, expiresAt: at(4, 11) }, // after the start
          { heldAt, expiresAt: heldAt }, // when it was placed
        ];
        for (const hold of refused) {
          await expect(
            booking({ start, end: at(4, 12), status: "HELD", hold }),
          ).rejects.toThrow(/booking_hold_period_valid/);
        }

        await expect(
          booking({
            start,
            end: at(4, 12),
            status: "HELD",
            hold: { heldAt, expiresAt: new Date(start.getTime() - 60 * 1000) },
          }),
        ).resolves.toMatchObject({ status: "HELD" });
      });
    });

    describe("AC4 — Needs Reconsideration flag fields", () => {
      const reservation = (data: Prisma.ReservationUncheckedCreateInput) =>
        prisma.reservation.create({ data });
      const reserved = {
        eventId: "",
        equipmentId: "eqp_lectern",
        quantity: 1,
        startAt: at(1, 9),
        endAt: at(1, 12),
        reservedById: "usr_techsupport",
      };

      it("SCRUM-172 [AC4] TC-172-04: a flagged booking or reservation must say why and when", async () => {
        const row = await booking({ start: at(5, 10), end: at(5, 12) });
        for (const data of [
          { needsReconsideration: true, reconsiderationFlaggedAt: new Date() },
          {
            needsReconsideration: true,
            reconsiderationReason: "Venue unavailable.",
          },
          {
            needsReconsideration: true,
            reconsiderationFlaggedAt: new Date(),
            reconsiderationReason: " ",
          },
        ]) {
          await expect(
            prisma.booking.update({ where: { id: row.id }, data }),
          ).rejects.toThrow(/booking_flag_has_reason/);
          await expect(
            reservation({ ...reserved, eventId: reservationEventId, ...data }),
          ).rejects.toThrow(/reservation_flag_has_reason/);
        }
      });

      it("SCRUM-172 [AC4] TC-172-04: a flag is saved with its reason, and resolved with who and when", async () => {
        const flaggedAt = at(1, 1);
        const resolvedAt = at(1, 2);
        const row = await booking({ start: at(5, 10), end: at(5, 12) });

        const flagged = await prisma.booking.update({
          where: { id: row.id },
          data: {
            needsReconsideration: true,
            reconsiderationFlaggedAt: flaggedAt,
            reconsiderationReason: "Grand Hall closed for repairs.",
          },
        });
        expect(flagged).toMatchObject({
          status: "APPROVED",
          needsReconsideration: true,
          reconsiderationReason: "Grand Hall closed for repairs.",
        });

        const resolved = await prisma.booking.update({
          where: { id: row.id },
          data: {
            needsReconsideration: false,
            reconsiderationResolvedAt: resolvedAt,
            reconsiderationResolvedById: "usr_coordinator",
          },
        });
        expect(resolved).toMatchObject({
          reconsiderationFlaggedAt: flaggedAt,
          reconsiderationResolvedAt: resolvedAt,
          reconsiderationResolvedById: "usr_coordinator",
        });

        const res = await reservation({
          ...reserved,
          eventId: reservationEventId,
          needsReconsideration: true,
          reconsiderationFlaggedAt: flaggedAt,
          reconsiderationReason: "Projector can't be provided.",
          reconsiderationResolvedAt: resolvedAt,
          reconsiderationResolvedById: "usr_coordinator",
        });
        expect(res.reconsiderationReason).toBe("Projector can't be provided.");
      });

      it("SCRUM-172 [AC4] TC-172-04: a resolution needs both who and when", async () => {
        const row = await booking({ start: at(5, 10), end: at(5, 12) });
        for (const data of [
          { reconsiderationResolvedAt: new Date() },
          { reconsiderationResolvedById: "usr_coordinator" },
        ]) {
          await expect(
            prisma.booking.update({ where: { id: row.id }, data }),
          ).rejects.toThrow(/booking_flag_resolution_complete/);
          await expect(
            reservation({ ...reserved, eventId: reservationEventId, ...data }),
          ).rejects.toThrow(/reservation_flag_resolution_complete/);
        }
      });
    });

    describe("AC6 — the safety check", () => {
      const check = (
        data: Partial<Prisma.SafetyCheckUncheckedCreateInput> = {},
      ) =>
        prisma.safetyCheck.create({
          data: {
            eventId: eventIds[0],
            requestedById: "usr_coordinator",
            ...data,
          },
        });
      const decided = { decidedById: "usr_venuestaff", decidedAt: new Date() };

      it("SCRUM-172 [AC6] TC-172-06: a requested check awaits review, and each outcome is saved with who and when", async () => {
        const awaiting = await check();
        expect(awaiting.status).toBe("AWAITING_REVIEW");

        const approved = await prisma.safetyCheck.update({
          where: { id: awaiting.id },
          data: { status: "APPROVED", ...decided },
        });
        expect(approved).toMatchObject({
          status: "APPROVED",
          decidedById: "usr_venuestaff",
        });

        const rejected = await check({
          status: "REJECTED",
          note: "Exit blocked.",
          ...decided,
        });
        expect(rejected.note).toBe("Exit blocked.");
      });

      it("SCRUM-172 [AC6] TC-172-06: Changes requested and Rejected need a note; Approved does not", async () => {
        for (const status of ["CHANGES_REQUESTED", "REJECTED"] as const) {
          for (const note of [undefined, "  "]) {
            await expect(check({ status, note, ...decided })).rejects.toThrow(
              /safety_check_note_required/,
            );
          }
        }
        await expect(
          check({ status: "APPROVED", ...decided }),
        ).resolves.toBeDefined();
      });

      it("SCRUM-172 [AC6] TC-172-06: an outcome without who recorded it, or when, is refused", async () => {
        for (const status of [
          "APPROVED",
          "CHANGES_REQUESTED",
          "REJECTED",
        ] as const) {
          for (const missing of [
            { decidedById: "usr_venuestaff" },
            { decidedAt: new Date() },
          ]) {
            await expect(
              check({ status, note: "See notes.", ...missing }),
            ).rejects.toThrow(/safety_check_outcome_recorded/);
          }
        }
        expect(
          await prisma.safetyCheck.count({ where: { eventId: eventIds[0] } }),
        ).toBe(0);
      });

      it("SCRUM-172 [AC6] TC-172-06: an Outdated check records when it went out of date", async () => {
        await expect(check({ status: "OUTDATED" })).rejects.toThrow(
          /safety_check_outdated_has_time/,
        );
        await expect(
          check({ status: "OUTDATED", outdatedAt: new Date() }),
        ).resolves.toBeDefined();
      });

      it("SCRUM-172 [AC6] TC-172-06: an event has at most one check awaiting review, and every check is kept", async () => {
        const first = await check();
        // The partial unique index safety_check_one_awaiting_per_event; Prisma
        // names the column, not the index.
        await expect(check()).rejects.toThrow(
          /Unique constraint failed on the fields: \(`"eventId"`\)/,
        );

        await prisma.safetyCheck.update({
          where: { id: first.id },
          data: {
            status: "CHANGES_REQUESTED",
            note: "Move the stage.",
            ...decided,
          },
        });
        await expect(check()).resolves.toBeDefined();
        await expect(check({ eventId: eventIds[1] })).resolves.toBeDefined();
        expect(
          await prisma.safetyCheck.count({ where: { eventId: eventIds[0] } }),
        ).toBe(2);
      });

      it("SCRUM-172 [AC6] TC-172-06: a picked arrangement is exactly one booking or one reservation, once per check", async () => {
        const row = await booking({ start: at(6, 10), end: at(6, 12) });
        const res = await prisma.reservation.create({
          data: {
            eventId: reservationEventId,
            equipmentId: "eqp_lectern",
            quantity: 1,
            startAt: at(1, 9),
            endAt: at(1, 12),
            reservedById: "usr_techsupport",
          },
        });
        const { id: checkId } = await check({
          status: "CHANGES_REQUESTED",
          note: "Move the stage.",
          ...decided,
          arrangements: {
            create: [{ bookingId: row.id }, { reservationId: res.id }],
          },
        });
        expect(
          await prisma.safetyCheckArrangement.count({ where: { checkId } }),
        ).toBe(2);

        for (const data of [{}, { bookingId: row.id, reservationId: res.id }]) {
          await expect(
            prisma.safetyCheckArrangement.create({
              data: { checkId, ...data },
            }),
          ).rejects.toThrow(/safety_check_arrangement_one_target/);
        }
        await expect(
          prisma.safetyCheckArrangement.create({
            data: { checkId, bookingId: row.id },
          }),
        ).rejects.toThrow(/Unique constraint/);
      });
    });

    describe("AC7 — notifications", () => {
      it("SCRUM-172 [AC7] TC-172-07: a notification shows at once unless given a later show-from time, and can name its booking", async () => {
        const start = at(7, 10);
        const hold = await booking({
          start,
          end: at(7, 12),
          status: "HELD",
          hold: liveHold(start),
        });
        const before = new Date();

        const now = await prisma.notification.create({
          data: {
            userId: "usr_coordinator",
            type: "BOOKING_HELD",
            title: "Venue held",
            message: "Held until the deadline.",
            bookingId: hold.id,
          },
        });
        const reminder = await prisma.notification.create({
          data: {
            userId: "usr_coordinator",
            type: "HOLD_EXPIRY_REMINDER",
            title: "Hold expiring",
            message: "Confirm within 24 hours.",
            bookingId: hold.id,
            showFromAt: at(6, 9),
          },
        });

        expect(now.showFromAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime() - 1000,
        );
        expect(now.showFromAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
        expect(reminder).toMatchObject({
          showFromAt: at(6, 9),
          withdrawnAt: null,
          bookingId: hold.id,
        });
      });

      it("SCRUM-172 [AC7] TC-172-07: every Week 7 notification type exists", async () => {
        const labels = await prisma.$queryRaw<{ label: string }[]>`
        SELECT e.enumlabel::text AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'NotificationType'`;

        expect(labels.map((row) => row.label)).toEqual(
          expect.arrayContaining([
            "BOOKING_REQUESTED",
            "EQUIPMENT_REQUEST_SUBMITTED",
            "EQUIPMENT_REQUEST_CHANGED",
            "BOOKING_REQUEST_WITHDRAWN",
            "EQUIPMENT_REQUEST_WITHDRAWN",
            "BOOKING_HELD",
            "HOLD_EXPIRY_REMINDER",
            "HOLD_EXPIRED",
            "HOLD_CONFIRMED",
            "HOLD_RELEASED",
            "CHANGE_REQUEST_SUBMITTED",
            "ARRANGEMENT_FLAGGED",
            "ARRANGEMENT_FLAG_RESOLVED",
            "REQUEST_AWAITING_ASSIGNMENT",
            "SAFETY_CHECK_REQUESTED",
            "SAFETY_CHECK_OUTCOME",
          ]),
        );
      });
    });

    describe("AC8 — the No equipment needed decision", () => {
      const decide = (data: {
        noEquipmentNeededAt?: Date | null;
        noEquipmentNeededById?: string | null;
      }) => prisma.event.update({ where: { id: eventIds[0] }, data });

      it("SCRUM-172 [AC8] TC-172-08: an event starts with no decision, and keeps who recorded No equipment needed and when", async () => {
        const before = await prisma.event.findUniqueOrThrow({
          where: { id: eventIds[0] },
        });
        expect(before).toMatchObject({
          noEquipmentNeededAt: null,
          noEquipmentNeededById: null,
        });

        const decidedAt = at(1, 3);
        await expect(
          decide({
            noEquipmentNeededAt: decidedAt,
            noEquipmentNeededById: "usr_coordinator",
          }),
        ).resolves.toMatchObject({
          noEquipmentNeededAt: decidedAt,
          noEquipmentNeededById: "usr_coordinator",
        });
      });

      it("SCRUM-172 [AC8] TC-172-08: clearing the decision goes back to Not decided", async () => {
        await decide({
          noEquipmentNeededAt: at(1, 3),
          noEquipmentNeededById: "usr_coordinator",
        });

        await expect(
          decide({ noEquipmentNeededAt: null, noEquipmentNeededById: null }),
        ).resolves.toMatchObject({
          noEquipmentNeededAt: null,
          noEquipmentNeededById: null,
        });
      });

      it("SCRUM-172 [AC8] TC-172-08: a decision without who recorded it, or when, is refused", async () => {
        for (const half of [
          { noEquipmentNeededAt: at(1, 3) },
          { noEquipmentNeededById: "usr_coordinator" },
        ]) {
          await expect(decide(half)).rejects.toThrow(
            /event_no_equipment_decision_complete/,
          );
        }
        expect(
          await prisma.event.findUniqueOrThrow({ where: { id: eventIds[0] } }),
        ).toMatchObject({
          noEquipmentNeededAt: null,
          noEquipmentNeededById: null,
        });
      });
    });

    describe("AC9 — booking rules use occupied periods", () => {
      // SCRUM-159 AC4: 10:00–12:00 with 30 and 45 minutes occupies 09:30–12:45.
      const first = () =>
        booking({
          start: at(8, 10),
          end: at(8, 12),
          setup: 30,
          turnaround: 45,
        });

      it("SCRUM-172 [AC9] TC-172-09: an Approved or Held booking whose occupied period overlaps another's is refused", async () => {
        await first();

        // 13:00–15:00 with 30 minutes' setup occupies from 12:30.
        for (const status of ["APPROVED", "HELD"] as const) {
          await expect(
            booking({
              event: 1,
              start: at(8, 13),
              end: at(8, 15),
              setup: 30,
              status,
              hold: status === "HELD" ? liveHold(at(8, 13)) : undefined,
            }),
          ).rejects.toThrow(/booking_no_double_booking/);
        }
        expect(await prisma.booking.count({ where: { venueId } })).toBe(1);
      });

      it("SCRUM-172 [AC9] TC-172-09: occupied periods that only touch don't conflict", async () => {
        await first();

        // 13:15–15:00 with 30 minutes' setup occupies from 12:45, where the first ends.
        await expect(
          booking({
            event: 1,
            start: at(8, 13, 15),
            end: at(8, 15),
            setup: 30,
          }),
        ).resolves.toMatchObject({ status: "APPROVED" });
      });

      it("SCRUM-172 [AC9] TC-172-09: a Held booking blocks like an Approved one, and Pending requests block nobody", async () => {
        const start = at(8, 10);
        await booking({
          start,
          end: at(8, 12),
          status: "HELD",
          hold: liveHold(start),
        });

        await expect(
          booking({ event: 1, start, end: at(8, 12) }),
        ).rejects.toThrow(/booking_no_double_booking/);
        await expect(
          booking({ event: 1, start, end: at(8, 12), status: "PENDING" }),
        ).resolves.toBeDefined();
      });

      it("SCRUM-172 [AC9] TC-172-09: a booking keeps the minutes it was approved with when the venue's change", async () => {
        await booking({ start: at(8, 10), end: at(8, 12) });
        await prisma.venue.update({
          where: { id: venueId },
          data: { setupMinutes: 120, turnaroundMinutes: 120 },
        });

        // Against the venue's new 120 minutes this would overlap; against the
        // booking's own 0 it only touches.
        await expect(
          booking({ event: 1, start: at(8, 12), end: at(8, 14) }),
        ).resolves.toBeDefined();
        await prisma.venue.update({
          where: { id: venueId },
          data: { setupMinutes: 0, turnaroundMinutes: 0 },
        });
      });

      it("SCRUM-172 [AC9] TC-172-14: two approvals whose booked periods only touch but whose occupied periods overlap, at the same moment: exactly one is saved", async () => {
        // 10:00–12:00 with 45 minutes' turnaround and 12:00–14:00 with 30
        // minutes' setup: the bare periods touch, the occupied ones overlap.
        const results = await Promise.allSettled([
          booking({ start: at(13, 10), end: at(13, 12), turnaround: 45 }),
          booking({ event: 1, start: at(13, 12), end: at(13, 14), setup: 30 }),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const [refused] = results.filter((r) => r.status === "rejected");
        expect(String((refused as PromiseRejectedResult).reason)).toMatch(
          /booking_no_double_booking|deadlock/,
        );
        expect(
          await prisma.booking.count({
            where: { venueId, status: "APPROVED" },
          }),
        ).toBe(1);
      });

      it("SCRUM-172 [AC9] TC-172-10: an Approved or Held booking whose occupied period overlaps recorded unavailability is refused", async () => {
        await unavailability(at(9, 9), at(9, 9, 45));

        // 10:00 with 30 minutes' setup occupies from 09:30, inside the unavailability.
        for (const status of ["APPROVED", "HELD"] as const) {
          await expect(
            booking({
              start: at(9, 10),
              end: at(9, 12),
              setup: 30,
              status,
              hold: status === "HELD" ? liveHold(at(9, 10)) : undefined,
            }),
          ).rejects.toThrow(/booking_overlaps_unavailability/);
        }
        // 15 minutes' setup occupies from 09:45, where the unavailability ends.
        await expect(
          booking({ start: at(9, 10), end: at(9, 12), setup: 15 }),
        ).resolves.toBeDefined();
      });

      it("SCRUM-172 [AC9] TC-172-10: a Pending request over unavailability is saved, and can't then be approved", async () => {
        await unavailability(at(9, 11), at(9, 13));
        const pending = await booking({
          start: at(9, 10),
          end: at(9, 12),
          status: "PENDING",
        });

        await expect(
          prisma.booking.update({
            where: { id: pending.id },
            data: { status: "APPROVED" },
          }),
        ).rejects.toThrow(/booking_overlaps_unavailability/);
      });

      it("SCRUM-172 [AC9] TC-172-11: unavailability may overlap Approved and Held bookings but not other unavailability", async () => {
        const start = at(10, 10);
        await booking({ start, end: at(10, 12) });
        await booking({
          event: 1,
          venue: otherVenueId,
          start,
          end: at(10, 12),
          status: "HELD",
          hold: liveHold(start),
        });

        await expect(
          unavailability(at(10, 11), at(10, 15)),
        ).resolves.toBeDefined();
        await expect(
          prisma.venueUnavailability.create({
            data: {
              venueId: otherVenueId,
              startAt: start,
              endAt: at(10, 12),
              recordedById: "usr_venuestaff",
            },
          }),
        ).resolves.toBeDefined();

        await expect(unavailability(at(10, 14), at(10, 16))).rejects.toThrow(
          /unavailability_overlaps_unavailability/,
        );
        // Touching is not overlapping.
        await expect(
          unavailability(at(10, 15), at(10, 16)),
        ).resolves.toBeDefined();
      });

      it("SCRUM-172 [AC9] TC-172-12: Rejected, Cancelled and Expired bookings don't stop the event asking for the venue again", async () => {
        const start = at(11, 10);
        await booking({
          start,
          end: at(11, 12),
          status: "REJECTED",
          reason: "Full that day.",
        });
        await booking({ start, end: at(11, 12), status: "CANCELLED" });
        await booking({
          start,
          end: at(11, 12),
          status: "EXPIRED",
          hold: liveHold(start),
        });

        await expect(
          booking({ start, end: at(11, 12), status: "PENDING" }),
        ).resolves.toBeDefined();
      });

      /** A hold placed two hours ago that expired a minute ago, still marked Held. */
      const lapsedHold = (start: Date) =>
        booking({
          start,
          end: at(12, 12),
          status: "HELD",
          hold: {
            heldAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            expiresAt: new Date(Date.now() - 60 * 1000),
          },
        });
      const statusOf = async (id: string) =>
        (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;

      it("SCRUM-172 [AC9] TC-172-13: a hold whose expiry has passed doesn't stop another event being approved, and is marked Expired", async () => {
        const start = at(12, 10);
        const lapsed = await lapsedHold(start);

        await expect(
          booking({ event: 1, start, end: at(12, 12) }),
        ).resolves.toBeDefined();
        expect(await statusOf(lapsed.id)).toBe("EXPIRED");
      });

      it("SCRUM-172 [AC9] TC-172-13: a hold whose expiry has passed doesn't stop its own event requesting the venue again", async () => {
        const start = at(12, 10);
        const lapsed = await lapsedHold(start);

        // The request is the only write since the expiry.
        await expect(
          booking({ start, end: at(12, 12), status: "PENDING" }),
        ).resolves.toBeDefined();
        expect(await statusOf(lapsed.id)).toBe("EXPIRED");
      });

      it("SCRUM-172 [AC9] TC-172-13: a hold whose expiry has passed can't be confirmed; one that hasn't can", async () => {
        const lapsed = await lapsedHold(at(12, 10));
        await expect(
          prisma.booking.update({
            where: { id: lapsed.id },
            data: { status: "APPROVED" },
          }),
        ).rejects.toThrow(/booking_hold_expired/);
        expect(await statusOf(lapsed.id)).toBe("HELD");

        const start = at(14, 10);
        const live = await booking({
          event: 1,
          start,
          end: at(14, 12),
          status: "HELD",
          hold: liveHold(start),
        });
        await expect(
          prisma.booking.update({
            where: { id: live.id },
            data: { status: "APPROVED" },
          }),
        ).resolves.toMatchObject({ status: "APPROVED" });
      });

      it("SCRUM-172 [AC9] TC-172-13: a hold whose expiry hasn't passed still blocks", async () => {
        const start = at(12, 10);
        const hold = await booking({
          start,
          end: at(12, 12),
          status: "HELD",
          hold: liveHold(start),
        });

        await expect(
          booking({ event: 1, start, end: at(12, 12) }),
        ).rejects.toThrow(/booking_no_double_booking/);
        expect(
          (await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } }))
            .status,
        ).toBe("HELD");
      });
    });
  },
);
