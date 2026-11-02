import { describe, it, expect, vi, afterEach, type Mock } from "vitest";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { cancelEvent } from "@/app/(app)/events/cancel-actions";
import { decideChangeRequest } from "@/app/(app)/events/change-decision-actions";
import { resolveReconsiderationFlag } from "@/app/(app)/events/reconsideration-actions";
import { getAllEvents, getEventForPlanning } from "@/app/(app)/all-events/queries";
import { completeIfTakenPlace, EVENT_TOOK_PLACE } from "@/lib/event-closing";

// SCRUM-262 — an event that has taken place is Completed, never cancelled or
// sent back to Planning, and All Events shows it as Completed. Against real
// Postgres, so only on a local database (README, "Local database (Docker)").
// Test cases: docs/testing/SCRUM-262.md.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const signIn = (id: string, role: Role) =>
  (auth as unknown as Mock).mockResolvedValue({
    user: { id, role, name: id, email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  });

const HOUR = 60 * 60 * 1000;
const events: string[] = [];

/** A Confirmed event of Cody's that ended `endedAgo` ms ago (or ends `-endedAgo` from now). */
async function confirmedEvent(endedAgo: number) {
  const endAt = new Date(Date.now() - endedAgo);
  const row = await prisma.event.create({
    data: {
      name: `SCRUM-262 ${Date.now()} ${events.length}`,
      status: "CONFIRMED",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      expectedAttendance: 20,
      startAt: new Date(endAt.getTime() - 2 * HOUR),
      endAt,
    },
    select: { id: true, endAt: true },
  });
  events.push(row.id);
  return row;
}

const statusOf = async (id: string) =>
  (await prisma.event.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

const historyOf = (entityId: string) =>
  prisma.auditLog.findMany({ where: { entityId }, select: { action: true, newValue: true, summary: true } });

describe.skipIf(!usesLocalDatabase)("SCRUM-262 — an event that has taken place", () => {
  afterEach(async () => {
    const requests = await prisma.eventChangeRequest.findMany({ where: { eventId: { in: events } }, select: { id: true } });
    const reservations = await prisma.reservation.findMany({ where: { eventId: { in: events } }, select: { id: true } });
    const ids = [...events, ...requests.map((r) => r.id), ...reservations.map((r) => r.id)];
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { eventId: { in: events } } });
    await prisma.changeRequestField.deleteMany({ where: { changeRequestId: { in: requests.map((r) => r.id) } } });
    await prisma.eventChangeRequest.deleteMany({ where: { eventId: { in: events } } });
    await prisma.reservation.deleteMany({ where: { eventId: { in: events } } });
    await prisma.event.deleteMany({ where: { id: { in: events } } });
    events.length = 0;
  });

  it("SCRUM-262 [AC1, AC3] TC-262-01: cancelling an event that has taken place is refused, and the event is saved as Completed", async () => {
    const { id } = await confirmedEvent(3 * 24 * HOUR);
    signIn("usr_coordinator", "COORDINATOR");

    expect(await cancelEvent({ eventId: id, reason: "Too late." })).toEqual({
      ok: false,
      error: EVENT_TOOK_PLACE,
    });
    expect(await statusOf(id)).toBe("COMPLETED");
    const history = await historyOf(id);
    expect(history).toEqual([
      expect.objectContaining({ action: "STATUS_CHANGED", newValue: "COMPLETED" }),
    ]);
  });

  it("SCRUM-262 [AC4] TC-262-02: at exactly its end the event is still Confirmed; one millisecond later it has taken place", async () => {
    const { id, endAt } = await confirmedEvent(HOUR);

    const atEnd = await prisma.$transaction((tx) => completeIfTakenPlace(tx, id, endAt!));
    expect(atEnd).toBe(false);
    expect(await statusOf(id)).toBe("CONFIRMED");

    const justAfter = await prisma.$transaction((tx) =>
      completeIfTakenPlace(tx, id, new Date(endAt!.getTime() + 1)),
    );
    expect(justAfter).toBe(true);
    expect(await statusOf(id)).toBe("COMPLETED");
  });

  it("SCRUM-262 [AC4] TC-262-02: an event that hasn't ended can still be cancelled", async () => {
    const { id } = await confirmedEvent(-HOUR);
    signIn("usr_coordinator", "COORDINATOR");

    expect(await cancelEvent({ eventId: id, reason: "Venue flooded." })).toEqual({
      ok: true,
      data: { status: "CANCELLED" },
    });
    expect(await statusOf(id)).toBe("CANCELLED");
  });

  it("SCRUM-262 [AC2, AC3] TC-262-03: a change request for an event that has taken place is rejected as taken place, not applied", async () => {
    const { id } = await confirmedEvent(3 * 24 * HOUR);
    const request = await prisma.eventChangeRequest.create({
      data: {
        eventId: id,
        requestedById: "usr_organiser",
        reason: "Move it a day later.",
        fields: {
          create: [{ fieldName: "expectedAttendance", oldValue: "20", newValue: "30", isMajor: true }],
        },
      },
      select: { id: true },
    });
    signIn("usr_coordinator", "COORDINATOR");

    expect(await decideChangeRequest({ changeRequestId: request.id, decision: "APPROVED" })).toEqual({
      ok: false,
      error: EVENT_TOOK_PLACE,
    });
    expect(await statusOf(id)).toBe("COMPLETED");
    expect(
      await prisma.eventChangeRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: { status: true, decisionReason: true },
      }),
    ).toEqual({ status: "REJECTED", decisionReason: EVENT_TOOK_PLACE });
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id }, select: { expectedAttendance: true } }))
        .expectedAttendance,
    ).toBe(20);
  });

  it("SCRUM-262 [AC2, AC3] TC-262-04: a flagged reservation on an event that has taken place is left as it is, and the event never returns to Planning", async () => {
    const { id } = await confirmedEvent(3 * 24 * HOUR);
    const event = await prisma.event.findUniqueOrThrow({ where: { id }, select: { startAt: true, endAt: true } });
    const reservation = await prisma.reservation.create({
      data: {
        eventId: id,
        equipmentId: "eqp_projector",
        quantity: 1,
        startAt: event.startAt!,
        endAt: event.endAt!,
        reservedById: "usr_techsupport",
        needsReconsideration: true,
        reconsiderationFlaggedAt: new Date(),
        reconsiderationReason: "Two projectors failed their safety test.",
      },
      select: { id: true },
    });
    signIn("usr_coordinator", "COORDINATOR");

    expect(
      await resolveReconsiderationFlag({ kind: "reservation", id: reservation.id, decision: "CANCEL" }),
    ).toEqual({ ok: false, error: EVENT_TOOK_PLACE });
    expect(await statusOf(id)).toBe("COMPLETED");
    expect(
      await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: { status: true, needsReconsideration: true },
      }),
    ).toEqual({ status: "CONFIRMED", needsReconsideration: true });
  });

  it("SCRUM-262 [AC5] TC-262-05: All Events lists and opens an event that has taken place as Completed, and the Completed filter finds it", async () => {
    const { id } = await confirmedEvent(3 * 24 * HOUR);
    signIn("usr_coordinatorlead", "COORDINATOR_LEAD");

    const all = (await getAllEvents({ unassigned: false }))!.events;
    const listed = all.find((event) => event.id === id);
    expect(listed?.status).toBe("COMPLETED");
    const filtered = (await getAllEvents({ status: "COMPLETED", unassigned: false }))!.events.map((event) => event.id);
    expect(filtered).toContain(id);
    expect((await getEventForPlanning(id))?.event.status).toBe("COMPLETED");
  });
});
