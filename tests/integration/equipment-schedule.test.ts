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
import {
  getEquipmentAvailability,
  getEquipmentSchedule,
} from "@/app/(app)/equipment/actions";
import {
  checkQuantity,
  requestedPeriodTone,
  splitByPeriod,
} from "@/lib/equipment/availability";

// SCRUM-30 — View Equipment Conflicts, against a real Postgres. The unit tests
// mock Prisma; these prove the "current and future" filter, the CONFIRMED-only
// status filter and the event-name join agree with the rows the database
// actually returns, and that splitting those rows by the requested period
// agrees with the availability the reservation is checked against.
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
const APPROVED_EVENT_NAME = "Planning — Research Symposium";

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
    it("SCRUM-30 [AC1]: lists current and future commitments with the event name, and drops finished ones", async () => {
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

    // Requested period for the cases below: 12:00–15:00.
    const period = { startAt: new Date(at(12)), endAt: new Date(at(15)) };
    const periodInput = { equipmentId: "", startAt: at(12), endAt: at(15) };

    it("SCRUM-30 [AC2, AC5]: splits real commitments by the requested period, with touching ones under other commitments", async () => {
      const touchesStart = await reserve(9, 12, 1);
      const inside = await reserve(13, 14, 1);
      const straddlesEnd = await reserve(14, 17, 1);
      const touchesEnd = await reserve(15, 18, 1);
      const later = await reserve(18, 20, 1);

      const result = await getEquipmentSchedule({ equipmentId, from: at(0) });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const { during, other } = splitByPeriod(result.data.entries, period);
        expect(during.map((e) => e.id)).toEqual([inside.id, straddlesEnd.id]);
        expect(other.map((e) => e.id)).toEqual([touchesStart.id, touchesEnd.id, later.id]);
      }
    });

    it("SCRUM-30 [AC3]: commitments during the period are amber while the request still fits", async () => {
      await reserve(13, 14, 2);
      await reserve(14, 17, 1);

      const availability = await getEquipmentAvailability({ ...periodInput, equipmentId });

      expect(availability).toMatchObject({ ok: true, data: { available: 2 } });
      if (availability.ok) {
        const verdict = checkQuantity(availability.data, 2);
        expect(verdict.sufficient).toBe(true);
        expect(requestedPeriodTone(verdict)).toBe("amber");
      }
    });

    it("SCRUM-30 [AC4]: they turn red, with the shortfall, once the request exceeds what is free", async () => {
      await reserve(13, 14, 2);
      await reserve(14, 17, 1);

      const availability = await getEquipmentAvailability({ ...periodInput, equipmentId });

      expect(availability.ok).toBe(true);
      if (availability.ok) {
        const verdict = checkQuantity(availability.data, 3);
        expect(verdict).toMatchObject({ sufficient: false, available: 2, shortfall: 1 });
        expect(requestedPeriodTone(verdict)).toBe("red");
      }
    });

    // Written straight to the table: two reservations outside the period that
    // together exceed the pool. They are other commitments — neutral, and not
    // part of what is free during the requested period.
    it("SCRUM-30 [AC2]: other commitments, even ones that overlap each other, do not reduce the requested period's availability", async () => {
      await reserve(9, 12, 4); // touches the start
      await reserve(15, 18, 4); // touches the end
      await reserve(18, 21, 3);
      await reserve(19, 22, 3); // overlaps the one before it

      const [schedule, availability] = await Promise.all([
        getEquipmentSchedule({ equipmentId, from: at(0) }),
        getEquipmentAvailability({ ...periodInput, equipmentId }),
      ]);

      expect(availability).toMatchObject({ ok: true, data: { available: 4, committed: 0 } });
      if (schedule.ok) {
        const { during, other } = splitByPeriod(schedule.data.entries, period);
        expect(during).toEqual([]);
        expect(other).toHaveLength(4);
      }
      expect(schedule.ok).toBe(true);
    });

    it("SCRUM-30 [AC6]: shows the reason, note and period of unavailability, alongside reservations in time order", async () => {
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

    it("SCRUM-30 [AC7]: an item with nothing committed from `from` onwards is reported fully available", async () => {
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
