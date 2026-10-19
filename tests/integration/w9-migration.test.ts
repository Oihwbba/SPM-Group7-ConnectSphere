import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

// SCRUM-172 AC12 to AC14 — what the Week 9 migration does to data that
// already exists. A scratch database is built from every migration before it,
// given rows in the shapes the current code writes (including a hold its
// Coordinator confirmed before Venue Staff approval existed), and then
// migrated, so the test sees the upgrade itself rather than a database built
// new. It creates and drops its own database, so it only runs against a
// localhost server (CI's service container, or the Docker DB).
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const MIGRATION = "20261013120000_w9_hold_approval_lead_expiry_history";
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((name) => /^\d{14}_/.test(name))
  .sort();
const sqlOf = (name: string) =>
  readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");

const scratchName = `connectsphere_w9_${Date.now()}`;
const urlFor = (database: string) => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${database}`;
  url.search = "";
  return url.toString();
};

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-172 — the Week 9 migration on existing data",
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
          ('usr_l', 'l@test.local', 'Lead', 'x', 'COORDINATOR_LEAD', now());
        INSERT INTO "Venue" ("id", "name", "location", "capacity", "updatedAt") VALUES
          ('ven_1', 'Hall', 'Block A', 100, now());
      `);
      // One event per booking, each on its own day, so no rule refuses them.
      const rows: [string, string, number, boolean][] = [
        ["pending", "PENDING", 1, false],
        ["approved", "APPROVED", 2, false],
        ["held", "HELD", 3, true],
        ["confirmed_hold", "APPROVED", 4, true],
        ["expired", "EXPIRED", 5, true],
      ];
      for (const [id, status, day, wasHeld] of rows) {
        await db.query(
          `INSERT INTO "Event" ("id", "name", "status", "organiserId", "coordinatorId", "updatedAt")
           VALUES ($1, $2, 'PLANNING', 'usr_c', 'usr_c', now())`,
          [`evt_${id}`, id],
        );
        await db.query(
          `INSERT INTO "Booking" ("id", "eventId", "venueId", "startAt", "endAt", "status",
                                  "heldAt", "holdExpiresAt", "holdNote", "requestedById", "updatedAt")
           VALUES ($1, $2, 'ven_1', $3::timestamp, $3::timestamp + interval '3 hours', $4,
                   $5, $6, $7, 'usr_c', now())`,
          [
            `bkg_${id}`,
            `evt_${id}`,
            `2037-06-0${day} 09:00`,
            status,
            wasHeld ? "2037-05-01 08:00" : null,
            wasHeld ? "2037-05-20 08:00" : null,
            wasHeld ? "Confirm the final headcount." : null,
          ],
        );
      }

      await db.query(sqlOf(MIGRATION));
      // Replaying every earlier migration takes a few seconds alone, and over
      // Vitest's 10 s hook default while the other files run alongside it.
    }, 60_000);

    afterAll(async () => {
      await db.end();
      await admin.query(
        `DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`,
      );
      await admin.end();
    });

    it("SCRUM-172 [AC12] TC-172-20: existing events start with no supervising Lead", async () => {
      const { rows } = await db.query(
        `SELECT count(*)::int AS events,
                count("supervisingLeadId")::int AS supervised
           FROM "Event"`,
      );

      expect(rows).toEqual([{ events: 5, supervised: 0 }]);
    });

    it("SCRUM-172 [AC13] TC-172-20: existing bookings start with no hold approval and keep their status, including a hold confirmed before approval existed", async () => {
      const { rows } = await db.query(
        `SELECT "id", "status"::text AS status, "holdApprovedAt", "holdApprovedById"
           FROM "Booking" ORDER BY "id"`,
      );

      expect(rows).toEqual(
        [
          ["bkg_approved", "APPROVED"],
          ["bkg_confirmed_hold", "APPROVED"],
          ["bkg_expired", "EXPIRED"],
          ["bkg_held", "HELD"],
          ["bkg_pending", "PENDING"],
        ].map(([id, status]) => ({
          id,
          status,
          holdApprovedAt: null,
          holdApprovedById: null,
        })),
      );
    });

    it("SCRUM-172 [AC14] TC-172-20: existing holds start with no recorded expiry changes", async () => {
      const { rows } = await db.query(
        `SELECT count(*)::int AS changes FROM "HoldExpiryChange"`,
      );

      expect(rows).toEqual([{ changes: 0 }]);
    });
  },
);
