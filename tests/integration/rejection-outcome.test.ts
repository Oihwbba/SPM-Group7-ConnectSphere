import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, afterAll, vi, type Mock } from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startRequestFromRejected } from "@/app/(app)/events/actions";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ORGANISER: Session = {
  user: {
    id: "usr_organiser",
    role: "ORGANISER",
    name: "Olivia Organiser",
    email: "organiser@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

// SCRUM-126 — every rejected event carries the outcome its Coordinator chose,
// enforced by the database (20261003120000_event_rejection_outcome), not only
// by the reject action. Test cases: docs/testing/SCRUM-126.md.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const MIGRATION = join(
  process.cwd(),
  "prisma/migrations/20261003120000_event_rejection_outcome/migration.sql",
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

const rejectedEvent = {
  status: "REJECTED" as const,
  organiserId: "usr_organiser",
  decisionReason: "Attendance exceeds every venue.",
};

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-126 — a rejection always records its outcome",
  () => {
    afterAll(async () => {
      await prisma.$disconnect();
    });

    it("SCRUM-126 [AC1] TC-126-02: the database refuses a rejected event without an outcome", async () => {
      await expect(
        prisma.event.create({
          data: { ...rejectedEvent, name: "SCRUM-126 no outcome" },
        }),
      ).rejects.toThrow(/event_rejection_has_outcome/);
    });

    it("SCRUM-126 [AC1] TC-126-01: a rejected event with an outcome is stored", async () => {
      const event = await prisma.event.create({
        data: {
          ...rejectedEvent,
          name: "SCRUM-126 with outcome",
          rejectionOutcome: "NEW_REQUEST",
        },
        select: { id: true, rejectionOutcome: true },
      });
      try {
        expect(event.rejectionOutcome).toBe("NEW_REQUEST");
      } finally {
        await prisma.event.delete({ where: { id: event.id } });
      }
    });

    it("SCRUM-126 [AC4] TC-126-10: two Start New Request clicks at the same moment start exactly one Draft", async () => {
      (auth as unknown as Mock).mockResolvedValue(ORGANISER);
      const name = `SCRUM-126 race ${Date.now()}`;
      const rejected = await prisma.event.create({
        data: { ...rejectedEvent, name, rejectionOutcome: "NEW_REQUEST" },
        select: { id: true },
      });
      try {
        const [a, b] = await Promise.all([
          startRequestFromRejected({ eventId: rejected.id }),
          startRequestFromRejected({ eventId: rejected.id }),
        ]);

        const drafts = await prisma.event.findMany({
          where: { name, status: "DRAFT" },
          select: { id: true },
        });
        expect(drafts).toHaveLength(1);
        // Both clicks are told about the same Draft; only one created it.
        expect([a, b]).toEqual(
          expect.arrayContaining([
            { ok: true, data: { id: drafts[0].id, created: true } },
            { ok: true, data: { id: drafts[0].id, created: false } },
          ]),
        );
      } finally {
        const ids = (
          await prisma.event.findMany({ where: { name }, select: { id: true } })
        ).map((e) => e.id);
        await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
        await prisma.event.deleteMany({ where: { id: { in: ids } } });
      }
    });

    it("SCRUM-126 [AC7] TC-126-09: the migration marks rejections recorded before it as Amend and resubmit, and leaves other events without an outcome", async () => {
      let migrated: Record<string, string | null> = {};

      // Rebuild the pre-migration state, run the real migration over it, and
      // roll everything back so the shared test database is left as it was.
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `ALTER TABLE "Event" DROP CONSTRAINT "event_rejection_has_outcome"`,
          );
          await tx.$executeRawUnsafe(
            `ALTER TABLE "Event" DROP COLUMN "rejectionOutcome"`,
          );
          await tx.$executeRawUnsafe(`DROP TYPE "RejectionOutcome"`);
          await tx.$executeRaw`
          INSERT INTO "Event" ("id", "name", "status", "organiserId", "decisionReason", "updatedAt")
          VALUES ('evt_scrum126_old_rejection', 'SCRUM-126 old rejection', 'REJECTED', 'usr_organiser', 'Too large', now()),
                 ('evt_scrum126_old_draft', 'SCRUM-126 old draft', 'DRAFT', 'usr_organiser', NULL, now())`;

          for (const statement of migrationStatements()) {
            await tx.$executeRawUnsafe(statement);
          }

          const rows = await tx.$queryRaw<
            { id: string; rejectionOutcome: string | null }[]
          >`SELECT "id", "rejectionOutcome"::text AS "rejectionOutcome" FROM "Event"
          WHERE "id" LIKE 'evt_scrum126_old_%'`;
          migrated = Object.fromEntries(
            rows.map((r) => [r.id, r.rejectionOutcome]),
          );
          throw new Rollback();
        }),
      ).rejects.toBeInstanceOf(Rollback);

      expect(migrated).toEqual({
        evt_scrum126_old_rejection: "AMEND_AND_RESUBMIT",
        evt_scrum126_old_draft: null,
      });
      expect(
        await prisma.event.count({
          where: { id: { startsWith: "evt_scrum126_old" } },
        }),
      ).toBe(0);
    });
  },
);
