import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

// SCRUM-253 — every venue has opening hours for each day of the week. A
// scratch database is built from every migration before the chore's, given
// venues in each shape an older database can hold, and then migrated, so the
// test sees the upgrade itself (AC1) and then the rule it adds (AC2). It
// creates and drops its own database, so it only runs against a localhost
// server.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const MIGRATION = "20261030120000_every_venue_has_hours";
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((name) => /^\d{14}_/.test(name))
  .sort();
const sqlOf = (name: string) =>
  readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");

const scratchName = `connectsphere_week_${Date.now()}`;
const urlFor = (database: string) => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${database}`;
  url.search = "";
  return url.toString();
};

const WEEK = [1, 2, 3, 4, 5, 6, 7];
const refusedForNoWeek = { code: "23514", constraint: "venue_has_week_of_hours" };

describe.skipIf(!usesLocalDatabase)("SCRUM-253 — every venue has opening hours", () => {
  const admin = new Client({ connectionString: urlFor("postgres") });
  const db = new Client({ connectionString: urlFor(scratchName) });

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${scratchName}"`);
    await db.connect();
    for (const name of migrations.slice(0, migrations.indexOf(MIGRATION))) {
      await db.query(sqlOf(name));
    }
    // A venue SCRUM-34's migration left without hours, one with its week, and
    // one with only Monday to Wednesday (no screen writes that).
    await db.query(`
      INSERT INTO "Venue" ("id", "name", "location", "capacity", "updatedAt") VALUES
        ('ven_none', 'None', 'A', 100, now()),
        ('ven_week', 'Week', 'B', 100, now()),
        ('ven_partial', 'Partial', 'C', 100, now());
      INSERT INTO "VenueOpeningHours" ("id", "venueId", "weekday", "opensMinute", "closesMinute")
      SELECT 'w' || d, 'ven_week', d,
             CASE WHEN d <= 5 THEN 540 END, CASE WHEN d <= 5 THEN 1080 END
        FROM generate_series(1, 7) AS d;
      INSERT INTO "VenueOpeningHours" ("id", "venueId", "weekday", "opensMinute", "closesMinute")
      SELECT 'p' || d, 'ven_partial', d, 600, 1200 FROM generate_series(1, 3) AS d;
    `);
    await db.query(sqlOf(MIGRATION));
    // Replaying every earlier migration takes a few seconds alone, and over
    // Vitest's 10 s hook default while the other files run alongside it.
  }, 60_000);

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

  const venueCount = async (id: string) =>
    Number((await db.query(`SELECT count(*) FROM "Venue" WHERE "id" = $1`, [id])).rows[0].count);

  /** Runs `statements` as one transaction, rolling back if any of them or the commit fails. */
  const inTransaction = async (statements: string) => {
    await db.query("BEGIN");
    try {
      await db.query(statements);
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  };

  it("SCRUM-253 [AC1] TC-253-01: a venue with no hours gets 00:00–23:59 on all seven days", async () => {
    expect(await hoursOf("ven_none")).toEqual(WEEK.map((day) => [day, 0, 1439]));
  });

  it("SCRUM-253 [AC1] TC-253-01: a venue that already has its week is unchanged", async () => {
    expect(await hoursOf("ven_week")).toEqual([
      [1, 540, 1080],
      [2, 540, 1080],
      [3, 540, 1080],
      [4, 540, 1080],
      [5, 540, 1080],
      [6, null, null],
      [7, null, null],
    ]);
  });

  it("SCRUM-253 [AC1] TC-253-01: a venue with only some days keeps them, and the rest are Closed, as a missing day already read", async () => {
    expect(await hoursOf("ven_partial")).toEqual([
      [1, 600, 1200],
      [2, 600, 1200],
      [3, 600, 1200],
      [4, null, null],
      [5, null, null],
      [6, null, null],
      [7, null, null],
    ]);
  });

  it("SCRUM-253 [AC2] TC-253-04: a venue saved without hours is refused when its transaction commits, and nothing is written", async () => {
    await expect(
      db.query(`INSERT INTO "Venue" ("id", "name", "location", "capacity", "updatedAt")
                VALUES ('ven_bare', 'Bare', 'D', 50, now())`),
    ).rejects.toMatchObject(refusedForNoWeek);
    expect(await venueCount("ven_bare")).toBe(0);
  });

  it("SCRUM-253 [AC2] TC-253-04: six days are refused, and nothing is written", async () => {
    await expect(
      inTransaction(`
        INSERT INTO "Venue" ("id", "name", "location", "capacity", "updatedAt")
          VALUES ('ven_six', 'Six', 'D', 50, now());
        INSERT INTO "VenueOpeningHours" ("id", "venueId", "weekday", "opensMinute", "closesMinute")
          SELECT 's' || d, 'ven_six', d, 540, 1080 FROM generate_series(1, 6) AS d;
      `),
    ).rejects.toMatchObject(refusedForNoWeek);
    expect(await venueCount("ven_six")).toBe(0);
    expect(await hoursOf("ven_six")).toEqual([]);
  });

  it("SCRUM-253 [AC2] TC-253-04: deleting one day's row is refused, and the venue keeps its week", async () => {
    await expect(
      db.query(`DELETE FROM "VenueOpeningHours" WHERE "venueId" = 'ven_week' AND "weekday" = 7`),
    ).rejects.toMatchObject(refusedForNoWeek);
    expect(await hoursOf("ven_week")).toHaveLength(7);
  });

  it("SCRUM-253 [AC2] TC-253-05: a venue saved with its seven days in one transaction is kept", async () => {
    await inTransaction(`
      INSERT INTO "Venue" ("id", "name", "location", "capacity", "updatedAt")
        VALUES ('ven_seven', 'Seven', 'D', 50, now());
      INSERT INTO "VenueOpeningHours" ("id", "venueId", "weekday", "opensMinute", "closesMinute")
        SELECT 'v' || d, 'ven_seven', d, 540, 1080 FROM generate_series(1, 7) AS d;
    `);
    expect(await venueCount("ven_seven")).toBe(1);
    expect(await hoursOf("ven_seven")).toHaveLength(7);
  });

  it("SCRUM-253 [AC2] TC-253-05: changing a day's times, or replacing a day's row in one transaction, is allowed", async () => {
    await db.query(
      `UPDATE "VenueOpeningHours" SET "opensMinute" = 600 WHERE "venueId" = 'ven_week' AND "weekday" = 1`,
    );
    await inTransaction(`
      DELETE FROM "VenueOpeningHours" WHERE "venueId" = 'ven_week' AND "weekday" = 6;
      INSERT INTO "VenueOpeningHours" ("id", "venueId", "weekday", "opensMinute", "closesMinute")
        VALUES ('w6b', 'ven_week', 6, 600, 900);
    `);
    expect((await hoursOf("ven_week")).filter(([day]) => day === 1 || day === 6)).toEqual([
      [1, 600, 1080],
      [6, 600, 900],
    ]);
  });

  it("SCRUM-253 [AC2] TC-253-05: deleting a venue takes its hours with it", async () => {
    await db.query(`DELETE FROM "Venue" WHERE "id" = 'ven_seven'`);
    expect(await venueCount("ven_seven")).toBe(0);
    expect(await hoursOf("ven_seven")).toEqual([]);
  });
});
