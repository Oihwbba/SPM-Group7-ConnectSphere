import { describe, it, expect, vi } from "vitest";
import type { EventStatus, PrismaClient } from "@prisma/client";

import {
  CANCELLABLE,
  completeFinishedEvents,
  EVENT_TOOK_PLACE,
  isOverdue,
} from "@/lib/event-closing";

// SCRUM-82 — which events can be cancelled, which are overdue, and completing
// finished events without a job. Test cases: docs/testing/SCRUM-82.md.

const NOW = new Date("2032-06-01T04:00:00.000Z");

describe("CANCELLABLE — SCRUM-82 AC1", () => {
  it("SCRUM-82 [AC1] TC-82-01: an event Under Review, in Planning or Confirmed can be cancelled", () => {
    expect(CANCELLABLE).toEqual(["UNDER_REVIEW", "PLANNING", "CONFIRMED"]);
  });
});

describe("isOverdue — SCRUM-82 AC10", () => {
  const before = new Date(NOW.getTime() - 60_000);

  it.each(["SUBMITTED", "UNDER_REVIEW", "PLANNING"] as EventStatus[])(
    "SCRUM-82 [AC10] TC-82-11: a %s event whose start has passed is overdue",
    (status) => {
      expect(isOverdue({ status, startAt: before }, NOW)).toBe(true);
    },
  );

  it("SCRUM-82 [AC10] TC-82-11: not overdue at exactly its start, before it, without a start, or once decided, confirmed or closed", () => {
    expect(isOverdue({ status: "PLANNING", startAt: NOW }, NOW)).toBe(false);
    expect(isOverdue({ status: "PLANNING", startAt: new Date(NOW.getTime() + 1) }, NOW)).toBe(false);
    expect(isOverdue({ status: "PLANNING", startAt: null }, NOW)).toBe(false);
    for (const status of ["DRAFT", "APPROVED", "CONFIRMED", "COMPLETED", "CANCELLED", "REJECTED"] as EventStatus[]) {
      expect(isOverdue({ status, startAt: before }, NOW)).toBe(false);
    }
  });

  it("SCRUM-82 [AC10] TC-82-11: uses the current time when none is given", () => {
    expect(isOverdue({ status: "PLANNING", startAt: new Date("2000-01-01T00:00:00Z") })).toBe(true);
  });
});

describe("completeFinishedEvents — SCRUM-82 AC7–AC9, AC11", () => {
  function client(
    completed: { id: string }[],
    pending: { id: string; event: { id: string; name: string; organiserId: string } }[] = [],
  ) {
    const $queryRaw = vi.fn().mockResolvedValue(completed);
    const createMany = vi.fn();
    const changeRequests = { findMany: vi.fn().mockResolvedValue(pending), updateMany: vi.fn() };
    const notifications = { createMany: vi.fn() };
    const tx = {
      $queryRaw,
      auditLog: { createMany },
      eventChangeRequest: changeRequests,
      notification: notifications,
    };
    const $transaction = vi.fn((work: (t: typeof tx) => unknown) => work(tx));
    const db = { $transaction } as unknown as PrismaClient;
    return { db, $queryRaw, createMany, $transaction, changeRequests, notifications };
  }

  it("SCRUM-82 [AC7] TC-82-09: the completion and its history entries are written in one transaction", async () => {
    const { db, $queryRaw, createMany, $transaction } = client([{ id: "evt_1" }]);

    await completeFinishedEvents(db, NOW);

    expect($transaction).toHaveBeenCalledTimes(1);
    expect($queryRaw).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it("SCRUM-82 [AC11] TC-82-14: a change request still Submitted is rejected with “The event has already taken place”, recorded, and the Organiser told, in the same transaction", async () => {
    const { db, createMany, changeRequests, notifications } = client(
      [{ id: "evt_1" }, { id: "evt_2" }],
      [{ id: "cr_1", event: { id: "evt_1", name: "Concert", organiserId: "usr_org" } }],
    );

    await completeFinishedEvents(db, NOW);

    expect(changeRequests.findMany).toHaveBeenCalledWith({
      where: { eventId: { in: ["evt_1", "evt_2"] }, status: "PENDING_REVIEW" },
      select: { id: true, event: { select: { id: true, name: true, organiserId: true } } },
    });
    expect(changeRequests.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["cr_1"] }, status: "PENDING_REVIEW" },
      data: { status: "REJECTED", decidedAt: NOW, decisionReason: EVENT_TOOK_PLACE },
    });
    expect(EVENT_TOOK_PLACE).toBe("The event has already taken place.");
    expect(createMany).toHaveBeenLastCalledWith({
      data: [
        {
          entityType: "EventChangeRequest",
          entityId: "cr_1",
          action: "REJECTED",
          actorId: null,
          fieldName: "status",
          oldValue: "PENDING_REVIEW",
          newValue: "REJECTED",
          summary: EVENT_TOOK_PLACE,
        },
      ],
    });
    expect(notifications.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "usr_org",
          type: "CHANGE_REQUEST_OUTCOME",
          title: "Change request rejected",
          message: 'Your change request for "Concert" was rejected: The event has already taken place.',
          link: "/events",
          eventId: "evt_1",
        },
      ],
    });
  });

  it("SCRUM-82 [AC11] TC-82-14: with no Submitted change request, nothing is rejected or sent", async () => {
    const { db, changeRequests, notifications } = client([{ id: "evt_1" }]);

    await completeFinishedEvents(db, NOW);

    expect(changeRequests.updateMany).not.toHaveBeenCalled();
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-82 [AC7] TC-82-09: completes Confirmed events whose end has passed, with a history entry each, and returns them", async () => {
    const { db, $queryRaw, createMany } = client([{ id: "evt_1" }, { id: "evt_2" }]);

    expect(await completeFinishedEvents(db, NOW)).toEqual(["evt_1", "evt_2"]);

    const [sql, ...values] = $queryRaw.mock.calls[0];
    const text = sql.join("?");
    // AC7, AC9: only Confirmed, and only strictly after the end.
    expect(text).toContain(`WHERE "status" = 'CONFIRMED'`);
    expect(text).toContain(`"endAt" < ?::timestamp`);
    expect(text).toContain(`SET "status" = 'COMPLETED'`);
    expect(text).toContain("RETURNING");
    expect(values).toEqual([NOW.toISOString(), NOW.toISOString(), NOW.toISOString()]);
    expect(createMany).toHaveBeenCalledWith({
      data: ["evt_1", "evt_2"].map((entityId) => ({
        entityType: "Event",
        entityId,
        action: "STATUS_CHANGED",
        actorId: null,
        fieldName: "status",
        oldValue: "CONFIRMED",
        newValue: "COMPLETED",
        summary: "Completed after its end time (SCRUM-82)",
      })),
    });
  });

  it("SCRUM-82 [AC8] TC-82-10: when nothing has finished, or it was already completed, nothing is written", async () => {
    const { db, createMany, changeRequests } = client([]);

    expect(await completeFinishedEvents(db, NOW)).toEqual([]);
    expect(createMany).not.toHaveBeenCalled();
    expect(changeRequests.findMany).not.toHaveBeenCalled();
  });

  it("SCRUM-82 [AC7] TC-82-09: uses the current time when none is given", async () => {
    const { db, $queryRaw } = client([]);
    const before = Date.now();

    await completeFinishedEvents(db);

    expect(Date.parse($queryRaw.mock.calls[0][1])).toBeGreaterThanOrEqual(before);
  });
});
