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
  createReservation,
  getAllEquipmentAvailability,
  getEquipmentAvailability,
} from "@/app/(app)/equipment/actions";

// SCRUM-29 — Check Equipment Availability, against a real Postgres. The unit
// tests mock Prisma; these prove the half-open SQL filters, the CONFIRMED-only
// status filter and the peak arithmetic agree with the database, and that the
// fix reaches the locked reservation path, where the old sum refused
// reservations that were genuinely free.
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

// Seeded APPROVED event (prisma/seed.ts).
const APPROVED_EVENT_ID = "evt_approved";

// A fixed far-future day, so no seeded commitment can overlap it and the
// schema's "start cannot be in the past" rule never trips.
const at = (hour: number, minute = 0) =>
  new Date(Date.UTC(2033, 2, 10, hour, minute)).toISOString();

describe.skipIf(!usesLocalDatabase)("SCRUM-29 — equipment availability against Postgres", () => {
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

  const reservationCount = () => prisma.reservation.count({ where: { equipmentId } });

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue(TECH_SUPPORT);
    const pool = await prisma.equipment.create({
      data: { type: `Availability test pool ${Date.now()}`, totalQuantity: 4 },
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

  describe("SCRUM-29 — Check Equipment Availability", () => {
    // The bug this story's fix closes: two reservations of three that never
    // share an instant commit three units, not six. The old SQL sum reported
    // 0 of 4 free across 09:00–16:00 and refused a reservation that fits.
    it("AC 1 & 4: reports the busiest instant, not the sum of everything touching the period", async () => {
      await reserve(9, 12, 3);
      await reserve(13, 16, 3);

      const result = await getEquipmentAvailability({
        equipmentId,
        startAt: at(9),
        endAt: at(16),
      });

      expect(result).toEqual({
        ok: true,
        data: { total: 4, committed: 3, available: 1 },
      });
    });

    it("AC 2: a quantity that fits the whole period is accepted by the locked reservation path", async () => {
      await reserve(9, 12, 3);
      await reserve(13, 16, 3);

      const result = await createReservation({
        eventId: APPROVED_EVENT_ID,
        equipmentId,
        quantity: 1,
        startAt: at(9),
        endAt: at(16),
      });

      expect(result).toMatchObject({ ok: true, data: { available: 0 } });
      expect(await reservationCount()).toBe(3);
    });

    it("AC 3: a quantity over the free units is refused with the shortfall, and nothing is written", async () => {
      await reserve(9, 12, 3);

      const result = await createReservation({
        eventId: APPROVED_EVENT_ID,
        equipmentId,
        quantity: 3,
        startAt: at(10),
        endAt: at(11),
      });

      expect(result).toEqual({
        ok: false,
        error: "Only 1 of 4 unit(s) are available for this period — 2 short.",
      });
      expect(await reservationCount()).toBe(1);
    });

    it("AC 5: a reservation ending exactly when the period starts leaves the whole pool free", async () => {
      await reserve(9, 12, 4);
      await reserve(15, 18, 4);

      const result = await getEquipmentAvailability({
        equipmentId,
        startAt: at(12),
        endAt: at(15),
      });
      expect(result).toMatchObject({ ok: true, data: { available: 4 } });

      const reserved = await createReservation({
        eventId: APPROVED_EVENT_ID,
        equipmentId,
        quantity: 4,
        startAt: at(12),
        endAt: at(15),
      });
      expect(reserved.ok).toBe(true);
    });

    it("AC 6: units under maintenance or damaged are not available", async () => {
      await outOfService(8, 18, 1, "MAINTENANCE");
      await outOfService(10, 11, 1, "DAMAGED");

      const result = await getEquipmentAvailability({
        equipmentId,
        startAt: at(9),
        endAt: at(12),
      });

      expect(result).toEqual({
        ok: true,
        data: { total: 4, committed: 2, available: 2 },
      });
    });

    // Cancelling returns units to the pool (the ReservationStatus contract),
    // so a cancelled reservation must not count against availability.
    it("does not count a cancelled reservation against the pool", async () => {
      await reserve(9, 12, 4, "CANCELLED");

      const result = await getEquipmentAvailability({
        equipmentId,
        startAt: at(9),
        endAt: at(12),
      });

      expect(result).toMatchObject({ ok: true, data: { available: 4 } });
    });

    it("AC 7: an end before the start is rejected, reads nothing and writes nothing", async () => {
      const result = await createReservation({
        eventId: APPROVED_EVENT_ID,
        equipmentId,
        quantity: 1,
        startAt: at(12),
        endAt: at(9),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors?.endAt).toBeTruthy();
      expect(await reservationCount()).toBe(0);
    });

    it("gives the same answer for the pool in the all-equipment view", async () => {
      await reserve(9, 12, 3);
      await reserve(13, 16, 3);

      const all = await getAllEquipmentAvailability({ startAt: at(9), endAt: at(16) });
      const one = await getEquipmentAvailability({
        equipmentId,
        startAt: at(9),
        endAt: at(16),
      });

      expect(all.ok && one.ok).toBe(true);
      if (all.ok && one.ok) expect(all.data[equipmentId]).toEqual(one.data);
    });
  });
});
