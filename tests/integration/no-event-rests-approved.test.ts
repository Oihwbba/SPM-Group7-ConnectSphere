import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

// SCRUM-254 — no event rests in Approved (SCRUM-135 AC12). A scratch database
// is built from every migration before the chore's, given an event left
// Approved from before approval moved straight to Planning, and then
// migrated, so the test sees the upgrade itself (AC1) and then the rule it
// adds (AC2). It creates and drops its own database, so it only runs against
// a localhost server.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const MIGRATION = "20261030130000_no_event_rests_approved";
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((name) => /^\d{14}_/.test(name))
  .sort();
const sqlOf = (name: string) =>
  readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");

const scratchName = `connectsphere_approved_${Date.now()}`;
const urlFor = (database: string) => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${database}`;
  url.search = "";
  return url.toString();
};

const refusedAsApproved = { code: "23514", constraint: "event_never_rests_approved" };

describe.skipIf(!usesLocalDatabase)("SCRUM-254 — no event rests in Approved", () => {
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
        ('usr_o', 'o@test.local', 'Organiser', 'x', 'ORGANISER', now()),
        ('usr_c', 'c@test.local', 'Coordinator', 'x', 'COORDINATOR', now());
      INSERT INTO "Event" ("id", "name", "status", "organiserId", "coordinatorId", "updatedAt") VALUES
        ('evt_left_approved', 'Left Approved', 'APPROVED', 'usr_o', 'usr_c', now()),
        ('evt_planning', 'Planning', 'PLANNING', 'usr_o', 'usr_c', now()),
        ('evt_review', 'Under review', 'UNDER_REVIEW', 'usr_o', 'usr_c', now());
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

  const statusOf = async (id: string) =>
    (await db.query(`SELECT "status" FROM "Event" WHERE "id" = $1`, [id])).rows[0]?.status;

  const historyOf = async (id: string) =>
    (
      await db.query(
        `SELECT "action", "actorId", "fieldName", "oldValue", "newValue" FROM "AuditLog"
          WHERE "entityType" = 'Event' AND "entityId" = $1`,
        [id],
      )
    ).rows;

  it("SCRUM-254 [AC1] TC-254-01: an event left Approved is moved to Planning, with the move in its history as a system change", async () => {
    expect(await statusOf("evt_left_approved")).toBe("PLANNING");
    expect(await historyOf("evt_left_approved")).toEqual([
      {
        action: "STATUS_CHANGED",
        actorId: null,
        fieldName: "status",
        oldValue: "APPROVED",
        newValue: "PLANNING",
      },
    ]);
  });

  it("SCRUM-254 [AC1] TC-254-01: events in any other status are unchanged, with nothing added to their history", async () => {
    expect(await statusOf("evt_planning")).toBe("PLANNING");
    expect(await statusOf("evt_review")).toBe("UNDER_REVIEW");
    expect(await historyOf("evt_planning")).toEqual([]);
    expect(await historyOf("evt_review")).toEqual([]);
  });

  it("SCRUM-254 [AC2] TC-254-02: an event can't be stored as Approved, by insert or update, and nothing is written", async () => {
    await expect(
      db.query(`INSERT INTO "Event" ("id", "name", "status", "organiserId", "updatedAt")
                VALUES ('evt_new_approved', 'New', 'APPROVED', 'usr_o', now())`),
    ).rejects.toMatchObject(refusedAsApproved);
    expect(await statusOf("evt_new_approved")).toBeUndefined();

    await expect(
      db.query(`UPDATE "Event" SET "status" = 'APPROVED' WHERE "id" = 'evt_review'`),
    ).rejects.toMatchObject(refusedAsApproved);
    expect(await statusOf("evt_review")).toBe("UNDER_REVIEW");
  });

  it("SCRUM-254 [AC2] TC-254-02: the move approval makes, Under Review to Planning, is still allowed", async () => {
    await db.query(`UPDATE "Event" SET "status" = 'PLANNING' WHERE "id" = 'evt_review'`);
    expect(await statusOf("evt_review")).toBe("PLANNING");
  });
});
