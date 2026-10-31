import { describe, it, expect } from "vitest";
import {
  BookingStatus,
  ClarificationStatus,
  ChangeRequestStatus,
  EquipmentRequestStatus,
  EventStatus,
  NotificationType,
  RegistrationStatus,
  RejectionOutcome,
  ReservationStatus,
  SafetyCheckStatus,
  UnavailabilityReason,
  VenueUnavailabilityReason,
} from "@prisma/client";

import { prisma } from "@/lib/db";

// SCRUM-238 against the seeded database (prisma/seed.ts): every status has a
// seeded row and every role has its work waiting. It only reads the rows the
// seed owns (their fixed ids), so other suites writing alongside don't change
// it; it runs against a local database, like the other integration suites.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const seeded = (prefix: string) => ({ id: { startsWith: prefix } });
const valuesOf = async <T,>(rows: Promise<{ v: T }[]>) => new Set((await rows).map((r) => r.v));

describe.skipIf(!usesLocalDatabase)("SCRUM-238 — the seed covers every role and status", () => {
  it("SCRUM-238 [AC2] TC-238-01: every status of every workflow record has a seeded row", async () => {
    const statuses = {
      event: [Object.values(EventStatus), valuesOf(prisma.event.findMany({ where: seeded("evt_"), select: { status: true } }).then((r) => r.map((x) => ({ v: x.status }))))],
      booking: [Object.values(BookingStatus), valuesOf(prisma.booking.findMany({ where: seeded("bkg_"), select: { status: true } }).then((r) => r.map((x) => ({ v: x.status }))))],
      equipmentRequest: [Object.values(EquipmentRequestStatus), valuesOf(prisma.equipmentRequest.findMany({ where: seeded("eqr_"), select: { status: true } }).then((r) => r.map((x) => ({ v: x.status }))))],
      reservation: [Object.values(ReservationStatus), valuesOf(prisma.reservation.findMany({ where: seeded("res_"), select: { status: true } }).then((r) => r.map((x) => ({ v: x.status }))))],
      registration: [Object.values(RegistrationStatus), valuesOf(prisma.registration.findMany({ where: seeded("reg_"), select: { status: true } }).then((r) => r.map((x) => ({ v: x.status }))))],
      clarification: [Object.values(ClarificationStatus), valuesOf(prisma.clarificationRequest.findMany({ where: seeded("clr_"), select: { status: true } }).then((r) => r.map((x) => ({ v: x.status }))))],
      changeRequest: [Object.values(ChangeRequestStatus), valuesOf(prisma.eventChangeRequest.findMany({ where: seeded("chg_"), select: { status: true } }).then((r) => r.map((x) => ({ v: x.status }))))],
      safetyCheck: [Object.values(SafetyCheckStatus), valuesOf(prisma.safetyCheck.findMany({ where: seeded("sfc_"), select: { status: true } }).then((r) => r.map((x) => ({ v: x.status }))))],
      rejectionOutcome: [Object.values(RejectionOutcome), valuesOf(prisma.event.findMany({ where: { ...seeded("evt_"), rejectionOutcome: { not: null } }, select: { rejectionOutcome: true } }).then((r) => r.map((x) => ({ v: x.rejectionOutcome! }))))],
      venueUnavailability: [Object.values(VenueUnavailabilityReason), valuesOf(prisma.venueUnavailability.findMany({ where: seeded("vun_"), select: { reason: true } }).then((r) => r.map((x) => ({ v: x.reason }))))],
      equipmentUnavailability: [Object.values(UnavailabilityReason), valuesOf(prisma.equipmentUnavailability.findMany({ where: seeded("eun_"), select: { reason: true } }).then((r) => r.map((x) => ({ v: x.reason }))))],
    } as const;

    // SCRUM-233: no event rests in Approved, since approval saves Planning
    // (SCRUM-81 AC1); the status shows only in history.
    const unseeded: Record<string, string[]> = { event: [EventStatus.APPROVED] };
    for (const [record, [all, present]] of Object.entries(statuses)) {
      const found = await present;
      const missing = (all as string[]).filter(
        (value) => !found.has(value as never) && !unseeded[record]?.includes(value),
      );
      expect(missing, `${record} statuses with no seeded row`).toEqual([]);
    }
  });

  it("SCRUM-238 [AC2] TC-238-01: every notification type is seeded, for a person who holds the role that receives it", async () => {
    const rows = await prisma.notification.findMany({
      where: seeded("ntf_"),
      select: { type: true, user: { select: { role: true, additionalRoles: true } } },
    });

    // SCRUM-233: no action writes Reservation cancelled, so a seeded one would
    // be a notice the app can't send.
    const types = new Set<NotificationType>([...rows.map((row) => row.type), NotificationType.RESERVATION_CANCELLED]);
    expect(Object.values(NotificationType).filter((type) => !types.has(type))).toEqual([]);
    expect(rows.map((row) => row.type)).not.toContain(NotificationType.RESERVATION_CANCELLED);

    const staffOnly: Partial<Record<NotificationType, string>> = {
      BOOKING_REQUESTED: "VENUE_STAFF",
      EQUIPMENT_REQUEST_SUBMITTED: "TECH_SUPPORT",
      REQUEST_AWAITING_ASSIGNMENT: "COORDINATOR_LEAD",
      SAFETY_CHECK_REQUESTED: "SAFETY_OFFICER",
      REGISTERED_EVENT_CHANGED: "ATTENDEE",
    };
    for (const row of rows) {
      const role = staffOnly[row.type];
      if (role) expect([row.user.role, ...row.user.additionalRoles], row.type).toContain(role);
    }
  });

  it("SCRUM-238 [AC1] TC-238-02: each role has work waiting to act on", async () => {
    const event = (id: string) => prisma.event.findUniqueOrThrow({ where: { id }, select: { status: true, coordinatorId: true, startAt: true, expectedAttendance: true } });
    const booking = (id: string) => prisma.booking.findUniqueOrThrow({ where: { id }, select: { status: true, needsReconsideration: true, holdApprovedAt: true } });

    // Lead: an unassigned request whose start has passed.
    const overdue = await event("evt_submitted_overdue");
    expect(overdue).toMatchObject({ status: "SUBMITTED", coordinatorId: null });
    expect(overdue.startAt!.getTime()).toBeLessThan(Date.now());

    // Safety Officer: a check awaiting review.
    expect(await prisma.safetyCheck.findUniqueOrThrow({ where: { id: "sfc_awaiting" }, select: { status: true } })).toEqual({ status: "AWAITING_REVIEW" });

    // Venue Staff: a second pending request, a hold, a hold approved for the Coordinator, a flag.
    expect(await booking("bkg_pending_2")).toMatchObject({ status: "PENDING" });
    expect(await booking("bkg_held")).toMatchObject({ status: "HELD", holdApprovedAt: null });
    expect((await booking("bkg_hold_approved")).holdApprovedAt).not.toBeNull();
    expect(await booking("bkg_flagged")).toMatchObject({ status: "APPROVED", needsReconsideration: true });

    // Technical Support: one in review, one approved with nothing reserved, a flagged reservation.
    expect(await prisma.equipmentRequest.findUniqueOrThrow({ where: { id: "eqr_in_review" }, select: { status: true } })).toEqual({ status: "IN_REVIEW" });
    expect(await prisma.equipmentRequest.findUniqueOrThrow({ where: { id: "eqr_ready_to_reserve" }, select: { status: true, _count: { select: { reservations: true } } } })).toEqual({ status: "APPROVED", _count: { reservations: 0 } });
    expect(await prisma.reservation.findUniqueOrThrow({ where: { id: "res_flagged_mic" }, select: { needsReconsideration: true } })).toEqual({ needsReconsideration: true });

    // Organiser: a question naming fields to change, and a complete draft to submit.
    expect(await prisma.clarificationRequest.findUniqueOrThrow({ where: { id: "clr_editable" }, select: { status: true, editableFields: true } })).toEqual({ status: "OPEN", editableFields: ["expectedAttendance", "preferredLayout"] });
    expect(await event("evt_draft_ready")).toMatchObject({ status: "DRAFT", expectedAttendance: 100 });

    // Coordinator: a cancellation request to decide, and an event ready to confirm.
    expect(await prisma.eventChangeRequest.findUniqueOrThrow({ where: { id: "chg_cancellation" }, select: { status: true, requestsCancellation: true } })).toEqual({ status: "PENDING_REVIEW", requestsCancellation: true });
    expect(await prisma.safetyCheck.findUniqueOrThrow({ where: { id: "sfc_approved" }, select: { status: true, eventId: true } })).toEqual({ status: "APPROVED", eventId: "evt_ready_to_confirm" });
  });

  it("SCRUM-238 [AC1] TC-238-02: the multi-role account organises one event and coordinates another", async () => {
    const organised = await prisma.event.findUniqueOrThrow({ where: { id: "evt_multirole_organised" }, select: { organiserId: true, bookings: { select: { status: true } } } });
    const coordinated = await prisma.event.findUniqueOrThrow({ where: { id: "evt_multirole_coordinated" }, select: { coordinatorId: true } });

    expect(organised).toEqual({ organiserId: "usr_multirole", bookings: [{ status: "PENDING" }] });
    expect(coordinated).toEqual({ coordinatorId: "usr_multirole" });
  });
});
