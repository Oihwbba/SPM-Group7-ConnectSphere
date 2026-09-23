import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  createReservation,
  getAllEquipmentAvailability,
  getEquipmentAvailability,
} from "@/app/(app)/equipment/actions";

// SCRUM-31 — reserve equipment for an approved event. Database mocked; the
// simultaneous last-unit case runs against real Postgres in concurrency.test.ts.
const tx = vi.hoisted(() => ({
  event: { findFirst: vi.fn() },
  equipment: { findFirst: vi.fn(), findMany: vi.fn() },
  reservation: { aggregate: vi.fn(), create: vi.fn(), groupBy: vi.fn() },
  equipmentUnavailability: { aggregate: vi.fn(), groupBy: vi.fn() },
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

function sessionWithoutId(role: Role): Session {
  return {
    user: { role, name: "Test User", email: "missing-id@test.local" },
    expires: "2999-01-01T00:00:00.000Z",
  } as Session;
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
  it("SCRUM-31 [AC1, AC2]: creates a confirmed reservation linked to the event and reduces availability by the reserved quantity", async () => {
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

  it("SCRUM-31 [AC3]: refuses over-allocation and shows the shortfall", async () => {
    poolWithFiveAvailable();

    const result = await createReservation({ ...validInput, quantity: 7 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Only 5 of 10 unit\(s\)/);
      expect(result.error).toMatch(/2 short/);
    }
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  it("SCRUM-31 [AC5]: locks the equipment row before counting availability", async () => {
    poolWithFiveAvailable();

    await createReservation(validInput);

    const lockedAt = tx.$queryRaw.mock.invocationCallOrder[0];
    const countedAt = tx.reservation.aggregate.mock.invocationCallOrder[0];
    expect(lockedAt).toBeLessThan(countedAt);
  });

  it.each([0, -1, 1.5, ""])(
    "SCRUM-31 [AC6]: quantity %s is reported invalid and nothing is created",
    async (quantity) => {
      const result = await createReservation({ ...validInput, quantity });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors?.quantity).toBeTruthy();
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-31 [AC4]: refuses a period whose end is not after its start", async () => {
    const result = await createReservation({ ...validInput, endAt: START });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.endAt).toBeTruthy();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-31 [AC1]: refuses a period whose start time is in the past", async () => {
    const result = await createReservation({
      ...validInput,
      startAt: "2020-01-01T01:00:00.000Z",
      endAt: "2020-01-01T05:00:00.000Z",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.startAt).toContain("Start time cannot be in the past.");
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-31 [AC2]: only reserves for an approved event", async () => {
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

  it("SCRUM-31 [AC1]: refuses reservation when the authenticated session has no user id", async () => {
    mockAuth.mockResolvedValue(sessionWithoutId("TECH_SUPPORT"));

    const result = await createReservation(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-31 [AC1]: refuses inactive equipment before counting availability", async () => {
    poolWithFiveAvailable();
    tx.$queryRaw.mockResolvedValue([]);

    const result = await createReservation(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Equipment type is unavailable.");
    expect(tx.equipment.findFirst).not.toHaveBeenCalled();
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  it("SCRUM-31 [AC1]: rethrows unexpected reservation transaction failures", async () => {
    poolWithFiveAvailable();
    mockTransaction.mockRejectedValue(new Error("transaction failed"));

    await expect(createReservation(validInput)).rejects.toThrow("transaction failed");
  });

  it("SCRUM-31 [AC1]: uses a fallback reservation error when the transaction returns an empty error result", async () => {
    mockTransaction.mockResolvedValue({ error: undefined });

    const result = await createReservation(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Unable to create the reservation.");
  });

  it("SCRUM-31 [AC1]: refuses when equipment disappears while availability is being counted", async () => {
    poolWithFiveAvailable();
    tx.equipment.findFirst.mockResolvedValue(null);

    const result = await createReservation(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Equipment type is unavailable.");
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  it.each(["ORGANISER", "COORDINATOR", "VENUE_STAFF", "ATTENDEE"] as Role[])(
    "SCRUM-31 [AC1]: refuses %s and never opens a transaction",
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
  it("SCRUM-31 [AC7]: deducts confirmed reservations and maintenance from the pool", async () => {
    poolWithFiveAvailable();

    const result = await getEquipmentAvailability(validInput);

    expect(result).toEqual({ ok: true, data: { available: 5, total: 10 } });
  });

  it("SCRUM-31 [AC7]: treats missing reservation and maintenance sums as zero", async () => {
    poolWithFiveAvailable();
    tx.reservation.aggregate.mockResolvedValue({ _sum: { quantity: null } });
    tx.equipmentUnavailability.aggregate.mockResolvedValue({
      _sum: { quantity: null },
    });

    const result = await getEquipmentAvailability(validInput);

    expect(result).toEqual({ ok: true, data: { available: 10, total: 10 } });
  });

  it("SCRUM-31 [AC7]: floors availability at zero when reservations and maintenance exceed the pool", async () => {
    poolWithFiveAvailable();
    tx.reservation.aggregate.mockResolvedValue({ _sum: { quantity: 8 } });
    tx.equipmentUnavailability.aggregate.mockResolvedValue({
      _sum: { quantity: 5 },
    });

    const result = await getEquipmentAvailability(validInput);

    expect(result).toEqual({ ok: true, data: { available: 0, total: 10 } });
  });

  it("SCRUM-31 [AC7]: returns unavailable when the equipment type is inactive", async () => {
    poolWithFiveAvailable();
    tx.equipment.findFirst.mockResolvedValue(null);

    const result = await getEquipmentAvailability(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Equipment type is unavailable.");
  });

  it("SCRUM-31 [AC7]: refuses invalid availability input before querying equipment", async () => {
    const result = await getEquipmentAvailability({
      equipmentId: "",
      startAt: START,
      endAt: END,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/valid reservation period/i);
      expect(result.fieldErrors?.equipmentId).toBeTruthy();
    }
    expect(tx.equipment.findFirst).not.toHaveBeenCalled();
  });

  it("SCRUM-31 [AC7]: rethrows unexpected equipment availability lookup failures", async () => {
    poolWithFiveAvailable();
    tx.equipment.findFirst.mockRejectedValue(new Error("lookup failed"));

    await expect(getEquipmentAvailability(validInput)).rejects.toThrow(
      "lookup failed",
    );
  });

  it("SCRUM-31 [AC4]: overlap is half-open so a period that only touches another does not count against it", async () => {
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

  it("SCRUM-31 [AC7]: refuses a role without equipment:read", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    const result = await getEquipmentAvailability(validInput);

    expect(result.ok).toBe(false);
    expect(tx.equipment.findFirst).not.toHaveBeenCalled();
  });
});

describe("getAllEquipmentAvailability — SCRUM-31", () => {
  it("SCRUM-31 [AC7]: calculates live period availability across all equipment types", async () => {
    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
    tx.equipment.findMany.mockResolvedValue([
      { id: "eq1", type: "Lectern", totalQuantity: 10 },
      { id: "eq2", type: "Projector", totalQuantity: 5 },
    ]);
    tx.reservation.groupBy.mockResolvedValue([
      { equipmentId: "eq1", _sum: { quantity: 2 } },
    ]);
    tx.equipmentUnavailability.groupBy.mockResolvedValue([
      { equipmentId: "eq1", _sum: { quantity: 1 } },
    ]);

    const result = await getAllEquipmentAvailability({
      startAt: START,
      endAt: END,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.eq1).toBeDefined();
      expect(result.data.eq1.available).toBe(7);
      expect(result.data.eq1.total).toBe(10);
      expect(result.data.eq2).toBeDefined();
      expect(result.data.eq2.available).toBe(5);
      expect(result.data.eq2.total).toBe(5);
    }
  });

  it("SCRUM-31 [AC7]: treats missing grouped sums as zero and caps availability at zero", async () => {
    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
    tx.equipment.findMany.mockResolvedValue([
      { id: "eq1", type: "Lectern", totalQuantity: 2 },
      { id: "eq2", type: "Projector", totalQuantity: 5 },
    ]);
    tx.reservation.groupBy.mockResolvedValue([
      { equipmentId: "eq1", _sum: { quantity: null } },
      { equipmentId: "eq2", _sum: { quantity: 7 } },
    ]);
    tx.equipmentUnavailability.groupBy.mockResolvedValue([
      { equipmentId: "eq1", _sum: { quantity: null } },
      { equipmentId: "eq2", _sum: { quantity: 1 } },
    ]);

    const result = await getAllEquipmentAvailability({
      startAt: START,
      endAt: END,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.eq1.available).toBe(2);
      expect(result.data.eq2.available).toBe(0);
    }
  });

  it("SCRUM-31 [AC4]: refuses a period whose end is not after its start", async () => {
    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));

    const result = await getAllEquipmentAvailability({
      startAt: START,
      endAt: START,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid reservation period/i);
    expect(tx.equipment.findMany).not.toHaveBeenCalled();
  });

  it("SCRUM-31 [AC7]: refuses a role without equipment:read", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    const result = await getAllEquipmentAvailability({
      startAt: START,
      endAt: END,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
    expect(tx.equipment.findMany).not.toHaveBeenCalled();
  });

  it("SCRUM-31 [AC7]: refuses non-date strings for startAt and endAt with explicit field errors", async () => {
    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));

    const result = await getAllEquipmentAvailability({
      startAt: "invalid-date",
      endAt: "invalid-date",
    });

    expect(result.ok).toBe(false);
    if (!result.ok && result.fieldErrors) {
      expect(result.fieldErrors.startAt).toContain("Invalid start time.");
      expect(result.fieldErrors.endAt).toContain("Invalid end time.");
    }
  });

  it("SCRUM-31 [AC7]: rethrows unexpected all-equipment availability failures", async () => {
    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
    tx.equipment.findMany.mockRejectedValue(new Error("db error"));

    await expect(
      getAllEquipmentAvailability({ startAt: START, endAt: END }),
    ).rejects.toThrow("db error");
  });
});

