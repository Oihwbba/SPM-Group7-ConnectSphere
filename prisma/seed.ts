/**
 * ConnectSphere seed data.
 *
 * Run with `npm run db:seed`, or automatically by `npm run db:reset`.
 *
 * Three rules this file must keep obeying:
 *
 *  1. IDEMPOTENT. Every row is upserted on a stable primary key, so running
 *     it twice changes nothing. Never add a bare `create`.
 *
 *  2. DETERMINISTIC IDs. Tests and Playwright specs reference these ids
 *     directly. Do not rename one without updating its callers.
 *
 *  3. DEMONSTRABLE. Every scenario below exists so a specific acceptance
 *     criterion can be shown working in a sprint review — a venue with an
 *     existing booking to collide with, an event one seat short of capacity,
 *     a registration window that has closed. The story key is named in the
 *     comment. If you add data, say which story needs it.
 *
 * Dates are RELATIVE to today (midnight UTC), not hard-coded, so that
 * "registration closes next week" is still true in Week 11. Ids stay fixed;
 * only the instants move.
 */
import {
  PrismaClient,
  Role,
  EventStatus,
  BookingStatus,
  RegistrationStatus,
  ClarificationStatus,
  EquipmentRequestStatus,
  ReservationStatus,
  UnavailabilityReason,
  VenueUnavailabilityReason,
  ChangeRequestStatus,
  NotificationType,
  RejectionOutcome,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

// Same pg driver adapter as lib/db.ts, so the seed runs on any architecture
// (including Windows-on-ARM) without the native query engine.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Everyone shares this password locally. NEVER do this outside seed data.
const DEV_PASSWORD = "Password123!";

// --- Time helpers ----------------------------------------------------------
// Midnight UTC today, so every run on a given day produces identical data.
const DAY_MS = 24 * 60 * 60 * 1000;
const BASE = new Date();
BASE.setUTCHours(0, 0, 0, 0);

/** `at(10, 2)` = 10 days from today at 02:00 UTC (10:00 Singapore time). */
function at(dayOffset: number, hourUTC: number): Date {
  return new Date(BASE.getTime() + dayOffset * DAY_MS + hourUTC * 60 * 60 * 1000);
}

// --- Stable ids ------------------------------------------------------------

const U = {
  organiser: "usr_organiser",
  coordinator: "usr_coordinator",
  venueStaff: "usr_venuestaff",
  techSupport: "usr_techsupport",
  attendee: "usr_attendee",
  organiser2: "usr_organiser_2",
  coordinator2: "usr_coordinator_2",
  attendee2: "usr_attendee_2",
  attendee3: "usr_attendee_3",
  attendee4: "usr_attendee_4",
} as const;

const V = {
  auditorium: "ven_auditorium",
  seminar: "ven_seminar",
  hall: "ven_hall",
  boardroom: "ven_boardroom",
} as const;

const EQ = {
  projector: "eqp_projector",
  mic: "eqp_mic",
  laptop: "eqp_laptop",
  speaker: "eqp_speaker",
  lectern: "eqp_lectern",
} as const;

const E = {
  draft: "evt_draft",
  submitted: "evt_submitted",
  underReview: "evt_under_review",
  approved: "evt_approved",
  planning: "evt_planning",
  confirmed: "evt_confirmed",
  completed: "evt_completed",
  cancelled: "evt_cancelled",
  rejected: "evt_rejected",
  full: "evt_full",
  lastSeat: "evt_last_seat",
  regNotOpen: "evt_reg_not_open",
  regClosed: "evt_reg_closed",
  otherOrganiser: "evt_other_organiser",
} as const;

// ---------------------------------------------------------------------------
// Users — SCRUM-65 (sign in), SCRUM-66/67 (one account per role to demo
// role-gating), SCRUM-68/70 (a second organiser and extra attendees so
// cross-user access denial is actually testable).
// ---------------------------------------------------------------------------

async function seedUsers(passwordHash: string) {
  const users = [
    { id: U.organiser, email: "organiser@test.local", name: "Olivia Organiser", role: Role.ORGANISER },
    { id: U.coordinator, email: "coordinator@test.local", name: "Cody Coordinator", role: Role.COORDINATOR },
    { id: U.venueStaff, email: "venuestaff@test.local", name: "Vera Venue", role: Role.VENUE_STAFF },
    { id: U.techSupport, email: "techsupport@test.local", name: "Theo Tech", role: Role.TECH_SUPPORT },
    { id: U.attendee, email: "attendee@test.local", name: "Aria Attendee", role: Role.ATTENDEE },
    // SCRUM-68: Organiser A must not be able to load Organiser B's event.
    { id: U.organiser2, email: "organiser2@test.local", name: "Owen Organiser", role: Role.ORGANISER },
    // SCRUM-69: reassignment has to move an event between two real people.
    { id: U.coordinator2, email: "coordinator2@test.local", name: "Cara Coordinator", role: Role.COORDINATOR },
    // SCRUM-74: filling an event needs more than one attendee.
    { id: U.attendee2, email: "attendee2@test.local", name: "Amir Attendee", role: Role.ATTENDEE },
    { id: U.attendee3, email: "attendee3@test.local", name: "Ana Attendee", role: Role.ATTENDEE },
    { id: U.attendee4, email: "attendee4@test.local", name: "Ade Attendee", role: Role.ATTENDEE },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { email: u.email, name: u.name, role: u.role, passwordHash },
      create: { ...u, passwordHash },
    });
  }
  return users.length;
}

// ---------------------------------------------------------------------------
// Venues — SCRUM-34 (details incl. accessibility and layouts), SCRUM-38/40
// (capacities and facilities that make filters and the suitability check
// produce both a suitable and an unsuitable answer).
// ---------------------------------------------------------------------------

async function seedVenues() {
  const venues = [
    {
      id: V.auditorium,
      name: "Grand Auditorium",
      location: "Level 1, Block A",
      capacity: 500,
      facilities: ["stage", "projector", "sound-system", "livestream"],
      accessibilityFeatures: ["wheelchair-access", "hearing-loop", "accessible-restroom"],
      supportedLayouts: ["theatre"],
      operatingHours: "Mon–Sun 07:00–23:00",
      notes: "Requires a technician on site for any livestreamed event.",
    },
    {
      id: V.seminar,
      name: "Seminar Room 2.1",
      location: "Level 2, Block B",
      capacity: 60,
      facilities: ["projector", "whiteboard"],
      accessibilityFeatures: ["wheelchair-access"],
      supportedLayouts: ["classroom", "u-shape", "boardroom"],
      operatingHours: "Mon–Fri 08:00–20:00",
    },
    {
      id: V.hall,
      name: "Exhibition Hall",
      location: "Level 1, Block C",
      capacity: 200,
      facilities: ["open-floor", "loading-bay", "sound-system"],
      accessibilityFeatures: ["wheelchair-access", "accessible-restroom"],
      supportedLayouts: ["banquet", "exhibition", "theatre"],
      operatingHours: "Mon–Sun 06:00–22:00",
    },
    {
      // SCRUM-40: deliberately small and sparsely equipped, so the suitability
      // check has something to mark "not suitable".
      id: V.boardroom,
      name: "Executive Boardroom",
      location: "Level 12, Block A",
      capacity: 14,
      facilities: ["video-conferencing", "whiteboard"],
      accessibilityFeatures: [],
      supportedLayouts: ["boardroom"],
      operatingHours: "Mon–Fri 09:00–18:00",
    },
  ];

  for (const v of venues) {
    await prisma.venue.upsert({ where: { id: v.id }, update: v, create: v });
  }

  // SCRUM-34 AC3: the hours above as an opening and a closing time per day
  // (minutes after midnight SGT), or Closed. Booking periods are refused
  // outside them (AC7).
  const open = (opens: string, closes: string) => ({
    opensMinute: Number(opens.slice(0, 2)) * 60 + Number(opens.slice(3)),
    closesMinute: Number(closes.slice(0, 2)) * 60 + Number(closes.slice(3)),
  });
  const closed = { opensMinute: null, closesMinute: null };
  const weekHours: Record<string, (weekday: number) => typeof closed | ReturnType<typeof open>> = {
    [V.auditorium]: () => open("07:00", "23:00"),
    [V.seminar]: (d) => (d <= 5 ? open("08:00", "20:00") : closed),
    [V.hall]: () => open("06:00", "22:00"),
    [V.boardroom]: (d) => (d <= 5 ? open("09:00", "18:00") : closed),
  };
  for (const [venueId, hoursOn] of Object.entries(weekHours)) {
    for (let weekday = 1; weekday <= 7; weekday++) {
      const hours = hoursOn(weekday);
      await prisma.venueOpeningHours.upsert({
        where: { venueId_weekday: { venueId, weekday } },
        update: hours,
        create: { venueId, weekday, ...hours },
      });
    }
  }
  return venues.length;
}

/** SCRUM-36/37 — availability must show unavailability that is NOT a booking. */
async function seedVenueUnavailability() {
  const rows = [
    {
      id: "vun_seminar_maintenance",
      venueId: V.seminar,
      startAt: at(15, 0),
      endAt: at(16, 0),
      reason: VenueUnavailabilityReason.MAINTENANCE,
      note: "Annual air-conditioning service.",
      recordedById: U.venueStaff,
    },
  ];
  for (const r of rows) {
    await prisma.venueUnavailability.upsert({ where: { id: r.id }, update: r, create: r });
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Equipment — SCRUM-27 (the predefined list), SCRUM-29 (a pool with a
// maintenance hold, so availability is not simply totalQuantity).
// ---------------------------------------------------------------------------

async function seedEquipment() {
  const equipment = [
    { id: EQ.projector, type: "Projector", totalQuantity: 10, description: "Portable 4000-lumen projector", technicalSpecs: "HDMI + USB-C, 1080p" },
    { id: EQ.mic, type: "Wireless Microphone", totalQuantity: 25, description: "Handheld radio mic", technicalSpecs: "UHF, 8h battery" },
    { id: EQ.laptop, type: "Laptop", totalQuantity: 15, description: "Presentation laptop", technicalSpecs: "Windows 11, HDMI, USB-C" },
    { id: EQ.speaker, type: "PA Speaker", totalQuantity: 8, description: "Powered PA speaker", technicalSpecs: "300W, XLR in" },
    { id: EQ.lectern, type: "Lectern", totalQuantity: 4, description: "Podium with gooseneck mic" },
  ];

  for (const e of equipment) {
    await prisma.equipment.upsert({ where: { id: e.id }, update: e, create: e });
  }
  return equipment.length;
}

/** SCRUM-29/30 — "Under Maintenance" removes part of the pool, not all of it. */
async function seedEquipmentUnavailability() {
  const rows = [
    {
      id: "eun_projector_repair",
      equipmentId: EQ.projector,
      quantity: 3,
      startAt: at(8, 0),
      endAt: at(12, 0),
      reason: UnavailabilityReason.MAINTENANCE,
      note: "Three units away for lamp replacement — 7 of 10 remain available.",
      recordedById: U.techSupport,
    },
    {
      id: "eun_speaker_damaged",
      equipmentId: EQ.speaker,
      quantity: 1,
      startAt: at(0, 0),
      endAt: at(30, 0),
      reason: UnavailabilityReason.DAMAGED,
      note: "Blown driver, awaiting write-off.",
      recordedById: U.techSupport,
    },
  ];
  for (const r of rows) {
    await prisma.equipmentUnavailability.upsert({ where: { id: r.id }, update: r, create: r });
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Events — one per status (SCRUM-23's nine values), plus the boundary cases
// the registration stories need.
// ---------------------------------------------------------------------------

type EventSeed = Parameters<typeof prisma.event.create>[0]["data"] & { id: string };

async function seedEvents() {
  const common = {
    purpose: "Seeded example for local development and sprint demos.",
    requiredFacilities: ["projector"],
    accessibilityNeeds: "Step-free access to the stage.",
    preferredLayout: "theatre",
    equipmentRequirements: "Projector and two wireless microphones.",
  };

  const events: EventSeed[] = [
    // --- One per status -----------------------------------------------------
    {
      // SCRUM-15/16: a draft is intentionally incomplete — no dates, no
      // attendance. This is the row that proves those columns are nullable.
      id: E.draft,
      name: "Draft — Annual Tech Summit",
      description: "Still being written up; dates not decided.",
      status: EventStatus.DRAFT,
      organiserId: U.organiser,
      requiredFacilities: [],
    },
    {
      id: E.submitted,
      name: "Submitted — Alumni Homecoming",
      description: "Waiting for a coordinator to pick it up.",
      status: EventStatus.SUBMITTED,
      ...common,
      startAt: at(30, 2),
      endAt: at(30, 8),
      expectedAttendance: 180,
      organiserId: U.organiser,
      submittedAt: at(-2, 3),
    },
    {
      id: E.underReview,
      name: "Under Review — Career Fair",
      description: "Coordinator has asked a clarifying question.",
      status: EventStatus.UNDER_REVIEW,
      ...common,
      startAt: at(35, 1),
      endAt: at(35, 9),
      expectedAttendance: 400,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      submittedAt: at(-4, 3),
    },
    {
      id: E.approved,
      name: "Approved — Research Symposium",
      description: "Approved; no venue booked yet.",
      status: EventStatus.APPROVED,
      ...common,
      startAt: at(40, 1),
      endAt: at(40, 7),
      expectedAttendance: 150,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      submittedAt: at(-8, 3),
      decidedAt: at(-6, 3),
      decidedById: U.coordinator,
    },
    {
      // SCRUM-81: in planning because its venue booking is still PENDING.
      id: E.planning,
      name: "Planning — Freshman Orientation",
      description: "Venue requested, awaiting Venue Staff decision.",
      status: EventStatus.PLANNING,
      ...common,
      startAt: at(20, 1),
      endAt: at(20, 9),
      expectedAttendance: 55,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      submittedAt: at(-12, 3),
      decidedAt: at(-10, 3),
      decidedById: U.coordinator,
    },
    {
      // SCRUM-81: venue booked AND equipment reserved, so it reached confirmed
      // — which is what makes it visible to Attendees (SCRUM-72).
      id: E.confirmed,
      name: "Confirmed — Charity Gala",
      description: "Venue booked, equipment reserved, open for registration.",
      status: EventStatus.CONFIRMED,
      ...common,
      startAt: at(10, 1),
      endAt: at(10, 5),
      expectedAttendance: 120,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      submittedAt: at(-20, 3),
      decidedAt: at(-18, 3),
      decidedById: U.coordinator,
      registrationEnabled: true,
      registrationCapacity: 100,
      registrationOpensAt: at(-7, 0),
      registrationClosesAt: at(9, 12),
    },
    {
      id: E.completed,
      name: "Completed — Hackathon",
      description: "Ran last month.",
      status: EventStatus.COMPLETED,
      ...common,
      startAt: at(-30, 1),
      endAt: at(-29, 10),
      expectedAttendance: 90,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      submittedAt: at(-60, 3),
      decidedAt: at(-58, 3),
      decidedById: U.coordinator,
      completedAt: at(-29, 11),
    },
    {
      // SCRUM-82: a cancellation reason is recorded and visible.
      id: E.cancelled,
      name: "Cancelled — Winter Workshop",
      description: "Called off by the organiser.",
      status: EventStatus.CANCELLED,
      ...common,
      startAt: at(25, 1),
      endAt: at(25, 6),
      expectedAttendance: 40,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      submittedAt: at(-15, 3),
      cancelledAt: at(-1, 3),
      cancelledById: U.organiser,
      cancellationReason: "Speaker withdrew and no replacement was available.",
    },
    {
      // SCRUM-19: a rejection records a reason — and the database refuses to
      // store a REJECTED event without one.
      id: E.rejected,
      name: "Rejected — Overcapacity Concert",
      description: "Attendance far exceeded any available venue.",
      status: EventStatus.REJECTED,
      ...common,
      startAt: at(28, 10),
      endAt: at(28, 14),
      expectedAttendance: 2000,
      organiserId: U.organiser,
      submittedAt: at(-9, 3),
      decidedAt: at(-8, 3),
      decidedById: U.coordinator,
      decisionReason:
        "Expected attendance of 2000 exceeds the capacity of every venue in the catalogue (largest is 500).",
      // SCRUM-126: the database also refuses a rejection without an outcome.
      rejectionOutcome: RejectionOutcome.AMEND_AND_RESUBMIT,
    },

    // --- Registration boundary cases ---------------------------------------
    {
      // SCRUM-74: three places, three registrations — this event is FULL.
      id: E.full,
      name: "Full — Wine Tasting Evening",
      description: "Every place taken; use this to demo the full-event path.",
      status: EventStatus.CONFIRMED,
      ...common,
      startAt: at(12, 10),
      endAt: at(12, 13),
      expectedAttendance: 3,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      registrationEnabled: true,
      registrationCapacity: 3,
      registrationOpensAt: at(-5, 0),
      registrationClosesAt: at(11, 12),
    },
    {
      // SCRUM-74: three places, two taken — exactly ONE remaining. This is the
      // row the simultaneous-registration test uses.
      id: E.lastSeat,
      name: "One Place Left — Studio Masterclass",
      description: "Two of three places taken. Seeded for the concurrency test.",
      status: EventStatus.CONFIRMED,
      ...common,
      startAt: at(14, 6),
      endAt: at(14, 9),
      expectedAttendance: 3,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      registrationEnabled: true,
      registrationCapacity: 3,
      registrationOpensAt: at(-5, 0),
      registrationClosesAt: at(13, 12),
    },
    {
      // SCRUM-75: registration has not opened yet.
      id: E.regNotOpen,
      name: "Registration Not Yet Open — Summer Camp",
      description: "Registration opens in a week.",
      status: EventStatus.CONFIRMED,
      ...common,
      startAt: at(45, 1),
      endAt: at(45, 9),
      expectedAttendance: 80,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      registrationEnabled: true,
      registrationCapacity: 80,
      registrationOpensAt: at(7, 0),
      registrationClosesAt: at(44, 12),
    },
    {
      // SCRUM-75: registration has closed.
      id: E.regClosed,
      name: "Registration Closed — Leadership Retreat",
      description: "Registration closed yesterday.",
      status: EventStatus.CONFIRMED,
      ...common,
      startAt: at(5, 1),
      endAt: at(5, 9),
      expectedAttendance: 30,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      registrationEnabled: true,
      registrationCapacity: 30,
      registrationOpensAt: at(-20, 0),
      registrationClosesAt: at(-1, 12),
    },
    {
      // SCRUM-68: belongs to a DIFFERENT organiser. Loading this as
      // organiser@test.local must be refused, indistinguishably from
      // "not found".
      id: E.otherOrganiser,
      name: "Another Client's Event — Product Launch",
      description: "Owned by organiser2. Must not be visible to organiser1.",
      status: EventStatus.SUBMITTED,
      ...common,
      startAt: at(22, 2),
      endAt: at(22, 7),
      expectedAttendance: 75,
      organiserId: U.organiser2,
      submittedAt: at(-3, 3),
    },
  ];

  for (const e of events) {
    const { id, ...data } = e;
    await prisma.event.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return events.length;
}

// ---------------------------------------------------------------------------
// Venue bookings — SCRUM-50/52/53.
//
// The APPROVED rows below deliberately occupy different venue/day pairs: the
// database refuses two overlapping approved bookings on one venue, so any
// accidental clash here fails the seed loudly rather than silently.
// ---------------------------------------------------------------------------

async function seedBookings() {
  const bookings = [
    {
      // Backs the confirmed event.
      id: "bkg_confirmed",
      eventId: E.confirmed,
      venueId: V.hall,
      startAt: at(10, 1),
      endAt: at(10, 5),
      status: BookingStatus.APPROVED,
      requestedAttendance: 120,
      requiredFacilities: ["sound-system"],
      requestedLayout: "banquet",
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-16, 3),
    },
    {
      // SCRUM-36: gives the auditorium an existing booking, so availability
      // and search have a real collision to exclude.
      id: "bkg_auditorium_existing",
      eventId: E.approved,
      venueId: V.auditorium,
      startAt: at(40, 1),
      endAt: at(40, 7),
      status: BookingStatus.APPROVED,
      requestedAttendance: 150,
      requiredFacilities: ["projector", "stage"],
      requestedLayout: "theatre",
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-5, 3),
    },
    {
      // SCRUM-52: something for the Venue Staff queue to contain.
      id: "bkg_pending",
      eventId: E.planning,
      venueId: V.seminar,
      startAt: at(20, 1),
      endAt: at(20, 9),
      status: BookingStatus.PENDING,
      requestedAttendance: 55,
      requiredFacilities: ["projector", "whiteboard"],
      requestedLayout: "classroom",
      requestedById: U.coordinator,
    },
    {
      // SCRUM-53: a rejection carries its reason. The database would refuse
      // this row without one.
      id: "bkg_rejected",
      eventId: E.planning,
      venueId: V.boardroom,
      startAt: at(20, 1),
      endAt: at(20, 9),
      status: BookingStatus.REJECTED,
      requestedAttendance: 55,
      requiredFacilities: [],
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-2, 3),
      decisionReason: "Boardroom seats 14; the event expects 55 attendees.",
    },
    {
      // SCRUM-82: cancelling an event releases its booking.
      id: "bkg_cancelled",
      eventId: E.cancelled,
      venueId: V.seminar,
      startAt: at(25, 1),
      endAt: at(25, 6),
      status: BookingStatus.CANCELLED,
      requiredFacilities: [],
      requestedById: U.coordinator,
    },
    {
      id: "bkg_full_event",
      eventId: E.full,
      venueId: V.boardroom,
      startAt: at(12, 10),
      endAt: at(12, 13),
      status: BookingStatus.APPROVED,
      requestedAttendance: 3,
      requiredFacilities: [],
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-4, 3),
    },
    {
      id: "bkg_last_seat_event",
      eventId: E.lastSeat,
      venueId: V.boardroom,
      startAt: at(14, 6),
      endAt: at(14, 9),
      status: BookingStatus.APPROVED,
      requestedAttendance: 3,
      requiredFacilities: [],
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-4, 3),
    },
  ];

  for (const b of bookings) {
    const { id, ...data } = b;
    await prisma.booking.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return bookings.length;
}

// ---------------------------------------------------------------------------
// Equipment requests and reservations — SCRUM-27/28/31.
// ---------------------------------------------------------------------------

async function seedEquipmentRequests() {
  // One APPROVED request (its reservations back the confirmed event) and one
  // still PENDING_REVIEW for the Technical Support queue. Only one open
  // request may exist per event — the database enforces that — so these two
  // belong to different events on purpose.
  const requests = [
    {
      id: "eqr_confirmed",
      eventId: E.confirmed,
      requestedById: U.coordinator,
      status: EquipmentRequestStatus.APPROVED,
      notes: "Gala AV package.",
      decidedAt: at(-15, 3),
    },
    {
      id: "eqr_planning",
      eventId: E.planning,
      requestedById: U.coordinator,
      status: EquipmentRequestStatus.PENDING_REVIEW,
      notes: "Orientation needs a projector and two mics.",
    },
  ];
  for (const r of requests) {
    const { id, ...data } = r;
    await prisma.equipmentRequest.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  const lines = [
    { id: "eql_confirmed_projector", requestId: "eqr_confirmed", equipmentId: EQ.projector, quantity: 1, technicalRequirements: "HDMI from the stage lectern." },
    { id: "eql_confirmed_mic", requestId: "eqr_confirmed", equipmentId: EQ.mic, quantity: 4, technicalRequirements: "Two handheld, two lapel if available." },
    { id: "eql_planning_projector", requestId: "eqr_planning", equipmentId: EQ.projector, quantity: 1 },
    { id: "eql_planning_mic", requestId: "eqr_planning", equipmentId: EQ.mic, quantity: 2 },
  ];
  for (const l of lines) {
    const { id, ...data } = l;
    await prisma.equipmentRequestLine.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // SCRUM-28: "a chronological history log of all updates made."
  const updates = [
    { id: "equ_1", requestId: "eqr_confirmed", actorId: U.techSupport, fromStatus: EquipmentRequestStatus.PENDING_REVIEW, toStatus: EquipmentRequestStatus.IN_REVIEW, note: "Checking mic availability for that evening." },
    { id: "equ_2", requestId: "eqr_confirmed", actorId: U.techSupport, fromStatus: EquipmentRequestStatus.IN_REVIEW, toStatus: EquipmentRequestStatus.APPROVED, note: "All items available and reserved." },
  ];
  for (const u of updates) {
    const { id, ...data } = u;
    await prisma.equipmentRequestUpdate.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  return { requests: requests.length, lines: lines.length, updates: updates.length };
}

async function seedReservations() {
  const reservations = [
    {
      id: "res_confirmed_projector",
      eventId: E.confirmed,
      equipmentId: EQ.projector,
      requestId: "eqr_confirmed",
      quantity: 1,
      startAt: at(10, 1),
      endAt: at(10, 5),
      status: ReservationStatus.CONFIRMED,
      reservedById: U.techSupport,
    },
    {
      id: "res_confirmed_mic",
      eventId: E.confirmed,
      equipmentId: EQ.mic,
      requestId: "eqr_confirmed",
      quantity: 4,
      startAt: at(10, 1),
      endAt: at(10, 5),
      status: ReservationStatus.CONFIRMED,
      reservedById: U.techSupport,
    },
    {
      // SCRUM-32: a cancelled reservation returns its quantity to the pool —
      // and cancelling it again must NOT return it twice.
      id: "res_cancelled",
      eventId: E.cancelled,
      equipmentId: EQ.laptop,
      quantity: 2,
      startAt: at(25, 1),
      endAt: at(25, 6),
      status: ReservationStatus.CANCELLED,
      cancelledAt: at(-1, 3),
      reservedById: U.techSupport,
    },
  ];
  for (const r of reservations) {
    const { id, ...data } = r;
    await prisma.reservation.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return reservations.length;
}

// ---------------------------------------------------------------------------
// Registrations — SCRUM-73/74/76/77.
// ---------------------------------------------------------------------------

async function seedRegistrations() {
  const registrations = [
    // Confirmed gala: a few places taken out of 100, including one withdrawal
    // so the Attendee's list shows more than one status (SCRUM-76).
    { id: "reg_gala_1", eventId: E.confirmed, userId: U.attendee, status: RegistrationStatus.REGISTERED, registeredAt: at(-6, 4) },
    { id: "reg_gala_2", eventId: E.confirmed, userId: U.attendee2, status: RegistrationStatus.REGISTERED, registeredAt: at(-6, 5) },
    { id: "reg_gala_3", eventId: E.confirmed, userId: U.attendee3, status: RegistrationStatus.WITHDRAWN, registeredAt: at(-6, 6), withdrawnAt: at(-2, 2) },

    // SCRUM-74: three of three places taken — this event is FULL.
    { id: "reg_full_1", eventId: E.full, userId: U.attendee, status: RegistrationStatus.REGISTERED, registeredAt: at(-4, 4) },
    { id: "reg_full_2", eventId: E.full, userId: U.attendee2, status: RegistrationStatus.REGISTERED, registeredAt: at(-4, 5) },
    { id: "reg_full_3", eventId: E.full, userId: U.attendee3, status: RegistrationStatus.REGISTERED, registeredAt: at(-4, 6) },

    // SCRUM-74: two of three taken — attendee3 and attendee4 are both free to
    // take the last place, which is what the simultaneous-registration test
    // needs.
    { id: "reg_last_1", eventId: E.lastSeat, userId: U.attendee, status: RegistrationStatus.REGISTERED, registeredAt: at(-3, 4) },
    { id: "reg_last_2", eventId: E.lastSeat, userId: U.attendee2, status: RegistrationStatus.REGISTERED, registeredAt: at(-3, 5) },

    // SCRUM-82: cancelling an event cancels its registrations.
    { id: "reg_cancelled_1", eventId: E.cancelled, userId: U.attendee, status: RegistrationStatus.CANCELLED, registeredAt: at(-10, 4) },
  ];

  for (const r of registrations) {
    const { id, ...data } = r;
    await prisma.registration.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return registrations.length;
}

// ---------------------------------------------------------------------------
// Clarification and change requests — SCRUM-18, SCRUM-41/128.
// ---------------------------------------------------------------------------

async function seedClarifications() {
  const rows = [
    {
      id: "clr_career_fair",
      eventId: E.underReview,
      requestedById: U.coordinator,
      message:
        "Your expected attendance is 400 but you have asked for a classroom layout. Can you confirm the layout you need?",
      status: ClarificationStatus.OPEN,
    },
  ];
  for (const r of rows) {
    const { id, ...data } = r;
    await prisma.clarificationRequest.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return rows.length;
}

async function seedChangeRequests() {
  await prisma.eventChangeRequest.upsert({
    where: { id: "chg_planning_date" },
    update: {},
    create: {
      id: "chg_planning_date",
      eventId: E.planning,
      requestedById: U.organiser,
      status: ChangeRequestStatus.PENDING_REVIEW,
      reason: "The dean's address was moved, so orientation has to shift by a day.",
    },
  });

  // SCRUM-128 AC1: one row per changed field, so the review screen is a read.
  // SCRUM-41 AC5: `isMajor` marks an impactful field; approving one flags the
  // event's bookings and reservations (SCRUM-128 AC4), never its registrations
  // (SCRUM-26 AC13).
  const fields = [
    { id: "chgf_start", changeRequestId: "chg_planning_date", fieldName: "startAt", oldValue: at(20, 1).toISOString(), newValue: at(21, 1).toISOString(), isMajor: true },
    { id: "chgf_end", changeRequestId: "chg_planning_date", fieldName: "endAt", oldValue: at(20, 9).toISOString(), newValue: at(21, 9).toISOString(), isMajor: true },
    { id: "chgf_desc", changeRequestId: "chg_planning_date", fieldName: "description", oldValue: "Venue requested, awaiting Venue Staff decision.", newValue: "Moved by one day at the dean's request.", isMajor: false },
  ];
  for (const f of fields) {
    const { id, ...data } = f;
    await prisma.changeRequestField.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return fields.length;
}

// ---------------------------------------------------------------------------
// Notifications — SCRUM-45/48/85/124. Enough rows that the list has both
// read and unread entries and an obvious ordering.
// ---------------------------------------------------------------------------

async function seedNotifications() {
  const rows = [
    { id: "ntf_1", userId: U.organiser, type: NotificationType.COORDINATOR_ASSIGNED, title: "A coordinator was assigned", message: "Cody Coordinator is now the coordinator for Under Review — Career Fair.", eventId: E.underReview, createdAt: at(-4, 3), readAt: at(-4, 4) },
    { id: "ntf_2", userId: U.organiser, type: NotificationType.CLARIFICATION_REQUESTED, title: "Clarification requested", message: "Your coordinator has asked a question about Under Review — Career Fair.", eventId: E.underReview, createdAt: at(-3, 3) },
    { id: "ntf_3", userId: U.organiser, type: NotificationType.EVENT_STATUS_CHANGED, title: "Event rejected", message: "Rejected — Overcapacity Concert was rejected.", eventId: E.rejected, createdAt: at(-8, 3) },
    { id: "ntf_4", userId: U.coordinator, type: NotificationType.BOOKING_DECISION, title: "Booking rejected", message: "Executive Boardroom was rejected for Planning — Freshman Orientation: capacity 14 is below 55 attendees.", eventId: E.planning, createdAt: at(-2, 3) },
    { id: "ntf_5", userId: U.attendee, type: NotificationType.REGISTRATION_CONFIRMED, title: "You are registered", message: "Your place at Confirmed — Charity Gala is confirmed.", eventId: E.confirmed, createdAt: at(-6, 4) },
    { id: "ntf_6", userId: U.attendee, type: NotificationType.REGISTERED_EVENT_CANCELLED, title: "An event you registered for was cancelled", message: "Cancelled — Winter Workshop will no longer go ahead.", eventId: E.cancelled, createdAt: at(-1, 3) },
  ];
  for (const n of rows) {
    const { id, ...data } = n;
    await prisma.notification.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Audit trail — SCRUM-71, and SCRUM-21's "a record exists of who was
// previously assigned".
// ---------------------------------------------------------------------------

async function seedAuditLog() {
  const rows = [
    { id: "aud_1", entityType: "Event", entityId: E.confirmed, action: "STATUS_CHANGED", actorId: U.coordinator, fieldName: "status", oldValue: "APPROVED", newValue: "PLANNING", createdAt: at(-18, 3) },
    { id: "aud_2", entityType: "Event", entityId: E.confirmed, action: "STATUS_CHANGED", actorId: null, fieldName: "status", oldValue: "PLANNING", newValue: "CONFIRMED", summary: "Venue booked and equipment reserved.", createdAt: at(-15, 4) },
    { id: "aud_3", entityType: "Event", entityId: E.underReview, action: "REASSIGNED", actorId: U.coordinator2, fieldName: "coordinatorId", oldValue: U.coordinator2, newValue: U.coordinator, summary: "Reassigned on return from leave.", createdAt: at(-4, 2) },
    { id: "aud_4", entityType: "Booking", entityId: "bkg_rejected", action: "REJECTED", actorId: U.venueStaff, summary: "Capacity 14 below expected attendance 55.", createdAt: at(-2, 3) },
  ];
  for (const a of rows) {
    const { id, ...data } = a;
    await prisma.auditLog.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return rows.length;
}

// ---------------------------------------------------------------------------

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  // Order matters: every block below depends on the ones above it.
  const users = await seedUsers(passwordHash);
  const venues = await seedVenues();
  const venueUnavail = await seedVenueUnavailability();
  const equipment = await seedEquipment();
  const equipUnavail = await seedEquipmentUnavailability();
  const events = await seedEvents();
  const bookings = await seedBookings();
  const eq = await seedEquipmentRequests();
  const reservations = await seedReservations();
  const registrations = await seedRegistrations();
  const clarifications = await seedClarifications();
  const changeFields = await seedChangeRequests();
  const notifications = await seedNotifications();
  const audit = await seedAuditLog();

  console.log("Seed complete:");
  console.log(`  ${users} users (5 roles, plus a 2nd organiser/coordinator and 3 extra attendees)`);
  console.log(`  ${venues} venues, ${venueUnavail} venue unavailability period(s)`);
  console.log(`  ${equipment} equipment types, ${equipUnavail} equipment unavailability period(s)`);
  console.log(`  ${events} events (one per status, plus registration boundary cases)`);
  console.log(`  ${bookings} venue bookings`);
  console.log(`  ${eq.requests} equipment requests, ${eq.lines} lines, ${eq.updates} history entries`);
  console.log(`  ${reservations} equipment reservations`);
  console.log(`  ${registrations} registrations`);
  console.log(`  ${clarifications} clarification request(s), 1 change request with ${changeFields} fields`);
  console.log(`  ${notifications} notifications, ${audit} audit entries`);
  console.log("");
  console.log(`  Every user's password is: ${DEV_PASSWORD}`);
  console.log("  Sign in as organiser@test.local to see the organiser's view.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
