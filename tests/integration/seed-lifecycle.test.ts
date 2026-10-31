import { describe, it, expect, vi, type Mock } from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/can";
import { getEventPageData } from "@/app/(app)/events/[id]/event-page-data";
import { getBrowsableEvent } from "@/app/(app)/events/queries";
import { getEventReadiness } from "@/app/(app)/events/readiness-actions";
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
// Every seeded event that reached Confirmed, whatever became of it after.
const REACHED_CONFIRMED = [
  "evt_confirmed",
  "evt_full",
  "evt_last_seat",
  "evt_reg_not_open",
  "evt_reg_closed",
  "evt_cancellation_requested",
  "evt_no_registration",
  "evt_two_venues",
  "evt_reconfirmed",
  "evt_change_pending",
  "evt_reservation_reported",
  "evt_cancelled",
  "evt_completed",
  "evt_replanning",
];
// Booked after the event came back to Planning, so after its first confirmation.
const REBOOKED = ["bkg_replanning", "bkg_reconfirmed"];
const HOUR_MS = 60 * 60 * 1000;
/** The Singapore weekday, 0 for Sunday to 6 for Saturday. */
const sgWeekday = (instant: Date) => new Date(instant.getTime() + 8 * HOUR_MS).getUTCDay();

const history = (entityId: string) =>
  prisma.auditLog.findMany({
    where: { entityId, id: { startsWith: "aud_" }, fieldName: "status" },
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
    ).toEqual({ name: "Planning: Venue Booked — Research Symposium", status: "PLANNING", decidedById: "usr_coordinator" });

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
    expect(confirmed.map((e) => e.id).sort()).toEqual([
      "evt_cancellation_requested",
      "evt_change_pending",
      "evt_confirmed",
      "evt_full",
      "evt_last_seat",
      "evt_no_registration",
      "evt_reconfirmed",
      "evt_reg_closed",
      "evt_reg_not_open",
      "evt_reservation_reported",
      "evt_two_venues",
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
      // AC4, AC15, SCRUM-26 AC12: only the reservation reported after
      // confirmation is left, on that one event.
      const left = event.id === "evt_reservation_reported" ? ["Equipment: Reserved: Projector"] : [];
      expect(outstanding, event.id).toEqual(left);
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
        bookings: { select: { startAt: true, decidedById: true } },
        reservations: {
          select: { request: { select: { updates: { select: { toStatus: true } } } } },
        },
      },
    });

    expect(event.cancelledById).toBe(event.coordinatorId);
    expect(event.decidedById).toBe("usr_coordinator");
    expect(event.registrationEnabled).toBe(true);
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
    expect(clarification.event.preferredLayout).toBe("Theatre");
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

  it("SCRUM-233 [AC13] TC-233-13: every seeded registration was taken while its event's registration was open, and only the state that needs one has a window", async () => {
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
            id: true,
            startAt: true,
          },
        },
      },
    });
    expect(registrations.length).toBeGreaterThan(0);
    const confirmations = await prisma.auditLog.findMany({
      where: { id: { startsWith: "aud_" }, newValue: "CONFIRMED" },
      select: { entityId: true, createdAt: true },
    });
    // SCRUM-73 AC5, SCRUM-75 AC2, AC4, AC7, AC8: after confirmation and any
    // opening time, before any closing time and before the start.
    const outside = registrations
      .filter(({ registeredAt: at, event: e }) => {
        const confirmedAt = confirmations.find((c) => c.entityId === e.id)?.createdAt;
        const open =
          e.registrationEnabled &&
          confirmedAt !== undefined &&
          at >= confirmedAt &&
          (e.registrationOpensAt === null || at >= e.registrationOpensAt) &&
          (e.registrationClosesAt === null || at < e.registrationClosesAt) &&
          e.startAt !== null &&
          at < e.startAt;
        return !open;
      })
      .map((r) => r.id);
    expect(outside).toEqual([]);

    // SCRUM-74: the expected attendance is the capacity, so none is stored.
    expect(await prisma.event.count({ where: { ...seeded, registrationCapacity: { not: null } } })).toBe(0);
    // SCRUM-75 AC1, AC6: a later opening comes only from the seed, for the one
    // state that needs it, and a closing time is what closing registration stores.
    const windows = await prisma.event.findMany({
      where: { ...seeded, OR: [{ registrationOpensAt: { not: null } }, { registrationClosesAt: { not: null } }] },
      select: { id: true },
    });
    expect(windows.map((e) => e.id).sort()).toEqual(["evt_reg_closed", "evt_reg_not_open"]);

    // Still not open weeks after a seed, and open before the event starts
    // (SCRUM-75 AC8). Measured from the seeded confirmation, not today, so an
    // older local database gives the same result.
    const notOpen = await prisma.event.findUniqueOrThrow({
      where: { id: "evt_reg_not_open" },
      select: { registrationOpensAt: true, startAt: true },
    });
    const confirmedAt = confirmations.find((c) => c.entityId === "evt_reg_not_open")!.createdAt;
    expect(notOpen.registrationOpensAt!.getTime() - confirmedAt.getTime()).toBeGreaterThanOrEqual(30 * 24 * HOUR_MS);
    expect(notOpen.registrationOpensAt!.getTime()).toBeLessThan(notOpen.startAt!.getTime());
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
    const reason = '"Cancelled: After Confirmation — Winter Workshop" was cancelled: Speaker withdrew and no replacement was available.';
    expect(notices).toEqual([
      { userId: "usr_attendee", title: "An event you registered for was cancelled", message: reason },
      { userId: "usr_coordinator", title: "Event cancelled", message: reason },
      { userId: "usr_organiser", title: "Event cancelled", message: reason },
    ]);

    const coordinator = { id: "usr_coordinator", role: "COORDINATOR", name: "Test", email: "coordinator@test.local" } as SessionUser;
    expect((await getEventPageData(coordinator, "evt_cancelled"))?.cancelledFrom).toBe("CONFIRMED");
  });

  it("SCRUM-233 [AC14] TC-233-15: every event that reached Confirmed had its venue, equipment and safety check settled in the order the actions allow", async () => {
    for (const id of REACHED_CONFIRMED) {
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
      const movedToPlanning = steps[1].createdAt.getTime();
      const confirmed = steps[2].createdAt.getTime();

      const event = await prisma.event.findUniqueOrThrow({
        where: { id },
        select: {
          noEquipmentNeededAt: true,
          bookings: {
            where: {
              id: { startsWith: "bkg_", notIn: REBOOKED },
              status: { in: ["APPROVED", "CANCELLED"] },
            },
            select: { id: true, decidedAt: true },
          },
          equipmentRequests: {
            where: { id: { startsWith: "eqr_" } },
            select: { id: true, decidedAt: true },
          },
          reservations: { select: { id: true, createdAt: true } },
          safetyChecks: {
            where: { id: { startsWith: "sfc_" }, decidedAt: { not: null } },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { createdAt: true, decidedAt: true },
          },
        },
      });

      // SCRUM-81 AC4, SCRUM-110: nothing is confirmed without a venue, its
      // equipment settled and an Approved safety check.
      expect(event.bookings.length, id).toBeGreaterThan(0);
      expect(event.noEquipmentNeededAt !== null || event.reservations.length > 0, id).toBe(true);
      expect(event.safetyChecks, id).toHaveLength(1);
      const [check] = event.safetyChecks;

      // SCRUM-50: a venue is requested for an approved event, so it is decided
      // after the event reached Planning.
      for (const booking of event.bookings) {
        expect(booking.decidedAt!.getTime(), booking.id).toBeGreaterThan(movedToPlanning);
      }
      // SCRUM-166 AC1: the check is requested once venue and equipment are done.
      const settled = [
        ...event.bookings.map((b) => b.decidedAt!),
        ...event.equipmentRequests.map((r) => r.decidedAt!),
        ...event.reservations.map((r) => r.createdAt),
        ...(event.noEquipmentNeededAt ? [event.noEquipmentNeededAt] : []),
      ];
      for (const at of settled) {
        expect(at.getTime(), id).toBeLessThan(check.createdAt.getTime());
      }
      expect(check.decidedAt!.getTime(), id).toBeLessThan(confirmed);
    }
  });

  it("SCRUM-233 [AC7, AC14] TC-233-16: the re-planned event shows how it came back to Planning, and Reject isn't offered, since it was Confirmed", async () => {
    const steps = await prisma.auditLog.findMany({
      where: { entityId: "evt_replanning", id: { startsWith: "aud_" }, fieldName: "status" },
      orderBy: { createdAt: "asc" },
      select: { oldValue: true, newValue: true },
    });
    expect(steps.map((s) => `${s.oldValue} → ${s.newValue}`)).toEqual([
      "UNDER_REVIEW → APPROVED",
      "APPROVED → PLANNING",
      "PLANNING → CONFIRMED",
      "CONFIRMED → PLANNING",
    ]);
    const change = await prisma.eventChangeRequest.findFirstOrThrow({
      where: { eventId: "evt_replanning", id: { startsWith: "chg_" } },
      select: { status: true, fields: { where: { isMajor: true }, select: { fieldName: true } } },
    });
    expect(change.status).toBe("APPROVED");
    expect(change.fields.map((f) => f.fieldName).sort()).toEqual(["endAt", "startAt"]);

    // SCRUM-117 AC4, SCRUM-166 AC13: the Coordinator can't reject it, and the
    // safety check its date change outdated has to be requested again.
    const coordinator = { id: "usr_coordinator", role: "COORDINATOR", name: "Test", email: "coordinator@test.local" } as SessionUser;
    (auth as unknown as Mock).mockResolvedValue({ user: coordinator, expires: "2999-01-01T00:00:00.000Z" } as Session);
    const readiness = await getEventReadiness("evt_replanning");
    expect(readiness.ok && readiness.data.canReject).toBe(false);
    expect(readiness.ok && readiness.data.items.find((i) => i.name === "Safety check")?.state).toBe("Outdated");
  });

  it("SCRUM-233 [AC14] TC-233-17: no seeded venue request is above its venue's capacity or its event's attendance", async () => {
    const bookings = await prisma.booking.findMany({
      where: { id: { startsWith: "bkg_" } },
      select: {
        id: true,
        requestedAttendance: true,
        venue: { select: { capacity: true } },
        event: { select: { expectedAttendance: true } },
      },
    });
    expect(bookings.length).toBeGreaterThan(0);
    // SCRUM-50 AC6, SCRUM-162 AC4. Equal to either limit fits.
    expect(
      bookings
        .filter(
          (b) =>
            b.requestedAttendance! > b.venue.capacity ||
            b.requestedAttendance! > b.event.expectedAttendance!,
        )
        .map((b) => b.id),
    ).toEqual([]);
  });

  it("SCRUM-233 [AC14] TC-233-18: every seeded row was created before its own next step, assigned events have their Lead, and confirmed details are kept", async () => {
    const events = await prisma.event.findMany({
      where: seeded,
      select: { id: true, createdAt: true, submittedAt: true, discardedAt: true, coordinatorId: true, supervisingLeadId: true },
    });
    const late: string[] = [];
    const before = (id: string, earlier: Date, later: Date | null) => {
      if (later && earlier > later) late.push(id);
    };
    for (const e of events) before(e.id, e.createdAt, e.submittedAt ?? e.discardedAt);

    const bookings = await prisma.booking.findMany({
      where: { id: { startsWith: "bkg_" } },
      select: { id: true, createdAt: true, decidedAt: true, heldAt: true },
    });
    for (const b of bookings) before(b.id, b.createdAt, b.decidedAt ?? b.heldAt);

    const requests = await prisma.equipmentRequest.findMany({
      where: { id: { startsWith: "eqr_" } },
      select: { id: true, createdAt: true, decidedAt: true, updates: { select: { createdAt: true, toStatus: true } } },
    });
    for (const r of requests) {
      before(r.id, r.createdAt, r.decidedAt);
      for (const update of r.updates) {
        before(r.id, r.createdAt, update.createdAt);
        // A seeded history is dated, not stamped when the seed ran. Only
        // cancelling comes after the decision (SCRUM-82).
        if (update.toStatus !== "CANCELLED") before(r.id, update.createdAt, r.decidedAt);
      }
    }
    const reservations = await prisma.reservation.findMany({
      where: { id: { startsWith: "res_" } },
      select: { id: true, createdAt: true, request: { select: { decidedAt: true } } },
    });
    for (const r of reservations) before(r.id, r.request!.decidedAt!, r.createdAt);

    const registrations = await prisma.registration.findMany({
      where: { id: { startsWith: "reg_" } },
      select: { id: true, createdAt: true, registeredAt: true },
    });
    for (const r of registrations) before(r.id, r.createdAt, r.registeredAt);

    const changes = await prisma.eventChangeRequest.findMany({
      where: { id: { startsWith: "chg_" } },
      select: { id: true, createdAt: true, decidedAt: true },
    });
    for (const c of changes) before(c.id, c.createdAt, c.decidedAt);
    expect(late).toEqual([]);

    // SCRUM-165, SCRUM-21: assigning or reassigning records the Lead.
    expect(events.filter((e) => e.coordinatorId && !e.supervisingLeadId).map((e) => e.id)).toEqual([]);

    // SCRUM-85: confirming records these, and nothing clears them.
    const closed = await prisma.event.findMany({
      where: { id: { in: ["evt_completed", "evt_cancelled"] } },
      select: { id: true, confirmedStartAt: true, confirmedVenues: true },
    });
    expect(closed).toHaveLength(2);
    for (const e of closed) {
      expect(e.confirmedStartAt, e.id).not.toBeNull();
      expect(e.confirmedVenues.length, e.id).toBeGreaterThan(0);
    }
  });

  it("SCRUM-233 [AC14] TC-233-19: every submitted event has every compulsory answer, and its assignment and every equipment request's submission are recorded", async () => {
    const events = await prisma.event.findMany({
      where: { ...seeded, submittedAt: { not: null } },
    });
    expect(events.length).toBeGreaterThan(0);
    // SCRUM-13, SCRUM-171: what submitting refuses to go without.
    const compulsory = [
      "name",
      "purpose",
      "description",
      "startAt",
      "endAt",
      "expectedAttendance",
      "venueRequirements",
      "accessibilityNeeds",
      "preferredLayout",
      "equipmentRequirements",
      "registrationRequired",
    ] as const;
    for (const event of events) {
      expect(compulsory.filter((field) => event[field] === null || event[field] === ""), event.id).toEqual([]);
    }

    // SCRUM-165: nobody coordinates an event without the Lead assigning it.
    const assigned = await prisma.auditLog.findMany({
      where: { id: { startsWith: "aud_" }, action: "ASSIGNED" },
      select: { entityId: true },
    });
    expect(
      events
        .filter((e) => e.coordinatorId && !assigned.some((a) => a.entityId === e.id))
        .map((e) => e.id),
    ).toEqual([]);

    // SCRUM-28 AC6: the history log starts with the submission itself.
    const requests = await prisma.equipmentRequest.findMany({
      where: { id: { startsWith: "eqr_" } },
      select: { id: true, updates: { orderBy: { createdAt: "asc" }, take: 1, select: { note: true } } },
    });
    expect(requests.filter((r) => r.updates[0]?.note !== "Request submitted.").map((r) => r.id)).toEqual([]);
  });

  it("SCRUM-233 [AC14] TC-233-19: the reservation Technical Support reported reads as the report writes it, and keeps that reason after the change approved later", async () => {
    const report = "Two of the three microphones are booked for a graduation on the same day.";
    const reason = `Technical Support can no longer provide it: ${report}`;
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: "res_flagged_mic" },
      select: { status: true, needsReconsideration: true, reconsiderationReason: true, reconsiderationFlaggedAt: true },
    });
    expect(reservation).toMatchObject({ status: "CONFIRMED", needsReconsideration: true, reconsiderationReason: reason });

    // SCRUM-26: a flag keeps its first reason, so the report came first.
    const change = await prisma.eventChangeRequest.findUniqueOrThrow({ where: { id: "chg_flagged_approved" }, select: { decidedAt: true } });
    expect(reservation.reconsiderationFlaggedAt!.getTime()).toBeLessThan(change.decidedAt!.getTime());
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: "bkg_flagged" }, select: { reconsiderationReason: true } });
    expect(booking.reconsiderationReason).toBe("Change approved: Expected attendance.");

    // SCRUM-32 AC5: recorded with who and when.
    const tech = await prisma.user.findUniqueOrThrow({ where: { email: "techsupport@test.local" }, select: { id: true } });
    const recorded = await prisma.auditLog.findMany({
      where: { id: { startsWith: "aud_" }, entityId: "res_flagged_mic", action: "REPORTED_UNPROVIDABLE" },
      select: { actorId: true, summary: true, createdAt: true },
    });
    expect(recorded).toEqual([{ actorId: tech.id, summary: report, createdAt: reservation.reconsiderationFlaggedAt }]);

    // SCRUM-32 AC5, SCRUM-124 AC8: the Coordinator hears of the report and of
    // the change; Technical Support hear of the reservation.
    const notices = await prisma.notification.findMany({
      where: { id: { startsWith: "ntf_" }, eventId: "evt_flagged", type: "ARRANGEMENT_FLAGGED" },
      select: { title: true, message: true, user: { select: { email: true } } },
    });
    const told = (email: string) => notices.filter((n) => n.user.email === email);
    const coordinator = told("coordinator@test.local");
    expect(coordinator.map((n) => n.title)).toEqual(Array(2).fill("Arrangements flagged for reconsideration"));
    expect(coordinator.filter((n) => n.message.endsWith(reason))).toHaveLength(1);
    expect(coordinator.filter((n) => n.message.endsWith("Change approved: Expected attendance."))).toHaveLength(1);
    expect(told("techsupport@test.local").filter((n) => n.message.endsWith(reason))).toHaveLength(1);
  });

  it("SCRUM-233 [AC15] TC-233-20: a seeded row shows each state a story can reach, so it can be tried by hand", async () => {
    const event = (id: string) =>
      prisma.event.findUniqueOrThrow({
        where: { id },
        select: {
          status: true,
          startAt: true,
          confirmedVenues: true,
          programme: true,
          specialRequests: true,
          registrationNotes: true,
          bookings: { select: { status: true, requestNotes: true, requiredAccessibilityFeatures: true, needsReconsideration: true } },
          safetyChecks: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
          changeRequests: { select: { status: true, requestsCancellation: true } },
          clarificationRequests: { select: { status: true } },
        },
      });

    // SCRUM-34 AC8: a retired venue and SCRUM-27 AC2: a retired equipment type.
    expect(await prisma.venue.count({ where: { id: { startsWith: "ven_" }, isActive: false } })).toBe(1);
    expect(await prisma.equipment.count({ where: { id: { startsWith: "eqp_" }, isActive: false } })).toBe(1);
    // SCRUM-159: a venue with setup and turnaround, whose booking kept them (AC8).
    expect(
      await prisma.booking.findUniqueOrThrow({
        where: { id: "bkg_change_pending" },
        select: { setupMinutes: true, turnaroundMinutes: true, venue: { select: { setupMinutes: true, turnaroundMinutes: true } } },
      }),
    ).toEqual({ setupMinutes: 30, turnaroundMinutes: 45, venue: { setupMinutes: 30, turnaroundMinutes: 45 } });
    // SCRUM-40 AC6: a judgement Venue Staff can read.
    expect(await prisma.venueSuitabilityJudgement.count({ where: { id: { startsWith: "vsj_" } } })).toBe(1);

    // SCRUM-162 AC7: two venues, both shown to Attendees.
    expect((await event("evt_two_venues")).confirmedVenues).toHaveLength(2);
    // SCRUM-85 AC2: confirmed again with new details, and its Attendee told.
    const notice = await prisma.notification.findUniqueOrThrow({
      where: { id: "ntf_event_changed" },
      select: { eventId: true, message: true },
    });
    expect(notice.eventId).toBe("evt_reconfirmed");
    expect(notice.message).toContain("is confirmed with new details");
    // SCRUM-128: a change waiting on a Confirmed event.
    expect((await event("evt_change_pending")).changeRequests).toEqual([
      { status: "PENDING_REVIEW", requestsCancellation: false },
    ]);
    // Approved, it must not leave more places than Black Box Studio has seats.
    const asked = await prisma.changeRequestField.findUniqueOrThrow({ where: { id: "chgf_pending_attendance" } });
    expect(Number(asked.newValue)).toBeGreaterThan(Number(asked.oldValue));
    expect(Number(asked.newValue)).toBeLessThanOrEqual(100);
    // SCRUM-166 AC9, AC10: the latest check Rejected, and its booking flagged.
    const rejectedCheck = await event("evt_safety_rejected");
    expect(rejectedCheck.safetyChecks).toEqual([{ status: "REJECTED" }]);
    expect(rejectedCheck.bookings[0].needsReconsideration).toBe(true);
    // SCRUM-13, SCRUM-50, SCRUM-171: the optional answers.
    const answers = await event("evt_every_answer");
    expect([answers.programme, answers.specialRequests, answers.registrationNotes]).not.toContain(null);
    expect(answers.bookings[0].requestNotes).not.toBeNull();
    expect(answers.bookings[0].requiredAccessibilityFeatures.length).toBeGreaterThan(0);
    // SCRUM-82 AC10: overdue in each status with a Coordinator.
    for (const [id, status] of [["evt_overdue_review", "UNDER_REVIEW"], ["evt_overdue_planning", "PLANNING"]]) {
      const overdue = await event(id);
      expect(overdue.status, id).toBe(status);
      expect(overdue.startAt!.getTime(), id).toBeLessThan(Date.now());
    }
    // SCRUM-117 AC3: rejecting from Planning released its booking.
    const rejected = await event("evt_rejected_from_planning");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.bookings).toEqual([expect.objectContaining({ status: "CANCELLED" })]);
    // SCRUM-18: answered, and waiting for the Coordinator.
    const answered = await event("evt_clarification_answered");
    expect(answered.status).toBe("UNDER_REVIEW");
    expect(answered.clarificationRequests).toEqual([{ status: "ANSWERED" }]);
  });

  it("SCRUM-233 [AC15] TC-233-21: an overdue Planning event has every readiness item complete, which the other overdue Planning event doesn't", async () => {
    const event = await prisma.event.findUniqueOrThrow({
      where: { id: "evt_overdue_ready" },
      select: { status: true, startAt: true },
    });
    expect(event.status).toBe("PLANNING");
    // SCRUM-82 AC10: overdue means the start has passed.
    expect(event.startAt!.getTime()).toBeLessThan(Date.now());

    const incomplete = async (id: string) =>
      (await getReadinessChecklist(prisma, id))!.items.filter((item) => !item.complete).map((item) => item.name);
    expect(await incomplete("evt_overdue_ready")).toEqual([]);
    expect(await incomplete("evt_overdue_planning")).toEqual(["Venue booking", "Equipment", "Safety check"]);
  });

  it("SCRUM-233 [AC4, AC15] TC-233-22: the Confirmed event's reported reservation reads as the report writes it, and leaves the event, its safety check and its registration as they were", async () => {
    const report = "The reserved projector failed its lamp test.";
    const reason = `Technical Support can no longer provide it: ${report}`;
    const event = await prisma.event.findUniqueOrThrow({
      where: { id: "evt_reservation_reported" },
      select: {
        status: true,
        safetyChecks: { select: { status: true } },
        registrations: { select: { status: true } },
        reservations: { select: { id: true, status: true, needsReconsideration: true, reconsiderationReason: true, reconsiderationFlaggedAt: true } },
      },
    });

    // SCRUM-32 AC1, SCRUM-26 AC2: a flag doesn't change a status.
    expect(event.status).toBe("CONFIRMED");
    expect(event.reservations).toEqual([
      expect.objectContaining({ id: "res_reported_projector", status: "CONFIRMED", needsReconsideration: true, reconsiderationReason: reason }),
    ]);
    // SCRUM-26 AC10 and AC13: only cancelling it outdates the check, and a flag
    // never touches a registration.
    expect(event.safetyChecks).toEqual([{ status: "APPROVED" }]);
    expect(event.registrations).toEqual([{ status: "REGISTERED" }]);
    expect((await history("evt_reservation_reported")).map((s) => s.newValue)).toEqual(["APPROVED", "PLANNING", "CONFIRMED"]);

    // SCRUM-32 AC5: recorded with who and when, after the event was confirmed.
    const [{ reconsiderationFlaggedAt: flaggedAt }] = event.reservations;
    const recorded = await prisma.auditLog.findMany({
      where: { id: { startsWith: "aud_" }, entityId: "res_reported_projector", action: "REPORTED_UNPROVIDABLE" },
      select: { actorId: true, summary: true, createdAt: true },
    });
    expect(recorded).toEqual([{ actorId: "usr_techsupport", summary: report, createdAt: flaggedAt }]);
    const confirmedAt = await prisma.auditLog.findFirstOrThrow({
      where: { id: { startsWith: "aud_" }, entityId: "evt_reservation_reported", newValue: "CONFIRMED" },
      select: { createdAt: true },
    });
    expect(confirmedAt.createdAt.getTime()).toBeLessThan(flaggedAt!.getTime());

    // SCRUM-124 AC8: the report tells the Coordinator and Technical Support.
    const notices = await prisma.notification.findMany({
      where: { id: { startsWith: "ntf_" }, eventId: "evt_reservation_reported", type: "ARRANGEMENT_FLAGGED" },
      orderBy: { userId: "asc" },
      select: { userId: true, title: true, message: true },
    });
    expect(notices.map((n) => [n.userId, n.title])).toEqual([
      ["usr_coordinator", "Arrangements flagged for reconsideration"],
      ["usr_techsupport", "Reservations flagged for reconsideration"],
    ]);
    for (const notice of notices) expect(notice.message.endsWith(reason), notice.userId).toBe(true);
  });

  it("SCRUM-233 [AC14] TC-233-26: every live hold has the notices holding it writes ahead, its reminder a day before it expires and its expiry notice when it does", async () => {
    const holds = await prisma.booking.findMany({
      where: { id: { startsWith: "bkg_" }, status: "HELD" },
      select: { id: true, holdExpiresAt: true },
    });
    expect(holds.map((hold) => hold.id).sort()).toEqual(["bkg_held", "bkg_hold_approved"]);

    for (const hold of holds) {
      const notices = await prisma.notification.findMany({
        where: { bookingId: hold.id, withdrawnAt: null },
        select: { type: true, showFromAt: true },
      });
      const shownAt = (type: string) => notices.filter((n) => n.type === type).map((n) => n.showFromAt);
      expect(shownAt("BOOKING_HELD"), hold.id).toHaveLength(1);
      expect(shownAt("HOLD_EXPIRY_REMINDER"), hold.id).toEqual([new Date(hold.holdExpiresAt!.getTime() - 24 * 60 * 60 * 1000)]);
      expect(shownAt("HOLD_EXPIRED"), hold.id).toEqual([hold.holdExpiresAt]);
    }
  });

  it("SCRUM-233 [AC14] TC-233-27: every live booking is at a venue with the facilities its event asks for", async () => {
    const bookings = await prisma.booking.findMany({
      where: { id: { startsWith: "bkg_" }, status: { in: ["PENDING", "HELD", "APPROVED"] } },
      select: { id: true, event: { select: { requiredFacilities: true } }, venue: { select: { facilities: true } } },
    });
    expect(bookings.length).toBeGreaterThan(0);

    for (const { id, event, venue } of bookings) {
      expect(venue.facilities, id).toEqual(expect.arrayContaining(event.requiredFacilities));
    }
  });

  it("SCRUM-233 [AC14] TC-233-28: no open equipment request asks for more than the pool owns, and the line short of stock is short only of what's free", async () => {
    const lines = await prisma.equipmentRequestLine.findMany({
      where: { id: { startsWith: "eql_" }, removedAt: null, request: { status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] } } },
      select: { id: true, quantity: true, equipment: { select: { totalQuantity: true } } },
    });
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.quantity, line.id).toBeLessThanOrEqual(line.equipment.totalQuantity);
    }

    // SCRUM-28 AC4: within the 10 owned, and one more than the 4 left free.
    const short = await prisma.equipmentRequestLine.findUniqueOrThrow({ where: { id: "eql_in_review_projector" } });
    const away = await prisma.equipmentUnavailability.findUniqueOrThrow({ where: { id: "eun_projector_workshop" } });
    const event = await prisma.event.findUniqueOrThrow({ where: { id: "evt_equipment_in_review" } });
    expect(away.startAt.getTime()).toBeLessThanOrEqual(event.startAt!.getTime());
    expect(away.endAt.getTime()).toBeGreaterThanOrEqual(event.endAt!.getTime());
    expect(10 - away.quantity).toBe(4);
    expect(short.quantity).toBe(5);
  });
});
