import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  suggestAlternativeEquipment,
  updateEquipmentRequestStatus,
} from "@/app/(app)/equipment-requests/actions";
import { getPoolAvailability } from "@/lib/equipment/request-queries";

// SCRUM-28 — Review and Update Equipment Request. Database mocked; the
// conditional update under two simultaneous reviewers, and the rows each update
// writes, run against real Postgres in
// tests/integration/equipment-request-review.test.ts.
const tx = vi.hoisted(() => ({
  equipmentRequest: { updateMany: vi.fn() },
  equipmentRequestLine: { update: vi.fn() },
  equipmentRequestUpdate: { create: vi.fn() },
  notification: { create: vi.fn() },
}));
const db = vi.hoisted(() => ({
  equipmentRequest: { findUnique: vi.fn() },
  equipment: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/equipment/request-queries", () => ({
  getPoolAvailability: vi.fn(),
}));

const mockAuth = auth as unknown as Mock;
const mockPool = getPoolAvailability as unknown as Mock;

function sessionFor(role: Role, id = "usr_tech"): Session {
  return {
    user: { id, role, name: "Theo Tech", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const START = new Date("2031-02-03T01:00:00.000Z");
const END = new Date("2031-02-03T09:00:00.000Z");
const event = {
  id: "evt_1",
  name: "Research Symposium",
  startAt: START,
  endAt: END,
};

const stored = (status: string, lines: unknown[] = []) => ({
  id: "eqr_1",
  status,
  requestedById: "usr_coord",
  event,
  lines,
});

const shortLine = {
  id: "eql_1",
  quantity: 3,
  equipment: { id: "eqp_lectern", type: "Lectern" },
};

const denied = ["ORGANISER", "COORDINATOR", "VENUE_STAFF", "ATTENDEE"] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT"));
  db.$transaction.mockImplementation(
    async (fn: (client: typeof tx) => unknown) => fn(tx),
  );
  tx.equipmentRequest.updateMany.mockResolvedValue({ count: 1 });
  tx.equipmentRequestLine.update.mockResolvedValue({});
  tx.equipmentRequestUpdate.create.mockResolvedValue({});
  tx.notification.create.mockResolvedValue({});
});

describe("updateEquipmentRequestStatus — SCRUM-28", () => {
  it("SCRUM-28 [AC2, AC5, AC6] TC-28-02, TC-28-09, TC-28-10: takes a pending request into review, records it and tells the coordinator", async () => {
    db.equipmentRequest.findUnique.mockResolvedValue(stored("PENDING_REVIEW"));

    const result = await updateEquipmentRequestStatus({
      requestId: "eqr_1",
      toStatus: "IN_REVIEW",
    });

    expect(result).toEqual({ ok: true, data: { status: "IN_REVIEW" } });
    expect(tx.equipmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "eqr_1", status: "PENDING_REVIEW" },
      data: { status: "IN_REVIEW", decidedAt: null },
    });
    // AC 6: the update joins the request's history.
    expect(tx.equipmentRequestUpdate.create).toHaveBeenCalledWith({
      data: {
        requestId: "eqr_1",
        actorId: "usr_tech",
        fromStatus: "PENDING_REVIEW",
        toStatus: "IN_REVIEW",
        note: null,
      },
    });
    // AC 5: the coordinator who raised it is notified automatically.
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_coord",
        type: "EQUIPMENT_REQUEST_UPDATED",
        title: "Equipment request updated",
        message:
          'Your equipment request for "Research Symposium" is now In Review.',
        link: "/equipment-requests",
        eventId: "evt_1",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/equipment-requests");
  });

  it("SCRUM-28 [AC3, AC5] TC-28-03, TC-28-09: approves a request in review, stamping the decision and passing on the note", async () => {
    db.equipmentRequest.findUnique.mockResolvedValue(stored("IN_REVIEW"));

    const result = await updateEquipmentRequestStatus({
      requestId: "eqr_1",
      toStatus: "APPROVED",
      note: "All items are available.",
    });

    expect(result).toEqual({ ok: true, data: { status: "APPROVED" } });
    expect(tx.equipmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "eqr_1", status: "IN_REVIEW" },
      data: { status: "APPROVED", decidedAt: expect.any(Date) },
    });
    expect(tx.notification.create.mock.calls[0][0].data.message).toBe(
      'Your equipment request for "Research Symposium" is now Approved. Note: All items are available.',
    );
  });

  it("SCRUM-28 [AC3, AC6] TC-28-04, TC-28-10: rejects a request in review with the reason", async () => {
    db.equipmentRequest.findUnique.mockResolvedValue(stored("IN_REVIEW"));

    const result = await updateEquipmentRequestStatus({
      requestId: "eqr_1",
      toStatus: "REJECTED",
      note: "No lecterns that week.",
    });

    expect(result).toEqual({ ok: true, data: { status: "REJECTED" } });
    expect(
      tx.equipmentRequestUpdate.create.mock.calls[0][0].data,
    ).toMatchObject({
      fromStatus: "IN_REVIEW",
      toStatus: "REJECTED",
      note: "No lecterns that week.",
    });
  });

  it("SCRUM-28 [AC3] TC-28-04: a rejection without a reason is refused next to the note, and nothing is written", async () => {
    const result = await updateEquipmentRequestStatus({
      requestId: "eqr_1",
      toStatus: "REJECTED",
    });

    expect(result).toEqual({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        note: ["Give the coordinator a reason for rejecting the request."],
      },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["PENDING_REVIEW", "APPROVED", "Pending Review", "Approved"],
    ["APPROVED", "REJECTED", "Approved", "Rejected"],
    ["REJECTED", "IN_REVIEW", "Rejected", "In Review"],
  ])(
    "SCRUM-28 [AC2, AC3] TC-28-05: refuses %s → %s, and writes nothing",
    async (from, to, fromLabel, toLabel) => {
      db.equipmentRequest.findUnique.mockResolvedValue(stored(from));

      const result = await updateEquipmentRequestStatus({
        requestId: "eqr_1",
        toStatus: to,
        note: "reason",
      });

      expect(result).toEqual({
        ok: false,
        error: `This request is ${fromLabel}, so it can't be marked ${toLabel}.`,
        fieldErrors: undefined,
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-28 [AC7] TC-28-06: when another reviewer changes the request first, says so and records nothing", async () => {
    db.equipmentRequest.findUnique.mockResolvedValue(stored("PENDING_REVIEW"));
    tx.equipmentRequest.updateMany.mockResolvedValue({ count: 0 });

    const result = await updateEquipmentRequestStatus({
      requestId: "eqr_1",
      toStatus: "IN_REVIEW",
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Someone else updated this request first. Refresh to see its current status.",
      fieldErrors: undefined,
    });
    expect(tx.equipmentRequestUpdate.create).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a request that doesn't exist", async () => {
    db.equipmentRequest.findUnique.mockResolvedValue(null);

    const result = await updateEquipmentRequestStatus({
      requestId: "eqr_missing",
      toStatus: "IN_REVIEW",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "Equipment request not found.",
    });
  });

  it("refuses a status Technical Support can't set", async () => {
    const result = await updateEquipmentRequestStatus({
      requestId: "eqr_1",
      toStatus: "CANCELLED",
    });

    expect(result.ok).toBe(false);
    expect(db.equipmentRequest.findUnique).not.toHaveBeenCalled();
  });

  it.each(denied)("refuses %s before reading anything", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));

    const result = await updateEquipmentRequestStatus({
      requestId: "eqr_1",
      toStatus: "IN_REVIEW",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "You do not have permission to do that.",
    });
    expect(db.equipmentRequest.findUnique).not.toHaveBeenCalled();
  });

  it("rethrows an unexpected database failure", async () => {
    db.equipmentRequest.findUnique.mockRejectedValue(
      new Error("connection lost"),
    );

    await expect(
      updateEquipmentRequestStatus({
        requestId: "eqr_1",
        toStatus: "IN_REVIEW",
      }),
    ).rejects.toThrow("connection lost");
  });
});

describe("suggestAlternativeEquipment — SCRUM-28 [AC4]", () => {
  const input = {
    requestId: "eqr_1",
    lineId: "eql_1",
    alternativeId: "eqp_laptop",
  };

  beforeEach(() => {
    db.equipmentRequest.findUnique.mockResolvedValue(
      stored("IN_REVIEW", [shortLine]),
    );
    db.equipment.findFirst.mockResolvedValue({
      id: "eqp_laptop",
      type: "Laptop",
    });
    mockPool.mockResolvedValue({
      eqp_lectern: { available: 1, total: 4 },
      eqp_laptop: { available: 6, total: 15 },
    });
  });

  it("SCRUM-28 [AC4, AC5] TC-28-07, TC-28-09: records the alternative on the short line, logs it and tells the coordinator", async () => {
    const result = await suggestAlternativeEquipment(input);

    expect(result).toEqual({ ok: true, data: { alternativeId: "eqp_laptop" } });
    expect(db.equipmentRequest.findUnique).toHaveBeenCalledWith({
      where: { id: "eqr_1" },
      select: {
        id: true,
        status: true,
        requestedById: true,
        // SCRUM-121 AC5: whose event it is.
        event: {
          select: { id: true, name: true, startAt: true, endAt: true, organiserId: true, coordinatorId: true },
        },
        lines: {
          where: { id: "eql_1", removedAt: null },
          select: {
            id: true,
            quantity: true,
            equipment: { select: { id: true, type: true } },
          },
        },
      },
    });
    expect(mockPool).toHaveBeenCalledWith(START, END);
    expect(tx.equipmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "eqr_1", status: "IN_REVIEW" },
      data: { updatedAt: expect.any(Date) },
    });
    expect(tx.equipmentRequestLine.update).toHaveBeenCalledWith({
      where: { id: "eql_1" },
      data: { suggestedAlternativeId: "eqp_laptop" },
    });
    expect(tx.equipmentRequestUpdate.create).toHaveBeenCalledWith({
      data: {
        requestId: "eqr_1",
        actorId: "usr_tech",
        fromStatus: null,
        toStatus: null,
        note: "Suggested Laptop instead of Lectern (only 1 of 4 free).",
      },
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_coord",
        type: "EQUIPMENT_REQUEST_UPDATED",
        title: "Equipment request updated",
        message:
          'Technical Support suggested Laptop instead of Lectern for "Research Symposium": only 1 of 4 Lectern are free.',
        link: "/equipment-requests",
        eventId: "evt_1",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/equipment-requests");
  });

  it("SCRUM-28 [AC4] TC-28-07: a requested type withdrawn from the pool counts as unavailable, so it can be replaced", async () => {
    mockPool.mockResolvedValue({ eqp_laptop: { available: 6, total: 15 } });

    const result = await suggestAlternativeEquipment(input);

    expect(result).toEqual({ ok: true, data: { alternativeId: "eqp_laptop" } });
    expect(tx.equipmentRequestUpdate.create.mock.calls[0][0].data.note).toBe(
      "Suggested Laptop instead of Lectern (only 0 of 0 free).",
    );
  });

  it("SCRUM-28 [AC4] TC-28-08: only while the request is in review", async () => {
    db.equipmentRequest.findUnique.mockResolvedValue(
      stored("PENDING_REVIEW", [shortLine]),
    );

    const result = await suggestAlternativeEquipment(input);

    expect(result).toMatchObject({
      ok: false,
      error: "Start the review before suggesting alternatives.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("SCRUM-28 [AC4] TC-28-08: only for equipment that is unavailable", async () => {
    mockPool.mockResolvedValue({
      eqp_lectern: { available: 3, total: 4 },
      eqp_laptop: { available: 6, total: 15 },
    });

    const result = await suggestAlternativeEquipment(input);

    expect(result).toMatchObject({
      ok: false,
      error:
        "Lectern has enough free for this event, so there is nothing to replace.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("SCRUM-28 [AC4] TC-28-08: the alternative must itself be available for the whole quantity", async () => {
    mockPool.mockResolvedValue({
      eqp_lectern: { available: 1, total: 4 },
      eqp_laptop: { available: 2, total: 15 },
    });

    const result = await suggestAlternativeEquipment(input);

    expect(result).toEqual({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        alternativeId: [
          "Only 2 of 15 Laptop are free for this event: 1 short.",
        ],
      },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  // regression (GLM review of #95): a type deactivated between the lookup and
  // the availability read is missing from the pool, and used to crash here.
  it("regression: an alternative missing from the availability snapshot is refused as having nothing free", async () => {
    mockPool.mockResolvedValue({ eqp_lectern: { available: 1, total: 4 } });

    const result = await suggestAlternativeEquipment(input);

    expect(result).toEqual({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        alternativeId: ["Only 0 of 0 Laptop are free for this event: 3 short."],
      },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("SCRUM-28 [AC4] TC-28-08: the alternative must be a different type from the inventory", async () => {
    const same = await suggestAlternativeEquipment({
      ...input,
      alternativeId: "eqp_lectern",
    });
    expect(same).toMatchObject({
      fieldErrors: { alternativeId: ["Choose a different equipment type."] },
    });

    db.equipment.findFirst.mockResolvedValue(null);
    const unknown = await suggestAlternativeEquipment({
      ...input,
      alternativeId: "eqp_gone",
    });
    expect(unknown).toMatchObject({
      fieldErrors: {
        alternativeId: ["Select an equipment type from the list."],
      },
    });
    expect(db.equipment.findFirst).toHaveBeenCalledWith({
      where: { id: "eqp_gone", isActive: true },
      select: { id: true, type: true },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("can't check an event without dates", async () => {
    db.equipmentRequest.findUnique.mockResolvedValue({
      ...stored("IN_REVIEW", [shortLine]),
      event: { ...event, startAt: null, endAt: null },
    });

    const result = await suggestAlternativeEquipment(input);

    expect(result).toMatchObject({
      ok: false,
      error: "This event has no dates yet, so availability can't be checked.",
    });
  });

  it("reports a line that isn't on the request, or a missing request, as not found", async () => {
    db.equipmentRequest.findUnique.mockResolvedValue(stored("IN_REVIEW", []));
    await expect(suggestAlternativeEquipment(input)).resolves.toMatchObject({
      error: "Equipment request not found.",
    });

    db.equipmentRequest.findUnique.mockResolvedValue(null);
    await expect(suggestAlternativeEquipment(input)).resolves.toMatchObject({
      error: "Equipment request not found.",
    });
  });

  it("when the request left review in the meantime, says so and records nothing", async () => {
    tx.equipmentRequest.updateMany.mockResolvedValue({ count: 0 });

    const result = await suggestAlternativeEquipment(input);

    expect(result).toMatchObject({
      ok: false,
      error:
        "Someone else updated this request first. Refresh to see its current status.",
    });
    expect(tx.equipmentRequestLine.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("refuses an incomplete suggestion before reading anything", async () => {
    const result = await suggestAlternativeEquipment({
      ...input,
      alternativeId: "",
    });

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { alternativeId: ["Choose the equipment to suggest."] },
    });
    expect(db.equipmentRequest.findUnique).not.toHaveBeenCalled();
  });

  it.each(denied)("refuses %s before reading anything", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));

    const result = await suggestAlternativeEquipment(input);

    expect(result).toMatchObject({
      ok: false,
      error: "You do not have permission to do that.",
    });
    expect(db.equipmentRequest.findUnique).not.toHaveBeenCalled();
  });

  it("rethrows an unexpected database failure", async () => {
    db.$transaction.mockRejectedValue(new Error("connection lost"));

    await expect(suggestAlternativeEquipment(input)).rejects.toThrow(
      "connection lost",
    );
  });
});
