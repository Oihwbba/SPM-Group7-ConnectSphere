import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { prisma } from "@/lib/db";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-172 AC12 to AC14 against a real Postgres: the data the Week 9
// clarifications add, written directly as the stories that build on it will
// write it (SCRUM-165 AC11, SCRUM-163 AC7, the hold-expiry change). The
// database is what is under test; expected values come from the criteria.
//
// These WRITE (a throwaway Lead, venue, events and their rows, removed
// afterwards), so they only run against a localhost database.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

/** A UTC instant on a far-future day, clear of anything seeded. */
const at = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2037, 4, day, hour, minute));

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-172 — Week 9 additions: supervising Lead, hold approval, hold expiry history",
  () => {
    const stamp = Date.now();
    // The seeded lead@test.local. Not made here: every Lead is told of each
    // submitted request (SCRUM-124 AC10), so a Lead made and deleted mid-run
    // would race other suites' submissions.
    const leadId = "usr_coordinatorlead";
    let venueId: string;
    let eventIds: string[];

    /**
     * A hold placed at 08:00 on day 1 and expiring at 08:00 on day 5, for
     * 09:00–12:00 on `day`. Each test holds its own event on its own day, so
     * no hold blocks another (booking_no_double_booking).
     */
    const hold = (event: number, day: number) =>
      prisma.booking.create({
        data: {
          eventId: eventIds[event],
          venueId,
          startAt: at(day, 9),
          endAt: at(day, 12),
          status: "HELD",
          heldAt: at(1, 8),
          holdExpiresAt: at(5, 8),
          holdNote: "Confirm the final headcount.",
          requestedById: "usr_coordinator",
        },
      });

    beforeAll(async () => {
      const period = { startAt: at(10, 9), endAt: at(10, 12) };
      eventIds = await createPlanningEvents("Week 9 rules event", [
        period,
        period,
        period,
        period,
        period,
        period,
        period,
      ]);
      venueId = (
        await prisma.venue.create({
          data: {
            name: `Week 9 test venue ${stamp}`,
            location: "Test block",
            capacity: 200,
          },
        })
      ).id;
    });

    afterAll(async () => {
      await removeEvents(eventIds);
      await prisma.venue.deleteMany({ where: { id: venueId } });
    });

    describe("AC12 — the event's supervising Lead", () => {
      it("SCRUM-172 [AC12] TC-172-17: an event starts with no supervising Lead, and keeps the Lead it is given", async () => {
        const before = await prisma.event.findUniqueOrThrow({
          where: { id: eventIds[0] },
        });
        expect(before.supervisingLeadId).toBeNull();

        await prisma.event.update({
          where: { id: eventIds[0] },
          data: { supervisingLeadId: leadId },
        });
        const after = await prisma.event.findUniqueOrThrow({
          where: { id: eventIds[0] },
          select: { supervisingLead: { select: { id: true, role: true } } },
        });
        expect(after.supervisingLead).toEqual({
          id: leadId,
          role: "COORDINATOR_LEAD",
        });
      });

      it("SCRUM-172 [AC12] TC-172-17: a supervising Lead who isn't a user is refused, and the event is unchanged", async () => {
        await expect(
          prisma.event.update({
            where: { id: eventIds[1] },
            data: { supervisingLeadId: "usr_nobody" },
          }),
        ).rejects.toThrow(/Event_supervisingLeadId_fkey/);
        const event = await prisma.event.findUniqueOrThrow({
          where: { id: eventIds[1] },
        });
        expect(event.supervisingLeadId).toBeNull();
      });

      it("SCRUM-172 [AC12] TC-172-17: deleting the supervising Lead's user leaves the event unsupervised, and keeps the event", async () => {
        const goneId = `usr_w9_gone_lead_${stamp}`;
        await prisma.user.create({
          data: {
            id: goneId,
            email: `w9-gone-lead-${stamp}@test.local`,
            name: "Week 9 departing Lead",
            passwordHash: "x",
            // The database's rule doesn't depend on the role. Not a Lead, so
            // other suites' notices to every Lead (SCRUM-124 AC10) never reach
            // this account, which the test deletes.
            role: "ATTENDEE",
          },
        });
        await prisma.event.update({
          where: { id: eventIds[2] },
          data: { supervisingLeadId: goneId },
        });

        await prisma.user.delete({ where: { id: goneId } });

        const event = await prisma.event.findUniqueOrThrow({
          where: { id: eventIds[2] },
        });
        expect(event).toMatchObject({
          supervisingLeadId: null,
          status: "PLANNING",
        });
      });
    });

    describe("AC13 — Venue Staff's approval of a hold", () => {
      it("SCRUM-172 [AC13] TC-172-18: a hold starts unapproved, records when and by whom Venue Staff approved it, and keeps that once confirmed", async () => {
        const row = await hold(0, 10);
        expect(row).toMatchObject({
          holdApprovedAt: null,
          holdApprovedById: null,
        });

        await prisma.booking.update({
          where: { id: row.id },
          data: { holdApprovedAt: at(2, 9), holdApprovedById: "usr_venuestaff" },
        });
        const confirmed = await prisma.booking.update({
          where: { id: row.id },
          data: { status: "APPROVED", decidedById: "usr_coordinator" },
        });
        expect(confirmed).toMatchObject({
          status: "APPROVED",
          holdApprovedAt: at(2, 9),
          holdApprovedById: "usr_venuestaff",
        });
      });

      it("SCRUM-172 [AC13] TC-172-18: an approval without who or when is refused", async () => {
        const row = await hold(1, 11);
        for (const data of [
          { holdApprovedAt: at(2, 9) },
          { holdApprovedById: "usr_venuestaff" },
        ]) {
          await expect(
            prisma.booking.update({ where: { id: row.id }, data }),
          ).rejects.toThrow(/booking_hold_approval_complete/);
        }
        const unchanged = await prisma.booking.findUniqueOrThrow({
          where: { id: row.id },
        });
        expect(unchanged).toMatchObject({
          holdApprovedAt: null,
          holdApprovedById: null,
        });
      });

      it("SCRUM-172 [AC13] TC-172-18: only a booking that was held records an approval, at or after the hold was placed", async () => {
        const pending = await prisma.booking.create({
          data: {
            eventId: eventIds[2],
            venueId,
            startAt: at(12, 9),
            endAt: at(12, 12),
            requestedById: "usr_coordinator",
          },
        });
        await expect(
          prisma.booking.update({
            where: { id: pending.id },
            data: {
              holdApprovedAt: at(2, 9),
              holdApprovedById: "usr_venuestaff",
            },
          }),
        ).rejects.toThrow(/booking_hold_approval_complete/);

        const row = await hold(3, 13);
        await expect(
          prisma.booking.update({
            where: { id: row.id },
            data: {
              holdApprovedAt: at(1, 7, 59),
              holdApprovedById: "usr_venuestaff",
            },
          }),
        ).rejects.toThrow(/booking_hold_approval_complete/);
        await expect(
          prisma.booking.update({
            where: { id: row.id },
            data: {
              holdApprovedAt: at(1, 8),
              holdApprovedById: "usr_venuestaff",
            },
          }),
        ).resolves.toMatchObject({ holdApprovedAt: at(1, 8) });
      });
    });

    it("SCRUM-172 [AC13] TC-172-18: a user who approved a hold can't be deleted, so the approval never loses who made it", async () => {
      const approverId = `usr_w9_approver_${stamp}`;
      await prisma.user.create({
        data: {
          id: approverId,
          email: `w9-approver-${stamp}@test.local`,
          name: "Week 9 approver",
          passwordHash: "x",
          // The database's rule doesn't depend on the role. Not Venue Staff, so
          // other suites' staff notices (SCRUM-124) never reach this short-lived
          // account and block its deletion, or fail on it.
          role: "ATTENDEE",
        },
      });
      const row = await hold(6, 16);
      await prisma.booking.update({
        where: { id: row.id },
        data: { holdApprovedAt: at(2, 9), holdApprovedById: approverId },
      });

      await expect(
        prisma.user.delete({ where: { id: approverId } }),
      ).rejects.toThrow(/Booking_holdApprovedById_fkey/);
      expect(
        await prisma.booking.findUniqueOrThrow({
          where: { id: row.id },
          select: { holdApprovedAt: true, holdApprovedById: true },
        }),
      ).toEqual({ holdApprovedAt: at(2, 9), holdApprovedById: approverId });

      await prisma.booking.delete({ where: { id: row.id } });
      await prisma.user.delete({ where: { id: approverId } });
    });

    describe("AC14 — the history of a hold's expiry", () => {
      it("SCRUM-172 [AC14] TC-172-19: each change to a hold's expiry is kept with the old and new expiry, who changed it and when", async () => {
        const row = await hold(4, 14);
        const before = new Date();
        await prisma.holdExpiryChange.create({
          data: {
            bookingId: row.id,
            oldExpiresAt: at(5, 8),
            newExpiresAt: at(6, 8),
            changedById: "usr_venuestaff",
          },
        });
        await prisma.holdExpiryChange.create({
          data: {
            bookingId: row.id,
            oldExpiresAt: at(6, 8),
            newExpiresAt: at(4, 17),
            changedById: "usr_venuestaff",
          },
        });

        const history = await prisma.holdExpiryChange.findMany({
          where: { bookingId: row.id },
          orderBy: { changedAt: "asc" },
        });
        expect(history).toMatchObject([
          {
            oldExpiresAt: at(5, 8),
            newExpiresAt: at(6, 8),
            changedById: "usr_venuestaff",
          },
          {
            oldExpiresAt: at(6, 8),
            newExpiresAt: at(4, 17),
            changedById: "usr_venuestaff",
          },
        ]);
        for (const change of history) {
          expect(change.changedAt.getTime()).toBeGreaterThanOrEqual(
            before.getTime() - 1000,
          );
        }
      });

      it("SCRUM-172 [AC14] TC-172-19: recording the same expiry as a change is refused, and nothing is kept", async () => {
        const row = await hold(5, 15);
        await expect(
          prisma.holdExpiryChange.create({
            data: {
              bookingId: row.id,
              oldExpiresAt: at(5, 8),
              newExpiresAt: at(5, 8),
              changedById: "usr_venuestaff",
            },
          }),
        ).rejects.toThrow(/hold_expiry_change_differs/);
        expect(
          await prisma.holdExpiryChange.count({ where: { bookingId: row.id } }),
        ).toBe(0);
      });
    });
  },
);
