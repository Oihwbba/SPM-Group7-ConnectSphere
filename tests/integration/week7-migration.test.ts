import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

// SCRUM-172 AC5, AC7 and AC10 — what the Week 7 migration does to data that
// already exists. A scratch database is built from every migration before it,
// given rows in the shapes the current code writes, and then migrated, so the
// test sees the upgrade itself rather than a database that was built new.
// It creates and drops its own database, so it only runs against a localhost
// server (CI's service container, or the Docker DB).
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const MIGRATION = "20261008120000_week7_schema_and_booking_rules";
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((name) => /^\d{14}_/.test(name))
  .sort();
const sqlOf = (name: string) =>
  readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");

const scratchName = `connectsphere_week7_${Date.now()}`;
const urlFor = (database: string) => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${database}`;
  url.search = "";
  return url.toString();
};

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-172 — the Week 7 migration on existing data",
  () => {
    const admin = new Client({ connectionString: urlFor("postgres") });
    const db = new Client({ connectionString: urlFor(scratchName) });

    beforeAll(async () => {
      await admin.connect();
      await admin.query(`CREATE DATABASE "${scratchName}"`);
      await db.connect();

      for (const name of migrations.slice(0, migrations.indexOf(MIGRATION))) {
        await db.query(sqlOf(name));
      }

      await db.query(`
        INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "updatedAt") VALUES
          ('usr_c', 'c@test.local', 'Coordinator', 'x', 'COORDINATOR', now()),
          ('usr_v', 'v@test.local', 'Venue Staff', 'x', 'VENUE_STAFF', now());
        INSERT INTO "Venue" ("id", "name", "location", "capacity", "updatedAt") VALUES
          ('ven_1', 'Hall', 'Block A', 100, now());
        INSERT INTO "VenueUnavailability" ("id", "venueId", "startAt", "endAt", "reason", "note", "recordedById", "updatedAt") VALUES
          ('vun_maint', 'ven_1', '2036-01-01 00:00', '2036-01-01 01:00', 'MAINTENANCE', 'Aircon.', 'usr_v', now()),
          ('vun_damaged', 'ven_1', '2036-01-02 00:00', '2036-01-02 01:00', 'DAMAGED', 'Projector mount.', 'usr_v', now()),
          ('vun_closed', 'ven_1', '2036-01-03 00:00', '2036-01-03 01:00', 'CLOSURE', NULL, 'usr_v', now()),
          ('vun_closed_note', 'ven_1', '2036-01-04 00:00', '2036-01-04 01:00', 'CLOSURE', 'Public holiday.', 'usr_v', now()),
          ('vun_other', 'ven_1', '2036-01-05 00:00', '2036-01-05 01:00', 'OTHER', NULL, 'usr_v', now());
      `);
      // One event per booking: the old rule allows one live booking per event.
      for (const [id, status] of [
        ["pending", "PENDING"],
        ["approved", "APPROVED"],
        ["rejected", "REJECTED"],
        ["cancelled", "CANCELLED"],
      ]) {
        await db.query(
          `INSERT INTO "Event" ("id", "name", "status", "organiserId", "updatedAt")
           VALUES ($1, $2, 'PLANNING', 'usr_c', now())`,
          [`evt_${id}`, id],
        );
        await db.query(
          `INSERT INTO "Booking" ("id", "eventId", "venueId", "startAt", "endAt", "status", "decisionReason", "requestedById", "updatedAt")
           VALUES ($1, $2, 'ven_1', '2036-02-01 09:00', '2036-02-01 12:00', $3, $4, 'usr_c', now())`,
          [
            `bkg_${id}`,
            `evt_${id}`,
            status,
            status === "REJECTED" ? "Full." : null,
          ],
        );
      }
      // A flag raised before the flag had a reason (nothing does this today,
      // but the CHECKs the migration adds must not fail on such a row).
      await db.query(
        `UPDATE "Booking" SET "needsReconsideration" = true WHERE "id" = 'bkg_approved'`,
      );
      await db.query(`
        INSERT INTO "Notification" ("id", "userId", "type", "title", "message", "createdAt", "updatedAt")
          VALUES ('ntf_1', 'usr_c', 'BOOKING_DECISION', 'Booking approved', 'Hall is booked.', '2026-09-01 08:00', now());
      `);

      await db.query(sqlOf(MIGRATION));
    });

    afterAll(async () => {
      await db.end();
      await admin.query(
        `DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`,
      );
      await admin.end();
    });

    it("SCRUM-172 [AC5] TC-172-05: Damaged becomes Equipment failure, and Closure becomes Other with Closure kept in the note", async () => {
      const { rows } = await db.query(
        `SELECT "id", "reason"::text AS reason, "note" FROM "VenueUnavailability" ORDER BY "id"`,
      );

      expect(rows).toEqual([
        { id: "vun_closed", reason: "OTHER", note: "Closure" },
        {
          id: "vun_closed_note",
          reason: "OTHER",
          note: "Closure: Public holiday.",
        },
        {
          id: "vun_damaged",
          reason: "EQUIPMENT_FAILURE",
          note: "Projector mount.",
        },
        { id: "vun_maint", reason: "MAINTENANCE", note: "Aircon." },
        { id: "vun_other", reason: "OTHER", note: null },
      ]);
    });

    it("SCRUM-172 [AC5] TC-172-05: venue unavailability offers exactly the five Week 7 reasons; equipment keeps its own", async () => {
      const labels = async (type: string) =>
        (
          await db.query(
            `SELECT e.enumlabel::text AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
              WHERE t.typname = $1 ORDER BY e.enumsortorder`,
            [type],
          )
        ).rows.map((row) => row.label);

      expect(await labels("VenueUnavailabilityReason")).toEqual([
        "MAINTENANCE",
        "EQUIPMENT_FAILURE",
        "RENOVATION",
        "SAFETY_CONCERN",
        "OTHER",
      ]);
      expect(await labels("UnavailabilityReason")).toEqual([
        "MAINTENANCE",
        "DAMAGED",
        "CLOSURE",
        "OTHER",
      ]);
    });

    it("SCRUM-172 [AC10] TC-172-15: every existing booking keeps its status, with 0 setup and turnaround minutes", async () => {
      const { rows } = await db.query(
        `SELECT "id", "status"::text AS status, "setupMinutes", "turnaroundMinutes"
           FROM "Booking" ORDER BY "id"`,
      );

      expect(rows).toEqual([
        {
          id: "bkg_approved",
          status: "APPROVED",
          setupMinutes: 0,
          turnaroundMinutes: 0,
        },
        {
          id: "bkg_cancelled",
          status: "CANCELLED",
          setupMinutes: 0,
          turnaroundMinutes: 0,
        },
        {
          id: "bkg_pending",
          status: "PENDING",
          setupMinutes: 0,
          turnaroundMinutes: 0,
        },
        {
          id: "bkg_rejected",
          status: "REJECTED",
          setupMinutes: 0,
          turnaroundMinutes: 0,
        },
      ]);
    });

    it("SCRUM-172 [AC4] TC-172-04: a booking flagged before the migration is given a reason and a time, and stays flagged", async () => {
      const { rows } = await db.query(
        `SELECT "needsReconsideration", "reconsiderationReason", "reconsiderationFlaggedAt" IS NOT NULL AS "hasTime"
           FROM "Booking" WHERE "id" = 'bkg_approved'`,
      );

      expect(rows).toEqual([
        {
          needsReconsideration: true,
          reconsiderationReason: "Reason not recorded (pre-constraint data).",
          hasTime: true,
        },
      ]);
    });

    it("SCRUM-172 [AC2] TC-172-02: existing venues start at 0 setup and 0 turnaround minutes, with no restrictions", async () => {
      const { rows } = await db.query(
        `SELECT "setupMinutes", "turnaroundMinutes", "knownRestrictions" FROM "Venue"`,
      );

      expect(rows).toEqual([
        { setupMinutes: 0, turnaroundMinutes: 0, knownRestrictions: null },
      ]);
    });

    it("SCRUM-172 [AC7] TC-172-07: an existing notification shows from when it was written", async () => {
      const { rows } = await db.query(
        `SELECT "showFromAt" = "createdAt" AS "fromWritten", "withdrawnAt" FROM "Notification"`,
      );

      expect(rows).toEqual([{ fromWritten: true, withdrawnAt: null }]);
    });
  },
);
