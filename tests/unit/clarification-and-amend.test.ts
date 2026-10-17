import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  submitEventRequest,
  transitionEventStatus,
} from "@/app/(app)/events/actions";
import {
  requestClarification,
  respondToClarification,
} from "@/app/(app)/events/clarification-actions";
import { clarificationChangesSchema } from "@/lib/schemas/clarification";

// SCRUM-108 — answer a clarification (only the fields it names), or amend
// and resubmit a rejected request to the same Coordinator. Test cases:
// docs/testing/SCRUM-108.md. Session and database are mocked; transactions
// run their callback against a mock `tx` whose tables are prisma's own.

const tx = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  clarificationRequest: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  user: { findMany: vi.fn(), findFirst: vi.fn() },
  eventChangeRequest: { updateMany: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
  auditLog: { create: vi.fn(), createMany: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: tx.event,
    clarificationRequest: tx.clarificationRequest,
    $transaction: vi.fn(),
  },
}));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}
const organiser = () => sessionFor("ORGANISER", "usr_org");
const coordinator = () => sessionFor("COORDINATOR", "usr_coord");

const FUTURE_START = new Date(Date.now() + 10 * 86400000);
const FUTURE_END = new Date(FUTURE_START.getTime() + 4 * 3600000);

beforeEach(() => {
  vi.clearAllMocks();
  tx.event.updateMany.mockResolvedValue({ count: 1 });
  tx.event.update.mockResolvedValue({});
  tx.clarificationRequest.updateMany.mockResolvedValue({ count: 1 });
  tx.user.findMany.mockResolvedValue([]);
  tx.user.findFirst.mockResolvedValue(null);
  tx.auditLog.create.mockResolvedValue({});
  tx.auditLog.createMany.mockResolvedValue({ count: 1 });
  tx.notification.create.mockResolvedValue({});
  tx.notification.createMany.mockResolvedValue({ count: 1 });
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

describe("requestClarification — SCRUM-108 AC1", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(coordinator());
    tx.event.findUnique.mockResolvedValue({
      id: "evt1",
      organiserId: "usr_org",
      coordinatorId: "usr_coord",
      status: "UNDER_REVIEW",
      name: "Summit",
    });
    tx.$queryRaw.mockResolvedValue([{ status: "UNDER_REVIEW" }]);
    tx.clarificationRequest.findFirst.mockResolvedValue(null);
    tx.clarificationRequest.create.mockResolvedValue({ id: "clr1" });
  });

  it("SCRUM-108 [AC1] TC-108-01: the Coordinator's ticked fields are stored with the question, each once", async () => {
    const result = await requestClarification({
      eventId: "evt1",
      message: "Can you confirm the numbers and the date?",
      editableFields: ["expectedAttendance", "schedule", "schedule"],
    });

    expect(result).toEqual({ ok: true, data: { id: "clr1" } });
    expect(tx.clarificationRequest.create).toHaveBeenCalledWith({
      data: {
        eventId: "evt1",
        requestedById: "usr_coord",
        message: "Can you confirm the numbers and the date?",
        editableFields: ["expectedAttendance", "schedule"],
      },
      select: { id: true },
    });
  });

  it("SCRUM-108 [AC1] TC-108-01: ticking none makes it a text answer only", async () => {
    await requestClarification({ eventId: "evt1", message: "Any updates?" });

    expect(tx.clarificationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ editableFields: [] }),
      }),
    );
  });

  it("SCRUM-108 [AC1] TC-108-01: a field that isn't on the request form is refused and nothing is created", async () => {
    const result = await requestClarification({
      eventId: "evt1",
      message: "Change the organiser?",
      editableFields: ["organiserId"],
    });

    expect(result.ok).toBe(false);
    expect(tx.clarificationRequest.create).not.toHaveBeenCalled();
  });
});

describe("respondToClarification — SCRUM-108 AC2–AC5, AC14", () => {
  const event = {
    id: "evt1",
    organiserId: "usr_org",
    coordinatorId: "usr_coord",
    status: "UNDER_REVIEW",
    name: "Summit",
    purpose: "Networking",
    description: "Annual summit",
    startAt: FUTURE_START,
    endAt: FUTURE_END,
    expectedAttendance: 400,
    venueRequirements: "Hall",
    accessibilityNeeds: "Ramp",
    preferredLayout: "Classroom",
    equipmentRequirements: "Projector",
    registrationNotes: "Online",
  };
  const clarification = (
    over: Partial<{
      status: string;
      response: string | null;
      editableFields: string[];
    }> = {},
  ) => ({
    id: "clr1",
    status: "OPEN",
    response: null,
    editableFields: ["expectedAttendance", "preferredLayout"],
    requestedById: "usr_coord",
    event,
    ...over,
  });

  beforeEach(() => mockAuth.mockResolvedValue(organiser()));

  it("SCRUM-108 [AC2, AC3, AC14] TC-108-02: the named fields change with the answer; only values that differ are written, each recorded with who", async () => {
    tx.clarificationRequest.findUnique.mockResolvedValue(clarification());

    const result = await respondToClarification({
      clarificationId: "clr1",
      response: "Theatre layout, and we expect 350.",
      changes: { expectedAttendance: 350, preferredLayout: "Classroom" },
    });

    expect(result).toEqual({ ok: true, data: { id: "clr1" } });
    expect(tx.clarificationRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "clr1", status: "OPEN" },
      data: expect.objectContaining({ status: "ANSWERED" }),
    });
    // preferredLayout was sent unchanged, so only attendance is written.
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: { expectedAttendance: 350 },
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          entityType: "Event",
          entityId: "evt1",
          action: "CLARIFICATION_ANSWERED",
          actorId: "usr_org",
          summary: "Theatre layout, and we expect 350.",
        },
        {
          entityType: "Event",
          entityId: "evt1",
          action: "UPDATED",
          actorId: "usr_org",
          fieldName: "expectedAttendance",
          oldValue: "400",
          newValue: "350",
          summary: "Changed in a clarification answer (SCRUM-108)",
        },
      ],
    });
    // AC3: the Coordinator is told and can resume; the event's status is untouched.
    expect(tx.notification.createMany).toHaveBeenCalled();
    expect(tx.event.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: expect.anything() }),
      }),
    );
  });

  it("SCRUM-108 [AC2, AC14] TC-108-02: a new date and time is written and recorded as the start and end together", async () => {
    tx.clarificationRequest.findUnique.mockResolvedValue(
      clarification({ editableFields: ["schedule"] }),
    );
    const start = new Date(FUTURE_START.getTime() + 86400000);
    const end = new Date(FUTURE_END.getTime() + 86400000);

    await respondToClarification({
      clarificationId: "clr1",
      response: "Moved a day later.",
      changes: { startAt: start.toISOString(), endAt: end.toISOString() },
    });

    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: { startAt: start, endAt: end },
    });
    expect(
      tx.auditLog.createMany.mock.calls[0][0].data.map(
        (e: { fieldName?: string }) => e.fieldName,
      ),
    ).toEqual([undefined, "startAt", "endAt"]);
  });

  it("SCRUM-108 [AC14] TC-108-02: a field that had no value is recorded with an empty old value", async () => {
    tx.clarificationRequest.findUnique.mockResolvedValue({
      ...clarification({ editableFields: ["preferredLayout"] }),
      event: { ...event, preferredLayout: null },
    });

    await respondToClarification({
      clarificationId: "clr1",
      response: "Theatre, please.",
      changes: { preferredLayout: "Theatre" },
    });

    expect(tx.auditLog.createMany.mock.calls[0][0].data[1]).toMatchObject({
      fieldName: "preferredLayout",
      oldValue: null,
      newValue: "Theatre",
    });
  });

  it("SCRUM-108 [AC2] TC-108-02: a text-only answer writes nothing to the event but is still recorded", async () => {
    tx.clarificationRequest.findUnique.mockResolvedValue(
      clarification({ editableFields: [] }),
    );

    const result = await respondToClarification({
      clarificationId: "clr1",
      response: "Yes, classroom is right.",
    });

    expect(result.ok).toBe(true);
    expect(tx.event.update).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("SCRUM-108 [AC5] TC-108-04: changing a field the clarification didn't name is refused, and nothing is written", async () => {
    tx.clarificationRequest.findUnique.mockResolvedValue(clarification());

    const result = await respondToClarification({
      clarificationId: "clr1",
      response: "Also renaming it.",
      changes: { expectedAttendance: 350, name: "Summit 2031" },
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Only the fields your coordinator named can be changed here. Use a change request for anything else.",
    });
    expect(tx.clarificationRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.event.update).not.toHaveBeenCalled();
  });

  it("SCRUM-108 [AC4] TC-108-03: saving the same answer again changes nothing", async () => {
    tx.clarificationRequest.findUnique.mockResolvedValue(
      clarification({ status: "ANSWERED", response: "Theatre layout." }),
    );

    const result = await respondToClarification({
      clarificationId: "clr1",
      response: "Theatre layout.",
    });

    expect(result).toEqual({ ok: true, data: { id: "clr1" } });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-108 [AC4] TC-108-03: a different answer after it was answered is refused", async () => {
    tx.clarificationRequest.findUnique.mockResolvedValue(
      clarification({ status: "ANSWERED", response: "Theatre layout." }),
    );

    const result = await respondToClarification({
      clarificationId: "clr1",
      response: "Actually, classroom.",
    });

    expect(result).toEqual({
      ok: false,
      error: "This clarification request has already been answered.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each([
    {
      when: "only the start is given",
      changes: { startAt: FUTURE_START.toISOString() },
    },
    {
      when: "the start is in the past",
      changes: {
        startAt: new Date(Date.now() - 86400000).toISOString(),
        endAt: FUTURE_END.toISOString(),
      },
    },
    {
      when: "the end is not after the start",
      changes: {
        startAt: FUTURE_END.toISOString(),
        endAt: FUTURE_START.toISOString(),
      },
    },
    {
      when: "a date is not a date",
      changes: { startAt: "soon", endAt: "later" },
    },
    { when: "attendance is zero", changes: { expectedAttendance: 0 } },
    { when: "the name is blank", changes: { name: "   " } },
    { when: "the field isn't on the form", changes: { organiserId: "usr_x" } },
  ])(
    "SCRUM-108 [AC2] TC-108-02: changes are refused when $when, as the request form would refuse them",
    ({ changes }) => {
      expect(clarificationChangesSchema.safeParse(changes).success).toBe(false);
    },
  );

  it.each([
    {
      when: "the new attendance is 0",
      input: { response: "Fewer.", changes: { expectedAttendance: 0 } },
      field: "expectedAttendance",
    },
    {
      when: "only the start is given",
      input: {
        response: "Moved.",
        changes: { startAt: FUTURE_START.toISOString() },
      },
      field: "endAt",
    },
    {
      when: "the response is blank",
      input: { response: "   " },
      field: "response",
    },
    {
      when: "a field isn't on the form",
      input: { response: "Also this.", changes: { organiserId: "usr_x" } },
      field: "changes",
    },
  ])(
    "SCRUM-108 [AC2] TC-108-02: when $when, the error is returned under that field so the panel can show it there, and nothing is read",
    async ({ input, field }) => {
      const result = await respondToClarification({
        clarificationId: "clr1",
        ...input,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Please fix the highlighted fields.");
        expect(Object.keys(result.fieldErrors ?? {})).toEqual([field]);
      }
      expect(tx.clarificationRequest.findUnique).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-171 [AC1] TC-171-10: a clarification answer can clear the registration note, which the form no longer requires", () => {
    expect(
      clarificationChangesSchema.safeParse({ registrationNotes: "" }).success,
    ).toBe(true);
    expect(
      clarificationChangesSchema.safeParse({ registrationNotes: "x".repeat(5001) })
        .success,
    ).toBe(false);
  });

  it("SCRUM-108 [AC2]: changes with no dates at all are valid", () => {
    expect(
      clarificationChangesSchema.safeParse({ preferredLayout: "Theatre" })
        .success,
    ).toBe(true);
  });
});

describe("transitionEventStatus — SCRUM-108 AC11 rejecting an unassigned request", () => {
  it("SCRUM-108 [AC11] TC-108-07: the Coordinator who rejects a request nobody was assigned to becomes its coordinator", async () => {
    mockAuth.mockResolvedValue(coordinator());
    tx.event.findUnique.mockResolvedValue({
      id: "evt1",
      status: "SUBMITTED",
      organiserId: "usr_org",
      coordinatorId: null,
    });

    await transitionEventStatus({
      eventId: "evt1",
      nextStatus: "REJECTED",
      decisionReason: "Too large for any venue.",
      rejectionOutcome: "AMEND_AND_RESUBMIT",
    });

    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: { id: "evt1", status: "SUBMITTED", coordinatorId: null },
      data: expect.objectContaining({
        status: "REJECTED",
        coordinatorId: "usr_coord",
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ASSIGNED",
        actorId: "usr_coord",
        oldValue: null,
        newValue: "usr_coord",
        summary: "Assigned to the rejecting coordinator (SCRUM-108)",
      }),
    });
  });
});

describe("submitEventRequest — SCRUM-108 AC9–AC12, AC14 resubmission", () => {
  const amended = {
    id: "evt1",
    name: "Amended Summit",
    purpose: "Networking",
    description: "Reduced to fit the hall",
    startAt: FUTURE_START.toISOString(),
    endAt: FUTURE_END.toISOString(),
    expectedAttendance: 120,
    venueRequirements: "Hall",
    preferredLayout: "Theatre",
    accessibilityNeeds: "Ramp",
    equipmentRequirements: "Projector",
    registrationRequired: "yes",
    registrationNotes: "Online",
  };
  // As rejected: the amendment above changes the description and attendance.
  const rejectedRow = (coordinatorId: string | null) => ({
    id: "evt1",
    organiserId: "usr_org",
    status: "REJECTED",
    coordinatorId,
    name: "Amended Summit",
    purpose: "Networking",
    description: "Too big for the hall",
    startAt: FUTURE_START,
    endAt: FUTURE_END,
    expectedAttendance: 300,
    venueRequirements: "Hall",
    requiredFacilities: [],
    preferredLayout: "Theatre",
    accessibilityNeeds: "Ramp",
    equipmentRequirements: "Projector",
    registrationRequired: true,
    registrationNotes: "Online",
    programme: null,
    specialRequests: null,
    timezone: "Asia/Singapore",
  });

  beforeEach(() => mockAuth.mockResolvedValue(organiser()));

  it("SCRUM-108 [AC9, AC11, AC14] TC-108-05: the amended request goes back to the same Coordinator, without automatic assignment, and the resubmission is recorded", async () => {
    tx.event.findFirst.mockResolvedValue(rejectedRow("usr_coord"));
    tx.user.findFirst.mockResolvedValue({ id: "usr_coord" });

    const result = await submitEventRequest(amended);

    expect(result).toEqual({ ok: true, data: { id: "evt1" } });
    // AC9: the same event is edited, not a new one.
    expect(tx.event.create).not.toHaveBeenCalled();
    expect(tx.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt1" },
        data: expect.objectContaining({ status: "SUBMITTED" }),
      }),
    );
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: "usr_coord",
        OR: [{ role: "COORDINATOR" }, { additionalRoles: { has: "COORDINATOR" } }],
      },
      select: { id: true },
    });
    expect(tx.event.update).toHaveBeenLastCalledWith({
      where: { id: "evt1" },
      data: { status: "UNDER_REVIEW" },
    });
    // AC11: automatic assignment (its advisory lock) never runs.
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "usr_coord",
        type: "EVENT_STATUS_CHANGED",
      }),
    });
    // SCRUM-45 AC1: back with its Coordinator, it isn't waiting to be
    // assigned, so the Organiser gets no submission notice.
    expect(tx.notification.createMany).not.toHaveBeenCalled();
    // AC14: who resubmitted and when (the entries' createdAt).
    expect(tx.auditLog.create.mock.calls.map((c) => c[0].data)).toEqual([
      expect.objectContaining({
        action: "STATUS_CHANGED",
        actorId: "usr_org",
        oldValue: "REJECTED",
        newValue: "SUBMITTED",
        summary: "Amended and resubmitted (SCRUM-108)",
      }),
      expect.objectContaining({
        action: "STATUS_CHANGED",
        actorId: null,
        oldValue: "SUBMITTED",
        newValue: "UNDER_REVIEW",
      }),
    ]);
    // AC9, AC14: the values the amendment replaced are kept, field by field,
    // and fields left as they were are not recorded.
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          entityType: "Event",
          entityId: "evt1",
          action: "UPDATED",
          actorId: "usr_org",
          fieldName: "description",
          oldValue: "Too big for the hall",
          newValue: "Reduced to fit the hall",
          summary: "Amended before resubmitting (SCRUM-108)",
        },
        {
          entityType: "Event",
          entityId: "evt1",
          action: "UPDATED",
          actorId: "usr_org",
          fieldName: "expectedAttendance",
          oldValue: "300",
          newValue: "120",
          summary: "Amended before resubmitting (SCRUM-108)",
        },
      ],
    });
  });

  it("SCRUM-108 [AC9, AC11, AC14] TC-108-13: a request resubmitted without changes still goes back Under Review, with no change entries", async () => {
    tx.event.findFirst.mockResolvedValue({
      ...rejectedRow("usr_coord"),
      description: amended.description,
      expectedAttendance: amended.expectedAttendance,
    });
    tx.user.findFirst.mockResolvedValue({ id: "usr_coord" });

    const result = await submitEventRequest(amended);

    expect(result).toEqual({ ok: true, data: { id: "evt1" } });
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create.mock.calls.map((c) => c[0].data)).toEqual([
      expect.objectContaining({ oldValue: "REJECTED", newValue: "SUBMITTED" }),
      expect.objectContaining({
        oldValue: "SUBMITTED",
        newValue: "UNDER_REVIEW",
      }),
    ]);
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "usr_coord" }),
    });
  });

  it.each([
    {
      when: "that Coordinator no longer holds the role",
      coordinatorId: "usr_old",
    },
    { when: "it was rejected before anyone was assigned", coordinatorId: null },
  ])(
    "SCRUM-108 [AC11] TC-108-06: when $when, automatic assignment picks a Coordinator",
    async ({ coordinatorId }) => {
      tx.event.findFirst.mockResolvedValue(rejectedRow(coordinatorId));
      tx.user.findFirst.mockResolvedValue(null);
      tx.user.findMany.mockResolvedValue([
        { id: "usr_new", _count: { coordinatedEvents: 0 } },
      ]);

      await submitEventRequest(amended);

      expect(tx.$executeRaw).toHaveBeenCalled();
      expect(tx.event.update).toHaveBeenLastCalledWith({
        where: { id: "evt1" },
        data: { coordinatorId: "usr_new", status: "UNDER_REVIEW" },
      });
    },
  );

  it("SCRUM-108 [AC11, AC14] TC-108-14: when its Coordinator lost the role and nobody can be assigned, the resubmitted request is left unassigned", async () => {
    tx.event.findFirst.mockResolvedValue(rejectedRow("usr_old"));
    tx.user.findFirst.mockResolvedValue(null);
    tx.user.findMany.mockResolvedValue([]);

    const result = await submitEventRequest(amended);

    expect(result).toEqual({ ok: true, data: { id: "evt1" } });
    expect(tx.event.update).toHaveBeenLastCalledWith({
      where: { id: "evt1" },
      data: { coordinatorId: null },
    });
    expect(tx.auditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        action: "ASSIGNED",
        actorId: null,
        oldValue: "usr_old",
        newValue: null,
      }),
    });
    // Nobody was assigned, so only the Organiser's submission notice
    // (SCRUM-45 AC1) is written.
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    expect(tx.notification.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ title: "Request submitted", eventId: "evt1" }),
    ]);
  });

  it("SCRUM-108 [AC12] TC-108-08: resubmitting an event that is no longer Rejected is refused, with no second history entry or notification", async () => {
    // Already resubmitted: the locked lookup no longer matches it.
    tx.event.findFirst.mockResolvedValue(null);

    const result = await submitEventRequest(amended);

    expect(result.ok).toBe(false);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-108 [AC13] TC-108-09: a Coordinator cannot answer a clarification or resubmit a request", async () => {
    mockAuth.mockResolvedValue(coordinator());

    const answered = await respondToClarification({
      clarificationId: "clr1",
      response: "Answering for them.",
    });
    const resubmitted = await submitEventRequest(amended);

    expect(answered.ok).toBe(false);
    expect(resubmitted.ok).toBe(false);
    expect(tx.clarificationRequest.findUnique).not.toHaveBeenCalled();
    expect(tx.event.findFirst).not.toHaveBeenCalled();
  });
});
