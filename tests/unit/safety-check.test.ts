import { describe, it, expect, vi } from "vitest";
import type { Prisma, SafetyCheckStatus } from "@prisma/client";

import {
  outdateSafetyChecks,
  safetyCheckItem,
  safetyCheckRequestable,
} from "@/lib/safety-checks";
import { getReadinessChecklist, type ReadinessChecklist } from "@/lib/event-readiness";

// SCRUM-166 — the safety check's checklist item, when one can be requested,
// and making a check Outdated. Test cases: docs/testing/SCRUM-166.md.

describe("safetyCheckItem — SCRUM-166 AC9", () => {
  it.each([
    ["AWAITING_REVIEW", "Awaiting review", false],
    ["APPROVED", "Approved", true],
    ["CHANGES_REQUESTED", "Changes requested", false],
    ["REJECTED", "Rejected", false],
    ["OUTDATED", "Outdated", false],
  ] as [SafetyCheckStatus, string, boolean][])(
    "SCRUM-166 [AC9, AC15] TC-166-10: a latest check %s reads %s, and only Approved completes the item",
    (status, state, complete) => {
      expect(safetyCheckItem({ status, note: "Widen the exits." })).toEqual({
        name: "Safety check",
        complete,
        state,
        reason: "Widen the exits.",
      });
    },
  );

  it("SCRUM-166 [AC9] TC-166-10: with no check, the item reads Not requested and is incomplete", () => {
    expect(safetyCheckItem(undefined)).toEqual({
      name: "Safety check",
      complete: false,
      state: "Not requested",
      reason: null,
    });
  });
});

describe("the readiness checklist with a safety check — SCRUM-166 AC9", () => {
  const START = new Date("2031-06-01T01:00:00Z");
  const END = new Date("2031-06-01T09:00:00Z");
  function client(safetyChecks: { status: SafetyCheckStatus; note: string | null }[]) {
    const findUnique = vi.fn().mockResolvedValue({
      status: "PLANNING",
      startAt: START,
      endAt: END,
      bookings: [
        { id: "bkg_1", venue: { name: "Main Hall" }, status: "APPROVED", decisionReason: null, createdAt: START, startAt: START, endAt: END },
      ],
      equipmentRequests: [],
      reservations: [],
      // SCRUM-170 AC4: Equipment is always listed; this event needs none.
      noEquipmentNeededAt: START,
      noEquipmentNeededBy: { name: "Cody Coordinator" },
      safetyChecks,
    });
    return { db: { event: { findUnique } } as unknown as Prisma.TransactionClient, findUnique };
  }

  it("SCRUM-166 [AC9] TC-166-10: with every arrangement complete, the event is ready only once its latest check is Approved", async () => {
    const notYet = await getReadinessChecklist(client([]).db, "evt");
    expect(notYet?.ready).toBe(false);
    expect(notYet?.items.at(-1)).toMatchObject({ name: "Safety check", state: "Not requested" });

    const outdated = await getReadinessChecklist(
      client([{ status: "OUTDATED", note: null }]).db,
      "evt",
    );
    expect(outdated?.ready).toBe(false);

    const approved = await getReadinessChecklist(
      client([{ status: "APPROVED", note: null }]).db,
      "evt",
    );
    expect(approved?.ready).toBe(true);
  });

  it("SCRUM-166 [AC9] TC-166-10: reads only the event's latest check", async () => {
    const { db, findUnique } = client([]);
    await getReadinessChecklist(db, "evt");

    expect(findUnique.mock.calls[0][0].select.safetyChecks).toEqual({
      select: { status: true, note: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
  });
});

describe("safetyCheckRequestable — SCRUM-166 AC1, AC7, AC12", () => {
  const checklist = (
    arrangementsComplete: boolean,
    safetyState: string | null,
  ): ReadinessChecklist => ({
    ready: false,
    items: [
      { name: "Venue booking", complete: arrangementsComplete, state: "Approved", reason: null },
      ...(safetyState === null
        ? []
        : [{ name: "Safety check" as const, complete: false, state: safetyState, reason: null }]),
    ],
  });

  it("SCRUM-166 [AC1, AC12] TC-166-01: requestable once every other item is complete and there is no check, or the last one was Changes requested, Rejected or Outdated", () => {
    for (const state of ["Not requested", "Changes requested", "Rejected", "Outdated"]) {
      expect(safetyCheckRequestable(checklist(true, state))).toBe(true);
    }
  });

  it("SCRUM-166 [AC1, AC7] TC-166-02: not requestable before the arrangements are complete, while a check awaits review or is approved, or without a safety item", () => {
    expect(safetyCheckRequestable(checklist(false, "Not requested"))).toBe(false);
    expect(safetyCheckRequestable(checklist(true, "Awaiting review"))).toBe(false);
    expect(safetyCheckRequestable(checklist(true, "Approved"))).toBe(false);
    expect(safetyCheckRequestable(checklist(true, null))).toBe(false);
  });
});

describe("outdateSafetyChecks — SCRUM-166 AC13", () => {
  it("SCRUM-166 [AC13] TC-166-12: marks the event's approved or awaiting check Outdated with the time, and nothing else", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { safetyCheck: { updateMany } } as unknown as Prisma.TransactionClient;
    const now = new Date("2031-05-01T00:00:00Z");

    expect(await outdateSafetyChecks(tx, "evt_1", now)).toEqual({ count: 1 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt_1", status: { in: ["AWAITING_REVIEW", "APPROVED"] } },
      data: { status: "OUTDATED", outdatedAt: now },
    });
  });
});
