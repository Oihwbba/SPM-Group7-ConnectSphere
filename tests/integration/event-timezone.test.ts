import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, afterAll } from "vitest";

import { prisma } from "@/lib/db";

// SCRUM-129 — every event is a Singapore event, enforced by the database
// (20261002120000_event_timezone_singapore), not only by the server actions.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const MIGRATION = join(
  process.cwd(),
  "prisma/migrations/20261002120000_event_timezone_singapore/migration.sql",
);

/** The migration's statements, without comments, one per element. */
function migrationStatements(): string[] {
  return readFileSync(MIGRATION, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

class Rollback extends Error {}

describe.skipIf(!usesLocalDatabase)("SCRUM-129 — event timezone is always Asia/Singapore", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("SCRUM-129 [AC1] TC-129-01: [Singapore timezone] a new event with no timezone given is stored as Asia/Singapore", async () => {
    const event = await prisma.event.create({
      data: { name: "SCRUM-129 default zone", organiserId: "usr_organiser" },
      select: { id: true, timezone: true },
    });
    try {
      expect(event.timezone).toBe("Asia/Singapore");
    } finally {
      await prisma.event.delete({ where: { id: event.id } });
    }
  });

  it("SCRUM-129 [AC1] TC-129-02: [Singapore timezone] the database refuses an event stored with any other timezone", async () => {
    await expect(
      prisma.event.create({
        data: { name: "SCRUM-129 other zone", organiserId: "usr_organiser", timezone: "UTC" },
      }),
    ).rejects.toThrow(/event_timezone_singapore/);
  });

  it("SCRUM-129 [AC1] TC-129-02: [Singapore timezone] the database refuses an event with no timezone", async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO "Event" ("id", "name", "status", "organiserId", "timezone", "updatedAt")
        VALUES ('evt_scrum129_null', 'SCRUM-129 null zone', 'DRAFT', 'usr_organiser', NULL, now())`,
    ).rejects.toThrow(/null/i);
  });

  it("SCRUM-129 [AC2] TC-129-03: [Existing events] the migration relabels an event saved under another timezone and keeps its stored instants", async () => {
    const startAt = new Date("2031-08-01T13:00:00.000Z");
    const endAt = new Date("2031-08-01T21:00:00.000Z");
    let migrated: { timezone: string; startAt: Date | null; endAt: Date | null } | null = null;

    // Rebuild the pre-migration state, run the real migration over it, and
    // roll everything back so the shared test database is left as it was.
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`ALTER TABLE "Event" DROP CONSTRAINT "event_timezone_singapore"`);
        await tx.$executeRawUnsafe(`ALTER TABLE "Event" ALTER COLUMN "timezone" DROP NOT NULL`);
        await tx.$executeRaw`
          INSERT INTO "Event" ("id", "name", "status", "organiserId", "startAt", "endAt", "timezone", "updatedAt")
          VALUES ('evt_scrum129_legacy', 'SCRUM-129 legacy', 'DRAFT', 'usr_organiser', ${startAt}, ${endAt}, 'America/New_York (EST/EDT)', now()),
                 ('evt_scrum129_legacy_null', 'SCRUM-129 legacy null', 'DRAFT', 'usr_organiser', NULL, NULL, NULL, now())`;

        for (const statement of migrationStatements()) {
          await tx.$executeRawUnsafe(statement);
        }

        migrated = await tx.event.findUniqueOrThrow({
          where: { id: "evt_scrum129_legacy" },
          select: { timezone: true, startAt: true, endAt: true },
        });
        const fromNull = await tx.event.findUniqueOrThrow({
          where: { id: "evt_scrum129_legacy_null" },
          select: { timezone: true },
        });
        expect(fromNull.timezone).toBe("Asia/Singapore");
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);

    expect(migrated).toEqual({ timezone: "Asia/Singapore", startAt, endAt });
    expect(await prisma.event.count({ where: { id: { startsWith: "evt_scrum129_legacy" } } })).toBe(0);
  });
});
