import { describe, it, expect, afterAll, afterEach, vi, type Mock } from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requestSafetyCheck } from "@/app/(app)/events/safety-check-actions";
import { recordSafetyCheckOutcome } from "@/app/(app)/safety-checks/actions";
import { confirmEvent } from "@/app/(app)/events/actions";
import { decideBookingRequest } from "@/app/(app)/bookings/actions";

// SCRUM-166 — the operational safety check against a real database: one check
// awaiting review per event, two officers at the same moment, the flags each
// outcome raises, Outdated on a change, and Confirm waiting for Approved.
// Test cases: docs/testing/SCRUM-166.md.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const session = (id: string, role: string): Session =>
  ({
    user: { id, role, name: id, email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  }) as Session;
const signInAs = (id: string, role: string) =>
  (auth as unknown as Mock).mockResolvedValue(session(id, role));
const asCoordinator = () => signInAs("usr_coordinator", "COORDINATOR");
const asOfficer = (id = "usr_safetyofficer") => signInAs(id, "SAFETY_OFFICER");

// One day per test, far enough ahead that nothing seeded overlaps it.
const day = (n: number) => ({
  startAt: new Date(`2032-10-${String(n).padStart(2, "0")}T02:00:00Z`),
  endAt: new Date(`2032-10-${String(n).padStart(2, "0")}T04:00:00Z`),
});
// The seeded safety2@test.local: seeded, never made or deleted here, since
// every Safety Officer is told of each requested check, while other suites run.
const SECOND_OFFICER = "usr_safetyofficer_2";
const created: string[] = [];

async function arrangedEvent(n: number) {
  const event = await prisma.event.create({
    data: {
      name: `SCRUM-166 ${Date.now()} ${created.length}`,
      status: "PLANNING",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      expectedAttendance: 40,
      // SCRUM-170 AC4: Equipment is always on the checklist; this event needs none.
      noEquipmentNeededAt: new Date(),
      noEquipmentNeededById: "usr_coordinator",
      ...day(n),
    },
    select: { id: true },
  });
  created.push(event.id);
  const booking = await prisma.booking.create({
    data: {
      eventId: event.id,
      venueId: "ven_hall",
      ...day(n),
      status: "APPROVED",
      requestedAttendance: 40,
      requestedById: "usr_coordinator",
      decidedById: "usr_venuestaff",
      decidedAt: new Date(),
    },
    select: { id: true },
  });
  return { eventId: event.id, bookingId: booking.id };
}

async function requested(eventId: string) {
  asCoordinator();
  const result = await requestSafetyCheck({ eventId });
  if (!result.ok) throw new Error(result.error);
  return result.data.checkId;
}

describe.skipIf(!usesLocalDatabase)("SCRUM-166 — operational safety check", () => {
  afterEach(async () => {
    const bookings = await prisma.booking.findMany({
      where: { eventId: { in: created } },
      select: { id: true },
    });
    const checks = await prisma.safetyCheck.findMany({
      where: { eventId: { in: created } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: {
          in: [...created, ...bookings.map((b) => b.id), ...checks.map((c) => c.id)],
        },
      },
    });
    await prisma.notification.deleteMany({ where: { eventId: { in: created } } });
    await prisma.safetyCheck.deleteMany({ where: { eventId: { in: created } } });
    await prisma.reservation.deleteMany({ where: { eventId: { in: created } } });
    await prisma.booking.deleteMany({ where: { eventId: { in: created } } });
    await prisma.event.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("SCRUM-166 [AC1, AC9] TC-166-01: once the venue is arranged, a requested check awaits review, every Safety Officer is notified, and Confirm waits for it", async () => {
    const { eventId } = await arrangedEvent(2);
    asCoordinator();
    expect(await confirmEvent({ eventId })).toEqual({
      ok: false,
      error: "This event isn't ready to confirm yet. Outstanding: Safety check (Not requested).",
    });

    const checkId = await requested(eventId);

    expect(await prisma.safetyCheck.findUniqueOrThrow({ where: { id: checkId } })).toMatchObject({
      status: "AWAITING_REVIEW",
      requestedById: "usr_coordinator",
    });
    const notified = await prisma.notification.findMany({
      where: { eventId, type: "SAFETY_CHECK_REQUESTED" },
      select: { userId: true },
    });
    expect(notified.map((n) => n.userId).sort()).toEqual(["usr_safetyofficer", SECOND_OFFICER].sort());
    asCoordinator();
    expect(await confirmEvent({ eventId })).toMatchObject({
      ok: false,
      error: expect.stringContaining("Safety check (Awaiting review)"),
    });
  });

  it("SCRUM-166 [AC7] TC-166-02: two requests at the same moment leave one check awaiting review", async () => {
    const { eventId } = await arrangedEvent(3);
    asCoordinator();

    const results = await Promise.all([
      requestSafetyCheck({ eventId }),
      requestSafetyCheck({ eventId }),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(await prisma.safetyCheck.count({ where: { eventId } })).toBe(1);
    expect(results.filter((r) => r.ok && r.data.existing)).toHaveLength(1);
  });

  it("SCRUM-166 [AC8] TC-166-11: two Safety Officers recording at the same moment save only the first; the second is shown it", async () => {
    const { eventId } = await arrangedEvent(4);
    const checkId = await requested(eventId);

    (auth as unknown as Mock)
      .mockResolvedValueOnce(session("usr_safetyofficer", "SAFETY_OFFICER"))
      .mockResolvedValueOnce(session(SECOND_OFFICER, "SAFETY_OFFICER"));
    const results = await Promise.all([
      recordSafetyCheckOutcome({ checkId, outcome: "APPROVED" }),
      recordSafetyCheckOutcome({ checkId, outcome: "REJECTED", note: "Exits blocked." }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const refused = results.find((r) => !r.ok);
    expect(refused).toMatchObject({
      ok: false,
      error: expect.stringMatching(/^This check is already (Approved|Rejected) by .+; nothing was changed\.$/),
    });
    expect(
      await prisma.auditLog.count({ where: { entityId: checkId, oldValue: "AWAITING_REVIEW" } }),
    ).toBe(1);
  });

  it("SCRUM-166 [AC3, AC10] TC-166-05: Changes requested keeps the picked booking, flags it with the note, and the event stays in Planning", async () => {
    const { eventId, bookingId } = await arrangedEvent(5);
    const checkId = await requested(eventId);
    asOfficer();

    const result = await recordSafetyCheckOutcome({
      checkId,
      outcome: "CHANGES_REQUESTED",
      note: "Move the stage away from the east exit.",
      bookingIds: [bookingId],
    });

    expect(result).toEqual({ ok: true, data: { status: "CHANGES_REQUESTED" } });
    expect(await prisma.safetyCheck.findUniqueOrThrow({ where: { id: checkId } })).toMatchObject({
      status: "CHANGES_REQUESTED",
      note: "Move the stage away from the east exit.",
      decidedById: "usr_safetyofficer",
    });
    expect(await prisma.safetyCheckArrangement.count({ where: { checkId, bookingId } })).toBe(1);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).toMatchObject({
      status: "APPROVED",
      needsReconsideration: true,
      reconsiderationReason:
        "Safety check changes requested: Move the stage away from the east exit.",
    });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).status).toBe(
      "PLANNING",
    );
    expect(
      await prisma.notification.count({
        where: { eventId, userId: "usr_coordinator", type: "SAFETY_CHECK_OUTCOME" },
      }),
    ).toBe(1);
  });

  it("SCRUM-166 [AC11, AC12] TC-166-06: Rejected flags every arrangement; once resolved, a new check can be requested and awaits review", async () => {
    const { eventId, bookingId } = await arrangedEvent(6);
    const reservation = await prisma.reservation.create({
      data: {
        eventId,
        equipmentId: "eqp_projector",
        quantity: 1,
        ...day(6),
        reservedById: "usr_techsupport",
      },
      select: { id: true },
    });
    const checkId = await requested(eventId);
    asOfficer();

    await recordSafetyCheckOutcome({ checkId, outcome: "REJECTED", note: "No crowd plan." });

    for (const row of [
      await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }),
      await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } }),
    ]) {
      expect(row.needsReconsideration).toBe(true);
    }
    expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).status).toBe(
      "PLANNING",
    );

    // The flags hold back a new request until they're resolved (SCRUM-26 AC12).
    asCoordinator();
    expect(await requestSafetyCheck({ eventId })).toMatchObject({ ok: false });
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        needsReconsideration: false,
        reconsiderationResolvedAt: new Date(),
        reconsiderationResolvedById: "usr_coordinator",
      },
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        needsReconsideration: false,
        reconsiderationResolvedAt: new Date(),
        reconsiderationResolvedById: "usr_coordinator",
      },
    });
    const second = await requestSafetyCheck({ eventId });
    expect(second).toMatchObject({ ok: true, data: { existing: false } });
    expect(await prisma.safetyCheck.count({ where: { eventId } })).toBe(2);
  });

  it("SCRUM-166 [AC9, AC13, AC14] TC-166-12: approval doesn't confirm; a newly approved booking outdates the check, which then can't be approved, and Confirm waits for a new one", async () => {
    const { eventId } = await arrangedEvent(7);
    const checkId = await requested(eventId);
    asOfficer();
    await recordSafetyCheckOutcome({ checkId, outcome: "APPROVED" });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).status).toBe(
      "PLANNING",
    );

    // A second venue for the same event is approved after the check.
    const second = await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_seminar",
        ...day(7),
        status: "PENDING",
        requestedAttendance: 20,
        requestedById: "usr_coordinator",
      },
      select: { id: true },
    });
    signInAs("usr_venuestaff", "VENUE_STAFF");
    expect(await decideBookingRequest({ bookingId: second.id, decision: "APPROVED" })).toMatchObject({
      ok: true,
    });

    const outdated = await prisma.safetyCheck.findUniqueOrThrow({ where: { id: checkId } });
    expect(outdated.status).toBe("OUTDATED");
    expect(outdated.outdatedAt).toBeInstanceOf(Date);
    asOfficer();
    expect(await recordSafetyCheckOutcome({ checkId, outcome: "APPROVED" })).toMatchObject({
      ok: false,
      error:
        "This check is Outdated because the event's arrangements changed; nothing was changed. The Coordinator needs to request a new one.",
    });
    asCoordinator();
    expect(await confirmEvent({ eventId })).toMatchObject({
      ok: false,
      error: expect.stringContaining("Safety check (Outdated)"),
    });
  });

  it("SCRUM-166 [AC9, AC14] TC-166-10: with the check approved, the Coordinator confirms the event", async () => {
    const { eventId } = await arrangedEvent(8);
    const checkId = await requested(eventId);
    asOfficer();
    await recordSafetyCheckOutcome({ checkId, outcome: "APPROVED" });

    asCoordinator();
    expect(await confirmEvent({ eventId })).toEqual({ ok: true, data: { status: "CONFIRMED" } });
  });
});
