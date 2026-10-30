import { describe, it, expect, vi, type Mock } from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/can";
import { getEventPageData } from "@/app/(app)/events/[id]/event-page-data";
import { getBrowsableEvent } from "@/app/(app)/events/queries";
import { getReadinessChecklist } from "@/lib/event-readiness";
import { eventPeriodError } from "@/lib/schemas/event";

// SCRUM-233 against the seeded database (prisma/seed.ts): the seed shows only
// what the lifecycle allows. It reads the rows the seed owns (their fixed
// ids), so other suites writing alongside don't change it; it runs against a
// local database, like the other integration suites.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const seeded = { id: { startsWith: "evt_" } };
const HOUR_MS = 60 * 60 * 1000;
/** The Singapore weekday, 0 for Sunday to 6 for Saturday. */
const sgWeekday = (instant: Date) => new Date(instant.getTime() + 8 * HOUR_MS).getUTCDay();

const history = (entityId: string) =>
  prisma.auditLog.findMany({
    where: { entityId, id: { startsWith: "aud_" } },
    orderBy: { createdAt: "asc" },
    select: { action: true, actorId: true, oldValue: true, newValue: true, summary: true },
  });

describe.skipIf(!usesLocalDatabase)("SCRUM-233 — the seed follows the event lifecycle", () => {
  it("SCRUM-233 [AC1] TC-233-01: no seeded event is Approved; the Research Symposium is Planning, with its approval and its move to Planning in its history", async () => {
    expect(await prisma.event.count({ where: { ...seeded, status: "APPROVED" } })).toBe(0);

    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: "evt_approved" },
        select: { name: true, status: true, decidedById: true },
      }),
    ).toEqual({ name: "Planning — Research Symposium", status: "PLANNING", decidedById: "usr_coordinator" });

    // ADR 0012: the Coordinator's approval, then the system's move (no actor).
    expect(await history("evt_approved")).toEqual([
      { action: "STATUS_CHANGED", actorId: "usr_coordinator", oldValue: "UNDER_REVIEW", newValue: "APPROVED", summary: null },
      { action: "STATUS_CHANGED", actorId: null, oldValue: "APPROVED", newValue: "PLANNING", summary: "Moved to Planning on approval (SCRUM-81)" },
    ]);
  });

  it("SCRUM-233 [AC2] TC-233-02: every seeded event with a period starts and ends on the same Singapore day, the Hackathon included", async () => {
    const events = await prisma.event.findMany({
      where: { ...seeded, startAt: { not: null }, endAt: { not: null } },
      select: { id: true, startAt: true, endAt: true },
    });

    expect(events.map((e) => e.id)).toContain("evt_completed");
    expect(
      events.filter((e) => eventPeriodError(e.startAt!, e.endAt!) !== null).map((e) => e.id),
    ).toEqual([]);
  });

  it("SCRUM-233 [AC4] TC-233-04: every seeded Confirmed event has a covering approved venue, its equipment settled, an Approved safety check, and its submission and approval recorded", async () => {
    const confirmed = await prisma.event.findMany({
      where: { ...seeded, status: "CONFIRMED" },
      select: { id: true, submittedAt: true, decidedAt: true, decidedById: true, confirmedVenues: true },
    });
    // The five original Confirmed events and SCRUM-238's two.
    expect(confirmed.map((e) => e.id).sort()).toEqual([
      "evt_cancellation_requested",
      "evt_confirmed",
      "evt_full",
      "evt_last_seat",
      "evt_no_registration",
      "evt_reg_closed",
      "evt_reg_not_open",
    ]);

    for (const event of confirmed) {
      expect(event.submittedAt, event.id).not.toBeNull();
      expect(event.decidedAt, event.id).not.toBeNull();
      expect(event.decidedById, event.id).toBe("usr_coordinator");
      // SCRUM-85: Attendees see where it is.
      expect(event.confirmedVenues.length, event.id).toBeGreaterThan(0);

      const checklist = await getReadinessChecklist(prisma, event.id);
      const outstanding = checklist!.items
        .filter((item) => !item.complete)
        .map((item) => `${item.name}: ${item.state}`);
      expect(outstanding, event.id).toEqual([]);
    }
  });

  it("SCRUM-233 [AC5] TC-233-05: a seeded rejection was made by the Coordinator assigned to the request", async () => {
    const rejected = await prisma.event.findMany({
      where: { ...seeded, status: "REJECTED" },
      select: { id: true, coordinatorId: true, decidedById: true },
    });

    expect(rejected.map((e) => e.id)).toContain("evt_rejected");
    for (const event of rejected) {
      expect(event.coordinatorId, event.id).not.toBeNull();
      expect(event.coordinatorId, event.id).toBe(event.decidedById);
    }
  });

  it("SCRUM-233 [AC6] TC-233-06: the cancelled event was confirmed with registration open, cancelled by its Coordinator, on a weekday, and its reservation came from an approved request", async () => {
    const event = await prisma.event.findUniqueOrThrow({
      where: { id: "evt_cancelled" },
      select: {
        startAt: true,
        coordinatorId: true,
        cancelledById: true,
        decidedById: true,
        registrationEnabled: true,
        registrationOpensAt: true,
        registrations: { select: { registeredAt: true } },
        bookings: { select: { startAt: true, decidedById: true } },
        reservations: {
          select: { request: { select: { updates: { select: { toStatus: true } } } } },
        },
      },
    });

    expect(event.cancelledById).toBe(event.coordinatorId);
    expect(event.decidedById).toBe("usr_coordinator");
    expect(event.registrationEnabled).toBe(true);
    for (const registration of event.registrations) {
      expect(registration.registeredAt.getTime()).toBeGreaterThanOrEqual(
        event.registrationOpensAt!.getTime(),
      );
    }
    await expect(history("evt_cancelled")).resolves.toContainEqual(
      expect.objectContaining({ actorId: "usr_coordinator", oldValue: "CONFIRMED", newValue: "CANCELLED" }),
    );

    // SCRUM-34 AC7: Seminar Room 2.1 is closed at weekends.
    expect([0, 6]).not.toContain(sgWeekday(event.startAt!));
    expect(event.bookings).toHaveLength(1);
    expect([0, 6]).not.toContain(sgWeekday(event.bookings[0].startAt));
    expect(event.bookings[0].decidedById).toBe("usr_venuestaff");

    // SCRUM-155: reserved only through an approved request.
    expect(event.reservations).toHaveLength(1);
    expect(event.reservations[0].request?.updates.map((u) => u.toStatus)).toContain("APPROVED");
  });

  it("SCRUM-233 [AC7] TC-233-07: seeded history matches the actions: the system moves an event to Planning, the assigned Coordinator confirms it, and a Lead reassigns it", async () => {
    const entries = await prisma.auditLog.findMany({
      where: { id: { startsWith: "aud_" }, entityType: "Event" },
      select: { id: true, entityId: true, action: true, actorId: true, oldValue: true, newValue: true, createdAt: true },
    });
    const toPlanning = entries.filter((e) => e.oldValue === "APPROVED" && e.newValue === "PLANNING");
    const confirming = entries.filter((e) => e.newValue === "CONFIRMED");
    const reassigning = entries.filter((e) => e.action === "REASSIGNED");

    expect(toPlanning.length).toBeGreaterThan(0);
    for (const entry of toPlanning) {
      expect(entry.actorId, entry.id).toBeNull();
      // Each move follows the Coordinator's own approval of the same event.
      expect(
        entries.some((e) => e.entityId === entry.entityId && e.newValue === "APPROVED" && e.actorId !== null),
        entry.id,
      ).toBe(true);
    }

    expect(confirming.length).toBeGreaterThan(0);
    for (const entry of confirming) {
      const { coordinatorId } = await prisma.event.findUniqueOrThrow({
        where: { id: entry.entityId },
        select: { coordinatorId: true },
      });
      expect(entry.actorId, entry.id).toBe(coordinatorId);
    }

    // Each event that reached Confirmed was approved, moved to Planning and
    // confirmed, and confirmed only once its booking and safety check were
    // approved (SCRUM-110).
    for (const id of ["evt_confirmed", "evt_full", "evt_last_seat", "evt_reg_not_open", "evt_reg_closed", "evt_cancelled"]) {
      const steps = await prisma.auditLog.findMany({
        where: { entityId: id, id: { startsWith: "aud_" }, fieldName: "status" },
        orderBy: { createdAt: "asc" },
        select: { oldValue: true, newValue: true, createdAt: true },
      });
      expect(steps.slice(0, 3).map((s) => `${s.oldValue} → ${s.newValue}`), id).toEqual([
        "UNDER_REVIEW → APPROVED",
        "APPROVED → PLANNING",
        "PLANNING → CONFIRMED",
      ]);
      const { bookings, safetyChecks } = await prisma.event.findUniqueOrThrow({
        where: { id },
        select: {
          bookings: { where: { id: { startsWith: "bkg_" } }, select: { decidedAt: true } },
          safetyChecks: { where: { id: { startsWith: "sfc_" }, status: "APPROVED" }, select: { decidedAt: true } },
        },
      });
      for (const decided of [...bookings, ...safetyChecks]) {
        expect(decided.decidedAt!.getTime(), id).toBeLessThan(steps[2].createdAt.getTime());
      }
    }

    // The Hackathon reached Confirmed too, and the system completed it after
    // its end time (SCRUM-82).
    const hackathon = await prisma.auditLog.findMany({
      where: { entityId: "evt_completed", id: { startsWith: "aud_" }, fieldName: "status" },
      orderBy: { createdAt: "asc" },
      select: { actorId: true, oldValue: true, newValue: true, createdAt: true },
    });
    const { completedAt } = await prisma.event.findUniqueOrThrow({
      where: { id: "evt_completed" },
      select: { completedAt: true },
    });
    expect(hackathon.map((s) => `${s.oldValue} → ${s.newValue}`)).toEqual([
      "UNDER_REVIEW → APPROVED",
      "APPROVED → PLANNING",
      "PLANNING → CONFIRMED",
      "CONFIRMED → COMPLETED",
    ]);
    expect(hackathon[3].actorId).toBeNull();
    expect(hackathon[3].createdAt).toEqual(completedAt);

    expect(reassigning.length).toBeGreaterThan(0);
    for (const entry of reassigning) {
      const actor = await prisma.user.findUniqueOrThrow({
        where: { id: entry.actorId! },
        select: { role: true, additionalRoles: true },
      });
      expect([actor.role, ...actor.additionalRoles], entry.id).toContain("COORDINATOR_LEAD");
      // Only a submitted request has a Coordinator to reassign (SCRUM-21).
      const { submittedAt } = await prisma.event.findUniqueOrThrow({
        where: { id: entry.entityId },
        select: { submittedAt: true },
      });
      expect(entry.createdAt.getTime(), entry.id).toBeGreaterThan(submittedAt!.getTime());
    }
  });

  it("SCRUM-233 [AC8] TC-233-08: the clarification names the event's own layout, every submitted event has Venue Requirements, and the rejection notice gives the reason and the next step", async () => {
    const clarification = await prisma.clarificationRequest.findUniqueOrThrow({
      where: { id: "clr_career_fair" },
      select: { message: true, event: { select: { preferredLayout: true } } },
    });
    expect(clarification.event.preferredLayout).toBe("theatre");
    expect(clarification.message).toContain("theatre layout");
    expect(clarification.message).not.toContain("classroom");

    expect(
      (
        await prisma.event.findMany({
          where: { ...seeded, status: { not: "DRAFT" }, OR: [{ venueRequirements: null }, { venueRequirements: "" }] },
          select: { id: true },
        })
      ).map((e) => e.id),
    ).toEqual([]);

    const notice = await prisma.notification.findUniqueOrThrow({
      where: { id: "ntf_3" },
      select: { message: true, event: { select: { decisionReason: true } } },
    });
    expect(notice.message).toContain(notice.event!.decisionReason!);
    expect(notice.message).toContain("What you can do next: Amend and resubmit.");
  });

  it("SCRUM-233 [AC13] TC-233-13: every seeded registration was taken while its event's registration was open, and every seeded capacity is the expected attendance", async () => {
    const registrations = await prisma.registration.findMany({
      where: { id: { startsWith: "reg_" } },
      select: {
        id: true,
        registeredAt: true,
        event: {
          select: {
            registrationEnabled: true,
            registrationOpensAt: true,
            registrationClosesAt: true,
            decidedAt: true,
            startAt: true,
          },
        },
      },
    });
    expect(registrations.length).toBeGreaterThan(0);
    // SCRUM-73 AC5, SCRUM-75 AC2, AC4, AC7, AC8: after approval and any
    // opening time, before any closing time and before the start.
    const outside = registrations
      .filter(({ registeredAt: at, event: e }) => {
        const open =
          e.registrationEnabled &&
          e.decidedAt !== null &&
          at >= e.decidedAt &&
          (e.registrationOpensAt === null || at >= e.registrationOpensAt) &&
          (e.registrationClosesAt === null || at < e.registrationClosesAt) &&
          e.startAt !== null &&
          at < e.startAt;
        return !open;
      })
      .map((r) => r.id);
    expect(outside).toEqual([]);

    // SCRUM-74: the expected attendance is the capacity, so the seed writes
    // no separate one (SCRUM-254 AC4). The client no longer reads the column.
    const withCapacity = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Event"
       WHERE left("id", 4) = 'evt_' AND "registrationCapacity" IS NOT NULL`;
    expect(withCapacity.map((e) => e.id)).toEqual([]);
  });

  it("SCRUM-233 [AC4, AC6, AC7] TC-233-14: what users see of the seed: an Attendee sees a venue for every Confirmed event, the cancellation notices give the reason, and the cancelled event's progress stops at Confirmed", async () => {
    const attendee = { id: "usr_attendee", role: "ATTENDEE", name: "Test", email: "attendee@test.local" } as SessionUser;
    (auth as unknown as Mock).mockResolvedValue({ user: attendee, expires: "2999-01-01T00:00:00.000Z" } as Session);
    const confirmed = await prisma.event.findMany({ where: { ...seeded, status: "CONFIRMED" }, select: { id: true } });
    expect(confirmed.length).toBeGreaterThan(0);
    const shown: string[] = [];
    const withoutVenue: string[] = [];
    for (const { id } of confirmed) {
      // SCRUM-171 AC4: an event that takes no registration isn't shown at all.
      const event = await getBrowsableEvent(id);
      if (!event) continue;
      shown.push(id);
      // The attendee pages say "Venue to be confirmed" when this is empty.
      if (event.bookings.length === 0) withoutVenue.push(id);
    }
    expect(shown).toEqual(expect.arrayContaining(["evt_reg_not_open", "evt_reg_closed"]));
    expect(withoutVenue).toEqual([]);

    // SCRUM-82: what cancelInTransaction sends the Organiser, the Coordinator
    // who cancelled, and each registered Attendee.
    const notices = await prisma.notification.findMany({
      where: { eventId: "evt_cancelled", id: { startsWith: "ntf_" }, type: { in: ["EVENT_STATUS_CHANGED", "REGISTERED_EVENT_CANCELLED"] } },
      orderBy: { userId: "asc" },
      select: { userId: true, title: true, message: true },
    });
    const reason = '"Cancelled — Winter Workshop" was cancelled: Speaker withdrew and no replacement was available.';
    expect(notices).toEqual([
      { userId: "usr_attendee", title: "An event you registered for was cancelled", message: reason },
      { userId: "usr_coordinator", title: "Event cancelled", message: reason },
      { userId: "usr_organiser", title: "Event cancelled", message: reason },
    ]);

    const coordinator = { id: "usr_coordinator", role: "COORDINATOR", name: "Test", email: "coordinator@test.local" } as SessionUser;
    expect((await getEventPageData(coordinator, "evt_cancelled"))?.cancelledFrom).toBe("CONFIRMED");
  });
});
