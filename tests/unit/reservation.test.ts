import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import * as equipmentActions from "@/app/(app)/equipment/actions";
import {
  getAllEquipmentAvailability,
  getEquipmentAvailability,
} from "@/app/(app)/equipment/actions";

// SCRUM-29/31 — what is free for a period. Database mocked. Reserving moved
// to SCRUM-155's approved-request card (SCRUM-156); its tests live in
// request-reservation.test.ts.
const tx = vi.hoisted(() => ({
  equipment: { findFirst: vi.fn(), findMany: vi.fn() },
  reservation: { findMany: vi.fn() },
  equipmentUnavailability: { findMany: vi.fn() },
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
  tx.equipment.findFirst.mockResolvedValue({ totalQuantity: 10 });
  tx.reservation.findMany.mockResolvedValue([
    { startAt: new Date(START), endAt: new Date(END), quantity: 3 },
  ]);
  tx.equipmentUnavailability.findMany.mockResolvedValue([
    { startAt: new Date(START), endAt: new Date(END), quantity: 2 },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
  mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
});

// SCRUM-156 AC 2: the one-type form only checks availability. With no
// action to call, a reservation that bypasses an approved request has nowhere
// to go; the only way to reserve is SCRUM-155's reserveEquipmentRequest.
describe("reserving outside an approved request — SCRUM-156", () => {
  it("SCRUM-156 [AC2] TC-156-03: the server offers no way to reserve except from an approved request", () => {
    const reserving = Object.keys(equipmentActions).filter((name) =>
      /reserv/i.test(name),
    );

    expect(reserving).toEqual(["reserveEquipmentRequest"]);
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

