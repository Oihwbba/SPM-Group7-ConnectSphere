import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  createReservation,
  getEquipmentAvailability,
} from "@/app/(app)/equipment/actions";

// SCRUM-31 — reserve equipment for an approved event. Database mocked; the
// simultaneous last-unit case runs against real Postgres in concurrency.test.ts.
const tx = vi.hoisted(() => ({
  event: { findFirst: vi.fn() },
  equipment: { findFirst: vi.fn() },
  reservation: { aggregate: vi.fn(), create: vi.fn() },
  equipmentUnavailability: { aggregate: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { ...tx, $transaction: vi.fn() },
}));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const START = "2030-06-01T01:00:00.000Z";
const END = "2030-06-01T05:00:00.000Z";

const validInput = {
  eventId: "evt_approved",
  equipmentId: "eq1",
  quantity: 5,
  startAt: START,
  endAt: END,
};

/** A pool of 10 with 3 already reserved and 2 under maintenance → 5 available. */
function poolWithFiveAvailable() {
  tx.event.findFirst.mockResolvedValue({ id: "evt_approved" });
  tx.$queryRaw.mockResolvedValue([{ id: "eq1" }]);
  tx.equipment.findFirst.mockResolvedValue({ totalQuantity: 10 });
  tx.reservation.aggregate.mockResolvedValue({ _sum: { quantity: 3 } });
  tx.equipmentUnavailability.aggregate.mockResolvedValue({
    _sum: { quantity: 2 },
  });
  tx.reservation.create.mockResolvedValue({ id: "res1" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
  mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
});

describe("createReservation — SCRUM-31", () => {
  it("AC 1 & 2: a quantity that fits is CONFIRMED, linked to the event, and availability drops by exactly that amount", async () => {
    poolWithFiveAvailable();

    const result = await createReservation(validInput);

    expect(result).toEqual({ ok: true, data: { id: "res1", available: 0 } });
    expect(tx.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: "evt_approved",
          equipmentId: "eq1",
          quantity: 5,
          status: "CONFIRMED",
          reservedById: "usr_tech",
        }),
      }),
    );
  });

  it("AC 3: over-allocation is refused and the shortfall is shown", async () => {
    poolWithFiveAvailable();

    const result = await createReservation({ ...validInput, quantity: 7 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Only 5 of 10 unit\(s\)/);
      expect(result.error).toMatch(/2 short/);
    }
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  it("AC 5: the equipment row is locked before availability is counted", async () => {
    poolWithFiveAvailable();

    await createReservation(validInput);

    const lockedAt = tx.$queryRaw.mock.invocationCallOrder[0];
    const countedAt = tx.reservation.aggregate.mock.invocationCallOrder[0];
    expect(lockedAt).toBeLessThan(countedAt);
  });

  it.each([0, -1, 1.5, ""])(
    "AC 6: quantity %s is reported invalid and nothing is created",
    async (quantity) => {
      const result = await createReservation({ ...validInput, quantity });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors?.quantity).toBeTruthy();
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it("refuses a period whose end is not after its start", async () => {
    const result = await createReservation({ ...validInput, endAt: START });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.endAt).toBeTruthy();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("only reserves for an approved event", async () => {
    poolWithFiveAvailable();
    tx.event.findFirst.mockResolvedValue(null);

    const result = await createReservation(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/approved event/i);
    expect(tx.event.findFirst).toHaveBeenCalledWith({
      where: { id: "evt_approved", status: "APPROVED" },
      select: { id: true },
    });
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  it.each(["ORGANISER", "COORDINATOR", "VENUE_STAFF", "ATTENDEE"] as Role[])(
    "refuses %s and never opens a transaction",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, `usr_${role.toLowerCase()}`));

      const result = await createReservation(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/permission/i);
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );
});

describe("getEquipmentAvailability — SCRUM-31", () => {
  it("AC 7: deducts confirmed reservations and maintenance from the pool", async () => {
    poolWithFiveAvailable();

    const result = await getEquipmentAvailability(validInput);

    expect(result).toEqual({ ok: true, data: { available: 5, total: 10 } });
  });

  it("AC 4: overlap is half-open — a period that only touches another does not count against it", async () => {
    poolWithFiveAvailable();

    await getEquipmentAvailability(validInput);

    // startAt < requestedEnd AND endAt > requestedStart: a reservation ending
    // exactly at START (endAt == START) fails `gt`, so it is not counted.
    expect(tx.reservation.aggregate).toHaveBeenCalledWith({
      where: {
        equipmentId: "eq1",
        status: "CONFIRMED",
        startAt: { lt: new Date(END) },
        endAt: { gt: new Date(START) },
      },
      _sum: { quantity: true },
    });
  });

  it("refuses a role without equipment:read", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    const result = await getEquipmentAvailability(validInput);

    expect(result.ok).toBe(false);
    expect(tx.equipment.findFirst).not.toHaveBeenCalled();
  });
});
