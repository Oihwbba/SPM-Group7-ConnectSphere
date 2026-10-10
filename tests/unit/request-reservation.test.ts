import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { reserveEquipmentRequest } from "@/app/(app)/equipment/actions";
import { RESERVABLE_EVENT_STATUSES } from "@/lib/schemas/reservation";

// SCRUM-155 — reserve an approved request in one step, all rows or none.
// Database mocked; the simultaneous cases run against real Postgres in
// tests/integration/request-reservation.test.ts.
const tx = vi.hoisted(() => ({
  equipmentRequest: { findFirst: vi.fn() },
  reservation: { findMany: vi.fn(), createMany: vi.fn() },
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

// The event runs 09:00–17:00 Singapore time; reservations default to it.
const START = "2030-06-01T01:00:00.000Z";
const END = "2030-06-01T09:00:00.000Z";

const validInput = {
  requestId: "eqr_1",
  startAt: START,
  endAt: END,
  lines: [
    { equipmentId: "eq_projector", quantity: 2 },
    { equipmentId: "eq_mic", quantity: 3 },
  ],
};

const POOLS = [
  { id: "eq_mic", totalQuantity: 4 },
  { id: "eq_projector", totalQuantity: 10 },
];

/**
 * An approved request for evt_1. Projectors: 10 in the pool, 5 reserved for
 * the whole period, so 5 are free. Microphones: 4 in the pool, none committed.
 * The three raw queries are the locks, in order: event, request, equipment.
 * `reservations` are the event's confirmed ones, which decide what is left.
 */
type Held = {
  requestId: string | null;
  equipmentId: string;
  quantity: number;
  startAt: Date;
  endAt: Date;
};
function approvedRequestWithStock({
  pools = POOLS,
  event = { startAt: new Date(START), endAt: new Date(END) } as {
    startAt: Date | null;
    endAt: Date | null;
  },
  reservations = [] as Held[],
} = {}) {
  tx.$queryRaw
    .mockResolvedValueOnce([{ id: "evt_1" }])
    .mockResolvedValueOnce([{ id: "eqr_1" }])
    .mockResolvedValueOnce(pools);
  tx.equipmentRequest.findFirst.mockResolvedValue({
    eventId: "evt_1",
    event: { ...event, reservations },
    lines: [
      { equipmentId: "eq_projector", quantity: 2 },
      { equipmentId: "eq_mic", quantity: 3 },
    ],
  });
  tx.reservation.findMany.mockResolvedValue([
    {
      equipmentId: "eq_projector",
      startAt: new Date(START),
      endAt: new Date(END),
      quantity: 5,
    },
  ]);
  tx.equipmentUnavailability.findMany.mockResolvedValue([]);
  tx.reservation.createMany.mockResolvedValue({ count: 2 });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
  mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
});

describe("reserveEquipmentRequest — SCRUM-155", () => {
  it("SCRUM-155 [AC3] TC-155-04: rows that all fit are reserved together, each Confirmed and linked to the event and the request", async () => {
    approvedRequestWithStock();

    const result = await reserveEquipmentRequest(validInput);

    expect(result).toEqual({ ok: true, data: { reserved: 2 } });
    expect(tx.reservation.createMany).toHaveBeenCalledTimes(1);
    expect(tx.reservation.createMany).toHaveBeenCalledWith({
      data: [
        {
          eventId: "evt_1",
          requestId: "eqr_1",
          equipmentId: "eq_projector",
          quantity: 2,
          startAt: new Date(START),
          endAt: new Date(END),
          reservedById: "usr_tech",
          status: "CONFIRMED",
        },
        {
          eventId: "evt_1",
          requestId: "eqr_1",
          equipmentId: "eq_mic",
          quantity: 3,
          startAt: new Date(START),
          endAt: new Date(END),
          reservedById: "usr_tech",
          status: "CONFIRMED",
        },
      ],
    });
  });

  it("SCRUM-155 [AC4] TC-155-05: one short row reserves nothing, and only that row reports what is free and the shortfall", async () => {
    approvedRequestWithStock();

    const result = await reserveEquipmentRequest({
      ...validInput,
      lines: [
        { equipmentId: "eq_projector", quantity: 2 },
        { equipmentId: "eq_mic", quantity: 6 },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Nothing was reserved/);
      expect(result.fieldErrors).toEqual({
        "lines.1.quantity": ["Only 4 of 4 free for this period — 2 short."],
      });
    }
    expect(tx.reservation.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-155 [AC4] TC-155-05: every short row is reported at once, not just the first", async () => {
    approvedRequestWithStock();

    const result = await reserveEquipmentRequest({
      ...validInput,
      lines: [
        { equipmentId: "eq_projector", quantity: 7 },
        { equipmentId: "eq_mic", quantity: 5 },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(Object.keys(result.fieldErrors ?? {})).toEqual([
        "lines.0.quantity",
        "lines.1.quantity",
      ]);
    expect(tx.reservation.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-155 [AC4] TC-155-05: equipment under maintenance for the period counts against the row, like a reservation", async () => {
    approvedRequestWithStock();
    tx.equipmentUnavailability.findMany.mockResolvedValue([
      {
        equipmentId: "eq_mic",
        startAt: new Date(START),
        endAt: new Date(END),
        quantity: 2,
      },
    ]);

    const result = await reserveEquipmentRequest(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.fieldErrors).toEqual({
        "lines.1.quantity": ["Only 2 of 4 free for this period — 1 short."],
      });
    expect(tx.reservation.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-155 [AC4] counts every type's commitments in two queries, not three per row", async () => {
    approvedRequestWithStock();

    await reserveEquipmentRequest(validInput);

    expect(tx.reservation.findMany).toHaveBeenCalledTimes(1);
    expect(tx.equipmentUnavailability.findMany).toHaveBeenCalledTimes(1);
    expect(tx.reservation.findMany.mock.calls[0][0].where).toMatchObject({
      equipmentId: { in: ["eq_projector", "eq_mic"] },
      status: "CONFIRMED",
      startAt: { lt: new Date(END) },
      endAt: { gt: new Date(START) },
    });
  });

  it("SCRUM-155 [AC5] TC-155-08, TC-155-15: locks the event, then the request, then the equipment rows in id order, before reading or counting anything", async () => {
    approvedRequestWithStock();

    await reserveEquipmentRequest(validInput);

    const [eventLock, requestLock, equipmentLock] = tx.$queryRaw.mock.calls;
    expect(eventLock[0].join("?")).toMatch(
      /FROM "Event" e[\s\S]*FOR UPDATE OF e/,
    );
    expect(eventLock[1]).toBe("eqr_1");
    expect(requestLock[0].join("?")).toMatch(
      /FROM "EquipmentRequest" WHERE "id" = \? FOR UPDATE/,
    );
    expect(requestLock[1]).toBe("eqr_1");
    expect(equipmentLock[0].join("?")).toMatch(/ORDER BY "id" FOR UPDATE/);
    expect(equipmentLock[1].values).toEqual(["eq_projector", "eq_mic"]);

    const [eventAt, requestAt, equipmentAt] =
      tx.$queryRaw.mock.invocationCallOrder;
    const readAt = tx.equipmentRequest.findFirst.mock.invocationCallOrder[0];
    expect(eventAt).toBeLessThan(requestAt);
    expect(requestAt).toBeLessThan(readAt);
    expect(readAt).toBeLessThan(equipmentAt);
    expect(equipmentAt).toBeLessThan(
      tx.reservation.findMany.mock.invocationCallOrder[0],
    );
  });

  it("SCRUM-155 [AC1, AC6] TC-155-01: accepts only an approved request for an Approved or Planning event that hasn't started, read with its lines and the event's confirmed reservations", async () => {
    approvedRequestWithStock();

    await reserveEquipmentRequest(validInput);

    expect(tx.equipmentRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: "eqr_1",
        status: "APPROVED",
        event: {
          status: { in: RESERVABLE_EVENT_STATUSES },
          startAt: { gt: expect.any(Date) },
        },
      },
      select: {
        eventId: true,
        updatedAt: true,
        event: {
          select: {
            startAt: true,
            endAt: true,
            reservations: {
              where: { status: "CONFIRMED" },
              select: {
                requestId: true,
                equipmentId: true,
                quantity: true,
                startAt: true,
                endAt: true,
              },
            },
          },
        },
        // SCRUM-142 AC1: a line the Coordinator removed is left out.
        lines: {
          where: { removedAt: null },
          select: { equipmentId: true, quantity: true },
        },
      },
    });
  });

  it("SCRUM-155 [AC6] TC-155-07, TC-155-12: a request whose every line is already covered is refused and nothing is written", async () => {
    const whole = { startAt: new Date(START), endAt: new Date(END) };
    approvedRequestWithStock({
      reservations: [
        {
          requestId: "eqr_1",
          equipmentId: "eq_projector",
          quantity: 2,
          ...whole,
        },
        { requestId: null, equipmentId: "eq_mic", quantity: 3, ...whole },
      ],
    });

    const result = await reserveEquipmentRequest(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already reserved/);
    expect(tx.reservation.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-156 [AC5] TC-156-07: a request with a line still missing can be reserved", async () => {
    const whole = { startAt: new Date(START), endAt: new Date(END) };
    approvedRequestWithStock({
      reservations: [
        {
          requestId: "eqr_1",
          equipmentId: "eq_projector",
          quantity: 2,
          ...whole,
        },
      ],
    });

    const result = await reserveEquipmentRequest({
      ...validInput,
      lines: [{ equipmentId: "eq_mic", quantity: 3 }],
    });

    expect(result.ok).toBe(true);
  });

  it("SCRUM-155 [AC1, AC6] TC-155-06, TC-155-10, TC-155-12: a request already reserved, or no longer approved, is refused and nothing is written", async () => {
    approvedRequestWithStock();
    tx.equipmentRequest.findFirst.mockResolvedValue(null);

    const result = await reserveEquipmentRequest(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatch(/already reserved, or no longer approved/);
    expect(tx.reservation.createMany).not.toHaveBeenCalled();
  });

  describe("SCRUM-155 [AC2] TC-155-13: the period may grow but must cover the whole event", () => {
    it("refuses a period that starts after the event begins, on the start field", async () => {
      approvedRequestWithStock();

      const result = await reserveEquipmentRequest({
        ...validInput,
        startAt: "2030-06-01T02:00:00.000Z",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(
          "The reservation must cover the whole event.",
        );
        expect(Object.keys(result.fieldErrors ?? {})).toEqual(["startAt"]);
        expect(result.fieldErrors?.startAt?.[0]).toMatch(
          /^Start by .*when the event begins\.$/,
        );
      }
      expect(tx.reservation.createMany).not.toHaveBeenCalled();
    });

    it("refuses a period that ends before the event ends, on the end field", async () => {
      approvedRequestWithStock();

      const result = await reserveEquipmentRequest({
        ...validInput,
        endAt: "2030-06-01T08:00:00.000Z",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(Object.keys(result.fieldErrors ?? {})).toEqual(["endAt"]);
        expect(result.fieldErrors?.endAt?.[0]).toMatch(
          /^End at .*or later, when the event ends\.$/,
        );
      }
      expect(tx.reservation.createMany).not.toHaveBeenCalled();
    });

    it("accepts a period that extends past both ends, for set-up and pack-down", async () => {
      approvedRequestWithStock();

      const result = await reserveEquipmentRequest({
        ...validInput,
        startAt: "2030-06-01T00:00:00.000Z",
        endAt: "2030-06-01T10:00:00.000Z",
      });

      expect(result).toEqual({ ok: true, data: { reserved: 2 } });
    });

    it("has nothing to check against when the event has no end date", async () => {
      approvedRequestWithStock({
        event: { startAt: new Date(START), endAt: null },
      });

      const result = await reserveEquipmentRequest(validInput);

      expect(result).toEqual({ ok: true, data: { reserved: 2 } });
    });

    it("has nothing to check against when the event has no start date", async () => {
      approvedRequestWithStock({
        event: { startAt: null, endAt: new Date(END) },
      });

      const result = await reserveEquipmentRequest(validInput);

      expect(result).toEqual({ ok: true, data: { reserved: 2 } });
    });
  });

  it("SCRUM-155 [AC2, AC7] TC-155-14: marks the row whose equipment type has been retired, and reserves nothing", async () => {
    approvedRequestWithStock({
      pools: [{ id: "eq_projector", totalQuantity: 10 }],
    });

    const result = await reserveEquipmentRequest(validInput);

    expect(result).toEqual({
      ok: false,
      error: "Nothing was reserved: an equipment type is no longer available.",
      fieldErrors: {
        "lines.1.equipmentId": [
          "This equipment type is no longer available. Choose another.",
        ],
      },
    });
    expect(tx.reservation.findMany).not.toHaveBeenCalled();
    expect(tx.reservation.createMany).not.toHaveBeenCalled();
  });

  describe("SCRUM-155 [AC7] TC-155-09: invalid rows or periods reserve nothing and say where the problem is", () => {
    it.each([
      [{ lines: [] }, "lines", /at least one/],
      [
        { lines: [{ equipmentId: "", quantity: 1 }] },
        "lines.0.equipmentId",
        /Select an equipment type/,
      ],
      [
        { lines: [{ equipmentId: "eq_mic", quantity: 0 }] },
        "lines.0.quantity",
        /greater than zero/,
      ],
      [
        { lines: [{ equipmentId: "eq_mic", quantity: 1.5 }] },
        "lines.0.quantity",
        /whole number/,
      ],
      [
        {
          lines: [
            { equipmentId: "eq_mic", quantity: 1 },
            { equipmentId: "eq_mic", quantity: 2 },
          ],
        },
        "lines.1.equipmentId",
        /already on another row/,
      ],
      [
        { lines: [{ equipmentId: "eq_mic", quantity: 1001 }] },
        "lines.0.quantity",
        /at most 1,000/,
      ],
      [
        {
          lines: Array.from({ length: 21 }, (_, i) => ({
            equipmentId: `eq_${i}`,
            quantity: 1,
          })),
        },
        "lines",
        /at most 20/,
      ],
      [{ endAt: START }, "endAt", /after the start/],
      [{ startAt: "2020-01-01T01:00:00.000Z" }, "startAt", /in the past/],
      [{ requestId: "" }, "requestId", /approved request/],
    ])("%j → %s", async (change, path, message) => {
      const result = await reserveEquipmentRequest({
        ...validInput,
        ...change,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors?.[path]?.[0]).toMatch(message);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("keeps every message for a field, e.g. a blank start is both missing and unreadable", async () => {
      const result = await reserveEquipmentRequest({
        ...validInput,
        startAt: "",
      });

      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.fieldErrors?.startAt).toEqual([
          "Choose a reservation start time.",
          "Invalid start time.",
        ]);
    });
  });

  it("refuses a role without equipment:reserve before reading anything", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));

    const result = await reserveEquipmentRequest(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("refuses a session with a permitted role but no user id before any write", async () => {
    mockAuth.mockResolvedValue({
      user: { role: "TECH_SUPPORT", name: "Test User" },
      expires: "2999-01-01T00:00:00.000Z",
    });

    const result = await reserveEquipmentRequest(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("a database failure while saving propagates instead of being reported as a refusal", async () => {
    approvedRequestWithStock();
    tx.reservation.createMany.mockRejectedValue(new Error("connection lost"));

    await expect(reserveEquipmentRequest(validInput)).rejects.toThrow(
      "connection lost",
    );
  });
});
