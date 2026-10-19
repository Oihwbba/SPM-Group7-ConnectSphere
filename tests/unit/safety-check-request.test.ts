import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getReadinessChecklist, type ReadinessChecklist } from "@/lib/event-readiness";
import { requestSafetyCheck } from "@/app/(app)/events/safety-check-actions";

// SCRUM-166 AC1, AC7, AC12 — the assigned Coordinator requests a safety
// check. Test cases: docs/testing/SCRUM-166.md. Session and database are
// mocked; the transaction runs its callback against a mock `tx`, and the
// checklist is a fixed answer (its rules are tested in event-readiness tests).

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUniqueOrThrow: vi.fn() },
  safetyCheck: { findFirst: vi.fn(), create: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/event-readiness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/event-readiness")>()),
  getReadinessChecklist: vi.fn(),
}));

const mockAuth = auth as unknown as Mock;
const mockEvent = prisma.event.findUnique as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;
const mockChecklist = getReadinessChecklist as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const eventRow = (status: EventStatus = "PLANNING", coordinatorId = "usr_coord") => ({
  organiserId: "usr_org",
  coordinatorId,
  status,
  name: "Concert",
});

const checklist = (
  venue: { complete: boolean; state: string },
  safetyState = "Not requested",
): ReadinessChecklist => ({
  ready: false,
  items: [
    { name: "Venue booking", reason: null, ...venue },
    { name: "Safety check", complete: false, state: safetyState, reason: null },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
  mockEvent.mockResolvedValue(eventRow());
  tx.event.findUniqueOrThrow.mockResolvedValue({ status: "PLANNING", coordinatorId: "usr_coord" });
  tx.safetyCheck.findFirst.mockResolvedValue(null);
  tx.safetyCheck.create.mockResolvedValue({ id: "chk_1" });
  tx.user.findMany.mockResolvedValue([{ id: "usr_safetyofficer" }, { id: "usr_safety_2" }]);
  tx.notification.createMany.mockResolvedValue({ count: 2 });
  mockChecklist.mockResolvedValue(checklist({ complete: true, state: "Approved" }));
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

function expectNothingWritten() {
  expect(tx.safetyCheck.create).not.toHaveBeenCalled();
  expect(tx.notification.createMany).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
}

describe("requestSafetyCheck — SCRUM-166", () => {
  it("SCRUM-166 [AC1] TC-166-01: once the venue and equipment are complete, a check joins the queue awaiting review and every Safety Officer is notified", async () => {
    const result = await requestSafetyCheck({ eventId: "evt_1" });

    expect(result).toEqual({ ok: true, data: { checkId: "chk_1", existing: false } });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.safetyCheck.create).toHaveBeenCalledWith({
      data: { eventId: "evt_1", requestedById: "usr_coord" },
      select: { id: true },
    });
    // AC6: never an officer who organises or coordinates this event.
    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ role: "SAFETY_OFFICER" }, { additionalRoles: { has: "SAFETY_OFFICER" } }],
        id: { notIn: ["usr_org", "usr_coord"] },
      },
      select: { id: true },
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: ["usr_safetyofficer", "usr_safety_2"].map((userId) => ({
        userId,
        type: "SAFETY_CHECK_REQUESTED",
        title: "Safety check requested",
        message: '"Concert" is waiting for an operational safety check.',
        link: "/safety-checks/chk_1",
        eventId: "evt_1",
      })),
    });
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      entityType: "SafetyCheck",
      entityId: "chk_1",
      action: "REQUESTED",
      actorId: "usr_coord",
      newValue: "AWAITING_REVIEW",
    });
  });

  it("SCRUM-166 [AC7] TC-166-02: requesting while a check awaits review returns that check and creates nothing", async () => {
    tx.safetyCheck.findFirst.mockResolvedValue({ id: "chk_open" });

    expect(await requestSafetyCheck({ eventId: "evt_1" })).toEqual({
      ok: true,
      data: { checkId: "chk_open", existing: true },
    });
    expectNothingWritten();
  });

  it("SCRUM-166 [AC1] TC-166-02: before the venue and equipment are complete, the request is refused with what's outstanding", async () => {
    mockChecklist.mockResolvedValue(checklist({ complete: false, state: "Pending" }));

    expect(await requestSafetyCheck({ eventId: "evt_1" })).toEqual({
      ok: false,
      error:
        "Arrange the venue and equipment before requesting a safety check. Outstanding: Venue booking (Pending).",
    });
    expectNothingWritten();
  });

  it("SCRUM-166 [AC12] TC-166-01: after Changes requested, Rejected or Outdated, a new check can be requested once the arrangements are complete", async () => {
    for (const state of ["Changes requested", "Rejected", "Outdated"]) {
      mockChecklist.mockResolvedValue(checklist({ complete: true, state: "Approved" }, state));
      expect(await requestSafetyCheck({ eventId: "evt_1" })).toMatchObject({ ok: true });
    }
    expect(tx.safetyCheck.create).toHaveBeenCalledTimes(3);
  });

  it("SCRUM-166 [AC1] TC-166-02: an event whose check is already approved needs no new one", async () => {
    mockChecklist.mockResolvedValue(checklist({ complete: true, state: "Approved" }, "Approved"));

    expect(await requestSafetyCheck({ eventId: "evt_1" })).toEqual({
      ok: false,
      error: "This event's safety check is already approved.",
    });
    expectNothingWritten();
  });

  it("SCRUM-166 [AC1, AC15] TC-166-02: only an event in Planning can have a check", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue({ status: "CONFIRMED", coordinatorId: "usr_coord" });

    expect(await requestSafetyCheck({ eventId: "evt_1" })).toEqual({
      ok: false,
      error: "Only an event in Planning can have a safety check.",
    });
    expectNothingWritten();
  });

  it("SCRUM-166 [AC1] TC-166-03: an event reassigned before the lock is refused with nothing written", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue({ status: "PLANNING", coordinatorId: "usr_other" });

    expect(await requestSafetyCheck({ eventId: "evt_1" })).toEqual({
      ok: false,
      error: "This event was updated by another user. Refresh and try again.",
    });
    expectNothingWritten();
  });

  it("SCRUM-166 [AC1] TC-166-03: anyone but the event's assigned Coordinator is refused before anything is written", async () => {
    for (const role of ["ORGANISER", "VENUE_STAFF", "SAFETY_OFFICER", "ATTENDEE"] as Role[]) {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_x"));
      expect(await requestSafetyCheck({ eventId: "evt_1" })).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
    }
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockEvent.mockResolvedValue(eventRow("PLANNING", "usr_other"));
    expect(await requestSafetyCheck({ eventId: "evt_1" })).toEqual({
      ok: false,
      error: "Event not found.",
    });
    mockEvent.mockResolvedValue(null);
    expect(await requestSafetyCheck({ eventId: "evt_missing" })).toMatchObject({ ok: false });
    expect(await requestSafetyCheck({})).toEqual({
      ok: false,
      error: "Please provide a valid event.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("does not swallow an unexpected database error", async () => {
    mockTransaction.mockRejectedValue(new Error("connection lost"));
    await expect(requestSafetyCheck({ eventId: "evt_1" })).rejects.toThrow("connection lost");
  });
});
