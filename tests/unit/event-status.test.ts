import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  submitEventRequest,
  transitionEventStatus,
} from "@/app/(app)/events/actions";

// SCRUM-24 (one guarded status gate), SCRUM-19 (approve / reject / resubmit) and
// SCRUM-68 (not-found parity). Session and database are mocked; the transaction
// runs its callback against a mock `tx` so the conditional update is observable.
//
// SCRUM-20: submitEventRequest also runs inside a transaction now, needing
// event.findFirst/update/create, user.findMany and notification.createMany.
// tx.event IS prisma.event below (the same object), so calls made directly
// (transitionEventStatus's prisma.event.findUnique) and calls made through
// the transaction (submitEventRequest's tx.event.findFirst) share one set of
// mocks — existing assertions on mockFindFirst/mockUpdate keep working
// unchanged. tx.user.findMany defaults to [] (no coordinators), so
// auto-assignment is a no-op in these tests; it's covered separately in
// tests/unit/coordinator-assignment.test.ts and
// tests/unit/event-auto-assignment.test.ts.
const tx = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  user: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: tx.event,
    $transaction: vi.fn(),
  },
}));

const mockAuth = auth as unknown as Mock;
const mockFindUnique = prisma.event.findUnique as unknown as Mock;
const mockFindFirst = prisma.event.findFirst as unknown as Mock;
const mockUpdate = prisma.event.update as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

function eventRow(
  over: Partial<{ status: EventStatus; coordinatorId: string | null }> = {},
) {
  return {
    id: "evt1",
    status: "SUBMITTED" as EventStatus,
    organiserId: "usr_org",
    coordinatorId: null as string | null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.event.updateMany.mockResolvedValue({ count: 1 });
  tx.auditLog.create.mockResolvedValue({});
  tx.user.findMany.mockResolvedValue([]);
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

describe("transitionEventStatus — SCRUM-24 single guarded gate", () => {
  it("SCRUM-19: a coordinator approves an unassigned submitted request", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockFindUnique.mockResolvedValue(eventRow());

    const result = await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "APPROVED",
    });

    expect(result).toEqual({ ok: true, data: { status: "APPROVED" } });
    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: { id: "evt1", status: "SUBMITTED", coordinatorId: null },
      data: expect.objectContaining({
        status: "APPROVED",
        decidedById: "usr_coord",
        decisionReason: null,
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: "evt1",
        oldValue: "SUBMITTED",
        newValue: "APPROVED",
      }),
    });
  });

  it("SCRUM-19: the assigned coordinator approves an under-review request", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockFindUnique.mockResolvedValue(
      eventRow({ status: "UNDER_REVIEW", coordinatorId: "usr_coord" }),
    );

    const result = await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "APPROVED",
    });

    expect(result.ok).toBe(true);
    expect(tx.event.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt1", status: "UNDER_REVIEW", coordinatorId: "usr_coord" },
      }),
    );
  });

  it("SCRUM-19: a rejection records its reason", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockFindUnique.mockResolvedValue(eventRow());

    const result = await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "REJECTED",
      decisionReason: "Expected attendance exceeds every venue.",
    });

    expect(result).toEqual({ ok: true, data: { status: "REJECTED" } });
    expect(tx.event.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          decisionReason: "Expected attendance exceeds every venue.",
        }),
      }),
    );
  });

  it("SCRUM-19: a rejection with a blank reason is refused and nothing is written", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));

    const result = await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "REJECTED",
      decisionReason: "   ",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/reason is required/i);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    "DRAFT",
    "APPROVED",
    "REJECTED",
    "PLANNING",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
  ] as EventStatus[])("refuses to decide an event that is %s", async (status) => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    // Assigned to this coordinator, so only the status rule can refuse it.
    mockFindUnique.mockResolvedValue(
      eventRow({ status, coordinatorId: "usr_coord" }),
    );

    const result = await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "APPROVED",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not allowed/i);
    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-24: the loser of two simultaneous decisions is told to refresh, and no audit entry is written", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockFindUnique.mockResolvedValue(eventRow());
    // Another coordinator's decision landed first, so the conditional update matches nothing.
    tx.event.updateMany.mockResolvedValue({ count: 0 });

    const result = await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "APPROVED",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/updated by another user/i);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it.each(["ORGANISER", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE"] as Role[])(
    "refuses %s before the event is even looked up",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, `usr_${role.toLowerCase()}`));

      const result = await transitionEventStatus({
        eventId: "evt1",
        nextStatus: "APPROVED",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/permission/i);
      expect(mockFindUnique).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-68: another coordinator's event is indistinguishable from a missing one", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));

    mockFindUnique.mockResolvedValueOnce(
      eventRow({ status: "UNDER_REVIEW", coordinatorId: "usr_other_coord" }),
    );
    const notMine = await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "APPROVED",
    });

    mockFindUnique.mockResolvedValueOnce(null);
    const missing = await transitionEventStatus({
      eventId: "evt_missing",
      nextStatus: "APPROVED",
    });

    expect(notMine).toEqual(missing);
    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-20: a coordinator cannot claim a request into review — that transition is automatic", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));

    const result = await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "UNDER_REVIEW",
    });

    expect(result.ok).toBe(false);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });
});

describe("submitEventRequest — SCRUM-19/24 rejected → submitted", () => {
  const futureStart = new Date(Date.now() + 86400000).toISOString();
  const futureEnd = new Date(Date.now() + 86400000 + 7200000).toISOString();

  it("an organiser resubmits an amended rejected request and the old decision is cleared", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org"));
    mockFindFirst.mockResolvedValue({ id: "evt1", status: "REJECTED" });
    mockUpdate.mockResolvedValue({ id: "evt1" });

    const result = await submitEventRequest({
      id: "evt1",
      name: "Amended Summit",
      purpose: "Networking",
      description: "Reduced to fit the hall",
      startAt: futureStart,
      endAt: futureEnd,
      expectedAttendance: 120,
      venueRequirements: "Hall",
      preferredLayout: "Theatre",
      accessibilityNeeds: "Ramp",
      equipmentRequirements: "Projector",
      registrationNotes: "Online",
    });

    expect(result.ok).toBe(true);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        id: "evt1",
        organiserId: "usr_org",
        status: { in: ["DRAFT", "REJECTED"] },
      },
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUBMITTED",
          decidedAt: null,
          decidedById: null,
          decisionReason: null,
        }),
      }),
    );
  });
});
