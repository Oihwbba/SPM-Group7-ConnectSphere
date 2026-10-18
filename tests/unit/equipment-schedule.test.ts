import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { getEquipmentSchedule } from "@/app/(app)/equipment/actions";

// SCRUM-30 — view what an equipment item is committed to. Database mocked;
// the overlap and pool arithmetic is pinned in equipment-availability.test.ts.
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
    needsReconsideration: false,
    event: { name },
  });

  it("SCRUM-30 [AC1]: lists current and future reservations with the event they serve", async () => {
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

  // Whether a commitment is a problem depends on the period and quantity being
  // requested, which the action does not know. It reports every commitment as
  // it stands, overlapping or not, and the view judges them against the
  // request with splitByPeriod and requestedPeriodTone.
  it("SCRUM-30 [AC1]: reports overlapping reservations as they stand, without judging them", async () => {
    db.reservation.findMany.mockResolvedValue([
      reservation("r1", "2030-06-01T01:00:00.000Z", "2030-06-01T05:00:00.000Z", 2, "A"),
      reservation("r2", "2030-06-01T04:00:00.000Z", "2030-06-01T08:00:00.000Z", 2, "B"),
    ]);

    const result = await getEquipmentSchedule(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entries).toEqual([
        expect.objectContaining({ id: "r1", eventName: "A", quantity: 2 }),
        expect.objectContaining({ id: "r2", eventName: "B", quantity: 2 }),
      ]);
      expect(Object.keys(result.data.entries[0]).sort()).toEqual(
        // SCRUM-32: whether it was reported as no longer providable is a
        // fact about the reservation, not a judgement of it.
        ["endAt", "eventName", "id", "kind", "needsReconsideration", "note", "quantity", "reason", "startAt"],
      );
    }
  });

  it("SCRUM-30 [AC5]: reports back-to-back reservations as two separate commitments", async () => {
    db.reservation.findMany.mockResolvedValue([
      reservation("r1", "2030-06-01T01:00:00.000Z", "2030-06-01T05:00:00.000Z", 2, "A"),
      reservation("r2", "2030-06-01T05:00:00.000Z", "2030-06-01T09:00:00.000Z", 2, "B"),
    ]);

    const result = await getEquipmentSchedule(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entries.map((row) => row.id)).toEqual(["r1", "r2"]);
      expect(result.data.entries[0].endAt).toEqual(result.data.entries[1].startAt);
    }
  });

  it("SCRUM-30 [AC6]: shows the reason and duration of unavailability", async () => {
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

  it("SCRUM-30 [AC7]: an item with nothing committed reports fully available, not an empty list", async () => {
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

  it("rejects a malformed request with field errors and reads nothing", async () => {
    const result = await getEquipmentSchedule({ equipmentId: "", from: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.equipmentId).toBeTruthy();
      expect(result.fieldErrors?.from).toBeTruthy();
    }
    expect(db.equipment.findFirst).not.toHaveBeenCalled();
  });

  // The schema only checks `from` is non-empty, so a string that is not a date
  // has to be caught after parsing or `endAt > Invalid Date` would match nothing.
  it("rejects a `from` that is not a date", async () => {
    const result = await getEquipmentSchedule({ ...input, from: "not-a-date" });

    expect(result.ok).toBe(false);
    expect(db.equipment.findFirst).not.toHaveBeenCalled();
  });

  it("rethrows a non-permission failure instead of reporting it as a refusal", async () => {
    db.equipment.findFirst.mockRejectedValue(new Error("connection lost"));

    await expect(getEquipmentSchedule(input)).rejects.toThrow("connection lost");
  });
});
