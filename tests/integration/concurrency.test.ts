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
import { createReservation } from "@/app/(app)/equipment/actions";
import { transitionEventStatus } from "@/app/(app)/events/actions";

// The "at the same moment" cases (SCRUM-31/53/74). These are the acceptance
// criteria the database constraints and row locks exist to satisfy, so each one
// needs a real concurrent test against a live Postgres — see
// docs/data-model.md §4.4. Replace each `it.todo` as the feature lands.
describe("concurrency", () => {
  // Enforced by the `booking_no_double_booking` EXCLUDE constraint.
  it.todo("rejects the second of two simultaneous overlapping approvals (SCRUM-53)");
  it.todo("allows a booking that starts exactly when another ends (SCRUM-38/50)");

  // Enforced by SELECT ... FOR UPDATE on the Event row.
  it.todo("gives the last remaining place to exactly one of two simultaneous registrations (SCRUM-74)");
});

// SCRUM-31 — enforced by SELECT ... FOR UPDATE on the Equipment row; a counted
// pool cannot use an exclusion constraint. These WRITE to the database (a
// throwaway Equipment row and its reservations, removed afterwards), so they only
// run against a localhost database — CI's service container, or the Docker DB —
// and never against the shared Supabase database that `.env` points at.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const TECH_SUPPORT: Session = {
  user: {
    id: "usr_techsupport",
    role: "TECH_SUPPORT",
    name: "Theo Tech",
    email: "techsupport@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

// Seeded APPROVED event (prisma/seed.ts).
const APPROVED_EVENT_ID = "evt_approved";

describe.skipIf(!usesLocalDatabase)("concurrency — equipment pool (SCRUM-31)", () => {
  let equipmentId: string;

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue(TECH_SUPPORT);
    // A pool of exactly ONE unit, so any over-allocation is unmistakable.
    const pool = await prisma.equipment.create({
      data: { type: `Concurrency test pool ${Date.now()}`, totalQuantity: 1 },
      select: { id: true },
    });
    equipmentId = pool.id;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { equipmentId } });
    await prisma.equipment.delete({ where: { id: equipmentId } });
    await prisma.$disconnect();
  });

  it("does not over-allocate equipment when two staff reserve the last unit (SCRUM-31)", async () => {
    const period = {
      eventId: APPROVED_EVENT_ID,
      equipmentId,
      quantity: 1,
      startAt: "2031-03-01T01:00:00.000Z",
      endAt: "2031-03-01T05:00:00.000Z",
    };

    const results = await Promise.all([
      createReservation(period),
      createReservation(period),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);

    const reserved = await prisma.reservation.aggregate({
      where: {
        equipmentId,
        status: "CONFIRMED",
        startAt: { lt: new Date(period.endAt) },
        endAt: { gt: new Date(period.startAt) },
      },
      _sum: { quantity: true },
    });
    expect(reserved._sum.quantity).toBe(1);
  });

  it("accepts reservations that touch at an endpoint — periods sharing an endpoint do not overlap (SCRUM-31)", async () => {
    const base = { eventId: APPROVED_EVENT_ID, equipmentId, quantity: 1 };

    // One unit, three back-to-back periods: each ends exactly when the next begins.
    const morning = await createReservation({
      ...base,
      startAt: "2031-04-01T01:00:00.000Z",
      endAt: "2031-04-01T03:00:00.000Z",
    });
    const midday = await createReservation({
      ...base,
      startAt: "2031-04-01T03:00:00.000Z",
      endAt: "2031-04-01T05:00:00.000Z",
    });
    const dawn = await createReservation({
      ...base,
      startAt: "2031-03-31T23:00:00.000Z",
      endAt: "2031-04-01T01:00:00.000Z",
    });

    expect(morning.ok).toBe(true);
    expect(midday.ok).toBe(true);
    expect(dawn.ok).toBe(true);
  });
});

describe.skipIf(!usesLocalDatabase)("concurrency — status transitions (SCRUM-24)", () => {
  let eventId: string | undefined;

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue(TECH_SUPPORT);
    const event = await prisma.event.create({
      data: {
        name: `SCRUM-24 Concurrency Event ${Date.now()}`,
        status: "SUBMITTED",
        organiserId: "usr_organiser",
      },
      select: { id: true },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    if (eventId) {
      await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
      await prisma.event.delete({ where: { id: eventId } });
    }
  });

  it("SCRUM-24: the loser of two simultaneous decisions is told to refresh, and no audit entry is written", async () => {
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_coord", role: "COORDINATOR", name: "Cody", email: "coordinator@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });

    const results = await Promise.all([
      transitionEventStatus({ eventId, nextStatus: "APPROVED" }),
      transitionEventStatus({ eventId, nextStatus: "REJECTED", decisionReason: "Too large" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
  });
});

