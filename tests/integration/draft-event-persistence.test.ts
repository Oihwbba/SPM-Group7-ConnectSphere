import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { createDraftEvent } from "@/app/(app)/events/actions";
import { prisma } from "@/lib/db";

// SCRUM-15 AC2 - draft persistence is database-facing behavior. The unit tests
// assert the Prisma payload; this integration test proves Postgres stores and
// updates the draft timestamps through the real server action.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const ORGANISER: Session = {
  user: {
    id: "usr_organiser",
    role: "ORGANISER",
    name: "Olivia Organiser",
    email: "organiser@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(ORGANISER);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-15 AC2 - draft event date persistence",
  () => {
    it("SCRUM-15 [AC2]: stores and updates draft start/end dates through the real database", async () => {
      const name = `SCRUM-15 draft date persistence ${Date.now()}`;
      const createdStart = "2031-09-01T02:00:00.000Z";
      const createdEnd = "2031-09-01T04:00:00.000Z";
      const updatedStart = "2031-09-02T03:30:00.000Z";
      const updatedEnd = "2031-09-02T06:00:00.000Z";
      let eventId: string | undefined;

      try {
        const createResult = await createDraftEvent({
          name,
          startAt: createdStart,
          endAt: createdEnd,
        });

        expect(createResult.ok).toBe(true);
        if (!createResult.ok) return;
        eventId = createResult.data.id;

        await expect(
          prisma.event.findUniqueOrThrow({
            where: { id: eventId },
            select: { startAt: true, endAt: true, status: true },
          }),
        ).resolves.toMatchObject({
          startAt: new Date(createdStart),
          endAt: new Date(createdEnd),
          status: "DRAFT",
        });

        const updateResult = await createDraftEvent({
          id: eventId,
          name: `${name} updated`,
          startAt: updatedStart,
          endAt: updatedEnd,
        });

        expect(updateResult.ok).toBe(true);

        await expect(
          prisma.event.findUniqueOrThrow({
            where: { id: eventId },
            select: { startAt: true, endAt: true, status: true },
          }),
        ).resolves.toMatchObject({
          startAt: new Date(updatedStart),
          endAt: new Date(updatedEnd),
          status: "DRAFT",
        });
      } finally {
        if (eventId) {
          await prisma.event.deleteMany({ where: { id: eventId } });
        }
      }
    });
  },
);
