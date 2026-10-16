import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

// SCRUM-34 AC3 — what the opening-hours migration does to venues whose hours
// were free text. A scratch database is built from every migration before
// it, given venues in the shapes the seed wrote, and then migrated, so the
// test sees the upgrade itself. It creates and drops its own database, so it
// only runs against a localhost server.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const MIGRATION = "20261015120000_venue_opening_hours";
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((name) => /^\d{14}_/.test(name))
  .sort();
const sqlOf = (name: string) =>
  readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");

const scratchName = `connectsphere_hours_${Date.now()}`;
const urlFor = (database: string) => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${database}`;
  url.search = "";
  return url.toString();
};

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-34 — the opening-hours migration on existing venues",
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
        INSERT INTO "Venue" ("id", "name", "location", "capacity", "operatingHours", "updatedAt") VALUES
          ('ven_daily', 'Daily', 'A', 100, 'Mon–Sun 07:00–23:00', now()),
          ('ven_weekdays', 'Weekdays', 'B', 100, 'Mon–Fri 09:00–18:00', now()),
          ('ven_free_text', 'Free text', 'C', 100, 'By arrangement', now()),
          ('ven_none', 'None', 'D', 100, NULL, now());
      `);
      await db.query(sqlOf(MIGRATION));
    });

    afterAll(async () => {
      await db.end();
      await admin.query(`DROP DATABASE IF EXISTS "${scratchName}"`);
      await admin.end();
    });

    const hoursOf = async (venueId: string) =>
      (
        await db.query(
          `SELECT "weekday", "opensMinute", "closesMinute" FROM "VenueOpeningHours"
            WHERE "venueId" = $1 ORDER BY "weekday"`,
          [venueId],
        )
      ).rows.map((r) => [r.weekday, r.opensMinute, r.closesMinute]);

    it("SCRUM-34 [AC3] TC-34-17: Mon–Sun hours become the same hours every day", async () => {
      expect(await hoursOf("ven_daily")).toEqual(
        [1, 2, 3, 4, 5, 6, 7].map((day) => [day, 420, 1380]),
      );
    });

    it("SCRUM-34 [AC3] TC-34-17: Mon–Fri hours open the weekdays and close the weekend", async () => {
      expect(await hoursOf("ven_weekdays")).toEqual([
        [1, 540, 1080],
        [2, 540, 1080],
        [3, 540, 1080],
        [4, 540, 1080],
        [5, 540, 1080],
        [6, null, null],
        [7, null, null],
      ]);
    });

    it("SCRUM-34 [AC3] TC-34-17: hours that can't be read, or none at all, leave no hours recorded", async () => {
      expect(await hoursOf("ven_free_text")).toEqual([]);
      expect(await hoursOf("ven_none")).toEqual([]);
    });

    it("SCRUM-34 [AC3] TC-34-17: the free-text column is kept, with its text", async () => {
      const kept = await db.query(
        `SELECT "operatingHours" FROM "Venue" WHERE "id" = 'ven_weekdays'`,
      );
      expect(kept.rows).toEqual([{ operatingHours: "Mon–Fri 09:00–18:00" }]);
    });
  },
);
