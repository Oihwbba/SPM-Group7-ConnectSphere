import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getChangeRequestsForEvent,
  raiseChangeRequest,
} from "@/app/(app)/events/change-request-actions";
import {
  CHANGE_REQUEST_STATUS_LABEL,
  changeFieldLabel,
  raiseChangeRequestSchema,
} from "@/lib/schemas/change-request";

// SCRUM-41 — raising and tracking a change request. Session and database are
// mocked; the transaction runs its callback against a mock `tx`, as in
// clarification.test.ts. The same rules against a real database, including
// two requests at once, are in tests/integration/change-requests.test.ts.
const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUniqueOrThrow: vi.fn() },
  eventChangeRequest: { findFirst: vi.fn(), create: vi.fn() },
  clarificationRequest: { findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
  notification: { create: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const mockAuth = auth as unknown as Mock;
const mockEventFindUnique = prisma.event.findUnique as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

const ORGANISER = "usr_org";
const COORDINATOR = "usr_coord";
const IN_A_MONTH = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const START = new Date(IN_A_MONTH.getTime());
const END = new Date(IN_A_MONTH.getTime() + 3 * 60 * 60 * 1000);

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

type Over = Partial<{
  status: EventStatus;
  coordinatorId: string | null;
  organiserId: string;
  discardedAt: Date | null;
}>;

/** The event as the action reads it before the transaction. */
const visible = (over: Over = {}) => ({
  organiserId: ORGANISER,
  coordinatorId: COORDINATOR,
  status: "PLANNING" as EventStatus,
  discardedAt: null,
  organiser: { name: "Olive Organiser" },
  changeRequests: [] as object[],
  ...over,
});

/** The event as the transaction re-reads it under the lock. */
const current = (over: Over = {}) => ({
  name: "Career Fair",
  purpose: "Recruiting",
  description: "Booths and talks.",
  startAt: START,
  endAt: END,
  expectedAttendance: 40,
  venueRequirements: "A hall",
  accessibilityNeeds: "Step-free access",
  preferredLayout: "Booths",
  equipmentRequirements: "Two projectors",
  registrationNotes: "Open to all students",
  programme: "Talks at 10",
  specialRequests: null,
  organiserId: ORGANISER,
  coordinatorId: COORDINATOR,
  status: "PLANNING" as EventStatus,
  ...over,
});

function signIn(role: Role, id: string, event: Over = {}) {
  mockAuth.mockResolvedValue(sessionFor(role, id));
  mockEventFindUnique.mockResolvedValue(visible(event));
  tx.event.findUniqueOrThrow.mockResolvedValue(current(event));
}

const nothingWritten = () => {
  expect(tx.eventChangeRequest.create).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([]);
  tx.eventChangeRequest.findFirst.mockResolvedValue(null);
  tx.eventChangeRequest.create.mockResolvedValue({ id: "chg_new" });
  tx.clarificationRequest.findFirst.mockResolvedValue(null);
  tx.auditLog.create.mockResolvedValue({});
  tx.notification.create.mockResolvedValue({});
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

describe("raiseChangeRequest — SCRUM-41", () => {
  it("SCRUM-41 [AC1, AC5, AC6] TC-41-01: records each changed field with its old and new value, marks attendance impactful, and leaves the event unchanged", async () => {
    signIn("ORGANISER", ORGANISER);

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: { expectedAttendance: 60, description: "Booths, talks and a panel." },
      reason: "More companies signed up.",
    });

    expect(result).toEqual({ ok: true, data: { id: "chg_new" } });
    expect(tx.eventChangeRequest.create).toHaveBeenCalledWith({
      data: {
        eventId: "evt1",
        requestedById: ORGANISER,
        reason: "More companies signed up.",
        requestsCancellation: false,
        fields: {
          create: [
            {
              fieldName: "description",
              oldValue: "Booths and talks.",
              newValue: "Booths, talks and a panel.",
              isMajor: false,
            },
            { fieldName: "expectedAttendance", oldValue: "40", newValue: "60", isMajor: true },
          ],
        },
      },
      select: { id: true },
    });
    // AC6: the event's values are untouched. The mock tx has no event write,
    // so any attempt to make one would have thrown.
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: "evt1",
        action: "CHANGE_REQUESTED",
        actorId: ORGANISER,
        summary: "Change requested: Description, Expected attendance",
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/events");
  });

  it("SCRUM-41 [AC5] TC-41-08: date, time, venue and equipment are impactful; the other fields are not", async () => {
    signIn("ORGANISER", ORGANISER);
    const newStart = new Date(START.getTime() + 24 * 60 * 60 * 1000);
    const newEnd = new Date(END.getTime() + 24 * 60 * 60 * 1000);

    await raiseChangeRequest({
      eventId: "evt1",
      changes: {
        startAt: newStart.toISOString(),
        endAt: newEnd.toISOString(),
        venueRequirements: "Two halls",
        equipmentRequirements: "Four projectors",
        name: "Career Fair 2031",
        purpose: "Recruiting interns",
        accessibilityNeeds: "Step-free access and a hearing loop",
        preferredLayout: "Theatre",
        registrationNotes: "Students only",
        programme: "Talks at 11",
        specialRequests: "Water for speakers",
      },
    });

    const created = tx.eventChangeRequest.create.mock.calls[0][0].data.fields.create;
    const impactful = Object.fromEntries(
      created.map((f: { fieldName: string; isMajor: boolean }) => [f.fieldName, f.isMajor]),
    );
    expect(impactful).toEqual({
      startAt: true,
      endAt: true,
      venueRequirements: true,
      equipmentRequirements: true,
      name: false,
      purpose: false,
      accessibilityNeeds: false,
      preferredLayout: false,
      registrationNotes: false,
      programme: false,
      specialRequests: false,
    });
    expect(created.find((f: { fieldName: string }) => f.fieldName === "startAt")).toEqual({
      fieldName: "startAt",
      oldValue: START.toISOString(),
      newValue: newStart.toISOString(),
      isMajor: true,
    });
    expect(tx.auditLog.create.mock.calls[0][0].data.summary).toBe(
      "Change requested: Event name, Purpose, Date and time, Venue requirements, Accessibility needs, Room layout, Equipment requirements, Registration needs, Programme, Special requests",
    );
  });

  it("SCRUM-41 [AC1] TC-41-01: an optional field can be cleared, and is recorded as having no value", async () => {
    signIn("ORGANISER", ORGANISER);

    await raiseChangeRequest({ eventId: "evt1", changes: { programme: "" } });

    expect(tx.eventChangeRequest.create.mock.calls[0][0].data.fields.create).toEqual([
      { fieldName: "programme", oldValue: "Talks at 10", newValue: null, isMajor: false },
    ]);
  });

  it("SCRUM-41 [AC1] TC-41-15: values equal to the event's are not a change, and nothing is written", async () => {
    signIn("ORGANISER", ORGANISER);

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: {
        expectedAttendance: 40,
        startAt: START.toISOString(),
        endAt: END.toISOString(),
        specialRequests: "",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: "Change at least one field, or ask to cancel the event.",
      fieldErrors: { changes: ["Change at least one field, or ask to cancel the event."] },
    });
    nothingWritten();
  });

  it("SCRUM-41 [AC1] TC-41-02: a cancellation request records the reason and no fields", async () => {
    signIn("ORGANISER", ORGANISER, { status: "CONFIRMED" });

    const result = await raiseChangeRequest({
      eventId: "evt1",
      requestsCancellation: true,
      reason: "The sponsor withdrew.",
    });

    expect(result.ok).toBe(true);
    expect(tx.eventChangeRequest.create.mock.calls[0][0].data).toEqual({
      eventId: "evt1",
      requestedById: ORGANISER,
      reason: "The sponsor withdrew.",
      requestsCancellation: true,
      fields: { create: [] },
    });
    expect(tx.auditLog.create.mock.calls[0][0].data.summary).toBe(
      "Cancellation requested: The sponsor withdrew.",
    );
  });

  it.each(["UNDER_REVIEW", "PLANNING", "CONFIRMED"] as const)(
    "SCRUM-41 [AC1] TC-41-04: a change request can be raised on a %s event",
    async (status) => {
      signIn("ORGANISER", ORGANISER, { status });

      const result = await raiseChangeRequest({
        eventId: "evt1",
        changes: { name: "Career Fair 2031" },
      });

      expect(result.ok).toBe(true);
    },
  );

  it.each([
    ["DRAFT", "A draft isn't submitted yet. Edit it directly instead."],
    [
      "REJECTED",
      "This request was rejected. Follow the next step under the rejection reason to amend it.",
    ],
    ["CANCELLED", "A cancelled or completed event can't be changed."],
    ["COMPLETED", "A cancelled or completed event can't be changed."],
    [
      "SUBMITTED",
      "This request is waiting for a coordinator to be assigned. It can't be changed until then.",
    ],
    [
      "APPROVED",
      "This request is waiting for a coordinator to be assigned. It can't be changed until then.",
    ],
  ] as const)(
    "SCRUM-41 [AC2] TC-41-05: a %s event is refused before anything is locked or written",
    async (status, message) => {
      signIn("ORGANISER", ORGANISER, { status });

      const result = await raiseChangeRequest({
        eventId: "evt1",
        changes: { name: "Career Fair 2031" },
      });

      expect(result).toEqual({ ok: false, error: message });
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-41 [AC2] TC-41-05: an event Under Review with no coordinator yet can't be changed", async () => {
    signIn("ORGANISER", ORGANISER, { status: "UNDER_REVIEW", coordinatorId: null });

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: { name: "Career Fair 2031" },
    });

    expect(result).toEqual({
      ok: false,
      error:
        "This request is waiting for a coordinator to be assigned. It can't be changed until then.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-41 [AC2] TC-41-16: an event rejected after it was read is refused under the lock, and nothing is written", async () => {
    signIn("ORGANISER", ORGANISER);
    tx.event.findUniqueOrThrow.mockResolvedValue(current({ status: "REJECTED" }));

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: { name: "Career Fair 2031" },
    });

    expect(result).toEqual({
      ok: false,
      error:
        "This request was rejected. Follow the next step under the rejection reason to amend it.",
    });
    expect(tx.$queryRaw).toHaveBeenCalled();
    nothingWritten();
  });

  it("SCRUM-41 [AC10] TC-41-16: a Coordinator unassigned after reading the event is refused, and nothing is written", async () => {
    signIn("COORDINATOR", COORDINATOR);
    tx.event.findUniqueOrThrow.mockResolvedValue(current({ coordinatorId: "usr_other" }));

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: { name: "Career Fair 2031" },
    });

    expect(result).toEqual({
      ok: false,
      error: "This event was updated by another user. Refresh and try again.",
    });
    nothingWritten();
  });

  it("SCRUM-41 [AC7] TC-41-10: a second request while one is Submitted is refused, and nothing is written", async () => {
    signIn("ORGANISER", ORGANISER);
    tx.eventChangeRequest.findFirst.mockResolvedValue({ id: "chg_open" });

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: { name: "Career Fair 2031" },
    });

    expect(result).toEqual({
      ok: false,
      error:
        "This event already has a change request waiting for a decision. It's shown below.",
    });
    expect(tx.eventChangeRequest.findFirst).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: "PENDING_REVIEW" },
      select: { id: true },
    });
    nothingWritten();
  });

  it("SCRUM-41 [AC7] TC-41-11: the open-request check runs after the event row is locked", async () => {
    signIn("ORGANISER", ORGANISER);
    const order: string[] = [];
    tx.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => {
      order.push(sql.join("?").includes("FOR UPDATE") ? "lock" : "other");
      return [];
    });
    tx.eventChangeRequest.findFirst.mockImplementation(async () => {
      order.push("check");
      return null;
    });

    await raiseChangeRequest({ eventId: "evt1", changes: { name: "Career Fair 2031" } });

    expect(order).toEqual(["lock", "check"]);
  });

  it("SCRUM-41 [AC3] TC-41-06: a field the open clarification names is refused, and nothing is written", async () => {
    signIn("ORGANISER", ORGANISER, { status: "UNDER_REVIEW" });
    tx.clarificationRequest.findFirst.mockResolvedValue({
      editableFields: ["expectedAttendance"],
    });

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: { expectedAttendance: 60, name: "Career Fair 2031" },
    });

    expect(result).toEqual({
      ok: false,
      error:
        "The open clarification request covers Expected attendance, so change it in the answer to it instead.",
    });
    expect(tx.clarificationRequest.findFirst).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: "OPEN" },
      select: { editableFields: true },
    });
    nothingWritten();
  });

  it("SCRUM-41 [AC3] TC-41-06: a new date and time is covered by a clarification that names the schedule", async () => {
    signIn("ORGANISER", ORGANISER, { status: "UNDER_REVIEW" });
    tx.clarificationRequest.findFirst.mockResolvedValue({
      editableFields: ["schedule", "name"],
    });

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: {
        startAt: new Date(START.getTime() + 3600_000).toISOString(),
        endAt: new Date(END.getTime() + 3600_000).toISOString(),
        name: "Career Fair 2031",
      },
    });

    expect(result).toEqual({
      ok: false,
      error:
        "The open clarification request covers Event name, Date and time, so change them in the answer to it instead.",
    });
    nothingWritten();
  });

  it("SCRUM-41 [AC3] TC-41-06: fields the open clarification doesn't name go through a change request", async () => {
    signIn("ORGANISER", ORGANISER, { status: "UNDER_REVIEW" });
    tx.clarificationRequest.findFirst.mockResolvedValue({ editableFields: ["name"] });

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: { expectedAttendance: 60 },
    });

    expect(result.ok).toBe(true);
  });

  it("SCRUM-41 [AC3] TC-41-06: a cancellation request isn't blocked by an open clarification", async () => {
    signIn("ORGANISER", ORGANISER, { status: "UNDER_REVIEW" });
    tx.clarificationRequest.findFirst.mockResolvedValue({ editableFields: ["name"] });

    const result = await raiseChangeRequest({
      eventId: "evt1",
      requestsCancellation: true,
      reason: "No longer needed.",
    });

    expect(result.ok).toBe(true);
    expect(tx.clarificationRequest.findFirst).not.toHaveBeenCalled();
  });

  it("SCRUM-41 [AC3] TC-41-06: outside Under Review there is no clarification to defer to", async () => {
    signIn("ORGANISER", ORGANISER, { status: "PLANNING" });

    await raiseChangeRequest({ eventId: "evt1", changes: { expectedAttendance: 60 } });

    expect(tx.clarificationRequest.findFirst).not.toHaveBeenCalled();
  });

  it("SCRUM-41 [AC9] TC-41-13: the assigned Coordinator raises a change request on the Organiser's behalf", async () => {
    signIn("COORDINATOR", COORDINATOR);

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: { expectedAttendance: 60 },
      reason: "Agreed with the organiser by phone.",
    });

    expect(result.ok).toBe(true);
    expect(tx.eventChangeRequest.create.mock.calls[0][0].data.requestedById).toBe(COORDINATOR);
  });

  it("SCRUM-41 [AC10] TC-41-14, SCRUM-165 [AC8] TC-165-11: a Coordinator who isn't assigned is refused as if the event were missing, and nothing is locked", async () => {
    signIn("COORDINATOR", "usr_other_coord", { status: "UNDER_REVIEW", coordinatorId: null });

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: { name: "Career Fair 2031" },
    });

    expect(result).toEqual({
      ok: false,
      error: "Event not found.",
      fieldErrors: undefined,
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-41 [AC10] TC-41-14: another Organiser's event, a missing one and a discarded one all look not found", async () => {
    signIn("ORGANISER", "usr_someone_else");
    const results = [await raiseChangeRequest({ eventId: "evt1", changes: { name: "X" } })];
    mockEventFindUnique.mockResolvedValue(null);
    results.push(await raiseChangeRequest({ eventId: "evt_missing", changes: { name: "X" } }));
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", ORGANISER));
    mockEventFindUnique.mockResolvedValue(visible({ status: "DRAFT", discardedAt: new Date() }));
    results.push(await raiseChangeRequest({ eventId: "evt1", changes: { name: "X" } }));

    for (const result of results) {
      expect(result).toEqual({ ok: false, error: "Event not found." });
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each(["VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE", "COORDINATOR_LEAD", "SAFETY_OFFICER"] as const)(
    "SCRUM-41 [AC10] TC-41-14: %s can't raise a change request, and nothing is read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_staff"));

      const result = await raiseChangeRequest({ eventId: "evt1", changes: { name: "X" } });

      expect(result).toEqual({ ok: false, error: "You do not have permission to do that." });
      expect(mockEventFindUnique).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-41 [AC10] TC-41-14: a signed-out caller is refused", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await raiseChangeRequest({ eventId: "evt1", changes: { name: "X" } });

    expect(result).toEqual({ ok: false, error: "You do not have permission to do that." });
  });

  it("SCRUM-41 [AC4] TC-41-07: invalid values are refused next to their field, before anything is read", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", ORGANISER));

    const result = await raiseChangeRequest({
      eventId: "evt1",
      changes: { expectedAttendance: 0 },
      reason: "x".repeat(2001),
    });

    expect(result).toEqual({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        expectedAttendance: ["Attendance must be a positive whole number."],
        reason: ["Keep the reason under 2000 characters."],
      },
    });
    expect(mockEventFindUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-41 [AC1] TC-41-15: a request with no changes at all is refused under the changes field", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", ORGANISER));

    const result = await raiseChangeRequest({ eventId: "evt1" });

    expect(result).toEqual({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { changes: ["Change at least one field, or ask to cancel the event."] },
    });
  });

  it("SCRUM-41 [AC1] TC-41-01: an unexpected database failure is not swallowed", async () => {
    signIn("ORGANISER", ORGANISER);
    mockTransaction.mockRejectedValue(new Error("connection lost"));

    await expect(
      raiseChangeRequest({ eventId: "evt1", changes: { name: "Career Fair 2031" } }),
    ).rejects.toThrow("connection lost");
  });
});

describe("raiseChangeRequestSchema — SCRUM-41 AC1, AC4", () => {
  const parse = (input: object) =>
    raiseChangeRequestSchema.safeParse({ eventId: "evt1", ...input });
  const messages = (input: object) => {
    const result = parse(input);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it("SCRUM-41 [AC1] TC-41-03: a cancellation needs a reason", () => {
    expect(messages({ requestsCancellation: true, reason: "   " })).toEqual([
      "Give a reason for cancelling the event.",
    ]);
  });

  it("SCRUM-41 [AC1] TC-41-03: a cancellation can't also change fields", () => {
    expect(
      messages({ requestsCancellation: true, reason: "Sponsor left.", changes: { name: "X" } }),
    ).toEqual(["A cancellation request can't also change fields."]);
  });

  it("SCRUM-41 [AC1] TC-41-03: a blank reason on a change request is no reason", () => {
    const result = parse({ changes: { name: "X" }, reason: "  " });
    expect(result.success && result.data.reason).toBeUndefined();
  });

  it.each([
    [{ expectedAttendance: 0 }, "Attendance must be a positive whole number."],
    [{ expectedAttendance: -5 }, "Attendance must be a positive whole number."],
    [{ expectedAttendance: 1.5 }, "Attendance must be a positive whole number."],
    [{ name: "   " }, "The event name can't be empty."],
    [{ startAt: IN_A_MONTH.toISOString() }, "Give both the start and the end."],
    [
      { startAt: END.toISOString(), endAt: START.toISOString() },
      "Proposed end date and time must be strictly after the start date and time.",
    ],
    [
      { startAt: START.toISOString(), endAt: START.toISOString() },
      "Proposed end date and time must be strictly after the start date and time.",
    ],
    [
      { startAt: new Date(Date.now() - 60_000).toISOString(), endAt: END.toISOString() },
      "Proposed date cannot be in the past.",
    ],
    [{ startAt: "not a date", endAt: END.toISOString() }, "Invalid date format."],
    [{ programme: "x".repeat(5001) }, "Keep the programme under 5000 characters."],
    [{ registrationRequired: true }, "Unrecognized key(s) in object: 'registrationRequired'"],
  ])("SCRUM-41 [AC4] TC-41-07: %j is refused: %s", (changes, message) => {
    expect(messages({ changes })).toContain(message);
  });

  it("SCRUM-41 [AC4] TC-41-07: the boundaries that are allowed: attendance 1, an end one minute after the start, an empty programme", () => {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60_000);
    expect(
      parse({
        changes: {
          expectedAttendance: 1,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          programme: "",
        },
      }).success,
    ).toBe(true);
  });
});

describe("change request labels — SCRUM-41 AC6", () => {
  it("SCRUM-41 [AC6] TC-41-09: the statuses read Submitted, Approved and Rejected", () => {
    expect(CHANGE_REQUEST_STATUS_LABEL).toEqual({
      PENDING_REVIEW: "Submitted",
      APPROVED: "Approved",
      REJECTED: "Rejected",
    });
  });

  it.each([
    ["startAt", "Start"],
    ["endAt", "End"],
    ["expectedAttendance", "Expected attendance"],
    ["specialRequests", "Special requests"],
    ["somethingOld", "somethingOld"],
  ])("SCRUM-41 [AC6] TC-41-09: the field %s reads %s", (fieldName, label) => {
    expect(changeFieldLabel(fieldName)).toBe(label);
  });
});

describe("getChangeRequestsForEvent — SCRUM-41 AC6, AC7, AC9", () => {
  const row = (over: object = {}) => ({
    id: "chg1",
    status: "PENDING_REVIEW",
    reason: "More companies.",
    requestsCancellation: false,
    decisionReason: null,
    createdAt: new Date("2031-03-01T08:00:00.000Z"),
    requestedById: ORGANISER,
    fields: [{ fieldName: "expectedAttendance", oldValue: "40", newValue: "60", isMajor: true }],
    ...over,
  });

  it("SCRUM-41 [AC6, AC9] TC-41-09: lists the event's requests newest first, labelling one the Coordinator raised", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", ORGANISER));
    mockEventFindUnique.mockResolvedValue({
      ...visible(),
      changeRequests: [
        row({ id: "chg2", status: "REJECTED", decisionReason: "No hall that size.", requestedById: COORDINATOR }),
        row({ id: "chg1", status: "APPROVED" }),
      ],
    });

    const result = await getChangeRequestsForEvent("evt1");

    const query = mockEventFindUnique.mock.calls[0][0];
    expect(query.where).toEqual({ id: "evt1" });
    expect(query.select.changeRequests.orderBy).toEqual({ createdAt: "desc" });
    expect(result.ok && result.data).toEqual({
      canRaise: true,
      requests: [
        expect.objectContaining({
          id: "chg2",
          status: "REJECTED",
          decisionReason: "No hall that size.",
          raisedFor: "Olive Organiser",
        }),
        expect.objectContaining({ id: "chg1", status: "APPROVED", raisedFor: null }),
      ],
    });
    expect(result.ok && result.data.requests[0]).not.toHaveProperty("requestedById");
  });

  it("SCRUM-41 [AC7] TC-41-10: no new request can be raised while one is Submitted", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", ORGANISER));
    mockEventFindUnique.mockResolvedValue({ ...visible(), changeRequests: [row()] });

    const result = await getChangeRequestsForEvent("evt1");

    expect(result.ok && result.data.canRaise).toBe(false);
  });

  it("SCRUM-41 [AC2] TC-41-05: a Cancelled event's requests are shown, but no new one can be raised", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", ORGANISER));
    mockEventFindUnique.mockResolvedValue(visible({ status: "CANCELLED" }));

    const result = await getChangeRequestsForEvent("evt1");

    expect(result.ok && result.data.canRaise).toBe(false);
  });

  it("SCRUM-41 [AC10] TC-41-14: a Coordinator who can see an unassigned request can't raise one", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_other_coord"));
    mockEventFindUnique.mockResolvedValue(visible({ status: "SUBMITTED", coordinatorId: null }));

    const result = await getChangeRequestsForEvent("evt1");

    expect(result.ok && result.data.canRaise).toBe(false);
  });

  it("SCRUM-41 [AC10] TC-41-14: another Organiser's, a missing and a discarded event all look not found", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_someone_else"));
    // The event has a request, and none of it may reach the caller.
    mockEventFindUnique.mockResolvedValue({ ...visible(), changeRequests: [row()] });
    const results = [await getChangeRequestsForEvent("evt1")];
    mockEventFindUnique.mockResolvedValue(null);
    results.push(await getChangeRequestsForEvent("evt_missing"));
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", ORGANISER));
    mockEventFindUnique.mockResolvedValue(visible({ discardedAt: new Date() }));
    results.push(await getChangeRequestsForEvent("evt1"));

    for (const result of results) {
      expect(result).toEqual({ ok: false, error: "Event not found." });
    }
  });

  it("SCRUM-41 [AC10] TC-41-14: a role that can't read events, or a signed-out caller, is refused before anything is read", async () => {
    mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF", "usr_staff"));
    expect(await getChangeRequestsForEvent("evt1")).toEqual({ ok: false, error: "Event not found." });
    mockAuth.mockResolvedValue(null);
    expect(await getChangeRequestsForEvent("evt1")).toEqual({ ok: false, error: "Event not found." });
    expect(mockEventFindUnique).not.toHaveBeenCalled();
  });
});

describe("raiseChangeRequest notices — SCRUM-124 AC7, AC12", () => {
  it("SCRUM-124 [AC7, AC12] TC-124-07: the assigned Coordinator is told which event and which fields the Organiser asked to change", async () => {
    signIn("ORGANISER", ORGANISER);

    await raiseChangeRequest({
      eventId: "evt1",
      changes: { expectedAttendance: 60, venueRequirements: "Two halls" },
    });

    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: COORDINATOR,
        type: "CHANGE_REQUEST_SUBMITTED",
        title: "Change request raised",
        message:
          'The organiser asked to change "Career Fair": Expected attendance, Venue requirements.',
        link: "/events",
        eventId: "evt1",
      },
    });
  });

  it("SCRUM-124 [AC7, AC12] TC-124-07: a cancellation request tells the Coordinator the Organiser's reason", async () => {
    signIn("ORGANISER", ORGANISER);

    await raiseChangeRequest({
      eventId: "evt1",
      requestsCancellation: true,
      reason: "The sponsor withdrew.",
    });

    expect(tx.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: COORDINATOR,
      title: "Cancellation requested",
      message: 'The organiser asked to cancel "Career Fair". Their reason: The sponsor withdrew.',
    });
  });

  it("SCRUM-124 [AC7] TC-124-07: a request the Coordinator raised themselves sends them no notice", async () => {
    signIn("COORDINATOR", COORDINATOR);

    await raiseChangeRequest({ eventId: "evt1", changes: { expectedAttendance: 60 } });

    expect(tx.eventChangeRequest.create).toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("SCRUM-124 [AC14] TC-124-07: a refused request sends no notice", async () => {
    signIn("ORGANISER", ORGANISER);
    tx.eventChangeRequest.findFirst.mockResolvedValue({ id: "chg_open" });

    await raiseChangeRequest({ eventId: "evt1", changes: { expectedAttendance: 60 } });

    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});
