import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  startRequestFromRejected,
  submitEventRequest,
  transitionEventStatus,
} from "@/app/(app)/events/actions";
import { REJECTION_OUTCOME_LABEL } from "@/lib/schemas/event";

// SCRUM-126 — the Coordinator who rejects a request chooses whether the
// Organiser amends it or starts a new one. Test cases:
// docs/testing/SCRUM-126.md. Session and database are mocked; the transaction
// runs its callback against a mock `tx`, as in event-status.test.ts.

const tx = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  clarificationRequest: { updateMany: vi.fn() },
  eventChangeRequest: { updateMany: vi.fn() },
  user: { findMany: vi.fn(), findFirst: vi.fn() },
  notification: { createMany: vi.fn() },
  auditLog: { create: vi.fn(), createMany: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: tx.event, $transaction: vi.fn() },
}));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const coordinator = () => sessionFor("COORDINATOR", "usr_coord");
const organiser = () => sessionFor("ORGANISER", "usr_org");

function reviewRow(status: EventStatus = "UNDER_REVIEW") {
  return {
    id: "evt1",
    status,
    organiserId: "usr_org",
    coordinatorId: "usr_coord",
  };
}

const REASON = "Expected attendance exceeds every venue.";

beforeEach(() => {
  vi.clearAllMocks();
  tx.event.updateMany.mockResolvedValue({ count: 1 });
  tx.auditLog.create.mockResolvedValue({});
  tx.auditLog.findFirst.mockResolvedValue(null);
  tx.clarificationRequest.updateMany.mockResolvedValue({ count: 0 });
  tx.user.findMany.mockResolvedValue([]);
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

describe("transitionEventStatus — SCRUM-126 rejection outcome", () => {
  it.each(["AMEND_AND_RESUBMIT", "NEW_REQUEST"] as const)(
    "SCRUM-126 [AC1] TC-126-01: rejecting with the outcome %s saves it with the reason",
    async (rejectionOutcome) => {
      mockAuth.mockResolvedValue(coordinator());
      tx.event.findUnique.mockResolvedValue(reviewRow());

      const result = await transitionEventStatus({
        eventId: "evt1",
        nextStatus: "REJECTED",
        decisionReason: REASON,
        rejectionOutcome,
      });

      expect(result).toEqual({ ok: true, data: { status: "REJECTED" } });
      expect(tx.event.updateMany).toHaveBeenCalledWith({
        where: {
          id: "evt1",
          status: "UNDER_REVIEW",
          coordinatorId: "usr_coord",
        },
        data: expect.objectContaining({
          status: "REJECTED",
          decisionReason: REASON,
          rejectionOutcome,
        }),
      });
    },
  );

  it("SCRUM-126 [AC1] TC-126-02: a rejection without an outcome is refused before anything is read or written", async () => {
    mockAuth.mockResolvedValue(coordinator());

    const result = await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "REJECTED",
      decisionReason: REASON,
    });

    expect(result).toEqual({
      ok: false,
      error: "Choose what the organiser can do next.",
      fieldErrors: {
        rejectionOutcome: ["Choose what the organiser can do next."],
      },
    });
    expect(tx.event.findUnique).not.toHaveBeenCalled();
    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-126 [AC1] TC-126-02: an outcome that is not one of the two choices is refused", async () => {
    mockAuth.mockResolvedValue(coordinator());

    const result = await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "REJECTED",
      decisionReason: REASON,
      rejectionOutcome: "CANCEL",
    });

    expect(result.ok).toBe(false);
    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-126 [AC6] TC-126-07: the outcome is recorded in the event history with who chose it", async () => {
    mockAuth.mockResolvedValue(coordinator());
    tx.event.findUnique.mockResolvedValue(reviewRow());

    await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "REJECTED",
      decisionReason: REASON,
      rejectionOutcome: "NEW_REQUEST",
    });

    // The entry's createdAt is the "when", as for every history entry.
    expect(tx.auditLog.create.mock.calls.map((c) => c[0].data)).toEqual([
      expect.objectContaining({
        action: "STATUS_CHANGED",
        actorId: "usr_coord",
        oldValue: "UNDER_REVIEW",
        newValue: "REJECTED",
      }),
      {
        entityType: "Event",
        entityId: "evt1",
        action: "UPDATED",
        actorId: "usr_coord",
        fieldName: "rejectionOutcome",
        oldValue: null,
        newValue: "NEW_REQUEST",
        summary: "Outcome chosen on rejection (SCRUM-126)",
      },
    ]);
  });

  it("SCRUM-126 [AC1]: an approval ignores any outcome sent with it and stores none", async () => {
    mockAuth.mockResolvedValue(coordinator());
    tx.event.findUnique.mockResolvedValue(reviewRow());

    await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "APPROVED",
      rejectionOutcome: "NEW_REQUEST",
    });

    expect(tx.event.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PLANNING",
          rejectionOutcome: null,
        }),
      }),
    );
    expect(
      tx.auditLog.create.mock.calls.some(
        (c) => c[0].data.fieldName === "rejectionOutcome",
      ),
    ).toBe(false);
  });
});

describe("submitEventRequest — SCRUM-126 only an amendable rejection is resubmitted", () => {
  const start = new Date(Date.now() + 86400000).toISOString();
  const end = new Date(Date.now() + 86400000 + 7200000).toISOString();
  const amended = {
    id: "evt1",
    name: "Amended Summit",
    purpose: "Networking",
    description: "Reduced to fit the hall",
    startAt: start,
    endAt: end,
    expectedAttendance: 120,
    venueRequirements: "Hall",
    preferredLayout: "Theatre",
    accessibilityNeeds: "Ramp",
    equipmentRequirements: "Projector",
    registrationNotes: "Online",
  };

  it("SCRUM-126 [AC2] TC-126-03: a request rejected for amendment can be resubmitted, and its outcome is cleared with the reason", async () => {
    mockAuth.mockResolvedValue(organiser());
    tx.event.findFirst.mockResolvedValue({
      id: "evt1",
      status: "REJECTED",
      coordinatorId: "usr_coord",
    });
    tx.event.update.mockResolvedValue({ id: "evt1" });

    const result = await submitEventRequest(amended);

    expect(result).toEqual({ ok: true, data: { id: "evt1" } });
    expect(tx.event.findFirst).toHaveBeenCalledWith({
      where: {
        id: "evt1",
        organiserId: "usr_org",
        OR: [
          { status: "DRAFT", discardedAt: null },
          { status: "REJECTED", rejectionOutcome: "AMEND_AND_RESUBMIT" },
        ],
      },
    });
    expect(tx.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUBMITTED",
          decisionReason: null,
          rejectionOutcome: null,
        }),
      }),
    );
  });

  it("SCRUM-126 [AC3] TC-126-04: a request rejected as needing a new request stays Rejected: resubmitting it is refused and nothing is written", async () => {
    mockAuth.mockResolvedValue(organiser());
    // The lookup only matches drafts and amendable rejections.
    tx.event.findFirst.mockResolvedValue(null);

    const result = await submitEventRequest(amended);

    expect(result).toEqual({
      ok: false,
      error: "Draft or rejected event not found or cannot be submitted.",
    });
    expect(tx.event.update).not.toHaveBeenCalled();
  });
});

describe("startRequestFromRejected — SCRUM-126 AC4", () => {
  const rejected = {
    name: "Overcapacity Concert",
    purpose: "Fundraising",
    description: "An evening concert.",
    startAt: new Date("2031-06-01T10:00:00Z"),
    endAt: new Date("2031-06-01T14:00:00Z"),
    expectedAttendance: 2000,
    venueRequirements: "Largest hall",
    requiredFacilities: ["stage", "projector"],
    accessibilityNeeds: "Step-free access",
    preferredLayout: "theatre",
    equipmentRequirements: "PA system",
    registrationNotes: "Ticketed",
    programme: "Two sets",
    specialRequests: null,
    equipmentTypes: ["PA Speaker"],
    registrationRequired: true,
  };

  it("SCRUM-126 [AC4] TC-126-05: creates a new Draft with the rejected event's details and nothing else", async () => {
    mockAuth.mockResolvedValue(organiser());
    tx.event.findFirst.mockResolvedValue(rejected);
    tx.event.create.mockResolvedValue({ id: "evt_new" });

    const result = await startRequestFromRejected({ eventId: "evt1" });

    expect(result).toEqual({
      ok: true,
      data: { id: "evt_new", created: true },
    });
    expect(tx.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "evt1",
          organiserId: "usr_org",
          status: "REJECTED",
          rejectionOutcome: "NEW_REQUEST",
        },
      }),
    );
    // Only the request's own details: no coordinator, decision, submission,
    // bookings, equipment requests, reservations or history come across.
    expect(tx.event.create).toHaveBeenCalledWith({
      data: {
        ...rejected,
        status: "DRAFT",
        timezone: "Asia/Singapore",
        organiserId: "usr_org",
      },
      select: { id: true },
    });
    // The rejected event's history records which Draft was started from it.
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "Event",
        entityId: "evt1",
        action: "NEW_REQUEST_STARTED",
        actorId: "usr_org",
        newValue: "evt_new",
        summary: "New request started from this rejection (SCRUM-126)",
      },
    });
  });

  it("SCRUM-126 [AC4] TC-126-10: starting again returns the Draft already started and creates no second copy", async () => {
    mockAuth.mockResolvedValue(organiser());
    tx.event.findFirst
      .mockResolvedValueOnce(rejected)
      .mockResolvedValueOnce({ id: "evt_first" });
    tx.auditLog.findFirst.mockResolvedValue({ newValue: "evt_first" });

    const result = await startRequestFromRejected({ eventId: "evt1" });

    expect(result).toEqual({
      ok: true,
      data: { id: "evt_first", created: false },
    });
    // The latest Draft started from it, and only while it isn't discarded
    // (SCRUM-130).
    expect(tx.auditLog.findFirst).toHaveBeenCalledWith({
      where: {
        entityType: "Event",
        entityId: "evt1",
        action: "NEW_REQUEST_STARTED",
      },
      orderBy: { createdAt: "desc" },
      select: { newValue: true },
    });
    expect(tx.event.findFirst).toHaveBeenLastCalledWith({
      where: { id: "evt_first", discardedAt: null },
      select: { id: true },
    });
    expect(tx.event.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("SCRUM-126 [AC4] TC-126-10: the rejected event is locked before it is read, so two clicks at once take turns", async () => {
    mockAuth.mockResolvedValue(organiser());
    tx.event.findFirst.mockResolvedValue(rejected);
    tx.event.create.mockResolvedValue({ id: "evt_new" });

    await startRequestFromRejected({ eventId: "evt1" });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.event.findFirst.mock.invocationCallOrder[0],
    );
  });

  it.each([
    "the outcome was Amend and resubmit",
    "the event is not Rejected",
    "it belongs to another organiser",
    "it does not exist",
  ])(
    "SCRUM-126 [AC4] TC-126-06: when %s, nothing is created and the event is reported not found",
    async () => {
      mockAuth.mockResolvedValue(organiser());
      // Each case is excluded by the lookup's where clause, asserted above.
      tx.event.findFirst.mockResolvedValue(null);

      expect(await startRequestFromRejected({ eventId: "evt1" })).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expect(tx.event.create).not.toHaveBeenCalled();
    },
  );

  it.each(["COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE"] as Role[])(
    "SCRUM-126 [AC4] TC-126-06: %s cannot start a request and nothing is read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, `usr_${role.toLowerCase()}`));

      const result = await startRequestFromRejected({ eventId: "evt1" });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/permission/i);
      expect(tx.event.findFirst).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-126 [AC4]: a request without an event id is refused before anything is read", async () => {
    mockAuth.mockResolvedValue(organiser());

    expect(await startRequestFromRejected({})).toEqual({
      ok: false,
      error: "Please choose a rejected request to start from.",
    });
    expect(tx.event.findFirst).not.toHaveBeenCalled();
  });

  it("SCRUM-126 [Exit path]: an unexpected database failure propagates instead of being reported as a refusal", async () => {
    mockAuth.mockResolvedValue(organiser());
    tx.event.findFirst.mockRejectedValue(new Error("connection lost"));

    await expect(startRequestFromRejected({ eventId: "evt1" })).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("REJECTION_OUTCOME_LABEL — SCRUM-126 AC1, AC5", () => {
  it("SCRUM-126 [AC1, AC5]: names both outcomes as the Coordinator chooses them and the Organiser reads them", () => {
    expect(REJECTION_OUTCOME_LABEL).toEqual({
      AMEND_AND_RESUBMIT: "Amend and resubmit",
      NEW_REQUEST: "Submit as a new request",
    });
  });
});
