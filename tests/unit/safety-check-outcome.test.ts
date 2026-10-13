import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { flagArrangements } from "@/lib/reconsideration";
import { recordSafetyCheckOutcome } from "@/app/(app)/safety-checks/actions";

// SCRUM-166 — a Safety Officer records a check's outcome. Test cases:
// docs/testing/SCRUM-166.md. Session and database are mocked; the
// transaction runs its callback against a mock `tx`. Raising the flags is
// SCRUM-26's `flagArrangements`, tested in reconsideration.test.ts, so here
// only its calls are checked.

const tx = vi.hoisted(() => ({
  event: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  booking: { count: vi.fn() },
  reservation: { count: vi.fn() },
  safetyCheck: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  safetyCheckArrangement: { createMany: vi.fn() },
  notification: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { safetyCheck: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/reconsideration", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reconsideration")>()),
  flagArrangements: vi.fn(),
}));

const mockAuth = auth as unknown as Mock;
const mockCheck = prisma.safetyCheck.findUnique as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;
const mockFlag = flagArrangements as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Sam Safety", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const checkRow = (
  over: Partial<{ organiserId: string; coordinatorId: string | null; status: EventStatus }> = {},
) => ({
  eventId: "evt_1",
  event: {
    organiserId: "usr_org",
    coordinatorId: "usr_coord" as string | null,
    status: "PLANNING" as EventStatus,
    name: "Concert",
    ...over,
  },
});

const NOTE = "The fire exit is blocked by the stage.";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("SAFETY_OFFICER", "usr_safety"));
  mockCheck.mockResolvedValue(checkRow());
  tx.event.findUniqueOrThrow.mockResolvedValue({ status: "PLANNING" });
  tx.booking.count.mockResolvedValue(1);
  tx.reservation.count.mockResolvedValue(1);
  tx.safetyCheck.updateMany.mockResolvedValue({ count: 1 });
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

function expectNothingWritten() {
  expect(tx.safetyCheck.updateMany).not.toHaveBeenCalled();
  expect(tx.safetyCheckArrangement.createMany).not.toHaveBeenCalled();
  expect(mockFlag).not.toHaveBeenCalled();
  expect(tx.notification.create).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
}

describe("recordSafetyCheckOutcome — outcomes (SCRUM-166 AC3, AC5, AC10, AC11, AC14)", () => {
  it("SCRUM-166 [AC3, AC5, AC14] TC-166-04: Approved is saved with who and when, flags nothing, and doesn't confirm the event", async () => {
    const result = await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "APPROVED" });

    expect(result).toEqual({ ok: true, data: { status: "APPROVED" } });
    expect(tx.safetyCheck.updateMany).toHaveBeenCalledWith({
      where: { id: "chk_1", status: "AWAITING_REVIEW" },
      data: {
        status: "APPROVED",
        note: null,
        decidedById: "usr_safety",
        decidedAt: expect.any(Date),
      },
    });
    expect(mockFlag).not.toHaveBeenCalled();
    expect(tx.event.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      entityType: "SafetyCheck",
      entityId: "chk_1",
      action: "APPROVED",
      actorId: "usr_safety",
      oldValue: "AWAITING_REVIEW",
      newValue: "APPROVED",
    });
  });

  it("SCRUM-166 [AC3, AC10] TC-166-05: Changes requested keeps the note and the picked arrangements, and flags only those with the note", async () => {
    const result = await recordSafetyCheckOutcome({
      checkId: "chk_1",
      outcome: "CHANGES_REQUESTED",
      note: NOTE,
      bookingIds: ["bkg_1"],
      reservationIds: ["res_1"],
    });

    expect(result).toEqual({ ok: true, data: { status: "CHANGES_REQUESTED" } });
    expect(tx.booking.count).toHaveBeenCalledWith({
      where: { id: { in: ["bkg_1"] }, eventId: "evt_1", status: { in: ["PENDING", "HELD", "APPROVED"] } },
    });
    expect(tx.reservation.count).toHaveBeenCalledWith({
      where: { id: { in: ["res_1"] }, eventId: "evt_1", status: "CONFIRMED" },
    });
    expect(tx.safetyCheck.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "CHANGES_REQUESTED",
      note: NOTE,
    });
    expect(tx.safetyCheckArrangement.createMany).toHaveBeenCalledWith({
      data: [
        { checkId: "chk_1", bookingId: "bkg_1" },
        { checkId: "chk_1", reservationId: "res_1" },
      ],
    });
    expect(mockFlag).toHaveBeenCalledWith(
      tx,
      { bookingIds: ["bkg_1"], reservationIds: ["res_1"] },
      `Safety check changes requested: ${NOTE}`,
      expect.any(Date),
    );
    expect(tx.event.update).not.toHaveBeenCalled();
  });

  it("SCRUM-166 [AC11] TC-166-06: Rejected flags every arrangement of the event and leaves it in Planning", async () => {
    const result = await recordSafetyCheckOutcome({
      checkId: "chk_1",
      outcome: "REJECTED",
      note: NOTE,
    });

    expect(result).toEqual({ ok: true, data: { status: "REJECTED" } });
    expect(mockFlag).toHaveBeenCalledWith(
      tx,
      { eventId: "evt_1" },
      `Safety check rejected: ${NOTE}`,
      expect.any(Date),
    );
    expect(tx.safetyCheckArrangement.createMany).not.toHaveBeenCalled();
    expect(tx.event.update).not.toHaveBeenCalled();
  });
});

describe("recordSafetyCheckOutcome — the Coordinator is told (SCRUM-166 AC4)", () => {
  it("SCRUM-166 [AC4] TC-166-07: the Coordinator is notified of the outcome and the note", async () => {
    await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "REJECTED", note: NOTE });

    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_coord",
        type: "SAFETY_CHECK_OUTCOME",
        title: "Safety check rejected",
        message: `"Concert": Rejected. ${NOTE}`,
        link: "/events",
        eventId: "evt_1",
      },
    });
  });

  it("SCRUM-166 [AC4] TC-166-07: an approval without a note says only the outcome; an event with no Coordinator has no one to notify", async () => {
    await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "APPROVED", note: "" });
    expect(tx.notification.create.mock.calls[0][0].data.message).toBe('"Concert": Approved.');

    tx.notification.create.mockClear();
    mockCheck.mockResolvedValue(checkRow({ coordinatorId: null }));
    await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "APPROVED" });
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});

describe("recordSafetyCheckOutcome — refusals (SCRUM-166 AC3, AC6–AC8, AC13)", () => {
  it("SCRUM-166 [AC3] TC-166-08: Changes requested and Rejected need a note, and Changes requested needs at least one arrangement", async () => {
    expect(
      await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "REJECTED", note: "  " }),
    ).toMatchObject({
      ok: false,
      error: "A note is required for Changes requested or Rejected.",
    });
    expect(
      await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "CHANGES_REQUESTED", note: NOTE }),
    ).toMatchObject({
      ok: false,
      error: "Pick at least one venue booking or equipment reservation the changes affect.",
    });
    expect(await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "MAYBE" })).toMatchObject({
      ok: false,
      error: "Please choose an outcome.",
    });
    expect(mockCheck).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("SCRUM-166 [AC3] TC-166-08: a picked arrangement that isn't one of this event's current ones is refused", async () => {
    tx.reservation.count.mockResolvedValue(0);

    expect(
      await recordSafetyCheckOutcome({
        checkId: "chk_1",
        outcome: "CHANGES_REQUESTED",
        note: NOTE,
        bookingIds: ["bkg_1"],
        reservationIds: ["res_other"],
      }),
    ).toEqual({
      ok: false,
      error: "Pick only this event's current venue bookings or equipment reservations.",
    });
    expectNothingWritten();
  });

  it("SCRUM-166 [AC6] TC-166-09: only a Safety Officer may record, and never for an event they organise or coordinate", async () => {
    for (const role of ["COORDINATOR", "ORGANISER", "VENUE_STAFF", "COORDINATOR_LEAD"] as Role[]) {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_x"));
      expect(
        await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "APPROVED" }),
      ).toEqual({ ok: false, error: "You do not have permission to do that." });
    }
    mockAuth.mockResolvedValue(sessionFor("SAFETY_OFFICER", "usr_safety"));
    for (const own of [{ organiserId: "usr_safety" }, { coordinatorId: "usr_safety" }]) {
      mockCheck.mockResolvedValue(checkRow(own));
      expect(
        await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "APPROVED" }),
      ).toEqual({ ok: false, error: "Safety check not found." });
    }
    mockCheck.mockResolvedValue(null);
    expect(
      await recordSafetyCheckOutcome({ checkId: "chk_x", outcome: "APPROVED" }),
    ).toEqual({ ok: false, error: "Safety check not found." });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-166 [AC7, AC8] TC-166-11: recording on a check already decided changes nothing and shows the outcome that stands, with who and when", async () => {
    tx.safetyCheck.updateMany.mockResolvedValue({ count: 0 });
    tx.safetyCheck.findUniqueOrThrow.mockResolvedValue({
      status: "APPROVED",
      decidedAt: new Date("2032-01-05T02:00:00Z"),
      decidedBy: { name: "Sara Safety" },
    });

    expect(
      await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "REJECTED", note: NOTE }),
    ).toEqual({
      ok: false,
      error:
        "This check is already Approved by Sara Safety on 5 Jan 2032, 10:00 am SGT; nothing was changed.",
    });
    expect(mockFlag).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("SCRUM-166 [AC13] TC-166-12: an Outdated check can't be approved, and the refusal says why rather than who approved it before", async () => {
    tx.safetyCheck.updateMany.mockResolvedValue({ count: 0 });
    // Approved earlier, then outdated by a change: it still carries who approved it.
    tx.safetyCheck.findUniqueOrThrow.mockResolvedValue({
      status: "OUTDATED",
      decidedAt: new Date("2032-01-05T02:00:00Z"),
      decidedBy: { name: "Sara Safety" },
    });

    expect(
      await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "APPROVED" }),
    ).toEqual({
      ok: false,
      error:
        "This check is Outdated because the event's arrangements changed; nothing was changed. The Coordinator needs to request a new one.",
    });
  });

  it("SCRUM-166 [AC15] TC-166-11: an event no longer in Planning can't have its check recorded", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue({ status: "CANCELLED" });

    expect(
      await recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "APPROVED" }),
    ).toEqual({
      ok: false,
      error: "This event is no longer in Planning, so its safety check can't be recorded.",
    });
    expectNothingWritten();
  });

  it("does not swallow an unexpected database error", async () => {
    mockTransaction.mockRejectedValue(new Error("connection lost"));
    await expect(
      recordSafetyCheckOutcome({ checkId: "chk_1", outcome: "APPROVED" }),
    ).rejects.toThrow("connection lost");
  });
});
