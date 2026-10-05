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
  reservation: { findMany: vi.fn(), create: vi.fn() },
  equipmentUnavailability: { findMany: vi.fn() },
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

/**
 * A pool of 10 with 3 already reserved and 2 under maintenance → 5 available.
 * Both rows span the whole requested period, so the busiest instant commits
 * all five. Availability is computed from rows rather than a SQL sum, because
 * a counted pool's answer is its peak — see lib/equipment/availability.ts.
 */
function poolWithFiveAvailable() {
  tx.event.findFirst.mockResolvedValue({ id: "evt_approved" });
  tx.$queryRaw.mockResolvedValue([{ id: "eq1" }]);
  tx.equipment.findFirst.mockResolvedValue({ totalQuantity: 10 });
  tx.reservation.findMany.mockResolvedValue([
    { startAt: new Date(START), endAt: new Date(END), quantity: 3 },
  ]);
  tx.equipmentUnavailability.findMany.mockResolvedValue([
    { startAt: new Date(START), endAt: new Date(END), quantity: 2 },
  ]);
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

    const lockedAt = tx.$queryRaw.mock.invocationCallOrder[1];
    const countedAt = tx.reservation.findMany.mock.invocationCallOrder[0];
    expect(lockedAt).toBeLessThan(countedAt);
  });

  // SCRUM-155 AC 5: reserving a whole request locks the event, then the
  // equipment. Taking them in the same order means the two forms take turns
  // on an event instead of deadlocking.
  it("SCRUM-155 TC-155-16: the event row is locked before its status is read and before the equipment row", async () => {
    poolWithFiveAvailable();

    await createReservation(validInput);

    const [eventLock, equipmentLock] = tx.$queryRaw.mock.calls;
    expect(eventLock[0].join("?")).toMatch(/FROM "Event" WHERE "id" = \? FOR UPDATE/);
    expect(eventLock[1]).toBe("evt_approved");
    expect(equipmentLock[0].join("?")).toMatch(/FROM "Equipment"/);
    const [eventLockedAt, equipmentLockedAt] = tx.$queryRaw.mock.invocationCallOrder;
    expect(eventLockedAt).toBeLessThan(tx.event.findFirst.mock.invocationCallOrder[0]);
    expect(tx.event.findFirst.mock.invocationCallOrder[0]).toBeLessThan(equipmentLockedAt);
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

  it("refuses a period whose start time is in the past", async () => {
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

  // An equipment request is raised for an Approved or Planning event
  // (SCRUM-27 AC 1), so it must be possible to reserve stock for either.
  it("only reserves for an event that can take an equipment request (Approved or Planning)", async () => {
    poolWithFiveAvailable();
    tx.event.findFirst.mockResolvedValue(null);

    const result = await createReservation(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/approved event/i);
    expect(tx.event.findFirst).toHaveBeenCalledWith({
      where: { id: "evt_approved", status: { in: ["APPROVED", "PLANNING"] } },
      select: { id: true },
    });
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  // Approval now moves an event straight to Planning (SCRUM-81), so an
  // approved event being planned must still take reservations.
  it("SCRUM-81 TC-81-12: equipment can be reserved for an event in Planning", async () => {
    poolWithFiveAvailable();
    tx.event.findFirst.mockResolvedValue({ id: "evt_planning" });

    const result = await createReservation({ ...validInput, eventId: "evt_planning" });

    expect(result.ok).toBe(true);
    expect(tx.event.findFirst).toHaveBeenCalledWith({
      where: { id: "evt_planning", status: { in: ["APPROVED", "PLANNING"] } },
      select: { id: true },
    });
    expect(tx.reservation.create).toHaveBeenCalled();
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

  it("SCRUM-31: a retired or unknown equipment type cannot be reserved — the row lock finds nothing and nothing is created", async () => {
    poolWithFiveAvailable();
    tx.$queryRaw.mockResolvedValue([]);

    const result = await createReservation(validInput);

    expect(result).toEqual({ ok: false, error: "Equipment type is unavailable." });
    expect(tx.reservation.findMany).not.toHaveBeenCalled();
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  // The row lock and the availability count are two separately written queries.
  // If their filters ever drift apart, the count can miss a row the lock found;
  // the reservation must then be refused, not made against an unknown pool.
  it("SCRUM-31: equipment the availability count cannot find after the row lock is refused and nothing is created", async () => {
    poolWithFiveAvailable();
    tx.equipment.findFirst.mockResolvedValue(null);

    const result = await createReservation(validInput);

    expect(result).toEqual({ ok: false, error: "Equipment type is unavailable." });
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  // reservedById is required: a token that passed the role check but carries
  // no id must not produce a reservation nobody can be held to.
  it("SCRUM-31 [Security gate]: a session with a permitted role but no user id is refused before any write", async () => {
    mockAuth.mockResolvedValue({
      user: { role: "TECH_SUPPORT", name: "Test User" },
      expires: "2999-01-01T00:00:00.000Z",
    });

    const result = await createReservation(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-31 [Exit path]: a database failure while saving propagates instead of being reported as a refusal", async () => {
    poolWithFiveAvailable();
    tx.reservation.create.mockRejectedValue(new Error("connection lost"));

    await expect(createReservation(validInput)).rejects.toThrow("connection lost");
  });
});

describe("getEquipmentAvailability — SCRUM-31", () => {
  it("AC 7: deducts confirmed reservations and maintenance from the pool", async () => {
    poolWithFiveAvailable();

    const result = await getEquipmentAvailability(validInput);

    // `committed` is the peak the pool carries during the period (3 reserved
    // + 2 under maintenance), which is what the 5 is derived from.
    expect(result).toEqual({
      ok: true,
      data: { available: 5, total: 10, committed: 5 },
    });
  });

  it("AC 4: overlap is half-open — a period that only touches another does not count against it", async () => {
    poolWithFiveAvailable();

    await getEquipmentAvailability(validInput);

    // startAt < requestedEnd AND endAt > requestedStart: a reservation ending
    // exactly at START (endAt == START) fails `gt`, so it is not counted.
    expect(tx.reservation.findMany).toHaveBeenCalledWith({
      where: {
        equipmentId: "eq1",
        status: "CONFIRMED",
        startAt: { lt: new Date(END) },
        endAt: { gt: new Date(START) },
      },
      select: { startAt: true, endAt: true, quantity: true },
    });
  });

  it("refuses a role without equipment:read", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    const result = await getEquipmentAvailability(validInput);

    expect(result.ok).toBe(false);
    expect(tx.equipment.findFirst).not.toHaveBeenCalled();
  });

  // SCRUM-29 AC 7 — an invalid check is rejected and shows no result at all,
  // not a zero that could be mistaken for "none available".
  it("SCRUM-29 AC 7: rejects an end before the start with field errors and reads nothing", async () => {
    const result = await getEquipmentAvailability({
      ...validInput,
      startAt: END,
      endAt: START,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/valid reservation period/i);
      expect(result.fieldErrors?.endAt).toBeTruthy();
    }
    expect(tx.equipment.findFirst).not.toHaveBeenCalled();
  });

  it("SCRUM-29 AC 1: reports an unknown or retired equipment type rather than a count", async () => {
    tx.equipment.findFirst.mockResolvedValueOnce(null);

    const result = await getEquipmentAvailability(validInput);

    expect(result).toEqual({ ok: false, error: "Equipment type is unavailable." });
    expect(tx.reservation.findMany).not.toHaveBeenCalled();
  });

  it("rethrows a database failure instead of reporting it as a refusal", async () => {
    tx.equipment.findFirst.mockRejectedValueOnce(new Error("connection reset"));

    await expect(getEquipmentAvailability(validInput)).rejects.toThrow(
      "connection reset",
    );
  });
});

describe("getAllEquipmentAvailability — SCRUM-31", () => {
  it("calculates live period availability across all equipment types", async () => {
    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
    tx.equipment.findMany.mockResolvedValue([
      { id: "eq1", type: "Lectern", totalQuantity: 10 },
      { id: "eq2", type: "Projector", totalQuantity: 5 },
    ]);
    tx.reservation.findMany.mockResolvedValue([
      {
        equipmentId: "eq1",
        startAt: new Date(START),
        endAt: new Date(END),
        quantity: 2,
      },
    ]);
    tx.equipmentUnavailability.findMany.mockResolvedValue([
      {
        equipmentId: "eq1",
        startAt: new Date(START),
        endAt: new Date(END),
        quantity: 1,
      },
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

  it("refuses a period whose end is not after its start", async () => {
    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));

    const result = await getAllEquipmentAvailability({
      startAt: START,
      endAt: START,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid reservation period/i);
    expect(tx.equipment.findMany).not.toHaveBeenCalled();
  });

  it("refuses a role without equipment:read", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    const result = await getAllEquipmentAvailability({
      startAt: START,
      endAt: END,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
    expect(tx.equipment.findMany).not.toHaveBeenCalled();
  });

  it("refuses non-date strings for startAt and endAt with explicit field errors", async () => {
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

  it("rethrows non-PermissionError exceptions", async () => {
    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
    tx.equipment.findMany.mockRejectedValue(new Error("db error"));

    await expect(
      getAllEquipmentAvailability({ startAt: START, endAt: END }),
    ).rejects.toThrow("db error");
  });
});

