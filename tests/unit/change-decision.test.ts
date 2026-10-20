import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { cancelInTransaction } from "@/lib/event-closing";
import { flagArrangements, flaggableArrangements } from "@/lib/reconsideration";
import { outdateSafetyChecks } from "@/lib/safety-checks";
import {
  decideChangeRequest,
  getChangeDecision,
} from "@/app/(app)/events/change-decision-actions";

// SCRUM-128 — the assigned Coordinator decides a change request (SCRUM-41).
// Test cases: docs/testing/SCRUM-128.md. Session and database are mocked; the
// transaction runs its callback against a mock `tx`. Flagging (SCRUM-26),
// outdating a safety check (SCRUM-166) and cancelling (SCRUM-82) have their
// own tests, so here only their calls are checked.

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  eventChangeRequest: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  registration: { count: vi.fn() },
  auditLog: { create: vi.fn(), createMany: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    eventChangeRequest: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/reconsideration", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reconsideration")>()),
  flagArrangements: vi.fn(),
  flaggableArrangements: vi.fn(),
}));
vi.mock("@/lib/safety-checks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/safety-checks")>()),
  outdateSafetyChecks: vi.fn(),
}));
vi.mock("@/lib/event-closing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/event-closing")>()),
  cancelInTransaction: vi.fn(),
}));

const mockAuth = auth as unknown as Mock;
const mockEvent = prisma.event.findUnique as unknown as Mock;
const mockRequest = prisma.eventChangeRequest.findUnique as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;
const mockFlag = flagArrangements as unknown as Mock;
const mockFlaggable = flaggableArrangements as unknown as Mock;
const mockOutdate = outdateSafetyChecks as unknown as Mock;
const mockCancel = cancelInTransaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const ATTENDANCE = { fieldName: "expectedAttendance", oldValue: "40", newValue: "80", isMajor: true };
const DESCRIPTION = { fieldName: "description", oldValue: "Old", newValue: "New", isMajor: false };

const pendingRequest = (fields = [ATTENDANCE], requestsCancellation = false) => ({
  status: "PENDING_REVIEW",
  reason: requestsCancellation ? "The sponsor pulled out." : "More people coming.",
  requestsCancellation,
  fields: requestsCancellation ? [] : fields,
});

const eventNow = (status: EventStatus = "PLANNING", coordinatorId = "usr_coord") => ({
  status,
  coordinatorId,
  organiserId: "usr_org",
  name: "Concert",
  startAt: new Date("2031-01-01T02:00:00.000Z"),
  endAt: new Date("2031-01-01T06:00:00.000Z"),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
  mockRequest.mockResolvedValue({
    eventId: "evt1",
    event: { organiserId: "usr_org", coordinatorId: "usr_coord", status: "PLANNING" },
  });
  tx.event.findUniqueOrThrow.mockResolvedValue(eventNow());
  tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(pendingRequest());
  tx.registration.count.mockResolvedValue(10);
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

function expectNothingWritten() {
  expect(tx.event.update).not.toHaveBeenCalled();
  expect(tx.eventChangeRequest.update).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
  expect(tx.notification.create).not.toHaveBeenCalled();
  expect(tx.notification.createMany).not.toHaveBeenCalled();
  expect(mockFlag).not.toHaveBeenCalled();
  expect(mockCancel).not.toHaveBeenCalled();
}

describe("decideChangeRequest — approving (SCRUM-128 AC2, AC4–AC6, AC10)", () => {
  it("SCRUM-128 [AC2, AC10] TC-128-02: the requested values become the event's and the request becomes Approved, with who and when, in one transaction", async () => {
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(pendingRequest([DESCRIPTION]));

    const result = await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });

    expect(result).toEqual({ ok: true, data: { decision: "APPROVED", returnedToPlanning: false } });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.eventChangeRequest.update).toHaveBeenCalledWith({
      where: { id: "cr1" },
      data: { decidedById: "usr_coord", decidedAt: expect.any(Date), status: "APPROVED" },
    });
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: { description: "New" },
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          entityType: "Event",
          entityId: "evt1",
          action: "UPDATED",
          actorId: "usr_coord",
          fieldName: "description",
          oldValue: "Old",
          newValue: "New",
          summary: "Change request cr1 approved (SCRUM-128)",
        },
      ],
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_org",
        type: "CHANGE_REQUEST_OUTCOME",
        title: "Change request approved",
        message: 'Your change request for "Concert" was approved: Description.',
        link: "/events",
        eventId: "evt1",
      },
    });
  });

  it("SCRUM-128 [AC6] TC-128-05: a change that isn't impactful flags nothing, outdates nothing and keeps the status", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("CONFIRMED"));
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(pendingRequest([DESCRIPTION]));

    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toMatchObject({ ok: true, data: { returnedToPlanning: false } });
    expect(mockFlag).not.toHaveBeenCalled();
    expect(mockOutdate).not.toHaveBeenCalled();
    expect(tx.event.update.mock.calls[0][0].data).not.toHaveProperty("status");
  });

  it("SCRUM-128 [AC4] TC-128-04: an impactful change flags the event's arrangements and outdates its safety check", async () => {
    await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });

    expect(mockFlag).toHaveBeenCalledWith(
      tx,
      { eventId: "evt1" },
      "Change approved: Expected attendance.",
      expect.any(Date),
    );
    expect(mockOutdate).toHaveBeenCalledWith(tx, "evt1", expect.any(Date));
  });

  it("SCRUM-128 [AC4] TC-128-04: a layout change outdates a safety check without flagging anything", async () => {
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(
      pendingRequest([{ fieldName: "preferredLayout", oldValue: "Theatre", newValue: "Banquet", isMajor: false }]),
    );

    await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });

    expect(mockFlag).not.toHaveBeenCalled();
    expect(mockOutdate).toHaveBeenCalled();
  });

  it("SCRUM-170 [AC4] TC-170-12: approving a change to the equipment requirements puts Equipment back to Not decided; any other change keeps No equipment needed", async () => {
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(
      pendingRequest([
        { fieldName: "equipmentRequirements", oldValue: "None", newValue: "Two microphones", isMajor: true },
      ]),
    );
    await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });
    expect(tx.event.update.mock.calls[0][0].data).toMatchObject({
      equipmentRequirements: "Two microphones",
      noEquipmentNeededAt: null,
      noEquipmentNeededById: null,
    });

    tx.event.update.mockClear();
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(pendingRequest([DESCRIPTION]));
    await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });
    expect(tx.event.update.mock.calls[0][0].data).not.toHaveProperty("noEquipmentNeededAt");
  });

  it("SCRUM-128 [AC5] TC-128-05: an impactful change to a Confirmed event returns it to Planning in the same operation, with a history entry, and withdraws its scheduled Registration closed notice", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("CONFIRMED"));

    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toEqual({ ok: true, data: { decision: "APPROVED", returnedToPlanning: true } });
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: { expectedAttendance: 80, status: "PLANNING" },
    });
    expect(tx.auditLog.createMany.mock.calls[0][0].data[1]).toMatchObject({
      action: "STATUS_CHANGED",
      oldValue: "CONFIRMED",
      newValue: "PLANNING",
    });
    expect(tx.notification.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt1",
        title: "Registration closed",
        withdrawnAt: null,
        showFromAt: { gt: expect.any(Date) },
      },
      data: { withdrawnAt: expect.any(Date) },
    });
  });

  it("SCRUM-45 [AC5, AC12] TC-45-09: back in Planning, the Organiser is told why", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("CONFIRMED"));

    await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });

    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "usr_org",
          type: "EVENT_STATUS_CHANGED",
          eventId: "evt1",
          title: "Your event is back in Planning",
          message:
            '"Concert" is back in Planning: a change to Expected attendance was approved. It needs confirming again before new registrations open.',
        },
      ],
    });
  });

  it("SCRUM-128 [AC6] TC-128-05, SCRUM-45 [AC5] TC-45-09: an impactful change to an event Under Review or in Planning keeps its status, and sends no back-in-Planning notice", async () => {
    for (const status of ["UNDER_REVIEW", "PLANNING"] as EventStatus[]) {
      tx.event.update.mockClear();
      tx.event.findUniqueOrThrow.mockResolvedValue(eventNow(status));
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });
      expect(tx.event.update.mock.calls[0][0].data).not.toHaveProperty("status");
      // Not Confirmed, so no Registration closed notice was scheduled.
      expect(tx.notification.updateMany).not.toHaveBeenCalled();
      expect(tx.notification.createMany).not.toHaveBeenCalled();
    }
  });
});

describe("decideChangeRequest — attendance and cancellation (SCRUM-128 AC7, AC8)", () => {
  it("SCRUM-128 [AC7] TC-128-06: an attendance below the active registrations is refused with their number, and nothing is written", async () => {
    tx.registration.count.mockResolvedValue(81);

    expect(await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" })).toEqual({
      ok: false,
      error:
        "The expected attendance can't be lower than the 81 active registrations, so this change can't be approved.",
    });
    expect(tx.registration.count).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: "REGISTERED" },
    });
    expectNothingWritten();
  });

  it("SCRUM-128 [AC7] TC-128-06: an attendance equal to the active registrations is allowed", async () => {
    tx.registration.count.mockResolvedValue(80);

    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toMatchObject({ ok: true });
  });

  it("SCRUM-171 [AC5] TC-171-09: Registration needed can't be approved as No while people are registered; the message gives how many, and nothing is written", async () => {
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(
      pendingRequest([
        { fieldName: "registrationRequired", oldValue: "true", newValue: "false", isMajor: false },
      ]),
    );
    tx.registration.count.mockResolvedValue(1);

    expect(await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" })).toEqual({
      ok: false,
      error: "This event has 1 active registration, so Registration needed can't be changed to No.",
    });
    expect(tx.registration.count).toHaveBeenCalledWith({
      where: { eventId: "evt1", status: "REGISTERED" },
    });
    expectNothingWritten();
  });

  it("SCRUM-171 [AC4, AC5] TC-171-09: with nobody registered, No is applied as No and closes registration, withdrawing its notice; Yes counts no registrations and changes neither", async () => {
    const needed = (newValue: string) =>
      pendingRequest([
        { fieldName: "registrationRequired", oldValue: "x", newValue, isMajor: false },
      ]);
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(needed("false"));
    tx.registration.count.mockResolvedValue(0);
    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toMatchObject({ ok: true });
    expect(tx.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ registrationRequired: false, registrationEnabled: false }),
      }),
    );
    expect(tx.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ title: "Registration closed" }) }),
    );

    vi.clearAllMocks();
    mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow());
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(needed("true"));
    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toMatchObject({ ok: true });
    expect(tx.registration.count).not.toHaveBeenCalled();
    expect(tx.event.update.mock.calls[0][0].data).not.toHaveProperty("registrationEnabled");
    expect(tx.notification.updateMany).not.toHaveBeenCalled();
  });

  describe("SCRUM-128 AC11 — Registration needed changed to Yes on a Confirmed event", () => {
    const toYes = () =>
      pendingRequest([
        { fieldName: "registrationRequired", oldValue: "false", newValue: "true", isMajor: false },
      ]);
    const confirmedWith = (times: { startAt: Date; registrationClosesAt: Date | null }) =>
      tx.event.findUniqueOrThrow
        .mockResolvedValueOnce(eventNow("CONFIRMED"))
        .mockResolvedValueOnce(times);
    const closingNotice = (showFromAt: Date) =>
      ["usr_org", "usr_coord"].map((userId) => ({
        userId,
        type: "EVENT_STATUS_CHANGED",
        eventId: "evt1",
        title: "Registration closed",
        message: expect.stringMatching(/^Registration for "Concert" closed at .+\.$/),
        showFromAt,
      }));

    beforeEach(() => {
      tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(toYes());
    });

    it("SCRUM-128 [AC11] TC-128-16: registration opens as confirming would open it (SCRUM-75 AC4), and its Registration closed notice is written for the event's start", async () => {
      const startAt = new Date("2099-03-01T02:00:00.000Z");
      confirmedWith({ startAt, registrationClosesAt: null });

      expect(
        await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
      ).toEqual({ ok: true, data: { decision: "APPROVED", returnedToPlanning: false } });
      expect(tx.event.update.mock.calls[0][0].data).toMatchObject({
        registrationRequired: true,
        registrationEnabled: true,
      });
      expect(tx.event.update.mock.calls[0][0].data).not.toHaveProperty("status");
      expect(tx.notification.createMany).toHaveBeenCalledWith({ data: closingNotice(startAt) });
    });

    it("SCRUM-128 [AC11] TC-128-16: with a window closing before the start, the notice is for the window's close; with the close already past, none is written", async () => {
      const startAt = new Date("2099-03-01T02:00:00.000Z");
      const windowCloses = new Date("2099-02-20T02:00:00.000Z");
      confirmedWith({ startAt, registrationClosesAt: windowCloses });
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });
      expect(tx.notification.createMany).toHaveBeenCalledWith({ data: closingNotice(windowCloses) });

      tx.notification.createMany.mockClear();
      confirmedWith({ startAt, registrationClosesAt: new Date("2000-01-01T00:00:00.000Z") });
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });
      expect(tx.event.update.mock.lastCall![0].data).toMatchObject({ registrationEnabled: true });
      expect(tx.notification.createMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ title: "Registration closed" })]) }),
      );
    });

    it("SCRUM-128 [AC11] TC-128-16: an event that isn't Confirmed opens registration when it is confirmed, so nothing opens now", async () => {
      tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("PLANNING"));

      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });

      expect(tx.event.update.mock.calls[0][0].data).not.toHaveProperty("registrationEnabled");
      expect(tx.notification.createMany).not.toHaveBeenCalled();
    });
  });

  it("SCRUM-128 [AC11], SCRUM-45 [AC5]: turning registration off on a Confirmed event withdraws its notice but doesn't say the event is back in Planning, since it isn't", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("CONFIRMED"));
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(
      pendingRequest([
        { fieldName: "registrationRequired", oldValue: "true", newValue: "false", isMajor: false },
      ]),
    );
    tx.registration.count.mockResolvedValue(0);

    await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });

    expect(tx.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ title: "Registration closed" }) }),
    );
    expect(tx.notification.createMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ title: "Your event is back in Planning" }),
        ]),
      }),
    );
  });

  it("SCRUM-128 [AC2] TC-128-15: a requested start that has passed while the request waited is refused, and nothing is written; a future one is applied", async () => {
    const startAt = (iso: string) => ({ fieldName: "startAt", oldValue: "2031-01-01T02:00:00.000Z", newValue: iso, isMajor: true });
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(pendingRequest([startAt("2020-01-01T02:00:00.000Z")]));

    expect(await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" })).toEqual({
      ok: false,
      error:
        "The start can't be in the past. The requested start has passed, so reject this request and the organiser can ask for a new date.",
    });
    expectNothingWritten();

    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(pendingRequest([startAt("2031-01-01T03:00:00.000Z")]));
    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toMatchObject({ ok: true });
  });

  it("SCRUM-128 [AC2] TC-128-17: a requested end that is no longer after the start, because the start moved while the request waited, is refused and nothing is written", async () => {
    // The event now starts at 05:00; the request only moves the end, to 03:00.
    tx.event.findUniqueOrThrow.mockResolvedValue({
      ...eventNow(),
      startAt: new Date("2031-01-01T05:00:00.000Z"),
    });
    const endAt = (iso: string) => ({ fieldName: "endAt", oldValue: "2031-01-01T06:00:00.000Z", newValue: iso, isMajor: true });
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(pendingRequest([endAt("2031-01-01T03:00:00.000Z")]));

    const refused = {
      ok: false,
      error:
        "The event's times changed after this request was raised, so it would now end before it starts. Reject it and the organiser can ask for new times.",
    };
    expect(await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" })).toEqual(refused);
    expectNothingWritten();

    // An end equal to the start is refused too; one minute after it is applied.
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(pendingRequest([endAt("2031-01-01T05:00:00.000Z")]));
    expect(await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" })).toEqual(refused);
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(pendingRequest([endAt("2031-01-01T05:01:00.000Z")]));
    expect(await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" })).toMatchObject({ ok: true });
  });

  it("SCRUM-128 [AC2] TC-128-17: a requested start judged against the end the event has now", async () => {
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(
      pendingRequest([{ fieldName: "startAt", oldValue: "2031-01-01T02:00:00.000Z", newValue: "2031-01-01T07:00:00.000Z", isMajor: true }]),
    );

    expect((await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" })).ok).toBe(false);
    expectNothingWritten();
  });

  it("SCRUM-128 [AC4, AC8] TC-128-07: approving refreshes every page it can change: flagged or released bookings and equipment, as SCRUM-25's edit and SCRUM-82's Cancel do", async () => {
    await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" });

    for (const path of ["/events", "/registrations", "/bookings", "/equipment", "/equipment-requests", "/venues/availability"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("SCRUM-128 [AC8] TC-128-07: approving a cancellation request marks it Approved first, then cancels the event with the Organiser's reason", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("CONFIRMED"));
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue(pendingRequest([], true));
    const order: string[] = [];
    tx.eventChangeRequest.update.mockImplementation(() => order.push("approved"));
    mockCancel.mockImplementation(() => order.push("cancelled"));

    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toEqual({ ok: true, data: { decision: "APPROVED", returnedToPlanning: false } });
    expect(mockCancel).toHaveBeenCalledWith(tx, {
      eventId: "evt1",
      name: "Concert",
      organiserId: "usr_org",
      fromStatus: "CONFIRMED",
      actorId: "usr_coord",
      reason: "The sponsor pulled out.",
    });
    expect(order).toEqual(["approved", "cancelled"]);
    expect(tx.event.update).not.toHaveBeenCalled();
    expect(tx.registration.count).not.toHaveBeenCalled();
  });
});

describe("decideChangeRequest — rejecting (SCRUM-128 AC3)", () => {
  it("SCRUM-128 [AC3, AC10] TC-128-03: rejecting with a reason leaves the event unchanged, marks the request Rejected and tells the Organiser why", async () => {
    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "REJECTED", reason: "No bigger room." }),
    ).toEqual({ ok: true, data: { decision: "REJECTED", returnedToPlanning: false } });
    expect(tx.eventChangeRequest.update).toHaveBeenCalledWith({
      where: { id: "cr1" },
      data: {
        decidedById: "usr_coord",
        decidedAt: expect.any(Date),
        status: "REJECTED",
        decisionReason: "No bigger room.",
      },
    });
    expect(tx.event.update).not.toHaveBeenCalled();
    expect(mockFlag).not.toHaveBeenCalled();
    expect(tx.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: "usr_org",
      title: "Change request rejected",
      message: 'Your change request for "Concert" was rejected: No bigger room.',
    });
  });

  it("SCRUM-128 [AC3] TC-128-03: a blank or missing reason is refused before anything is read", async () => {
    for (const reason of [undefined, "", "   "]) {
      expect(
        await decideChangeRequest({ changeRequestId: "cr1", decision: "REJECTED", reason }),
      ).toEqual({
        ok: false,
        error: "A reason is required to reject a change request.",
        fieldErrors: { reason: ["A reason is required to reject a change request."] },
      });
    }
    expect(await decideChangeRequest({ changeRequestId: "cr1", decision: "MAYBE" })).toEqual({
      ok: false,
      error: "Please choose Approve or Reject.",
    });
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("decideChangeRequest — who and when (SCRUM-128 AC9)", () => {
  it("SCRUM-128 [AC9] TC-128-08: anyone but the event's assigned Coordinator is refused before anything is written", async () => {
    for (const role of ["ORGANISER", "VENUE_STAFF", "SAFETY_OFFICER", "ATTENDEE"] as Role[]) {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_x"));
      expect(
        await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
      ).toEqual({ ok: false, error: "You do not have permission to do that." });
    }
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockRequest.mockResolvedValue({
      eventId: "evt1",
      event: { organiserId: "usr_org", coordinatorId: "usr_other", status: "PLANNING" },
    });
    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toEqual({ ok: false, error: "Change request not found." });
    mockRequest.mockResolvedValue(null);
    expect(
      await decideChangeRequest({ changeRequestId: "cr_x", decision: "APPROVED" }),
    ).toEqual({ ok: false, error: "Change request not found." });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-128 [AC9] TC-128-08: an event reassigned before the lock is refused with nothing written", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("PLANNING", "usr_other"));

    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toEqual({ ok: false, error: "This event was updated by another user. Refresh and try again." });
    expectNothingWritten();
  });

  it("SCRUM-128 [AC2] TC-128-10: a request already decided keeps its decision, and nothing is written", async () => {
    tx.eventChangeRequest.findUniqueOrThrow.mockResolvedValue({ ...pendingRequest(), status: "REJECTED" });

    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toEqual({ ok: false, error: "This change request is already Rejected; nothing was changed." });
    expectNothingWritten();
  });

  it("SCRUM-128 [AC2] TC-128-10: an event that has since been cancelled or completed can't take the change", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(eventNow("COMPLETED"));

    expect(
      await decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).toEqual({
      ok: false,
      error: "This event can no longer be changed, so the request can't be applied.",
    });
    expectNothingWritten();
  });

  it("does not swallow an unexpected database error", async () => {
    mockTransaction.mockRejectedValue(new Error("connection lost"));
    await expect(
      decideChangeRequest({ changeRequestId: "cr1", decision: "APPROVED" }),
    ).rejects.toThrow("connection lost");
  });
});

describe("getChangeDecision — SCRUM-128 AC1", () => {
  const eventRow = (over: Record<string, unknown> = {}) => ({
    expectedAttendance: 40,
    description: "Old",
    organiserId: "usr_org",
    coordinatorId: "usr_coord",
    status: "PLANNING",
    changeRequests: [
      { id: "cr1", requestsCancellation: false, fields: [ATTENDANCE, DESCRIPTION] },
    ],
    equipmentRequests: [{ status: "IN_REVIEW" }],
    ...over,
  });

  it("SCRUM-128 [AC1] TC-128-01: shows each changed field's current and requested value, and every arrangement the impactful change could affect", async () => {
    mockEvent.mockResolvedValue(eventRow());
    mockFlaggable.mockResolvedValue([
      { kind: "booking", id: "b1", label: "Exhibition Hall (Approved)" },
      { kind: "booking", id: "b2", label: "Seminar Room 2.1 (Held)" },
      { kind: "reservation", id: "r1", label: "Projector × 2" },
    ]);

    expect(await getChangeDecision("evt1")).toEqual({
      ok: true,
      data: {
        changeRequestId: "cr1",
        requestsCancellation: false,
        impactful: true,
        fields: [
          { fieldName: "expectedAttendance", current: "40", requested: "80" },
          { fieldName: "description", current: "Old", requested: "New" },
        ],
        affected: [
          "Exhibition Hall (Approved)",
          "Seminar Room 2.1 (Held)",
          "Projector × 2",
          "Equipment request (In Review)",
        ],
      },
    });
    expect(mockFlaggable).toHaveBeenCalledWith(prisma, "evt1");
    const { select } = mockEvent.mock.calls[0][0];
    expect(select.changeRequests.where).toEqual({ status: "PENDING_REVIEW" });
    expect(select.equipmentRequests.where).toEqual({
      status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] },
    });
  });

  it("SCRUM-128 [AC1, AC8] TC-128-01: a cancellation request lists everything it would release; a change that isn't impactful lists nothing", async () => {
    mockFlaggable.mockResolvedValue([{ kind: "booking", id: "b1", label: "Exhibition Hall (Approved)" }]);
    mockEvent.mockResolvedValue(
      eventRow({ changeRequests: [{ id: "cr2", requestsCancellation: true, fields: [] }], equipmentRequests: [] }),
    );
    expect(await getChangeDecision("evt1")).toMatchObject({
      ok: true,
      data: { requestsCancellation: true, impactful: false, affected: ["Exhibition Hall (Approved)"] },
    });

    mockFlaggable.mockClear();
    mockEvent.mockResolvedValue(
      eventRow({ changeRequests: [{ id: "cr3", requestsCancellation: false, fields: [DESCRIPTION] }] }),
    );
    expect(await getChangeDecision("evt1")).toMatchObject({ ok: true, data: { affected: [] } });
    expect(mockFlaggable).not.toHaveBeenCalled();
  });

  it("SCRUM-128 [AC1] TC-128-01: nothing awaits a decision once no request is Submitted", async () => {
    mockEvent.mockResolvedValue(eventRow({ changeRequests: [] }));

    expect(await getChangeDecision("evt1")).toEqual({ ok: true, data: null });
  });

  it("SCRUM-128 [AC1, AC2] TC-128-01: a Submitted request on an event that is now Completed or Cancelled isn't offered for a decision, since it can't be applied", async () => {
    for (const status of ["COMPLETED", "CANCELLED"]) {
      mockEvent.mockResolvedValue(eventRow({ status }));
      expect(await getChangeDecision("evt1")).toEqual({ ok: true, data: null });
    }
  });

  it("SCRUM-128 [AC9] TC-128-08: anyone but the assigned Coordinator, a missing event or no session gets not found", async () => {
    mockEvent.mockResolvedValue(eventRow({ coordinatorId: "usr_other" }));
    expect(await getChangeDecision("evt1")).toEqual({ ok: false, error: "Event not found." });

    mockEvent.mockResolvedValue(eventRow());
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org"));
    expect(await getChangeDecision("evt1")).toMatchObject({ ok: false });

    mockAuth.mockResolvedValue(null);
    expect(await getChangeDecision("evt1")).toMatchObject({ ok: false });

    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockEvent.mockResolvedValue(null);
    expect(await getChangeDecision("evt_x")).toMatchObject({ ok: false });
  });
});
