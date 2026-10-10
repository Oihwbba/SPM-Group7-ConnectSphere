import { describe, it, expect, afterAll, afterEach, vi, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getChangeRequestsForEvent,
  raiseChangeRequest,
} from "@/app/(app)/events/change-request-actions";
import { transitionEventStatus } from "@/app/(app)/events/actions";

// SCRUM-41 — raising a change request against a real database: the lock and
// the partial unique index behind "at most one Submitted request" (AC7), the
// rejection that closes it (AC8), and the clarification it defers to (AC3).
// Test cases: docs/testing/SCRUM-41.md. The second seeded Organiser and
// Coordinator are used so nothing here moves another suite's rows.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ORGANISER = "usr_organiser_2";
const COORDINATOR = "usr_coordinator_2";

const session = (id: string, role: "ORGANISER" | "COORDINATOR"): Session => ({
  user: { id, role, name: id, email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const signInAs = (id: string, role: "ORGANISER" | "COORDINATOR") =>
  (auth as unknown as Mock).mockResolvedValue(session(id, role));

const START = new Date("2032-05-01T01:00:00Z");
const END = new Date("2032-05-01T09:00:00Z");

const created: string[] = [];

async function eventIn(status: EventStatus) {
  const { id } = await prisma.event.create({
    data: {
      name: `SCRUM-41 ${status} ${Date.now()}`,
      status,
      organiserId: ORGANISER,
      coordinatorId: COORDINATOR,
      submittedAt: new Date(),
      startAt: START,
      endAt: END,
      expectedAttendance: 40,
      description: "Booths and talks.",
    },
    select: { id: true },
  });
  created.push(id);
  return id;
}

describe.skipIf(!usesLocalDatabase)("SCRUM-41 — raise and track a change request", () => {
  afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: created } } });
    await prisma.notification.deleteMany({ where: { eventId: { in: created } } });
    await prisma.clarificationRequest.deleteMany({ where: { eventId: { in: created } } });
    await prisma.eventChangeRequest.deleteMany({ where: { eventId: { in: created } } });
    await prisma.event.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("SCRUM-41 [AC1, AC5, AC6] TC-41-01: the request is Submitted with its old and new values, and the event keeps its own", async () => {
    signInAs(ORGANISER, "ORGANISER");
    const eventId = await eventIn("PLANNING");

    const result = await raiseChangeRequest({
      eventId,
      changes: { expectedAttendance: 60, description: "Booths, talks and a panel." },
    });

    expect(result.ok).toBe(true);
    const request = await prisma.eventChangeRequest.findFirstOrThrow({
      where: { eventId },
      include: { fields: { orderBy: { fieldName: "asc" } } },
    });
    expect(request).toMatchObject({
      status: "PENDING_REVIEW",
      requestedById: ORGANISER,
      requestsCancellation: false,
    });
    expect(
      request.fields.map(({ fieldName, oldValue, newValue, isMajor }) => ({
        fieldName,
        oldValue,
        newValue,
        isMajor,
      })),
    ).toEqual([
      {
        fieldName: "description",
        oldValue: "Booths and talks.",
        newValue: "Booths, talks and a panel.",
        isMajor: false,
      },
      { fieldName: "expectedAttendance", oldValue: "40", newValue: "60", isMajor: true },
    ]);
    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { expectedAttendance: true, description: true, status: true },
      }),
    ).toEqual({ expectedAttendance: 40, description: "Booths and talks.", status: "PLANNING" });
  });

  it("SCRUM-41 [AC7] TC-41-10: a second request is refused while one is Submitted, and allowed once that one is decided", async () => {
    signInAs(ORGANISER, "ORGANISER");
    const eventId = await eventIn("CONFIRMED");
    await raiseChangeRequest({ eventId, changes: { expectedAttendance: 60 } });

    const second = await raiseChangeRequest({
      eventId,
      requestsCancellation: true,
      reason: "The sponsor withdrew.",
    });

    expect(second).toEqual({
      ok: false,
      error:
        "This event already has a change request waiting for a decision. It's shown below.",
    });
    expect(await prisma.eventChangeRequest.count({ where: { eventId } })).toBe(1);

    await prisma.eventChangeRequest.updateMany({
      where: { eventId },
      data: { status: "REJECTED", decisionReason: "Not this time." },
    });
    const third = await raiseChangeRequest({
      eventId,
      requestsCancellation: true,
      reason: "The sponsor withdrew.",
    });
    expect(third.ok).toBe(true);
    expect(await prisma.eventChangeRequest.count({ where: { eventId } })).toBe(2);
  });

  it("SCRUM-41 [AC7] TC-41-11: of two requests raised at the same moment, exactly one is created", async () => {
    signInAs(ORGANISER, "ORGANISER");
    const eventId = await eventIn("PLANNING");

    const results = await Promise.all([
      raiseChangeRequest({ eventId, changes: { expectedAttendance: 60 } }),
      raiseChangeRequest({ eventId, changes: { expectedAttendance: 70 } }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({
      ok: false,
      error:
        "This event already has a change request waiting for a decision. It's shown below.",
    });
    expect(await prisma.eventChangeRequest.count({ where: { eventId } })).toBe(1);
  });

  it("SCRUM-41 [AC7] TC-41-11: the database itself refuses a second Submitted request for an event", async () => {
    const eventId = await eventIn("PLANNING");
    await prisma.eventChangeRequest.create({ data: { eventId, requestedById: ORGANISER } });

    await expect(
      prisma.eventChangeRequest.create({ data: { eventId, requestedById: ORGANISER } }),
    ).rejects.toThrow();
    expect(await prisma.eventChangeRequest.count({ where: { eventId } })).toBe(1);
  });

  it("SCRUM-41 [AC1] TC-41-03: the database refuses a cancellation request without a reason", async () => {
    const eventId = await eventIn("PLANNING");

    for (const reason of [null, "   "]) {
      await expect(
        prisma.eventChangeRequest.create({
          data: { eventId, requestedById: ORGANISER, requestsCancellation: true, reason },
        }),
      ).rejects.toThrow(/event_change_request_cancellation_has_reason/);
    }
    expect(await prisma.eventChangeRequest.count({ where: { eventId } })).toBe(0);
  });

  it("SCRUM-41 [AC8] TC-41-12: rejecting an event Under Review rejects its Submitted change request with the event's reason", async () => {
    signInAs(ORGANISER, "ORGANISER");
    const eventId = await eventIn("UNDER_REVIEW");
    await raiseChangeRequest({ eventId, changes: { expectedAttendance: 60 } });

    signInAs(COORDINATOR, "COORDINATOR");
    const rejected = await transitionEventStatus({
      eventId,
      nextStatus: "REJECTED",
      decisionReason: "No venue can take this event.",
      rejectionOutcome: "NEW_REQUEST",
    });

    expect(rejected.ok).toBe(true);
    expect(
      await prisma.eventChangeRequest.findFirstOrThrow({
        where: { eventId },
        select: { status: true, decisionReason: true, decidedById: true },
      }),
    ).toEqual({
      status: "REJECTED",
      decisionReason: "No venue can take this event.",
      decidedById: COORDINATOR,
    });
  });

  it("SCRUM-41 [AC3] TC-41-06: a field the open clarification names is refused, and one it doesn't name is accepted", async () => {
    signInAs(ORGANISER, "ORGANISER");
    const eventId = await eventIn("UNDER_REVIEW");
    await prisma.clarificationRequest.create({
      data: {
        eventId,
        requestedById: COORDINATOR,
        message: "How many attendees now?",
        editableFields: ["expectedAttendance"],
      },
    });

    const covered = await raiseChangeRequest({ eventId, changes: { expectedAttendance: 60 } });
    expect(covered).toEqual({
      ok: false,
      error:
        "The open clarification request covers Expected attendance, so change it in the answer to it instead.",
    });
    expect(await prisma.eventChangeRequest.count({ where: { eventId } })).toBe(0);

    const other = await raiseChangeRequest({ eventId, changes: { description: "Booths only." } });
    expect(other.ok).toBe(true);
  });

  it("SCRUM-41 [AC6, AC9] TC-41-13: the assigned Coordinator's request is shown to the Organiser as raised for them", async () => {
    signInAs(COORDINATOR, "COORDINATOR");
    const eventId = await eventIn("PLANNING");
    const raised = await raiseChangeRequest({
      eventId,
      changes: { expectedAttendance: 55 },
      reason: "Agreed with the organiser by phone.",
    });
    expect(raised.ok).toBe(true);

    signInAs(ORGANISER, "ORGANISER");
    const { name } = await prisma.user.findUniqueOrThrow({
      where: { id: ORGANISER },
      select: { name: true },
    });
    const listed = await getChangeRequestsForEvent(eventId);

    expect(listed.ok && listed.data.canRaise).toBe(false);
    expect(listed.ok && listed.data.requests).toEqual([
      expect.objectContaining({
        status: "PENDING_REVIEW",
        reason: "Agreed with the organiser by phone.",
        raisedFor: name,
      }),
    ]);
  });
});
