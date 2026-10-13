import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { recordNoEquipmentNeeded } from "@/app/(app)/events/equipment-decision-actions";

// SCRUM-170 AC4 — the assigned Coordinator records No equipment needed.
// Test cases: docs/testing/SCRUM-170.md. Session and database are mocked; the
// transaction runs its callback against a mock `tx`. The lock and the race
// with creating a request run against real Postgres in
// tests/integration/equipment-decision.test.ts.

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUnique: vi.fn(), update: vi.fn() },
  equipmentRequest: { count: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

function eventRow(
  over: Partial<{
    status: EventStatus;
    coordinatorId: string | null;
    noEquipmentNeededAt: Date | null;
  }> = {},
) {
  return {
    organiserId: "usr_org",
    coordinatorId: "usr_coord" as string | null,
    status: "PLANNING" as EventStatus,
    noEquipmentNeededAt: null as Date | null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
  tx.event.findUnique.mockResolvedValue(eventRow());
  tx.equipmentRequest.count.mockResolvedValue(0);
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

function expectNothingWritten() {
  expect(tx.event.update).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
}

describe("recordNoEquipmentNeeded — SCRUM-170 AC4", () => {
  it("SCRUM-170 [AC4] TC-170-06: the assigned Coordinator records No equipment needed, keeping who and when, and it is audited", async () => {
    const result = await recordNoEquipmentNeeded({ eventId: "evt1" });

    expect(result).toEqual({
      ok: true,
      data: { recordedAt: expect.any(Date) },
    });
    const recordedAt = result.ok ? result.data.recordedAt : null;
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: {
        noEquipmentNeededAt: recordedAt,
        noEquipmentNeededById: "usr_coord",
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "Event",
        entityId: "evt1",
        action: "UPDATED",
        actorId: "usr_coord",
        fieldName: "noEquipmentNeededAt",
        oldValue: null,
        newValue: recordedAt!.toISOString(),
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/events");
  });

  it("SCRUM-170 [AC4] TC-170-11: the event row is locked before it is read, so a request created at the same moment takes turns with it", async () => {
    await recordNoEquipmentNeeded({ eventId: "evt1" });

    const order = (mock: Mock) => mock.mock.invocationCallOrder[0];
    expect(order(tx.$queryRaw)).toBeLessThan(order(tx.event.findUnique));
    expect(order(tx.equipmentRequest.count)).toBeLessThan(
      order(tx.event.update),
    );
  });

  it("SCRUM-170 [AC4] TC-170-06: recording it again keeps the first decision and writes nothing", async () => {
    const first = new Date("2031-05-20T02:00:00Z");
    tx.event.findUnique.mockResolvedValue(
      eventRow({ noEquipmentNeededAt: first }),
    );

    expect(await recordNoEquipmentNeeded({ eventId: "evt1" })).toEqual({
      ok: true,
      data: { recordedAt: first },
    });
    expectNothingWritten();
  });

  it("SCRUM-170 [AC4] TC-170-10: an event with a live equipment request is refused, and nothing is written", async () => {
    tx.equipmentRequest.count.mockResolvedValue(1);

    expect(await recordNoEquipmentNeeded({ eventId: "evt1" })).toEqual({
      ok: false,
      error:
        "This event has an equipment request. Withdraw it before recording that no equipment is needed.",
    });
    expect(tx.equipmentRequest.count).toHaveBeenCalledWith({
      where: {
        eventId: "evt1",
        status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] },
      },
    });
    expectNothingWritten();
  });

  it.each(["SUBMITTED", "UNDER_REVIEW", "CONFIRMED", "CANCELLED"] as const)(
    "SCRUM-170 [AC4] TC-170-10: a %s event is refused, and nothing is written",
    async (status) => {
      tx.event.findUnique.mockResolvedValue(eventRow({ status }));

      expect(await recordNoEquipmentNeeded({ eventId: "evt1" })).toEqual({
        ok: false,
        error: "Equipment can only be decided while the event is in Planning.",
      });
      expectNothingWritten();
    },
  );

  it.each([
    ["another Coordinator's event", { coordinatorId: "usr_other" }],
    ["an event nobody is assigned to", { coordinatorId: null }],
  ])(
    "SCRUM-170 [AC4] TC-170-10: %s reads as not found, and nothing is written",
    async (_, over) => {
      tx.event.findUnique.mockResolvedValue(eventRow(over));

      expect(await recordNoEquipmentNeeded({ eventId: "evt1" })).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-170 [AC4] TC-170-10: a missing event reads the same as one the Coordinator isn't assigned to", async () => {
    tx.event.findUnique.mockResolvedValue(null);

    expect(await recordNoEquipmentNeeded({ eventId: "evt_missing" })).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expectNothingWritten();
  });

  it.each(["ORGANISER", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE"] as const)(
    "SCRUM-170 [AC4] TC-170-10: a %s can't record it, and nothing is read or written",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_x"));

      expect(await recordNoEquipmentNeeded({ eventId: "evt1" })).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-170 [AC4] TC-170-10: a request without an event is refused before anything is read", async () => {
    expect(await recordNoEquipmentNeeded({})).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
