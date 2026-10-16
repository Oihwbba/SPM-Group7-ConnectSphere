import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getQueueRequest,
  getUnassignedQueue,
  isOverdue,
} from "@/app/(app)/queue/queries";
import { assignCoordinator } from "@/app/(app)/queue/actions";

// SCRUM-165 — the Lead's Unassigned queue and assignment. `can()` runs for
// real so each role's actual permissions are under test; the database is
// mocked, and the assignment transaction runs against a mock `tx`.
const tx = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), updateMany: vi.fn() },
  user: { findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
  notification: { createMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    event: { findMany: vi.fn(), findUnique: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;
const mockFindMany = prisma.event.findMany as unknown as Mock;
const mockFindUnique = prisma.event.findUnique as unknown as Mock;
const mockUserFindMany = prisma.user.findMany as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const lead = () => sessionFor("COORDINATOR_LEAD", "usr_lead");
const past = new Date("2000-01-01T00:00:00Z");
const future = new Date("2999-01-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
  tx.event.findUnique.mockResolvedValue({
    id: "evt1",
    name: "Career Fair",
    organiserId: "usr_org",
    status: "SUBMITTED",
  });
  tx.user.findFirst.mockResolvedValue({ id: "usr_cody", name: "Cody" });
  tx.event.updateMany.mockResolvedValue({ count: 1 });
  tx.auditLog.create.mockResolvedValue({});
  tx.notification.createMany.mockResolvedValue({ count: 2 });
});

describe("isOverdue — SCRUM-165 AC2", () => {
  const now = new Date("2031-06-01T00:00:00Z");

  it("SCRUM-165 [AC2] TC-165-02: [Positive] a request whose start has passed is overdue", () => {
    expect(isOverdue(new Date("2031-05-31T00:00:00Z"), now)).toBe(true);
  });

  it("SCRUM-165 [AC2] TC-165-03: [Boundary] a request starting exactly now has started, so it is overdue", () => {
    expect(isOverdue(now, now)).toBe(true);
  });

  it("SCRUM-165 [AC2] TC-165-03: [Boundary] a request starting later isn't overdue, nor one with no start", () => {
    expect(isOverdue(new Date("2031-06-02T00:00:00Z"), now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
  });
});

describe("getUnassignedQueue — SCRUM-165 AC2, AC10", () => {
  it("SCRUM-165 [AC2] TC-165-02: [Positive] lists Submitted requests with no Coordinator, oldest submission first, with the fields the Lead needs", async () => {
    mockAuth.mockResolvedValue(lead());
    mockFindMany.mockResolvedValue([
      { id: "e1", startAt: past, organiser: { name: "Olivia" } },
      { id: "e2", startAt: future, organiser: { name: "Owen" } },
    ]);

    const queue = await getUnassignedQueue();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where).toEqual({ status: "SUBMITTED", coordinatorId: null });
    expect(query.orderBy).toEqual({ submittedAt: "asc" });
    expect(Object.keys(query.select).sort()).toEqual([
      "endAt",
      "expectedAttendance",
      "id",
      "name",
      "organiser",
      "startAt",
      "submittedAt",
    ]);
    expect(queue.map((entry) => [entry.id, entry.overdue])).toEqual([
      ["e1", true],
      ["e2", false],
    ]);
  });

  it.each([
    "ORGANISER",
    "COORDINATOR",
    "VENUE_STAFF",
    "TECH_SUPPORT",
    "ATTENDEE",
    "SAFETY_OFFICER",
  ] as const)(
    "SCRUM-165 [AC10] TC-165-13: [Negative] a %s sees no queue, before any query runs",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_other"));

      expect(await getUnassignedQueue()).toEqual([]);
      expect(mockFindMany).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-165 [AC10] TC-165-13: [Negative] a signed-out caller sees no queue", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await getUnassignedQueue()).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("getQueueRequest — SCRUM-165 AC3, AC4", () => {
  const waiting = {
    id: "evt1",
    name: "Career Fair",
    status: "SUBMITTED",
    coordinatorId: null,
    organiserId: "usr_org",
    startAt: future,
    organiser: { name: "Olivia" },
  };

  beforeEach(() => {
    mockFindUnique.mockResolvedValue(waiting);
    mockUserFindMany.mockResolvedValue([
      { id: "usr_cody", name: "Cody", _count: { coordinatedEvents: 2 } },
      { id: "usr_cara", name: "Cara", _count: { coordinatedEvents: 1 } },
    ]);
  });

  it("SCRUM-165 [AC3, AC4] TC-165-04, TC-165-05: [Positive] a Lead sees the request's basic information with each Coordinator's active events and the least-loaded suggested", async () => {
    mockAuth.mockResolvedValue(lead());

    const found = await getQueueRequest("evt1");

    expect(found?.request).toEqual({ ...waiting, overdue: false });
    expect(found?.coordinators).toEqual([
      { id: "usr_cody", name: "Cody", activeEvents: 2 },
      { id: "usr_cara", name: "Cara", activeEvents: 1 },
    ]);
    expect(found?.suggestedId).toBe("usr_cara");
  });

  it("SCRUM-165 [AC7] TC-165-09: [Negative] the event's own Organiser is never offered, even if they also coordinate", async () => {
    mockAuth.mockResolvedValue(lead());
    mockUserFindMany.mockResolvedValue([
      { id: "usr_org", name: "Olivia", _count: { coordinatedEvents: 0 } },
      { id: "usr_cody", name: "Cody", _count: { coordinatedEvents: 4 } },
    ]);

    const found = await getQueueRequest("evt1");

    expect(found?.coordinators.map((c) => c.id)).toEqual(["usr_cody"]);
    expect(found?.suggestedId).toBe("usr_cody");
  });

  it("SCRUM-165 [AC7] TC-165-10: [Negative] a request that already has a Coordinator isn't in the queue, so it isn't shown", async () => {
    mockAuth.mockResolvedValue(lead());
    mockFindUnique.mockResolvedValue({
      ...waiting,
      status: "UNDER_REVIEW",
      coordinatorId: "usr_cody",
    });

    expect(await getQueueRequest("evt1")).toBeNull();
  });

  it("SCRUM-165 [AC10] TC-165-13: [Negative] a missing request returns null, like any other refusal", async () => {
    mockAuth.mockResolvedValue(lead());
    mockFindUnique.mockResolvedValue(null);

    expect(await getQueueRequest("evt_missing")).toBeNull();
  });

  it("SCRUM-165 [AC10] TC-165-13: [Negative] a Coordinator can't open a queued request, before any query runs", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cody"));

    expect(await getQueueRequest("evt1")).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-165 [AC10] TC-165-13: [Negative] a signed-out caller is refused", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await getQueueRequest("evt1")).toBeNull();
  });
});

describe("assignCoordinator — SCRUM-165", () => {
  const assign = () =>
    assignCoordinator({ eventId: "evt1", coordinatorId: "usr_cody" });

  it("SCRUM-165 [AC5, AC11] TC-165-07, TC-165-14: [Positive] the event gets the Coordinator, moves to Under Review and records the supervising Lead in one write", async () => {
    mockAuth.mockResolvedValue(lead());

    expect(await assign()).toEqual({
      ok: true,
      data: { coordinatorName: "Cody" },
    });
    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: { id: "evt1", status: "SUBMITTED", coordinatorId: null },
      data: {
        coordinatorId: "usr_cody",
        status: "UNDER_REVIEW",
        supervisingLeadId: "usr_lead",
      },
    });
  });

  it("SCRUM-165 [AC5] TC-165-07: [Positive] the Coordinator and the Organiser are notified", async () => {
    mockAuth.mockResolvedValue(lead());

    await assign();

    expect(
      tx.notification.createMany.mock.calls[0][0].data.map(
        (n: { userId: string; type: string }) => [n.userId, n.type],
      ),
    ).toEqual([
      ["usr_org", "COORDINATOR_ASSIGNED"],
      ["usr_cody", "COORDINATOR_ASSIGNED"],
    ]);
  });

  it("SCRUM-165 [AC5] TC-165-07: [Positive] the assignment is recorded with the Lead who made it", async () => {
    mockAuth.mockResolvedValue(lead());

    await assign();

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ASSIGNED",
        actorId: "usr_lead",
        oldValue: null,
        newValue: "usr_cody",
      }),
    });
  });

  it("SCRUM-165 [AC4] TC-165-06: [Positive] only someone who holds the Coordinator role now can be assigned", async () => {
    mockAuth.mockResolvedValue(lead());

    await assign();

    expect(tx.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "usr_cody", role: "COORDINATOR" },
      }),
    );
  });

  it("SCRUM-165 [AC4] TC-165-06: [Negative] choosing someone who isn't a Coordinator is refused and nothing is written", async () => {
    mockAuth.mockResolvedValue(lead());
    tx.user.findFirst.mockResolvedValue(null);

    const result = await assign();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Coordinator/);
    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-165 [AC7] TC-165-09: [Negative] the event's own Organiser can't be its Coordinator", async () => {
    mockAuth.mockResolvedValue(lead());
    tx.user.findFirst.mockResolvedValue({ id: "usr_org", name: "Olivia" });

    const result = await assignCoordinator({
      eventId: "evt1",
      coordinatorId: "usr_org",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Organiser/);
    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-165 [AC6, AC7] TC-165-08, TC-165-10: [Negative] a request someone else assigned first is refused, naming who it went to, and nothing else is written", async () => {
    mockAuth.mockResolvedValue(lead());
    tx.event.updateMany.mockResolvedValue({ count: 0 });
    tx.event.findUnique
      .mockResolvedValueOnce({
        id: "evt1",
        name: "Career Fair",
        organiserId: "usr_org",
        status: "SUBMITTED",
      })
      .mockResolvedValueOnce({ coordinator: { name: "Cara" } });

    const result = await assign();

    expect(result).toEqual({
      ok: false,
      error: "This request is already assigned to Cara.",
      fieldErrors: undefined,
    });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-165 [AC7] TC-165-10: [Negative] a request that left the queue without a Coordinator is refused", async () => {
    mockAuth.mockResolvedValue(lead());
    tx.event.updateMany.mockResolvedValue({ count: 0 });
    tx.event.findUnique
      .mockResolvedValueOnce({
        id: "evt1",
        name: "Career Fair",
        organiserId: "usr_org",
        status: "SUBMITTED",
      })
      .mockResolvedValueOnce({ coordinator: null });

    const result = await assign();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no longer waiting/);
  });

  it.each([
    null,
    { id: "evt1", name: "Draft", organiserId: "usr_org", status: "DRAFT" },
  ])(
    "SCRUM-165 [AC10] TC-165-13: [Negative] a missing request or a draft looks not found (%#)",
    async (row) => {
      mockAuth.mockResolvedValue(lead());
      tx.event.findUnique.mockResolvedValue(row);

      expect(await assign()).toEqual({
        ok: false,
        error: "Request not found.",
        fieldErrors: undefined,
      });
      expect(tx.event.updateMany).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-165 [AC4] TC-165-06: [Negative] a missing Coordinator choice is refused before anything is read", async () => {
    mockAuth.mockResolvedValue(lead());

    const result = await assignCoordinator({
      eventId: "evt1",
      coordinatorId: "",
    });

    expect(result.ok).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each([
    "COORDINATOR",
    "ORGANISER",
    "VENUE_STAFF",
    "SAFETY_OFFICER",
  ] as const)(
    "SCRUM-165 [AC10] TC-165-13: [Negative] a %s can't assign, before anything is read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_other"));

      const result = await assign();

      expect(result.ok).toBe(false);
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it("[Exit path] rethrows an unexpected error instead of swallowing it", async () => {
    mockAuth.mockResolvedValue(lead());
    mockTransaction.mockRejectedValue(new Error("db down"));

    await expect(assign()).rejects.toThrow("db down");
  });
});
