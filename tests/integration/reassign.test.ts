import { describe, it, expect, vi, beforeAll, afterAll, type Mock } from "vitest";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { reassignCoordinator } from "@/app/(app)/all-events/actions";

// SCRUM-21 against a real Postgres: only the session is mocked. It writes a
// throwaway event and a second Lead, so it runs only against a localhost
// database (CI's, or the Docker one), never the shared Supabase one.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const asLead = (id: string) => ({
  user: { id, role: "COORDINATOR_LEAD", name: "Lead", email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});

describe.skipIf(!usesLocalDatabase)("SCRUM-21 — reassigning against a real database", () => {
  let eventId: string;
  let secondLeadId: string;

  beforeAll(async () => {
    const [event, lead] = await Promise.all([
      prisma.event.create({
        data: {
          name: `SCRUM-21 Reassign Event ${Date.now()}`,
          status: "PLANNING",
          organiserId: "usr_organiser",
          coordinatorId: "usr_coordinator",
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `reassign-lead-${Date.now()}@test.local`,
          name: "Second Lead",
          role: "COORDINATOR_LEAD",
          passwordHash: "not-used-in-this-test",
        },
        select: { id: true },
      }),
    ]);
    eventId = event.id;
    secondLeadId = lead.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.delete({ where: { id: eventId } });
    await prisma.user.delete({ where: { id: secondLeadId } });
  });

  it("SCRUM-21 [AC2, AC9] TC-21-02: [Concurrency] two Leads reassign the same event at the same moment: exactly one is saved, the event has one Coordinator, and one history entry exists", async () => {
    (auth as unknown as Mock)
      .mockResolvedValueOnce(asLead("usr_coordinatorlead"))
      .mockResolvedValueOnce(asLead(secondLeadId));

    const results = await Promise.all([
      reassignCoordinator({ eventId, coordinatorId: "usr_coordinator_2" }),
      reassignCoordinator({ eventId, coordinatorId: "usr_coordinator_2" }),
    ]);

    const saved = results.filter((r) => r.ok && r.data.changed);
    expect(saved).toHaveLength(1);
    const event = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { coordinatorId: true, status: true },
    });
    expect(event).toEqual({ coordinatorId: "usr_coordinator_2", status: "PLANNING" });
    expect(
      await prisma.auditLog.findMany({
        where: { entityId: eventId, action: "REASSIGNED" },
        select: { oldValue: true, newValue: true },
      }),
    ).toEqual([{ oldValue: "usr_coordinator", newValue: "usr_coordinator_2" }]);
    expect(
      await prisma.notification.count({
        where: { eventId, type: "COORDINATOR_REASSIGNED" },
      }),
    ).toBe(3);
  });
});
