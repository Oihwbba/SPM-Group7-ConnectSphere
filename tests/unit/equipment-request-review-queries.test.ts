import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getEquipmentRequestQueue,
  getPoolAvailability,
} from "@/lib/equipment/request-queries";

// SCRUM-28 — the reads behind Technical Support's review queue. Database
// mocked; the overlap and pool arithmetic itself is pinned in
// equipment-availability.test.ts, and the queue runs against real Postgres in
// tests/integration/equipment-request-review.test.ts.
const db = vi.hoisted(() => ({
  equipmentRequest: { findMany: vi.fn() },
  equipment: { findMany: vi.fn() },
  reservation: { findMany: vi.fn() },
  equipmentUnavailability: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));

const START = new Date("2031-02-03T01:00:00.000Z");
const END = new Date("2031-02-03T09:00:00.000Z");

const pool = [
  { id: "eqp_lectern", type: "Lectern", totalQuantity: 4 },
  { id: "eqp_projector", type: "Projector", totalQuantity: 10 },
];

const request = (overrides: Record<string, unknown> = {}) => ({
  id: "eqr_1",
  status: "IN_REVIEW",
  notes: null,
  createdAt: new Date("2031-01-01T00:00:00.000Z"),
  decidedAt: null,
  event: { id: "evt_1", name: "Symposium", startAt: START, endAt: END },
  requestedBy: { name: "Cody Coordinator" },
  lines: [
    {
      id: "eql_1",
      quantity: 3,
      technicalRequirements: "Podium mic",
      equipment: {
        id: "eqp_lectern",
        type: "Lectern",
        technicalSpecs: null,
        description: "Podium",
      },
      suggestedAlternative: null,
    },
  ],
  updates: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.equipment.findMany.mockResolvedValue(pool);
  db.reservation.findMany.mockResolvedValue([]);
  db.equipmentUnavailability.findMany.mockResolvedValue([]);
  db.equipmentRequest.findMany.mockResolvedValue([]);
});

describe("getPoolAvailability — SCRUM-28 [AC1, AC4]", () => {
  it("reports each active type's busiest instant in the period, counting confirmed reservations and outages", async () => {
    db.reservation.findMany.mockResolvedValue([
      { equipmentId: "eqp_lectern", startAt: START, endAt: END, quantity: 2 },
    ]);
    db.equipmentUnavailability.findMany.mockResolvedValue([
      { equipmentId: "eqp_lectern", startAt: START, endAt: END, quantity: 1 },
    ]);

    await expect(getPoolAvailability(START, END)).resolves.toEqual({
      eqp_lectern: { available: 1, total: 4 },
      eqp_projector: { available: 10, total: 10 },
    });

    const overlapping = { startAt: { lt: END }, endAt: { gt: START } };
    expect(db.reservation.findMany).toHaveBeenCalledWith({
      where: {
        equipmentId: { in: ["eqp_lectern", "eqp_projector"] },
        status: "CONFIRMED",
        ...overlapping,
      },
      select: { equipmentId: true, startAt: true, endAt: true, quantity: true },
    });
    expect(db.equipmentUnavailability.findMany).toHaveBeenCalledWith({
      where: {
        equipmentId: { in: ["eqp_lectern", "eqp_projector"] },
        ...overlapping,
      },
      select: { equipmentId: true, startAt: true, endAt: true, quantity: true },
    });
  });
});

describe("getEquipmentRequestQueue — SCRUM-28", () => {
  it("SCRUM-28 [AC1, AC6] TC-28-01, TC-28-10: reads every request, oldest first, with each line's equipment details and the history", async () => {
    await getEquipmentRequestQueue();

    const query = db.equipmentRequest.findMany.mock.calls[0][0];
    expect(query.where).toBeUndefined();
    expect(query.orderBy).toEqual({ createdAt: "asc" });
    expect(query.select.requestedBy).toEqual({ select: { name: true } });
    expect(query.select.lines.select).toMatchObject({
      quantity: true,
      technicalRequirements: true,
      equipment: {
        select: {
          id: true,
          type: true,
          technicalSpecs: true,
          description: true,
        },
      },
      suggestedAlternative: { select: { id: true, type: true } },
    });
    expect(query.select.updates.orderBy).toEqual([
      { createdAt: "asc" },
      { id: "asc" },
    ]);
  });

  it("SCRUM-28 [AC1, AC4] TC-28-01: an open request's lines carry what is free for the event, and a short line its alternatives", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([request()]);
    db.reservation.findMany.mockResolvedValue([
      { equipmentId: "eqp_lectern", startAt: START, endAt: END, quantity: 2 },
    ]);

    const [queued] = await getEquipmentRequestQueue();

    expect(queued.lines[0].review).toEqual({
      available: 2,
      total: 4,
      shortfall: 1,
      alternatives: [{ id: "eqp_projector", type: "Projector", available: 10 }],
    });
  });

  it("checks availability once per open request, and not at all for decided ones", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([
      request({ id: "eqr_open" }),
      request({ id: "eqr_done", status: "APPROVED" }),
    ]);

    const queue = await getEquipmentRequestQueue();

    expect(db.reservation.findMany).toHaveBeenCalledTimes(1);
    expect(
      queue.find((row) => row.id === "eqr_done")?.lines[0].review,
    ).toBeNull();
  });

  it("leaves availability unknown for an event without dates", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([
      request({
        event: { id: "evt_x", name: "TBC", startAt: null, endAt: null },
      }),
    ]);

    const [queued] = await getEquipmentRequestQueue();

    expect(queued.lines[0].review).toBeNull();
    expect(db.reservation.findMany).not.toHaveBeenCalled();
  });
});
