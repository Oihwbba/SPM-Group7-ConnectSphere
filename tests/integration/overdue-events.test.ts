import { describe, it, expect, afterAll, afterEach, vi, type Mock } from "vitest";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  confirmEvent,
  rejectPlanningEvent,
  transitionEventStatus,
} from "@/app/(app)/events/actions";
import { cancelEvent } from "@/app/(app)/events/cancel-actions";

// SCRUM-249 — an overdue event can't be approved or confirmed, against a real
// database: what is left unwritten, that rejecting and cancelling still work,
// and that the check sees a start moved while it waits for the event's lock.
// Test cases: docs/testing/SCRUM-249.md.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const REFUSED = {
  ok: false,
  error: "This event is overdue: its start time has passed. It can be rejected or cancelled.",
  fieldErrors: undefined,
};

const HOUR_MS = 60 * 60 * 1000;
const PAST = { startAt: new Date("2001-03-05T02:00:00Z"), endAt: new Date("2001-03-05T06:00:00Z") };
const FUTURE = { startAt: new Date("2036-03-05T02:00:00Z"), endAt: new Date("2036-03-05T06:00:00Z") };

const created: string[] = [];

async function event(
  status: "UNDER_REVIEW" | "PLANNING",
  period: { startAt: Date; endAt: Date },
) {
  const { id } = await prisma.event.create({
    data: {
      name: `SCRUM-249 ${Date.now()} ${created.length}`,
      status,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      expectedAttendance: 40,
      registrationRequired: true,
      ...period,
    },
    select: { id: true },
  });
  created.push(id);
  return id;
}

/** A Planning event every checklist item is complete for (SCRUM-110, SCRUM-166). */
async function readyEvent(period: { startAt: Date; endAt: Date }) {
  const eventId = await event("PLANNING", period);
  await prisma.event.update({
    where: { id: eventId },
    data: { noEquipmentNeededAt: new Date(), noEquipmentNeededById: "usr_coordinator" },
  });
  await prisma.booking.create({
    data: {
      eventId,
      venueId: "ven_auditorium",
      ...period,
      status: "APPROVED",
      requestedById: "usr_coordinator",
      decidedById: "usr_venuestaff",
      decidedAt: new Date(),
    },
  });
  await prisma.safetyCheck.create({
    data: {
      eventId,
      status: "APPROVED",
      requestedById: "usr_coordinator",
      decidedById: "usr_safetyofficer",
      decidedAt: new Date(),
    },
  });
  return eventId;
}

const written = async (eventId: string) => ({
  audit: await prisma.auditLog.count({ where: { entityId: eventId } }),
  notifications: await prisma.notification.count({ where: { eventId } }),
});

/** Runs an action while another transaction, which moves the start, holds the lock. */
async function raceAgainstStartMovedTo(
  eventId: string,
  startAt: Date,
  action: () => Promise<unknown>,
) {
  let commit!: () => void;
  const committed = new Promise<void>((resolve) => (commit = resolve));
  let lockHeld!: () => void;
  const held = new Promise<void>((resolve) => (lockHeld = resolve));
  const moving = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      await tx.event.update({
        where: { id: eventId },
        data: { startAt, endAt: new Date(startAt.getTime() + HOUR_MS) },
      });
      lockHeld();
      await committed;
    },
    { timeout: 15_000 },
  );
  await held;

  const acting = action();
  // Commit only once the action waits on the lock, so the test proves the check
  // made under the lock, not a read made before it.
  const waitingOnLock = async () =>
    (
      await prisma.$queryRaw<{ waiting: number }[]>`
        SELECT count(*)::int AS waiting FROM pg_locks WHERE NOT granted`
    )[0].waiting > 0;
  try {
    for (let tries = 0; !(await waitingOnLock()); tries++) {
      if (tries > 60) throw new Error("the action never waited for the event lock");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } finally {
    commit();
    await moving;
  }
  return acting;
}

describe.skipIf(!usesLocalDatabase)("SCRUM-249 — an overdue event", () => {
  afterEach(async () => {
    const eventId = { in: created };
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.booking.deleteMany({ where: { eventId } });
    await prisma.safetyCheck.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    created.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const asCoordinator = () =>
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_coordinator", role: "COORDINATOR", name: "Cody", email: "coordinator@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });

  it("SCRUM-249 [AC1] TC-249-01: approving an overdue request is refused, and it stays Under Review with nothing written", async () => {
    asCoordinator();
    const eventId = await event("UNDER_REVIEW", PAST);
    const openQuestion = await prisma.clarificationRequest.create({
      data: { eventId, requestedById: "usr_coordinator", message: "Which hall?" },
    });

    expect(await transitionEventStatus({ eventId, nextStatus: "APPROVED" })).toEqual(REFUSED);

    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { status: true, decidedAt: true, decidedById: true },
      }),
    ).toEqual({ status: "UNDER_REVIEW", decidedAt: null, decidedById: null });
    expect(await written(eventId)).toEqual({ audit: 0, notifications: 0 });
    expect(
      await prisma.clarificationRequest.findUniqueOrThrow({
        where: { id: openQuestion.id },
        select: { status: true },
      }),
    ).toEqual({ status: "OPEN" });
    await prisma.clarificationRequest.delete({ where: { id: openQuestion.id } });
  });

  it("SCRUM-249 [AC1] TC-249-02: rejecting an overdue request still works", async () => {
    asCoordinator();
    const eventId = await event("UNDER_REVIEW", PAST);

    expect(
      await transitionEventStatus({
        eventId,
        nextStatus: "REJECTED",
        decisionReason: "Its date has passed.",
        rejectionOutcome: "NEW_REQUEST",
      }),
    ).toEqual({ ok: true, data: { status: "REJECTED" } });

    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { status: true, decisionReason: true },
      }),
    ).toEqual({ status: "REJECTED", decisionReason: "Its date has passed." });
  });

  it("SCRUM-249 [AC2] TC-249-03: confirming an overdue event that is otherwise ready is refused, and it stays in Planning with nothing written", async () => {
    asCoordinator();
    const eventId = await readyEvent(PAST);

    expect(await confirmEvent({ eventId })).toEqual(REFUSED);

    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          status: true,
          registrationEnabled: true,
          confirmedStartAt: true,
          confirmedVenues: true,
        },
      }),
    ).toEqual({
      status: "PLANNING",
      registrationEnabled: false,
      confirmedStartAt: null,
      confirmedVenues: [],
    });
    expect(await written(eventId)).toEqual({ audit: 0, notifications: 0 });
  });

  it("SCRUM-249 [AC2] TC-249-03: the same event, starting later, can be confirmed, so only its start refused it", async () => {
    asCoordinator();
    const eventId = await readyEvent(FUTURE);

    expect(await confirmEvent({ eventId })).toEqual({ ok: true, data: { status: "CONFIRMED" } });
  });

  it("SCRUM-249 [AC2] TC-249-04: an overdue Planning event can still be rejected (SCRUM-117)", async () => {
    asCoordinator();
    const eventId = await event("PLANNING", PAST);

    expect(
      await rejectPlanningEvent({
        eventId,
        decisionReason: "Its date has passed.",
        rejectionOutcome: "NEW_REQUEST",
      }),
    ).toEqual({ ok: true, data: { status: "REJECTED" } });
  });

  it("SCRUM-249 [AC2] TC-249-04: an overdue Planning event can still be cancelled (SCRUM-82)", async () => {
    asCoordinator();
    const eventId = await event("PLANNING", PAST);

    expect(await cancelEvent({ eventId, reason: "Its date has passed." })).toEqual({
      ok: true,
      data: { status: "CANCELLED" },
    });
  });

  it("SCRUM-249 [AC3] TC-249-09: approval waits for the event's lock and sees a start moved into the past while it waited", async () => {
    asCoordinator();
    const eventId = await event("UNDER_REVIEW", FUTURE);

    const result = await raceAgainstStartMovedTo(eventId, PAST.startAt, () =>
      transitionEventStatus({ eventId, nextStatus: "APPROVED" }),
    );

    expect(result).toEqual(REFUSED);
    expect(
      await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { status: true } }),
    ).toEqual({ status: "UNDER_REVIEW" });
  });

  it("SCRUM-249 [AC3] TC-249-09: approval waits for the event's lock and sees a start moved later while it waited", async () => {
    asCoordinator();
    const eventId = await event("UNDER_REVIEW", PAST);

    const result = await raceAgainstStartMovedTo(eventId, FUTURE.startAt, () =>
      transitionEventStatus({ eventId, nextStatus: "APPROVED" }),
    );

    expect(result).toEqual({ ok: true, data: { status: "PLANNING" } });
  });

  it("SCRUM-249 [AC3] TC-249-09: confirming waits for the event's lock and sees a start moved into the past while it waited", async () => {
    asCoordinator();
    const eventId = await readyEvent(FUTURE);

    const result = await raceAgainstStartMovedTo(eventId, PAST.startAt, () =>
      confirmEvent({ eventId }),
    );

    expect(result).toEqual(REFUSED);
    expect(
      await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { status: true } }),
    ).toEqual({ status: "PLANNING" });
  });
});
