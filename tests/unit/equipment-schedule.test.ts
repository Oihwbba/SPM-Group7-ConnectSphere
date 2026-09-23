import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import {
  checkAvailability,
  getEquipmentSchedule,
} from "@/app/(app)/equipment/actions";

// SCRUM-29 (check availability) and SCRUM-30 (view conflicts). Database
// mocked; the arithmetic itself is pinned in equipment-availability.test.ts.
const db = vi.hoisted(() => ({
  equipment: { findFirst: vi.fn(), findMany: vi.fn() },
  reservation: { findMany: vi.fn(), create: vi.fn() },
  equipmentUnavailability: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { ...db, $transaction: vi.fn() } }));

const mockAuth = auth as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const START = "2030-06-01T01:00:00.000Z";
const END = "2030-06-01T05:00:00.000Z";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
  db.equipment.findFirst.mockResolvedValue({
    id: "eq1",
    type: "Projector",
    totalQuantity: 10,
  });
  db.reservation.findMany.mockResolvedValue([]);
  db.equipmentUnavailability.findMany.mockResolvedValue([]);
});

describe("checkAvailability — SCRUM-29", () => {
  const input = {
    equipmentId: "eq1",
    quantity: 4,
    startAt: START,
    endAt: END,
  };

  it("AC 1 & 2: reports the free quantity and that a fitting request may proceed", async () => {
    db.reservation.findMany.mockResolvedValue([
      { startAt: new Date(START), endAt: new Date(END), quantity: 6 },
    ]);

    const result = await checkAvailability(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        total: 10,
        available: 4,
        requested: 4,
        sufficient: true,
        shortfall: 0,
      });
    }
  });

  it("AC 3: reports the shortfall when the request exceeds what is free", async () => {
    db.reservation.findMany.mockResolvedValue([
      { startAt: new Date(START), endAt: new Date(END), quantity: 8 },
    ]);

    const result = await checkAvailability(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        available: 2,
        requested: 4,
        sufficient: false,
        shortfall: 2,
      });
    }
  });

  it("AC 4 & 6: counts overlapping reservations and maintenance against the pool", async () => {
    db.reservation.findMany.mockResolvedValue([
      { startAt: new Date(START), endAt: new Date(END), quantity: 3 },
    ]);
    db.equipmentUnavailability.findMany.mockResolvedValue([
      { startAt: new Date(START), endAt: new Date(END), quantity: 5 },
    ]);

    const result = await checkAvailability(input);

    if (result.ok) expect(result.data.available).toBe(2);
    // Maintenance is filtered by period, not by reason: every reason takes
    // units out of the pool.
    expect(db.equipmentUnavailability.findMany).toHaveBeenCalledWith({
      where: {
        equipmentId: "eq1",
        startAt: { lt: new Date(END) },
        endAt: { gt: new Date(START) },
      },
      select: { startAt: true, endAt: true, quantity: true },
    });
  });

  it("AC 5: a reservation that ends exactly when the period starts leaves the pool free", async () => {
    db.reservation.findMany.mockResolvedValue([]);

    const result = await checkAvailability(input);

    if (result.ok) expect(result.data.available).toBe(10);
    expect(db.reservation.findMany).toHaveBeenCalledWith({
      where: {
        equipmentId: "eq1",
        status: "CONFIRMED",
        // endAt > START excludes a reservation ending exactly at START.
        startAt: { lt: new Date(END) },
        endAt: { gt: new Date(START) },
      },
      select: { startAt: true, endAt: true, quantity: true },
    });
  });

  // AC 7 — an invalid check produces no result at all, not a zero result.
  it.each([
    ["zero", { quantity: 0 }],
    ["negative", { quantity: -3 }],
    ["fractional", { quantity: 2.5 }],
    ["an end before the start", { startAt: END, endAt: START }],
    ["an end equal to the start", { startAt: START, endAt: START }],
  ])("AC 7: rejects %s and reads nothing", async (_label, override) => {
    const result = await checkAvailability({ ...input, ...override });

    expect(result.ok).toBe(false);
    expect(db.equipment.findFirst).not.toHaveBeenCalled();
  });

  it("refuses a role without equipment:read", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    const result = await checkAvailability(input);

    expect(result.ok).toBe(false);
    expect(db.equipment.findFirst).not.toHaveBeenCalled();
  });
});

describe("getEquipmentSchedule — SCRUM-30", () => {
  const input = { equipmentId: "eq1", from: START };
  const reservation = (
    id: string,
    from: string,
    to: string,
    quantity: number,
    name: string,
  ) => ({
    id,
    startAt: new Date(from),
    endAt: new Date(to),
    quantity,
    event: { name },
  });

  it("AC 1: lists current and future reservations with the event they serve", async () => {
    db.reservation.findMany.mockResolvedValue([
      reservation("r1", START, END, 2, "Orientation"),
    ]);

    const result = await getEquipmentSchedule(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entries).toHaveLength(1);
      expect(result.data.entries[0]).toMatchObject({
        kind: "reservation",
        eventName: "Orientation",
        quantity: 2,
      });
      expect(result.data.fullyAvailable).toBe(false);
    }
    // Anything still running at `from` is current, so the filter is on the end.
    expect(db.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ endAt: { gt: new Date(START) } }),
      }),
    );
  });

  it("AC 2 & 4: flags reservations that share time as conflicting", async () => {
    db.reservation.findMany.mockResolvedValue([
      reservation("r1", "2030-06-01T01:00:00.000Z", "2030-06-01T05:00:00.000Z", 2, "A"),
      reservation("r2", "2030-06-01T04:00:00.000Z", "2030-06-01T08:00:00.000Z", 2, "B"),
    ]);

    const result = await getEquipmentSchedule(input);

    if (result.ok) {
      expect(result.data.entries.every((row) => row.hasConflict)).toBe(true);
      expect(result.data.entries[0].conflictsWith).toEqual(["r2"]);
    }
  });

  it("AC 3: reservations that touch at an endpoint are adjacent, not conflicting", async () => {
    db.reservation.findMany.mockResolvedValue([
      reservation("r1", "2030-06-01T01:00:00.000Z", "2030-06-01T05:00:00.000Z", 2, "A"),
      reservation("r2", "2030-06-01T05:00:00.000Z", "2030-06-01T09:00:00.000Z", 2, "B"),
    ]);

    const result = await getEquipmentSchedule(input);

    if (result.ok) {
      expect(result.data.entries.some((row) => row.hasConflict)).toBe(false);
    }
  });

  it("AC 5: shows the reason and duration of unavailability", async () => {
    db.equipmentUnavailability.findMany.mockResolvedValue([
      {
        id: "u1",
        startAt: new Date(START),
        endAt: new Date(END),
        quantity: 3,
        reason: "DAMAGED",
        note: "Dropped in transit",
      },
    ]);

    const result = await getEquipmentSchedule(input);

    if (result.ok) {
      expect(result.data.entries[0]).toMatchObject({
        kind: "unavailability",
        reason: "DAMAGED",
        note: "Dropped in transit",
        quantity: 3,
        startAt: new Date(START),
        endAt: new Date(END),
      });
    }
  });

  it("AC 6: an item with nothing committed reports fully available, not an empty list", async () => {
    const result = await getEquipmentSchedule(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fullyAvailable).toBe(true);
      expect(result.data.entries).toEqual([]);
      expect(result.data.totalQuantity).toBe(10);
    }
  });

  it("returns entries in chronological order, reservations and repairs together", async () => {
    db.reservation.findMany.mockResolvedValue([
      reservation("late", "2030-06-02T01:00:00.000Z", "2030-06-02T05:00:00.000Z", 1, "B"),
    ]);
    db.equipmentUnavailability.findMany.mockResolvedValue([
      {
        id: "early",
        startAt: new Date(START),
        endAt: new Date(END),
        quantity: 1,
        reason: "MAINTENANCE",
        note: null,
      },
    ]);

    const result = await getEquipmentSchedule(input);

    if (result.ok) {
      expect(result.data.entries.map((row) => row.id)).toEqual(["early", "late"]);
    }
  });

  it("refuses a role without equipment:read, and an unknown item", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org"));
    expect((await getEquipmentSchedule(input)).ok).toBe(false);
    expect(db.equipment.findFirst).not.toHaveBeenCalled();

    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
    db.equipment.findFirst.mockResolvedValue(null);
    expect((await getEquipmentSchedule(input)).ok).toBe(false);
  });
});
