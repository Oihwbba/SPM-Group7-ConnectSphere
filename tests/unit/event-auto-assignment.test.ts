import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { submitEventRequest } from "@/app/(app)/events/actions";
import { pickCoordinator } from "@/lib/coordinator-assignment";

// SCRUM-20 — auto-assignment happens INSIDE submitEventRequest's transaction
// (SCRUM-14). These tests mock pickCoordinator itself (already unit-tested
// separately in coordinator-assignment.test.ts) and assert submitEventRequest
// calls it, writes the assignment, notifies both parties, and audits it.
vi.mock("@/lib/coordinator-assignment", () => ({
  pickCoordinator: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  event: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  notification: { createMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { $transaction: vi.fn() },
}));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;
const mockPickCoordinator = pickCoordinator as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const futureStart = new Date(Date.now() + 86400000).toISOString();
const futureEnd = new Date(Date.now() + 86400000 + 7200000).toISOString();

const validInput = {
  name: "Career Fair",
  purpose: "Connect students with employers",
  description: "Annual careers fair",
  startAt: futureStart,
  endAt: futureEnd,
  expectedAttendance: 100,
  venueRequirements: "Large hall",
  accessibilityNeeds: "Wheelchair access",
  preferredLayout: "Booths",
  equipmentRequirements: "Tables and chairs",
  registrationNotes: "Open registration",
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.event.create.mockResolvedValue({ id: "evt_new" });
  tx.notification.createMany.mockResolvedValue({ count: 2 });
  tx.auditLog.create.mockResolvedValue({});
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
  mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
});

describe("submitEventRequest — SCRUM-20 auto-assignment", () => {
  it("AC: a coordinator is available — event is assigned, moved to UNDER_REVIEW, both parties notified", async () => {
    mockPickCoordinator.mockResolvedValue("usr_coordinator");

    const result = await submitEventRequest(validInput);

    expect(result.ok).toBe(true);
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt_new" },
      data: { coordinatorId: "usr_coordinator", status: "UNDER_REVIEW" },
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "usr_organiser",
          type: "COORDINATOR_ASSIGNED",
          eventId: "evt_new",
        }),
        expect.objectContaining({
          userId: "usr_coordinator",
          type: "COORDINATOR_ASSIGNED",
          eventId: "evt_new",
        }),
      ],
    });
  });

  it("AC: an event has at most one assigned coordinator — the update sets exactly one coordinatorId", async () => {
    mockPickCoordinator.mockResolvedValue("usr_coordinator");

    await submitEventRequest(validInput);

    const updateCall = tx.event.update.mock.calls[0][0];
    expect(updateCall.data.coordinatorId).toBe("usr_coordinator");
    expect(tx.event.update).toHaveBeenCalledTimes(1);
  });

  it("AC: no coordinator available — event still reaches SUBMITTED and does not fail silently (no throw)", async () => {
    mockPickCoordinator.mockResolvedValue(null);

    const result = await submitEventRequest(validInput);

    expect(result.ok).toBe(true);
    // status stays SUBMITTED (set on the initial create), never moved to
    // UNDER_REVIEW because there was nobody to assign it to.
    expect(tx.event.update).not.toHaveBeenCalled();
    // Only the Organiser's submission notice (SCRUM-45 AC1): nobody was
    // assigned, so there is no assignment notice.
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    expect(tx.notification.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        userId: "usr_organiser",
        title: "Request submitted",
      }),
    ]);
  });

  it("AC: the assignment is logged for auditability", async () => {
    mockPickCoordinator.mockResolvedValue("usr_coordinator");

    await submitEventRequest(validInput);

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "Event",
        entityId: "evt_new",
        action: "ASSIGNED",
        newValue: "usr_coordinator",
      }),
    });
  });

  it("AC: no accept/decline step — assignment and status change happen in the same write, nothing awaits a response", async () => {
    mockPickCoordinator.mockResolvedValue("usr_coordinator");

    const result = await submitEventRequest(validInput);

    // The action resolves fully; there is no separate "pending acceptance"
    // status or further step required for the coordinator.
    expect(result.ok).toBe(true);
    expect(tx.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "UNDER_REVIEW" }) }),
    );
  });
});
describe("submitEventRequest — SCRUM-45 AC1 submission notice", () => {
  it("SCRUM-45 [AC1, AC12] TC-45-01: the Organiser is told the request was submitted and is waiting to be assigned, then the assignment is a notice of its own", async () => {
    mockPickCoordinator.mockResolvedValue("usr_coordinator");

    await submitEventRequest(validInput);

    const written = tx.notification.createMany.mock.calls.map(
      (call) => call[0].data,
    );
    expect(written[0]).toEqual([
      {
        userId: "usr_organiser",
        type: "EVENT_STATUS_CHANGED",
        eventId: "evt_new",
        title: "Request submitted",
        message:
          '"Career Fair" was submitted and is waiting to be assigned to a Coordinator.',
      },
    ]);
    expect(
      written[1].map((n: { userId: string; type: string }) => [n.userId, n.type]),
    ).toEqual([
      ["usr_organiser", "COORDINATOR_ASSIGNED"],
      ["usr_coordinator", "COORDINATOR_ASSIGNED"],
    ]);
    expect(written).toHaveLength(2);
  });
});
