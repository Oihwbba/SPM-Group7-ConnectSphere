import { describe, it, expect, vi, afterAll, type Mock } from "vitest";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { confirmEvent, transitionEventStatus } from "@/app/(app)/events/actions";

// SCRUM-24 AC5 against a real database: a Confirmed event goes back to
// Planning only through an approved impactful change request (SCRUM-128) or a
// cancelled flagged arrangement (SCRUM-135 AC8, SCRUM-26), whose own tests
// prove those paths. Test cases: docs/testing/SCRUM-24.md.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

describe.skipIf(!usesLocalDatabase)("SCRUM-24 — a Confirmed event's status", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("SCRUM-24 [AC5] TC-24-06: deciding a Confirmed event again is refused and confirming it again changes nothing; it stays Confirmed", async () => {
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_coordinator", role: "COORDINATOR", name: "Cody", email: "coordinator@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });
    const { id } = await prisma.event.create({
      data: {
        name: `SCRUM-24 Confirmed ${Date.now()}`,
        status: "CONFIRMED",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2033-04-01T02:00:00Z"),
        endAt: new Date("2033-04-01T06:00:00Z"),
        expectedAttendance: 40,
      },
      select: { id: true },
    });
    try {
      for (const nextStatus of ["APPROVED", "REJECTED"] as const) {
        expect(
          (await transitionEventStatus({ eventId: id, nextStatus, decisionReason: "Try it.", rejectionOutcome: "NEW_REQUEST" })).ok,
        ).toBe(false);
      }
      // Confirming twice is a no-op (SCRUM-81), not a way back to Planning.
      await confirmEvent({ eventId: id });

      expect(
        await prisma.event.findUniqueOrThrow({ where: { id }, select: { status: true } }),
      ).toEqual({ status: "CONFIRMED" });
      expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(0);
    } finally {
      await prisma.notification.deleteMany({ where: { eventId: id } });
      await prisma.auditLog.deleteMany({ where: { entityId: id } });
      await prisma.event.delete({ where: { id } });
    }
  });
});
