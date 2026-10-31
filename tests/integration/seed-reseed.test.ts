import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { completeFinishedEvents } from "@/lib/event-closing";

// SCRUM-233: seeded dates move with the day the seed runs, so `npm run db:seed`
// on a database seeded days ago has to get past its own older rows. Each run
// moves every seeded row, so this builds its own throwaway database: on the one
// the other suites share, they would see their rows move under them.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl);

const run = promisify(execFile);
const DAY_MS = 24 * 60 * 60 * 1000;
const today = new Date();
today.setUTCHours(0, 0, 0, 0);
/** The seed's `at`: `dayOffset` days from today, at `hourUTC`. */
const at = (dayOffset: number, hourUTC = 0) =>
  new Date(today.getTime() + dayOffset * DAY_MS + hourUTC * 60 * 60 * 1000);

describe.skipIf(!usesLocalDatabase)("SCRUM-233 — re-seeding on a later day", () => {
  const name = `connectsphere_reseed_${process.pid}`;
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  const env = { ...process.env, DATABASE_URL: url.href, DIRECT_URL: url.href };

  const admin = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: url.href });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const seedOn = (dayOffset: number) =>
    run(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
      env: { ...env, SEED_TODAY: at(dayOffset).toISOString() },
    });

  beforeAll(async () => {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name}`);
    await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env });
  }, 120_000);

  afterAll(async () => {
    await db.$disconnect();
    await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  });

  it("SCRUM-233 [AC11] TC-233-23: the seed runs over itself after a gap of days, restores what passed, and leaves rows made through the app", async () => {
    // Started in the past, so older holds have really expired by the database's
    // clock, and the gaps are ones that clashed before the fix: 2, 5, 9 and 12.
    await seedOn(-28);
    await seedOn(-26);
    await seedOn(-21);
    // What using the app does to a database nobody re-seeded: SCRUM-82 completes
    // what has passed, Charity Gala's Registration Closed sibling among them.
    await completeFinishedEvents(db, at(-11));
    expect(await db.event.findUniqueOrThrow({ where: { id: "evt_reg_closed" }, select: { status: true } })).toEqual({ status: "COMPLETED" });
    await seedOn(-12);

    const appBooking = await db.booking.create({
      data: { eventId: "evt_under_review", venueId: "ven_hall", startAt: at(200, 1), endAt: at(200, 9), status: "APPROVED", requestedAttendance: 10, requestedById: "usr_coordinator", decidedById: "usr_venuestaff", decidedAt: at(-1) },
    });
    const appUnavailability = await db.venueUnavailability.create({
      data: { venueId: "ven_seminar", startAt: at(201), endAt: at(202), reason: "OTHER", note: "Recorded through the app.", recordedById: "usr_venuestaff" },
    });

    await seedOn(0);

    expect(
      await db.booking.findUniqueOrThrow({ where: { id: "bkg_confirmed" }, select: { status: true, startAt: true, endAt: true } }),
    ).toEqual({ status: "APPROVED", startAt: at(10, 1), endAt: at(10, 5) });
    expect(
      await db.booking.findUniqueOrThrow({ where: { id: "bkg_pending" }, select: { status: true } }),
    ).toEqual({ status: "PENDING" });
    expect(
      await db.booking.findUniqueOrThrow({ where: { id: "bkg_held" }, select: { status: true, holdExpiresAt: true } }),
    ).toEqual({ status: "HELD", holdExpiresAt: at(5, 4) });
    expect(
      await db.event.findUniqueOrThrow({ where: { id: "evt_reg_closed" }, select: { status: true, startAt: true, completedAt: true } }),
    ).toEqual({ status: "CONFIRMED", startAt: at(5, 1), completedAt: null });
    expect(
      await db.event.findUniqueOrThrow({ where: { id: "evt_completed" }, select: { status: true, completedAt: true } }),
    ).toEqual({ status: "COMPLETED", completedAt: at(-30, 11) });

    // Reserved after its request was decided, which this run moved forward.
    expect(
      await db.reservation.findUniqueOrThrow({ where: { id: "res_confirmed_projector" }, select: { createdAt: true } }),
    ).toEqual({ createdAt: at(-16, 5) });

    const seededUnavailability = await db.venueUnavailability.findMany({
      where: { id: { startsWith: "vun_" } },
      orderBy: { id: "asc" },
      select: { id: true, startAt: true },
    });
    expect(seededUnavailability.map((row) => row.id)).toEqual([
      "vun_auditorium_failure",
      "vun_boardroom_safety",
      "vun_hall_renovation",
      "vun_seminar_maintenance",
      "vun_seminar_other",
    ]);
    expect(seededUnavailability[3].startAt).toEqual(at(15));

    expect(
      await db.booking.findUniqueOrThrow({ where: { id: appBooking.id }, select: { status: true, startAt: true } }),
    ).toEqual({ status: "APPROVED", startAt: at(200, 1) });
    expect(
      await db.venueUnavailability.findUniqueOrThrow({ where: { id: appUnavailability.id }, select: { startAt: true } }),
    ).toEqual({ startAt: at(201) });
  }, 180_000);

  // Every seeded row, every column but the one Prisma stamps on each write.
  const SEEDED_ROWS = [
    ["Event", "evt_"], ["Booking", "bkg_"], ["Reservation", "res_"], ["Registration", "reg_"],
    ["ClarificationRequest", "clr_"], ["EventChangeRequest", "chg_"], ["ChangeRequestField", "chgf"],
    ["EquipmentRequest", "eqr_"], ["EquipmentRequestLine", "eql_"], ["SafetyCheck", "sfc_"],
    ["Notification", "ntf_"], ["Venue", "ven_"], ["Equipment", "eqp_"], ["EquipmentUnavailability", "eun_"],
  ];
  const seededRows = async () => {
    const rows: Record<string, unknown[]> = {};
    for (const [table, prefix] of SEEDED_ROWS) {
      const { rows: found } = await pool.query(
        `SELECT to_jsonb(t) - 'updatedAt' AS row FROM "${table}" t WHERE left(t."id", 4) = $1 ORDER BY t."id"`,
        [prefix],
      );
      rows[table] = found.map((r) => r.row);
    }
    return rows;
  };

  it("SCRUM-233 [AC11] TC-233-25: a re-seed puts back every seeded row the app changed, whichever field it wrote", async () => {
    await seedOn(0);
    const fresh = await seededRows();
    expect(fresh.Event.length).toBeGreaterThan(0);
    const now = new Date();
    const coordinator = "usr_coordinator";

    // What the actions write: assigning, editing a draft, cancelling, rejecting
    // from Planning, confirming, deciding, flagging, answering and retiring.
    await db.event.update({ where: { id: "evt_submitted" }, data: { status: "UNDER_REVIEW", coordinatorId: coordinator, supervisingLeadId: "usr_coordinatorlead" } });
    await db.event.update({ where: { id: "evt_draft" }, data: { purpose: "Written in the app.", startAt: at(50, 1), endAt: at(50, 2), expectedAttendance: 5, specialRequests: "Edited." } });
    await db.event.update({ where: { id: "evt_two_venues" }, data: { status: "CANCELLED", cancelledAt: now, cancelledById: coordinator, cancellationReason: "Rain." } });
    await db.event.update({ where: { id: "evt_approved" }, data: { status: "REJECTED", decidedAt: now, decidedById: coordinator, decisionReason: "No caterer.", rejectionOutcome: "AMEND_AND_RESUBMIT" } });
    await db.event.update({ where: { id: "evt_ready_to_confirm" }, data: { status: "CONFIRMED", registrationEnabled: true, confirmedStartAt: now, confirmedEndAt: now, confirmedVenues: ["Seminar Room 2.1 — Level 2, Block B"] } });
    await db.booking.update({ where: { id: "bkg_pending" }, data: { status: "APPROVED", decidedById: "usr_venuestaff", decidedAt: now, needsReconsideration: true, reconsiderationFlaggedAt: now, reconsiderationReason: "Change approved." } });
    await db.booking.update({ where: { id: "bkg_held" }, data: { holdApprovedAt: now, holdApprovedById: "usr_venuestaff" } });
    await db.booking.update({ where: { id: "bkg_flagged" }, data: { needsReconsideration: false, reconsiderationResolvedAt: now, reconsiderationResolvedById: coordinator } });
    await db.booking.update({ where: { id: "bkg_multirole_pending" }, data: { status: "REJECTED", decidedById: "usr_venuestaff", decidedAt: now, decisionReason: "In use." } });
    await db.reservation.update({ where: { id: "res_flagged_mic" }, data: { status: "CANCELLED", cancelledAt: now, needsReconsideration: false, reconsiderationResolvedAt: now, reconsiderationResolvedById: coordinator } });
    await db.registration.update({ where: { id: "reg_replanning_1" }, data: { status: "WITHDRAWN", withdrawnAt: now } });
    await db.clarificationRequest.update({ where: { id: "clr_editable" }, data: { status: "ANSWERED", response: "Lowered.", respondedAt: now } });
    await db.eventChangeRequest.update({ where: { id: "chg_planning_date" }, data: { status: "APPROVED", decidedById: coordinator, decidedAt: now } });
    await db.eventChangeRequest.update({ where: { id: "chg_pending" }, data: { status: "REJECTED", decidedById: coordinator, decidedAt: now, decisionReason: "No." } });
    await db.equipmentRequest.update({ where: { id: "eqr_planning" }, data: { status: "APPROVED", decidedAt: now } });
    await db.equipmentRequestLine.update({ where: { id: "eql_planning_mic" }, data: { removedAt: now, suggestedAlternativeId: "eqp_laptop", technicalRequirements: "Added." } });
    await db.safetyCheck.update({ where: { id: "sfc_awaiting" }, data: { status: "CHANGES_REQUESTED", note: "Move it.", decidedById: "usr_safetyofficer", decidedAt: now } });
    await db.notification.update({ where: { id: "ntf_2" }, data: { readAt: now } });
    await db.notification.update({ where: { id: "ntf_hold_reminder" }, data: { withdrawnAt: now } });
    await db.venue.update({ where: { id: "ven_seminar" }, data: { isActive: false, notes: "Edited.", knownRestrictions: "Edited.", setupMinutes: 15, turnaroundMinutes: 15 } });
    await db.equipment.update({ where: { id: "eqp_lectern" }, data: { isActive: false, technicalSpecs: "Edited." } });
    expect(await seededRows()).not.toEqual(fresh);

    await seedOn(0);

    expect(await seededRows()).toEqual(fresh);
  }, 60_000);

  it("SCRUM-233 [AC11] TC-233-24: a seed refused part way by a row made through the app writes nothing at all", async () => {
    // Tomorrow's run moves bkg_confirmed to day 11, where this booking now is.
    await db.booking.create({
      data: { eventId: "evt_submitted", venueId: "ven_hall", startAt: at(11, 1), endAt: at(11, 5), status: "APPROVED", requestedAttendance: 10, requestedById: "usr_coordinator", decidedById: "usr_venuestaff", decidedAt: at(-1) },
    });
    const liveBookings = () =>
      db.booking.count({ where: { id: { startsWith: "bkg_" }, status: { in: ["PENDING", "HELD", "APPROVED"] } } });
    const before = await liveBookings();
    expect(before).toBeGreaterThan(0);

    await expect(seedOn(1)).rejects.toThrow(/booking_no_double_booking/);

    expect(await liveBookings()).toBe(before);
    expect(
      await db.event.findUniqueOrThrow({ where: { id: "evt_confirmed" }, select: { startAt: true } }),
    ).toEqual({ startAt: at(10, 1) });
    expect(await db.venueUnavailability.count({ where: { id: { startsWith: "vun_" } } })).toBe(5);
  }, 60_000);
});
