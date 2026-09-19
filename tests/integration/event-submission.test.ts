import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { submitEventRequest } from "@/app/(app)/events/actions";

// SCRUM-14 — a repeat submission of the same event must not create a second
// request or send another notification. Writes to the database, so it only
// runs against a localhost database (CI's service container, or the Docker
// DB), never the shared Supabase one that `.env` points at.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

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

describe.skipIf(!usesLocalDatabase)("event submission — repeat submission (SCRUM-14)", () => {
  let eventId: string;

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue(ORGANISER);
    const draft = await prisma.event.create({
      data: {
        name: `SCRUM-14 Repeat Submission ${Date.now()}`,
        status: "DRAFT",
        organiserId: "usr_organiser",
      },
      select: { id: true },
    });
    eventId = draft.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  it("SCRUM-14 AC: submitting the same event again is refused, creates no second request and sends no additional notification", async () => {
    const input = {
      id: eventId,
      name: "SCRUM-14 Repeat Submission",
      purpose: "Repeat submission coverage",
      description: "SCRUM-14 integration coverage",
      startAt: "2031-07-01T09:00:00.000Z",
      endAt: "2031-07-01T17:00:00.000Z",
      expectedAttendance: 10,
      venueRequirements: "Any room",
      accessibilityNeeds: "None",
      preferredLayout: "Classroom",
      equipmentRequirements: "None",
      registrationNotes: "None",
    };

    const first = await submitEventRequest(input);
    expect(first.ok).toBe(true);

    const eventsBefore = await prisma.event.count({
      where: { organiserId: "usr_organiser" },
    });
    const notificationsBefore = await prisma.notification.count({
      where: { eventId },
    });

    const second = await submitEventRequest(input);

    expect(second.ok).toBe(false);
    expect(
      await prisma.event.count({ where: { organiserId: "usr_organiser" } }),
    ).toBe(eventsBefore);
    expect(await prisma.notification.count({ where: { eventId } })).toBe(
      notificationsBefore,
    );
  });
});
