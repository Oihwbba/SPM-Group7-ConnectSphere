import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getEquipmentSchedule } from "@/app/(app)/equipment/actions";

// SCRUM-30 — View Equipment Conflicts, against a real Postgres. The unit tests
// mock Prisma; these prove the "current and future" filter, the CONFIRMED-only
// status filter, the event-name join and the conflict marking agree with the
// rows the database actually returns.
//
// They WRITE a throwaway Equipment row and its commitments, removed after each
// test, so they only run against a localhost database (CI's service container
// or the Docker DB) — never the shared Supabase database `.env` points at.
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

// Seeded APPROVED event and its name (prisma/seed.ts).
const APPROVED_EVENT_ID = "evt_approved";
const APPROVED_EVENT_NAME = "Approved — Research Symposium";

// A fixed far-future day, so no seeded commitment can overlap it and the
// schema's "start cannot be in the past" rule never trips.
const at = (hour: number, minute = 0) =>
  new Date(Date.UTC(2033, 2, 10, hour, minute)).toISOString();

describe.skipIf(!usesLocalDatabase)("SCRUM-30 — equipment schedule against Postgres", () => {
  let equipmentId: string;

  const reserve = (from: number, to: number, quantity: number, status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") =>
    prisma.reservation.create({
      data: {
        eventId: APPROVED_EVENT_ID,
        equipmentId,
        quantity,
        startAt: at(from),
        endAt: at(to),
        reservedById: TECH_SUPPORT.user!.id!,
        status,
      },
    });

  const outOfService = (
    from: number,
    to: number,
    quantity: number,
    reason: "MAINTENANCE" | "DAMAGED",
    note: string | null = null,
  ) =>
    prisma.equipmentUnavailability.create({
      data: {
        equipmentId,
        quantity,
        startAt: at(from),
        endAt: at(to),
        reason,
        note,
        recordedById: TECH_SUPPORT.user!.id!,
      },
    });

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue(TECH_SUPPORT);
    const pool = await prisma.equipment.create({
      data: { type: `Schedule test pool ${Date.now()}`, totalQuantity: 4 },
      select: { id: true },
    });
    equipmentId = pool.id;
  });

  beforeEach(async () => {
    await prisma.reservation.deleteMany({ where: { equipmentId } });
    await prisma.equipmentUnavailability.deleteMany({ where: { equipmentId } });
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { equipmentId } });
    await prisma.equipmentUnavailability.deleteMany({ where: { equipmentId } });
    await prisma.equipment.delete({ where: { id: equipmentId } });
  });

  describe("SCRUM-30 — View Equipment Conflicts", () => {
    it("AC 1: lists current and future commitments with the event name, and drops finished ones", async () => {
      await reserve(8, 10, 1); // finished before `from`
      await reserve(11, 14, 1); // still running at `from`
      await reserve(15, 17, 1); // in the future

      const result = await getEquipmentSchedule({ equipmentId, from: at(12) });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.entries.map((e) => e.startAt.toISOString())).toEqual([
          at(11),
          at(15),
        ]);
        expect(result.data.entries.every((e) => e.eventName === APPROVED_EVENT_NAME)).toBe(true);
        expect(result.data.fullyAvailable).toBe(false);
      }
    });

    it("AC 2 & 4: flags reservations that share time, naming each other", async () => {
      const first = await reserve(9, 12, 1);
      const second = await reserve(11, 14, 1);

      const result = await getEquipmentSchedule({ equipmentId, from: at(0) });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const byId = new Map(result.data.entries.map((e) => [e.id, e]));
        expect(byId.get(first.id)).toMatchObject({ hasConflict: true, conflictsWith: [second.id] });
        expect(byId.get(second.id)).toMatchObject({ hasConflict: true, conflictsWith: [first.id] });
      }
    });

    it("AC 3: reservations that touch at an endpoint are adjacent, not conflicting", async () => {
      await reserve(9, 12, 1);
      await reserve(12, 15, 1);

      const result = await getEquipmentSchedule({ equipmentId, from: at(0) });

      if (result.ok) expect(result.data.entries.some((e) => e.hasConflict)).toBe(false);
      expect(result.ok).toBe(true);
    });

    // Written straight to the table: the reservation action would refuse
    // this, but only the action enforces the pool, so the schedule must still
    // say plainly when the stored commitments exceed it.
    it("marks commitments that exceed the pool as over-committed", async () => {
      await reserve(9, 12, 3);
      await reserve(10, 13, 3);

      const result = await getEquipmentSchedule({ equipmentId, from: at(0) });

      if (result.ok) {
        expect(result.data.entries.every((e) => e.overCommitted)).toBe(true);
        expect(result.data.entries[0].committedDuringEntry).toBe(6);
      }
      expect(result.ok).toBe(true);
    });

    it("AC 5: shows the reason, note and period of unavailability, alongside reservations in time order", async () => {
      await reserve(14, 16, 1);
      await outOfService(9, 11, 2, "DAMAGED", "Cracked lens");

      const result = await getEquipmentSchedule({ equipmentId, from: at(0) });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.entries.map((e) => e.kind)).toEqual(["unavailability", "reservation"]);
        expect(result.data.entries[0]).toMatchObject({
          reason: "DAMAGED",
          note: "Cracked lens",
          quantity: 2,
          eventName: null,
        });
        expect(result.data.entries[0].endAt.getTime() - result.data.entries[0].startAt.getTime()).toBe(
          2 * 3600_000,
        );
      }
    });

    it("AC 6: an item with nothing committed from `from` onwards is reported fully available", async () => {
      await reserve(8, 10, 1); // finished before `from`, so it does not count
      await reserve(12, 14, 4, "CANCELLED");

      const result = await getEquipmentSchedule({ equipmentId, from: at(11) });

      expect(result).toMatchObject({
        ok: true,
        data: { fullyAvailable: true, entries: [], totalQuantity: 4 },
      });
    });
  });
});
