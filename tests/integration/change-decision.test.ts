import { describe, it, expect, afterAll, afterEach, vi, type Mock } from "vitest";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { decideChangeRequest } from "@/app/(app)/events/change-decision-actions";
import { raiseChangeRequest } from "@/app/(app)/events/change-request-actions";

// SCRUM-128 — deciding a change request against a real database: all of an
// approval or none of it, flags and an outdated safety check on an impactful
// change, a cancellation request, and two decisions at the same moment.
// Test cases: docs/testing/SCRUM-128.md.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const asCoordinator = () =>
  (auth as unknown as Mock).mockResolvedValue({
    user: { id: "usr_coordinator", role: "COORDINATOR", name: "Cody", email: "coordinator@test.local" },
    expires: "2999-01-01T00:00:00.000Z",
  });

// One day per test, far enough ahead that nothing seeded overlaps it.
const day = (n: number) => ({
  startAt: new Date(`2033-01-${String(n).padStart(2, "0")}T02:00:00Z`),
  endAt: new Date(`2033-01-${String(n).padStart(2, "0")}T06:00:00Z`),
});
const created: string[] = [];

async function confirmedEvent(n: number) {
  const event = await prisma.event.create({
    data: {
      name: `SCRUM-128 ${Date.now()} ${created.length}`,
      status: "CONFIRMED",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      expectedAttendance: 40,
      registrationEnabled: true,
      ...day(n),
    },
    select: { id: true },
  });
  created.push(event.id);
  return event.id;
}

async function changeRequest(
  eventId: string,
  fields: { fieldName: string; oldValue: string | null; newValue: string | null; isMajor: boolean }[],
  requestsCancellation = false,
) {
  const request = await prisma.eventChangeRequest.create({
    data: {
      eventId,
      requestedById: "usr_organiser",
      reason: requestsCancellation ? "The sponsor pulled out." : "Plans changed.",
      requestsCancellation,
      fields: { create: fields },
    },
    select: { id: true },
  });
  return request.id;
}

describe.skipIf(!usesLocalDatabase)("SCRUM-128 — deciding a change request", () => {
  afterEach(async () => {
    const bookings = await prisma.booking.findMany({
      where: { eventId: { in: created } },
      select: { id: true },
    });
    const requests = await prisma.eventChangeRequest.findMany({
      where: { eventId: { in: created } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: {
          in: [...created, ...bookings.map((b) => b.id), ...requests.map((r) => r.id)],
        },
      },
    });
    await prisma.notification.deleteMany({ where: { eventId: { in: created } } });
    await prisma.registration.deleteMany({ where: { eventId: { in: created } } });
    await prisma.booking.deleteMany({ where: { eventId: { in: created } } });
    await prisma.event.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("SCRUM-128 [AC2, AC4, AC5] TC-128-11: approving an impactful change to a Confirmed event applies it, flags the booking, outdates the safety check and returns the event to Planning, with registrations kept and its scheduled Registration closed notice withdrawn", async () => {
    const eventId = await confirmedEvent(3);
    const bookingId = (
      await prisma.booking.create({
        data: {
          eventId,
          venueId: "ven_hall",
          ...day(3),
          status: "APPROVED",
          requestedById: "usr_coordinator",
          decidedById: "usr_venuestaff",
          decidedAt: new Date(),
        },
        select: { id: true },
      })
    ).id;
    const check = await prisma.safetyCheck.create({
      data: {
        eventId,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_safetyofficer",
        decidedAt: new Date(),
      },
      select: { id: true },
    });
    await prisma.registration.create({ data: { eventId, userId: "usr_attendee" } });
    // Confirming wrote it ahead, to show when registration closes (SCRUM-45 AC11).
    await prisma.notification.create({
      data: {
        userId: "usr_organiser",
        type: "EVENT_STATUS_CHANGED",
        title: "Registration closed",
        message: "…",
        eventId,
        showFromAt: day(3).startAt,
      },
    });
    const requestId = await changeRequest(eventId, [
      { fieldName: "expectedAttendance", oldValue: "40", newValue: "90", isMajor: true },
    ]);
    asCoordinator();

    expect(
      await decideChangeRequest({ changeRequestId: requestId, decision: "APPROVED" }),
    ).toEqual({ ok: true, data: { decision: "APPROVED", returnedToPlanning: true } });

    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      expectedAttendance: 90,
      status: "PLANNING",
    });
    expect(
      await prisma.eventChangeRequest.findUniqueOrThrow({ where: { id: requestId } }),
    ).toMatchObject({ status: "APPROVED", decidedById: "usr_coordinator" });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).toMatchObject({
      status: "APPROVED",
      needsReconsideration: true,
      reconsiderationReason: "Change approved: Expected attendance.",
    });
    expect((await prisma.safetyCheck.findUniqueOrThrow({ where: { id: check.id } })).status).toBe(
      "OUTDATED",
    );
    // AC5: existing registrations stay Registered.
    expect((await prisma.registration.findFirstOrThrow({ where: { eventId } })).status).toBe(
      "REGISTERED",
    );
    expect(
      await prisma.notification.count({
        where: { eventId, title: "Registration closed", withdrawnAt: null },
      }),
    ).toBe(0);
  });

  it("SCRUM-128 [AC2] TC-128-12: if applying fails, neither the event nor the request is saved", async () => {
    const eventId = await confirmedEvent(4);
    // A start after the event's end breaks event_period_valid mid-apply.
    const requestId = await changeRequest(eventId, [
      { fieldName: "description", oldValue: null, newValue: "Changed", isMajor: false },
      { fieldName: "startAt", oldValue: null, newValue: "2033-01-05T02:00:00.000Z", isMajor: true },
    ]);
    asCoordinator();

    await expect(
      decideChangeRequest({ changeRequestId: requestId, decision: "APPROVED" }),
    ).rejects.toThrow();

    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      description: null,
      status: "CONFIRMED",
    });
    expect(
      (await prisma.eventChangeRequest.findUniqueOrThrow({ where: { id: requestId } })).status,
    ).toBe("PENDING_REVIEW");
  });

  it("SCRUM-128 [AC7] TC-128-06: lowering the attendance below the active registrations is refused and nothing changes", async () => {
    const eventId = await confirmedEvent(5);
    await prisma.registration.createMany({
      data: ["usr_attendee", "usr_attendee_2", "usr_attendee_3"].map((userId) => ({ eventId, userId })),
    });
    const requestId = await changeRequest(eventId, [
      { fieldName: "expectedAttendance", oldValue: "40", newValue: "2", isMajor: true },
    ]);
    asCoordinator();

    expect(
      await decideChangeRequest({ changeRequestId: requestId, decision: "APPROVED" }),
    ).toEqual({
      ok: false,
      error:
        "The expected attendance can't be lower than the 3 active registrations, so this change can't be approved.",
    });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).expectedAttendance).toBe(40);
  });

  it("SCRUM-41 [AC1] TC-41-18, SCRUM-171 [AC5] TC-171-09: a raised Registration needed No is refused while someone is registered, and applied as No once nobody is", async () => {
    const eventId = await confirmedEvent(8);
    await prisma.event.update({ where: { id: eventId }, data: { registrationRequired: true } });
    await prisma.registration.create({ data: { eventId, userId: "usr_attendee" } });
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_organiser", role: "ORGANISER", name: "Olivia", email: "organiser@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });
    const raised = await raiseChangeRequest({ eventId, changes: { registrationRequired: false } });
    if (!raised.ok) throw new Error(raised.error);
    asCoordinator();

    expect(
      await decideChangeRequest({ changeRequestId: raised.data.id, decision: "APPROVED" }),
    ).toEqual({
      ok: false,
      error: "This event has 1 active registration, so Registration needed can't be changed to No.",
    });
    const unchanged = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { registrationRequired: true },
    });
    expect(unchanged).toEqual({ registrationRequired: true });
    expect(
      (await prisma.eventChangeRequest.findUniqueOrThrow({ where: { id: raised.data.id } })).status,
    ).toBe("PENDING_REVIEW");

    await prisma.registration.updateMany({ where: { eventId }, data: { status: "WITHDRAWN" } });
    expect(
      await decideChangeRequest({ changeRequestId: raised.data.id, decision: "APPROVED" }),
    ).toMatchObject({ ok: true });
    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { registrationRequired: true, status: true },
      }),
    ).toEqual({ registrationRequired: false, status: "CONFIRMED" });
  });

  it("SCRUM-170 [AC4] TC-170-12: approving a change to the equipment requirements clears No equipment needed, who and when together", async () => {
    const eventId = await confirmedEvent(9);
    await prisma.event.update({
      where: { id: eventId },
      data: {
        status: "PLANNING",
        equipmentRequirements: "None",
        noEquipmentNeededAt: new Date(),
        noEquipmentNeededById: "usr_coordinator",
      },
    });
    const requestId = await changeRequest(eventId, [
      { fieldName: "equipmentRequirements", oldValue: "None", newValue: "Two microphones", isMajor: true },
    ]);
    asCoordinator();

    expect(
      await decideChangeRequest({ changeRequestId: requestId, decision: "APPROVED" }),
    ).toMatchObject({ ok: true });
    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { equipmentRequirements: true, noEquipmentNeededAt: true, noEquipmentNeededById: true },
      }),
    ).toEqual({ equipmentRequirements: "Two microphones", noEquipmentNeededAt: null, noEquipmentNeededById: null });
  });

  it("SCRUM-128 [AC8] TC-128-07: approving a cancellation request cancels the event with the Organiser's reason, and the request stays Approved", async () => {
    const eventId = await confirmedEvent(6);
    await prisma.registration.create({ data: { eventId, userId: "usr_attendee" } });
    const requestId = await changeRequest(eventId, [], true);
    asCoordinator();

    expect(
      await decideChangeRequest({ changeRequestId: requestId, decision: "APPROVED" }),
    ).toMatchObject({ ok: true });

    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      status: "CANCELLED",
      cancellationReason: "The sponsor pulled out.",
    });
    expect(
      (await prisma.eventChangeRequest.findUniqueOrThrow({ where: { id: requestId } })).status,
    ).toBe("APPROVED");
    expect((await prisma.registration.findFirstOrThrow({ where: { eventId } })).status).toBe(
      "CANCELLED",
    );
  });

  it("SCRUM-128 [AC2] TC-128-10: an approval and a rejection at the same moment leave one decision", async () => {
    const eventId = await confirmedEvent(7);
    const requestId = await changeRequest(eventId, [
      { fieldName: "description", oldValue: null, newValue: "Changed", isMajor: false },
    ]);
    asCoordinator();

    const results = await Promise.all([
      decideChangeRequest({ changeRequestId: requestId, decision: "APPROVED" }),
      decideChangeRequest({ changeRequestId: requestId, decision: "REJECTED", reason: "No." }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({
      error: expect.stringMatching(/^This change request is already (Approved|Rejected); nothing was changed\.$/),
    });
    expect(
      await prisma.auditLog.count({ where: { entityId: requestId, oldValue: "PENDING_REVIEW" } }),
    ).toBe(1);
  });
});
