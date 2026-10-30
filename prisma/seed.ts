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
  SafetyCheckStatus,
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

/**
 * SCRUM-34 AC7 — the first day from `dayOffset` that is a weekday in
 * Singapore. Seminar Room 2.1 and the Executive Boardroom are closed at
 * weekends, so their seeded bookings land on a weekday whatever day the seed
 * runs, and stay within the hours the seed gives them.
 */
function weekdayFrom(dayOffset: number): number {
  const sgWeekday = (d: number) => new Date(at(d, 4).getTime() + 8 * 60 * 60 * 1000).getUTCDay();
  let day = dayOffset;
  while (sgWeekday(day) === 0 || sgWeekday(day) === 6) day++;
  return day;
}
// The planning event's pending Seminar Room request, and the change request
// proposing to move it a day later.
const PLANNING_DAY = weekdayFrom(20);
const PLANNING_MOVED_DAY = weekdayFrom(PLANNING_DAY + 1);
// The two Boardroom bookings, on different days so they never overlap.
const FULL_DAY = weekdayFrom(12);
const LAST_SEAT_DAY = weekdayFrom(Math.max(14, FULL_DAY + 1));
// SCRUM-233: the cancelled event's Seminar Room booking, on a weekday.
const CANCELLED_DAY = weekdayFrom(25);

// --- Stable ids ------------------------------------------------------------

const U = {
  organiser: "usr_organiser",
  coordinator: "usr_coordinator",
  venueStaff: "usr_venuestaff",
  venueStaff2: "usr_venuestaff_2",
  techSupport: "usr_techsupport",
  attendee: "usr_attendee",
  organiser2: "usr_organiser_2",
  coordinator2: "usr_coordinator_2",
  attendee2: "usr_attendee_2",
  attendee3: "usr_attendee_3",
  attendee4: "usr_attendee_4",
  safetyOfficer: "usr_safetyofficer",
  coordinatorLead: "usr_coordinatorlead",
  coordinatorLead2: "usr_coordinatorlead_2",
  safetyOfficer2: "usr_safetyofficer_2",
  multiRole: "usr_multirole",
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
  const users: { id: string; email: string; name: string; role: Role; additionalRoles?: Role[] }[] = [
    { id: U.organiser, email: "organiser@test.local", name: "Olivia Organiser", role: Role.ORGANISER },
    { id: U.coordinator, email: "coordinator@test.local", name: "Cody Coordinator", role: Role.COORDINATOR },
    { id: U.venueStaff, email: "venuestaff@test.local", name: "Vera Venue", role: Role.VENUE_STAFF },
    // SCRUM-53 AC5: two members of Venue Staff approving at the same moment.
    // Seeded rather than made by a test: every Venue Staff member is told of
    // venue requests (SCRUM-124), so one appearing mid-run would change what
    // other suites count.
    { id: U.venueStaff2, email: "venuestaff2@test.local", name: "Victor Venue", role: Role.VENUE_STAFF },
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
    // SCRUM-166: reviews operational safety checks.
    { id: U.safetyOfficer, email: "safety@test.local", name: "Sam Safety", role: Role.SAFETY_OFFICER },
    // SCRUM-164: the Event Coordinator Lead (Week 7 change 5).
    { id: U.coordinatorLead, email: "lead@test.local", name: "Lee Lead", role: Role.COORDINATOR_LEAD },
    // SCRUM-165 AC6: two Leads assigning at once. Seeded rather than made by a
    // test, like the second Safety Officer below.
    { id: U.coordinatorLead2, email: "lead2@test.local", name: "Lena Lead", role: Role.COORDINATOR_LEAD },
    // SCRUM-166 AC8: two Safety Officers recording at once. Seeded rather than
    // made by a test: every Safety Officer is told of each requested check, so
    // one appearing or vanishing mid-run would race other suites.
    { id: U.safetyOfficer2, email: "safety2@test.local", name: "Sasha Safety", role: Role.SAFETY_OFFICER },
    // SCRUM-121: one account holding several roles, two of them with an
    // events view. The Lead can assign it events as a Coordinator, but never
    // one it organises (AC4).
    {
      id: U.multiRole,
      email: "multirole@test.local",
      name: "Morgan Multirole",
      role: Role.VENUE_STAFF,
      additionalRoles: [Role.TECH_SUPPORT, Role.COORDINATOR, Role.ORGANISER],
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        email: u.email,
        name: u.name,
        role: u.role,
        additionalRoles: u.additionalRoles ?? [],
        passwordHash,
      },
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
// Events — one per status an event can rest in, plus the boundary cases the
// registration stories need. Approved is not one: approval saves Planning
// (SCRUM-81 AC1, SCRUM-135 AC12), so it shows only in an event's history
// (SCRUM-233).
// ---------------------------------------------------------------------------

type EventSeed = Parameters<typeof prisma.event.create>[0]["data"] & { id: string };

async function seedEvents() {
  const common = {
    purpose: "Seeded example for local development and sprint demos.",
    requiredFacilities: ["projector"],
    accessibilityNeeds: "Step-free access to the stage.",
    preferredLayout: "theatre",
    equipmentRequirements: "Projector and two wireless microphones.",
    // SCRUM-13/14: submitting requires Venue Requirements (SCRUM-233).
    venueRequirements: "A hall with a stage and step-free access.",
  };
  // SCRUM-233, SCRUM-81: a Confirmed event was submitted and approved first.
  const approvedBy = (submittedDay: number) => ({
    submittedAt: at(submittedDay, 3),
    decidedAt: at(submittedDay + 2, 3),
    decidedById: U.coordinator,
  });
  // SCRUM-170: these events need no equipment, so their readiness checklist
  // records that decision instead of a reservation (SCRUM-233).
  const noEquipment = (recordedDay: number) => ({
    equipmentRequirements: null,
    noEquipmentNeededAt: at(recordedDay, 3),
    noEquipmentNeededById: U.coordinator,
  });

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
      // SCRUM-81 AC1, SCRUM-135 AC12: approval saves Planning, so no event
      // stays Approved; its history shows the approval (SCRUM-233). The id is
      // kept because the equipment and booking tests use it.
      id: E.approved,
      name: "Planning — Research Symposium",
      description: "Approved and in planning; its venue is booked.",
      status: EventStatus.PLANNING,
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
      startAt: at(PLANNING_DAY, 1),
      endAt: at(PLANNING_DAY, 9),
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
      // SCRUM-74: the capacity is the expected attendance (SCRUM-233).
      registrationCapacity: 120,
      registrationOpensAt: at(-7, 0),
      registrationClosesAt: at(9, 12),
    },
    {
      // SCRUM-190: an event takes place within one day (09:00–18:00 SGT).
      id: E.completed,
      name: "Completed — Hackathon",
      description: "Ran last month.",
      status: EventStatus.COMPLETED,
      ...common,
      startAt: at(-30, 1),
      endAt: at(-30, 10),
      expectedAttendance: 90,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      submittedAt: at(-60, 3),
      decidedAt: at(-58, 3),
      decidedById: U.coordinator,
      // SCRUM-73, SCRUM-75: its registration was taken while open, after
      // approval and before the start; completing leaves it enabled (SCRUM-233).
      registrationEnabled: true,
      registrationCapacity: 90,
      registrationOpensAt: at(-50, 0),
      registrationClosesAt: at(-31, 12),
      completedAt: at(-30, 11),
    },
    {
      // SCRUM-82: a cancellation reason is recorded and visible. It was
      // Confirmed with registration open, so it could take a registration
      // (SCRUM-73), and its assigned Coordinator cancelled it (SCRUM-82 AC1).
      id: E.cancelled,
      name: "Cancelled — Winter Workshop",
      description: "Called off after the speaker withdrew.",
      status: EventStatus.CANCELLED,
      ...common,
      startAt: at(CANCELLED_DAY, 1),
      endAt: at(CANCELLED_DAY, 6),
      expectedAttendance: 40,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      ...approvedBy(-15),
      registrationEnabled: true,
      registrationCapacity: 40,
      registrationOpensAt: at(-11, 0),
      registrationClosesAt: at(CANCELLED_DAY - 1, 12),
      cancelledAt: at(-1, 3),
      cancelledById: U.coordinator,
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
      // SCRUM-135 AC4: only a request with a Coordinator can be rejected.
      coordinatorId: U.coordinator,
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
      startAt: at(FULL_DAY, 7),
      endAt: at(FULL_DAY, 10),
      expectedAttendance: 3,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      ...approvedBy(-12),
      ...noEquipment(-8),
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
      startAt: at(LAST_SEAT_DAY, 6),
      endAt: at(LAST_SEAT_DAY, 9),
      expectedAttendance: 3,
      organiserId: U.organiser,
      coordinatorId: U.coordinator,
      ...approvedBy(-12),
      ...noEquipment(-8),
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
      ...approvedBy(-10),
      ...noEquipment(-6),
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
      ...approvedBy(-26),
      ...noEquipment(-22),
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
      startAt: at(PLANNING_DAY, 1),
      endAt: at(PLANNING_DAY, 9),
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
      startAt: at(PLANNING_DAY, 1),
      endAt: at(PLANNING_DAY, 9),
      status: BookingStatus.REJECTED,
      requestedAttendance: 55,
      requiredFacilities: [],
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-2, 3),
      decisionReason: "Boardroom seats 14; the event expects 55 attendees.",
    },
    {
      // SCRUM-82: cancelling an event releases its booking. It was approved
      // before the event was cancelled.
      id: "bkg_cancelled",
      eventId: E.cancelled,
      venueId: V.seminar,
      startAt: at(CANCELLED_DAY, 1),
      endAt: at(CANCELLED_DAY, 6),
      status: BookingStatus.CANCELLED,
      requestedAttendance: 40,
      requiredFacilities: [],
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-13, 3),
    },
    {
      id: "bkg_full_event",
      eventId: E.full,
      venueId: V.boardroom,
      startAt: at(FULL_DAY, 7),
      endAt: at(FULL_DAY, 10),
      status: BookingStatus.APPROVED,
      requestedAttendance: 3,
      requiredFacilities: [],
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-8, 3),
    },
    {
      id: "bkg_last_seat_event",
      eventId: E.lastSeat,
      venueId: V.boardroom,
      startAt: at(LAST_SEAT_DAY, 6),
      endAt: at(LAST_SEAT_DAY, 9),
      status: BookingStatus.APPROVED,
      requestedAttendance: 3,
      requiredFacilities: [],
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-8, 3),
    },
    // SCRUM-233: every Confirmed event has an approved venue covering it, so
    // Attendees see where it is (SCRUM-85).
    {
      id: "bkg_reg_not_open",
      eventId: E.regNotOpen,
      venueId: V.hall,
      startAt: at(45, 1),
      endAt: at(45, 9),
      status: BookingStatus.APPROVED,
      requestedAttendance: 80,
      requiredFacilities: [],
      requestedLayout: "theatre",
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-8, 3),
    },
    {
      id: "bkg_reg_closed",
      eventId: E.regClosed,
      venueId: V.hall,
      startAt: at(5, 1),
      endAt: at(5, 9),
      status: BookingStatus.APPROVED,
      requestedAttendance: 30,
      requiredFacilities: [],
      requestedLayout: "theatre",
      requestedById: U.coordinator,
      decidedById: U.venueStaff,
      decidedAt: at(-24, 3),
    },
  ];

  for (const b of bookings) {
    const { id, ...data } = b;
    await prisma.booking.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return bookings.length;
}

// SCRUM-85 — each seeded Confirmed event was last confirmed as it stands, so
// re-planning it shows Attendees those details. The same rule as the
// migration that added the fields.
async function seedConfirmedDetails() {
  await prisma.$executeRaw`
    UPDATE "Event" e
    SET "confirmedStartAt" = e."startAt",
        "confirmedEndAt" = e."endAt",
        "confirmedVenues" = COALESCE(
          (SELECT array_agg(v."name" || ' — ' || v."location" ORDER BY b."createdAt")
           FROM "Booking" b JOIN "Venue" v ON v."id" = b."venueId"
           WHERE b."eventId" = e."id" AND b."status" = 'APPROVED'),
          ARRAY[]::TEXT[])
    WHERE e."status" = 'CONFIRMED'`;
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
    // SCRUM-155: the cancelled event's laptops were reserved from an approved
    // request, which cancelling the event then cancelled (SCRUM-82).
    {
      id: "eqr_winter_workshop",
      eventId: E.cancelled,
      requestedById: U.coordinator,
      status: EquipmentRequestStatus.CANCELLED,
      notes: "Laptops for the workshop exercises.",
      decidedAt: at(-12, 3),
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
    { id: "eql_winter_workshop_laptop", requestId: "eqr_winter_workshop", equipmentId: EQ.laptop, quantity: 2 },
  ];
  for (const l of lines) {
    const { id, ...data } = l;
    await prisma.equipmentRequestLine.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // SCRUM-28: "a chronological history log of all updates made."
  const updates = [
    { id: "equ_1", requestId: "eqr_confirmed", actorId: U.techSupport, fromStatus: EquipmentRequestStatus.PENDING_REVIEW, toStatus: EquipmentRequestStatus.IN_REVIEW, note: "Checking mic availability for that evening." },
    { id: "equ_2", requestId: "eqr_confirmed", actorId: U.techSupport, fromStatus: EquipmentRequestStatus.IN_REVIEW, toStatus: EquipmentRequestStatus.APPROVED, note: "All items available and reserved." },
    { id: "equ_winter_workshop_1", requestId: "eqr_winter_workshop", actorId: U.techSupport, fromStatus: EquipmentRequestStatus.PENDING_REVIEW, toStatus: EquipmentRequestStatus.IN_REVIEW, note: "Checking laptop stock.", createdAt: at(-12, 2) },
    { id: "equ_winter_workshop_2", requestId: "eqr_winter_workshop", actorId: U.techSupport, fromStatus: EquipmentRequestStatus.IN_REVIEW, toStatus: EquipmentRequestStatus.APPROVED, note: "Two laptops available.", createdAt: at(-12, 3) },
    { id: "equ_winter_workshop_3", requestId: "eqr_winter_workshop", actorId: U.coordinator, fromStatus: EquipmentRequestStatus.APPROVED, toStatus: EquipmentRequestStatus.CANCELLED, note: "Cancelled because the event was cancelled: Speaker withdrew and no replacement was available.", createdAt: at(-1, 3) },
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
      requestId: "eqr_winter_workshop",
      quantity: 2,
      startAt: at(CANCELLED_DAY, 1),
      endAt: at(CANCELLED_DAY, 6),
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

/**
 * SCRUM-233 — SCRUM-81 confirms only an event whose readiness checklist is
 * complete (SCRUM-110), which includes an Approved safety check (SCRUM-166).
 * Each check names the arrangements it reviewed.
 */
async function seedConfirmedSafetyChecks() {
  const approved = (id: string, eventId: string, decidedDay: number) => ({
    id,
    eventId,
    status: SafetyCheckStatus.APPROVED,
    requestedById: U.coordinator,
    decidedById: U.safetyOfficer,
    decidedAt: at(decidedDay, 3),
    createdAt: at(decidedDay - 1, 3),
  });
  const checks = [
    approved("sfc_confirmed", E.confirmed, -15),
    approved("sfc_full", E.full, -6),
    approved("sfc_last_seat", E.lastSeat, -6),
    approved("sfc_reg_not_open", E.regNotOpen, -5),
    approved("sfc_reg_closed", E.regClosed, -21),
    approved("sfc_winter_workshop", E.cancelled, -12),
  ];
  for (const c of checks) {
    const { id, ...data } = c;
    await prisma.safetyCheck.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  const arrangements = [
    { id: "sfa_confirmed_booking", checkId: "sfc_confirmed", bookingId: "bkg_confirmed" },
    { id: "sfa_confirmed_projector", checkId: "sfc_confirmed", reservationId: "res_confirmed_projector" },
    { id: "sfa_confirmed_mic", checkId: "sfc_confirmed", reservationId: "res_confirmed_mic" },
    { id: "sfa_full_booking", checkId: "sfc_full", bookingId: "bkg_full_event" },
    { id: "sfa_last_seat_booking", checkId: "sfc_last_seat", bookingId: "bkg_last_seat_event" },
    { id: "sfa_reg_not_open_booking", checkId: "sfc_reg_not_open", bookingId: "bkg_reg_not_open" },
    { id: "sfa_reg_closed_booking", checkId: "sfc_reg_closed", bookingId: "bkg_reg_closed" },
    { id: "sfa_winter_workshop_booking", checkId: "sfc_winter_workshop", bookingId: "bkg_cancelled" },
    { id: "sfa_winter_workshop_laptop", checkId: "sfc_winter_workshop", reservationId: "res_cancelled" },
  ];
  for (const a of arrangements) {
    const { id, ...data } = a;
    await prisma.safetyCheckArrangement.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return checks.length;
}

// ---------------------------------------------------------------------------
// Registrations — SCRUM-73/74/76/77.
// ---------------------------------------------------------------------------

async function seedRegistrations() {
  const registrations = [
    // Confirmed gala: a few places taken out of 120, including one withdrawal
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
        "Your expected attendance is 400 in a theatre layout, which only the Grand Auditorium can seat. Can you confirm the attendance, so we can check the Auditorium for your date?",
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
    { id: "chgf_start", changeRequestId: "chg_planning_date", fieldName: "startAt", oldValue: at(PLANNING_DAY, 1).toISOString(), newValue: at(PLANNING_MOVED_DAY, 1).toISOString(), isMajor: true },
    { id: "chgf_end", changeRequestId: "chg_planning_date", fieldName: "endAt", oldValue: at(PLANNING_DAY, 9).toISOString(), newValue: at(PLANNING_MOVED_DAY, 9).toISOString(), isMajor: true },
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
    // SCRUM-45 AC3: as transitionEventStatus words it, with the reason and the next step.
    { id: "ntf_3", userId: U.organiser, type: NotificationType.EVENT_STATUS_CHANGED, title: "Your request was rejected", message: "\"Rejected — Overcapacity Concert\" was rejected: Expected attendance of 2000 exceeds the capacity of every venue in the catalogue (largest is 500). What you can do next: Amend and resubmit.", eventId: E.rejected, createdAt: at(-8, 3) },
    { id: "ntf_4", userId: U.coordinator, type: NotificationType.BOOKING_DECISION, title: "Booking rejected", message: "Executive Boardroom was rejected for Planning — Freshman Orientation: capacity 14 is below 55 attendees.", eventId: E.planning, createdAt: at(-2, 3) },
    { id: "ntf_5", userId: U.attendee, type: NotificationType.REGISTRATION_CONFIRMED, title: "You are registered", message: "Your place at Confirmed — Charity Gala is confirmed.", eventId: E.confirmed, createdAt: at(-6, 4) },
    // SCRUM-82: the notices cancelInTransaction sends its Organiser, the
    // Coordinator who cancelled and each registered Attendee, with the reason
    // (SCRUM-233).
    { id: "ntf_cancelled_organiser", userId: U.organiser, type: NotificationType.EVENT_STATUS_CHANGED, title: "Event cancelled", message: "\"Cancelled — Winter Workshop\" was cancelled: Speaker withdrew and no replacement was available.", eventId: E.cancelled, createdAt: at(-1, 3) },
    { id: "ntf_cancelled_coordinator", userId: U.coordinator, type: NotificationType.EVENT_STATUS_CHANGED, title: "Event cancelled", message: "\"Cancelled — Winter Workshop\" was cancelled: Speaker withdrew and no replacement was available.", eventId: E.cancelled, createdAt: at(-1, 3) },
    { id: "ntf_6", userId: U.attendee, type: NotificationType.REGISTERED_EVENT_CANCELLED, title: "An event you registered for was cancelled", message: "\"Cancelled — Winter Workshop\" was cancelled: Speaker withdrew and no replacement was available.", eventId: E.cancelled, createdAt: at(-1, 3) },
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
  // SCRUM-233: each Confirmed event's history shows how it got there, once
  // its arrangements and safety check were in place.
  const confirmedHistory = (prefix: string, eventId: string, approvedAt: Date, confirmedAt: Date) => [
    { id: `${prefix}_approved`, entityType: "Event", entityId: eventId, action: "STATUS_CHANGED", actorId: U.coordinator, fieldName: "status", oldValue: "UNDER_REVIEW", newValue: "APPROVED", createdAt: approvedAt },
    { id: `${prefix}_planning`, entityType: "Event", entityId: eventId, action: "STATUS_CHANGED", actorId: null, fieldName: "status", oldValue: "APPROVED", newValue: "PLANNING", summary: "Moved to Planning on approval (SCRUM-81)", createdAt: new Date(approvedAt.getTime() + 1000) },
    { id: `${prefix}_confirmed`, entityType: "Event", entityId: eventId, action: "STATUS_CHANGED", actorId: U.coordinator, fieldName: "status", oldValue: "PLANNING", newValue: "CONFIRMED", summary: "Confirmed by the assigned coordinator (SCRUM-81)", createdAt: confirmedAt },
  ];
  const rows = [
    // SCRUM-233, ADR 0012: approving writes the Coordinator's approval and the
    // system's move to Planning (no actor); confirming records the Coordinator.
    // The move is a second later, so the history lists them in order.
    { id: "aud_confirmed_approved", entityType: "Event", entityId: E.confirmed, action: "STATUS_CHANGED", actorId: U.coordinator, fieldName: "status", oldValue: "UNDER_REVIEW", newValue: "APPROVED", createdAt: at(-18, 3) },
    { id: "aud_1", entityType: "Event", entityId: E.confirmed, action: "STATUS_CHANGED", actorId: null, fieldName: "status", oldValue: "APPROVED", newValue: "PLANNING", summary: "Moved to Planning on approval (SCRUM-81)", createdAt: new Date(at(-18, 3).getTime() + 1000) },
    { id: "aud_2", entityType: "Event", entityId: E.confirmed, action: "STATUS_CHANGED", actorId: U.coordinator, fieldName: "status", oldValue: "PLANNING", newValue: "CONFIRMED", summary: "Confirmed by the assigned coordinator (SCRUM-81)", createdAt: at(-15, 4) },
    { id: "aud_approved_approved", entityType: "Event", entityId: E.approved, action: "STATUS_CHANGED", actorId: U.coordinator, fieldName: "status", oldValue: "UNDER_REVIEW", newValue: "APPROVED", createdAt: at(-6, 3) },
    { id: "aud_approved_planning", entityType: "Event", entityId: E.approved, action: "STATUS_CHANGED", actorId: null, fieldName: "status", oldValue: "APPROVED", newValue: "PLANNING", summary: "Moved to Planning on approval (SCRUM-81)", createdAt: new Date(at(-6, 3).getTime() + 1000) },
    ...confirmedHistory("aud_full", E.full, at(-10, 3), at(-6, 4)),
    ...confirmedHistory("aud_last_seat", E.lastSeat, at(-10, 3), at(-6, 4)),
    ...confirmedHistory("aud_reg_not_open", E.regNotOpen, at(-8, 3), at(-5, 4)),
    ...confirmedHistory("aud_reg_closed", E.regClosed, at(-24, 3), at(-21, 4)),
    ...confirmedHistory("aud_cancelled", E.cancelled, at(-13, 3), at(-12, 4)),
    // SCRUM-82: what completeFinishedEvents writes once a Confirmed event ends.
    ...confirmedHistory("aud_completed", E.completed, at(-58, 3), at(-52, 4)),
    { id: "aud_completed_completed", entityType: "Event", entityId: E.completed, action: "STATUS_CHANGED", actorId: null, fieldName: "status", oldValue: "CONFIRMED", newValue: "COMPLETED", summary: "Completed after its end time (SCRUM-82)", createdAt: at(-30, 11) },
    // SCRUM-21: reassigning is the Lead's action.
    { id: "aud_3", entityType: "Event", entityId: E.underReview, action: "REASSIGNED", actorId: U.coordinatorLead, fieldName: "coordinatorId", oldValue: U.coordinator2, newValue: U.coordinator, summary: "Reassigned by the Lead from Cara Coordinator to Cody Coordinator (SCRUM-21)", createdAt: at(-4, 2) },
    // SCRUM-82: what cancelInTransaction writes when the Coordinator cancels.
    { id: "aud_cancelled_status", entityType: "Event", entityId: E.cancelled, action: "STATUS_CHANGED", actorId: U.coordinator, fieldName: "status", oldValue: "CONFIRMED", newValue: "CANCELLED", summary: "Speaker withdrew and no replacement was available.", createdAt: at(-1, 3) },
    { id: "aud_cancelled_released", entityType: "Event", entityId: E.cancelled, action: "ARRANGEMENTS_RELEASED", actorId: U.coordinator, summary: "Cancelled (SCRUM-82): 1 venue booking(s), 1 equipment reservation(s), 1 equipment request(s) and 1 registration(s) cancelled; 0 safety check(s) outdated; 0 change request(s) rejected.", createdAt: at(-1, 3) },
    { id: "aud_4", entityType: "Booking", entityId: "bkg_rejected", action: "REJECTED", actorId: U.venueStaff, summary: "Capacity 14 below expected attendance 55.", createdAt: at(-2, 3) },
  ];
  for (const a of rows) {
    const { id, ...data } = a;
    await prisma.auditLog.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// SCRUM-238 — one scenario for every role's work, and a row in every status.
//
// Everything above stays as it is: tests rely on it. These rows sit 50 or more
// days out, on venue/day pairs nothing else uses, so they never clash with the
// rows above or with the dates the tests pick. Each event belongs to Olivia
// Organiser and Cody Coordinator unless it says otherwise.
// ---------------------------------------------------------------------------

const W = {
  safetyAwaiting: "evt_safety_awaiting",
  safetyChanges: "evt_safety_changes",
  readyToConfirm: "evt_ready_to_confirm",
  hold: "evt_hold",
  holdApproved: "evt_hold_approved",
  flagged: "evt_flagged",
  equipmentInReview: "evt_equipment_in_review",
  readyToReserve: "evt_ready_to_reserve",
  cancellationRequested: "evt_cancellation_requested",
  noRegistration: "evt_no_registration",
  replanning: "evt_replanning",
  draftReady: "evt_draft_ready",
  draftDiscarded: "evt_draft_discarded",
  rejectedNewRequest: "evt_rejected_new_request",
  clarificationFields: "evt_clarification_fields",
  submittedOverdue: "evt_submitted_overdue",
  multiRoleOrganised: "evt_multirole_organised",
  multiRoleCoordinated: "evt_multirole_coordinated",
} as const;

const WD = {
  safetyAwaiting: 52,
  safetyChanges: 55,
  readyToConfirm: weekdayFrom(58),
  hold: weekdayFrom(61),
  holdApproved: weekdayFrom(64),
  flagged: 67,
  equipmentInReview: 70,
  readyToReserve: 73,
  cancellationRequested: 76,
  noRegistration: 79,
  draftReady: 80,
  multiRoleOrganised: weekdayFrom(82),
  replanning: 85,
  multiRoleCoordinated: 88,
  rejectedNewRequest: 90,
  clarificationFields: 92,
};

/** 09:00–17:00 SGT on `day`, inside every venue's opening hours. */
const workday = (day: number) => ({ startAt: at(day, 1), endAt: at(day, 9) });

async function seedWorkflowEvents() {
  const common = {
    purpose: "Seeded so every role has work to see and act on (SCRUM-238).",
    requiredFacilities: ["projector"],
    accessibilityNeeds: "Step-free access to the stage.",
    preferredLayout: "theatre",
    equipmentRequirements: "Microphones for the speakers.",
    venueRequirements: "A room with a projector and step-free access.",
    organiserId: U.organiser,
  };
  // SCRUM-233: the Confirmed events below need no equipment (SCRUM-170).
  const noEquipment = { equipmentRequirements: null, noEquipmentNeededAt: at(-10, 3), noEquipmentNeededById: U.coordinator };
  const planned = (coordinatorId: string, day: number, attendance: number) => ({
    ...common,
    ...workday(day),
    expectedAttendance: attendance,
    coordinatorId,
    supervisingLeadId: U.coordinatorLead,
    submittedAt: at(-14, 3),
    decidedAt: at(-12, 3),
    decidedById: coordinatorId,
  });

  const events: EventSeed[] = [
    // SCRUM-166: the Safety Officer's queue. Venue approved and equipment
    // reserved, with a check awaiting review (an earlier one went Outdated).
    { id: W.safetyAwaiting, name: "Safety Review — Engineering Open Day", description: "Venue and equipment in place; the safety check awaits review.", status: EventStatus.PLANNING, ...planned(U.coordinator, WD.safetyAwaiting, 150) },
    // SCRUM-166 AC3: Changes requested, for Cara Coordinator to act on; SCRUM-170:
    // No equipment needed recorded.
    {
      id: W.safetyChanges,
      name: "Safety Changes — Robotics Showcase",
      description: "The Safety Officer asked for changes to the stage layout.",
      status: EventStatus.PLANNING,
      ...planned(U.coordinator2, WD.safetyChanges, 300),
      equipmentRequirements: null,
      noEquipmentNeededAt: at(-5, 3),
      noEquipmentNeededById: U.coordinator2,
    },
    // SCRUM-81: venue, equipment and safety check all done — ready to confirm.
    { id: W.readyToConfirm, name: "Ready to Confirm — Alumni Networking Night", description: "Every checklist item is complete; the Coordinator can confirm it.", status: EventStatus.PLANNING, ...planned(U.coordinator, WD.readyToConfirm, 50) },
    // SCRUM-163: a tentative hold for Venue Staff to approve, change or release,
    // and an earlier hold that expired.
    { id: W.hold, name: "On Hold — Design Week Kickoff", description: "The Boardroom is held while the speakers confirm.", status: EventStatus.PLANNING, ...planned(U.coordinator, WD.hold, 12) },
    // SCRUM-163 AC7: Venue Staff approved the hold; the Coordinator confirms or releases it.
    { id: W.holdApproved, name: "Hold Approved — Founders' Breakfast", description: "Venue Staff approved the hold; it waits for the Coordinator.", status: EventStatus.PLANNING, ...planned(U.coordinator, WD.holdApproved, 40) },
    // SCRUM-26/128: an approved change flagged the booking and the reservation.
    { id: W.flagged, name: "Flagged — Sustainability Forum", description: "Attendance grew after approval, so its arrangements need reconsidering.", status: EventStatus.PLANNING, ...planned(U.coordinator, WD.flagged, 350) },
    // SCRUM-28/52/134: an equipment request in review with a short line, and a
    // second pending venue request so the Venue Staff queue has an order.
    { id: W.equipmentInReview, name: "Equipment In Review — Media Workshop", description: "Technical Support is reviewing its equipment.", status: EventStatus.PLANNING, ...planned(U.coordinator, WD.equipmentInReview, 120) },
    // SCRUM-155: an approved request with nothing reserved yet.
    { id: W.readyToReserve, name: "Ready to Reserve — Robotics Open House", description: "Equipment approved and waiting for Technical Support to reserve it.", status: EventStatus.PLANNING, ...planned(U.coordinator, WD.readyToReserve, 90) },
    // SCRUM-41/128 AC8: a Confirmed event whose Organiser asked to cancel it.
    {
      id: W.cancellationRequested,
      name: "Cancellation Requested — Spring Concert",
      description: "Confirmed; the Organiser has asked for it to be cancelled.",
      status: EventStatus.CONFIRMED,
      ...planned(U.coordinator, WD.cancellationRequested, 250),
      ...noEquipment,
      registrationRequired: true,
      registrationEnabled: true,
      registrationCapacity: 250,
      registrationOpensAt: at(-3, 0),
      registrationClosesAt: at(WD.cancellationRequested - 1, 12),
    },
    // SCRUM-171: a Confirmed event that takes no registrations.
    { id: W.noRegistration, name: "No Registration — Staff Appreciation Lunch", description: "Confirmed, by invitation only.", status: EventStatus.CONFIRMED, ...planned(U.coordinator, WD.noRegistration, 80), ...noEquipment, registrationRequired: false, registrationEnabled: false },
    // SCRUM-85 AC9: confirmed, then re-planned after a change; Attendees still
    // see the last confirmed details.
    { id: W.replanning, name: "Re-planning — Jazz Night", description: "A change moved it back into planning after it was confirmed.", status: EventStatus.PLANNING, ...planned(U.coordinator, WD.replanning, 150), registrationRequired: true, registrationEnabled: true, registrationCapacity: 150, registrationOpensAt: at(-10, 0), registrationClosesAt: at(WD.replanning - 1, 12) },
    // SCRUM-15/16: a complete draft, ready to submit.
    { id: W.draftReady, name: "Draft Ready — Graduate Research Showcase", description: "Every field filled in; ready to submit.", status: EventStatus.DRAFT, ...common, ...workday(WD.draftReady), expectedAttendance: 100 },
    // SCRUM-17: a discarded draft, no longer listed.
    { id: W.draftDiscarded, name: "Discarded Draft — Book Club Social", description: "Started, then discarded.", status: EventStatus.DRAFT, ...common, requiredFacilities: [], discardedAt: at(-3, 4) },
    // SCRUM-126: rejected with "submit a new request" as the outcome.
    { id: W.rejectedNewRequest, name: "Rejected (New Request) — Night Market", description: "Rejected; the Organiser needs to submit a new request.", status: EventStatus.REJECTED, ...common, ...workday(WD.rejectedNewRequest), expectedAttendance: 600, coordinatorId: U.coordinator, submittedAt: at(-9, 3), decidedAt: at(-7, 3), decidedById: U.coordinator, decisionReason: "An outdoor night market isn't something our venues can host; please request an indoor event instead.", rejectionOutcome: RejectionOutcome.NEW_REQUEST },
    // SCRUM-108: a clarification naming the fields the Organiser may change.
    { id: W.clarificationFields, name: "Clarification Asked — Community Concert", description: "The Coordinator asked about attendance and layout.", status: EventStatus.UNDER_REVIEW, ...common, ...workday(WD.clarificationFields), expectedAttendance: 450, coordinatorId: U.coordinator, supervisingLeadId: U.coordinatorLead, submittedAt: at(-5, 3) },
    // SCRUM-82 AC10, SCRUM-165: unassigned, and its start has passed — overdue.
    { id: W.submittedOverdue, name: "Overdue — Orientation Volunteers Briefing", description: "Submitted but never assigned, and its date has passed.", status: EventStatus.SUBMITTED, ...common, ...workday(-2), expectedAttendance: 30, submittedAt: at(-20, 3) },
    // SCRUM-121 AC5: organised by the multi-role account, so it can't decide
    // this event's venue request as Venue Staff.
    { id: W.multiRoleOrganised, name: "Multi-role Organiser — Lab Tour", description: "Organised by Morgan Multirole, who is also Venue Staff.", status: EventStatus.PLANNING, ...planned(U.coordinator, WD.multiRoleOrganised, 12), organiserId: U.multiRole },
    // SCRUM-121: coordinated by the multi-role account.
    { id: W.multiRoleCoordinated, name: "Multi-role Coordinator — Debate Finals", description: "Coordinated by Morgan Multirole.", status: EventStatus.UNDER_REVIEW, ...common, ...workday(WD.multiRoleCoordinated), expectedAttendance: 200, coordinatorId: U.multiRole, supervisingLeadId: U.coordinatorLead2, submittedAt: at(-6, 3) },
  ];

  for (const e of events) {
    const { id, ...data } = e;
    await prisma.event.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // SCRUM-85 AC9: what Attendees were last told about the re-planned event.
  await prisma.event.update({
    where: { id: W.replanning },
    data: {
      confirmedStartAt: at(WD.replanning - 1, 1),
      confirmedEndAt: at(WD.replanning - 1, 9),
      confirmedVenues: ["Exhibition Hall — Level 1, Block C"],
    },
  });

  // SCRUM-131/166: a venue restriction for the Safety Officer to weigh.
  await prisma.venue.update({
    where: { id: V.hall },
    data: { knownRestrictions: "Loading bay closes at 20:00; no open flames on the exhibition floor." },
  });
  return events.length;
}

async function seedWorkflowBookings() {
  const approved = (id: string, eventId: string, venueId: string, day: number, attendance: number) => ({
    id,
    eventId,
    venueId,
    ...workday(day),
    status: BookingStatus.APPROVED,
    requestedAttendance: attendance,
    requiredFacilities: [],
    requestedById: U.coordinator,
    decidedById: U.venueStaff,
    decidedAt: at(-8, 3),
  });

  const bookings = [
    approved("bkg_safety_awaiting", W.safetyAwaiting, V.hall, WD.safetyAwaiting, 150),
    { ...approved("bkg_safety_changes", W.safetyChanges, V.auditorium, WD.safetyChanges, 300), requestedById: U.coordinator2 },
    approved("bkg_ready_to_confirm", W.readyToConfirm, V.seminar, WD.readyToConfirm, 50),
    // SCRUM-163: held until five days from now.
    {
      id: "bkg_held",
      eventId: W.hold,
      venueId: V.boardroom,
      ...workday(WD.hold),
      status: BookingStatus.HELD,
      requestedAttendance: 12,
      requiredFacilities: ["video-conferencing"],
      requestedById: U.coordinator,
      heldAt: at(-1, 3),
      holdExpiresAt: at(5, 4),
      holdNote: "Held while the keynote speakers confirm their dates.",
    },
    // SCRUM-163 AC4: an earlier hold that ran out.
    {
      id: "bkg_expired",
      eventId: W.hold,
      venueId: V.hall,
      ...workday(WD.hold),
      status: BookingStatus.EXPIRED,
      requestedAttendance: 12,
      requiredFacilities: [],
      requestedById: U.coordinator,
      heldAt: at(-9, 3),
      holdExpiresAt: at(-2, 3),
      holdNote: "Held as a fallback while the Boardroom was checked.",
    },
    // SCRUM-163 AC7: approved by Venue Staff, waiting for the Coordinator.
    {
      id: "bkg_hold_approved",
      eventId: W.holdApproved,
      venueId: V.seminar,
      ...workday(WD.holdApproved),
      status: BookingStatus.HELD,
      requestedAttendance: 40,
      requiredFacilities: ["whiteboard"],
      requestedById: U.coordinator,
      heldAt: at(-4, 3),
      holdExpiresAt: at(6, 4),
      holdNote: "Held for the founders' breakfast; caterer to confirm numbers.",
      holdApprovedAt: at(-2, 3),
      holdApprovedById: U.venueStaff,
    },
    // SCRUM-26/128 AC4: flagged when the attendance change was approved.
    {
      ...approved("bkg_flagged", W.flagged, V.auditorium, WD.flagged, 250),
      needsReconsideration: true,
      reconsiderationFlaggedAt: at(-1, 5),
      reconsiderationReason: "Expected attendance changed from 250 to 350 by an approved change request.",
    },
    // SCRUM-52/134: a second pending request, newer than bkg_pending.
    {
      id: "bkg_pending_2",
      eventId: W.equipmentInReview,
      venueId: V.hall,
      ...workday(WD.equipmentInReview),
      status: BookingStatus.PENDING,
      requestedAttendance: 120,
      requiredFacilities: ["sound-system"],
      requestedLayout: "theatre",
      requestedById: U.coordinator,
    },
    approved("bkg_cancellation_requested", W.cancellationRequested, V.auditorium, WD.cancellationRequested, 250),
    approved("bkg_no_registration", W.noRegistration, V.hall, WD.noRegistration, 80),
    approved("bkg_replanning", W.replanning, V.hall, WD.replanning, 150),
    // SCRUM-121 AC5: Morgan Multirole can't decide this one, as its Organiser.
    {
      id: "bkg_multirole_pending",
      eventId: W.multiRoleOrganised,
      venueId: V.boardroom,
      ...workday(WD.multiRoleOrganised),
      status: BookingStatus.PENDING,
      requestedAttendance: 12,
      requiredFacilities: [],
      requestedById: U.coordinator,
    },
  ];
  for (const b of bookings) {
    const { id, ...data } = b;
    await prisma.booking.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // SCRUM-163 AC9: the hold's deadline was moved once.
  const change = { bookingId: "bkg_held", oldExpiresAt: at(3, 4), newExpiresAt: at(5, 4), changedById: U.venueStaff, changedAt: at(-1, 6) };
  await prisma.holdExpiryChange.upsert({ where: { id: "hxc_held_1" }, update: change, create: { id: "hxc_held_1", ...change } });
  return bookings.length;
}

async function seedWorkflowEquipment() {
  const requests = [
    { id: "eqr_safety_awaiting", eventId: W.safetyAwaiting, requestedById: U.coordinator, status: EquipmentRequestStatus.APPROVED, notes: "Microphones for the demo stations.", decidedAt: at(-7, 3) },
    { id: "eqr_ready_to_confirm", eventId: W.readyToConfirm, requestedById: U.coordinator, status: EquipmentRequestStatus.APPROVED, notes: "Laptops for the sign-in desk.", decidedAt: at(-7, 3) },
    { id: "eqr_flagged", eventId: W.flagged, requestedById: U.coordinator, status: EquipmentRequestStatus.APPROVED, notes: "Microphones for the panel.", decidedAt: at(-6, 3) },
    // SCRUM-28: in review, with a line short of stock and an alternative suggested.
    { id: "eqr_in_review", eventId: W.equipmentInReview, requestedById: U.coordinator, status: EquipmentRequestStatus.IN_REVIEW, notes: "Projectors for every breakout room." },
    // SCRUM-28: closed requests on the same event, before the current one.
    { id: "eqr_rejected", eventId: W.equipmentInReview, requestedById: U.coordinator, status: EquipmentRequestStatus.REJECTED, notes: "First attempt.", decidedAt: at(-9, 3) },
    { id: "eqr_cancelled", eventId: W.equipmentInReview, requestedById: U.coordinator, status: EquipmentRequestStatus.CANCELLED, notes: "Withdrawn by the Coordinator." },
    // SCRUM-155: approved, nothing reserved yet.
    { id: "eqr_ready_to_reserve", eventId: W.readyToReserve, requestedById: U.coordinator, status: EquipmentRequestStatus.APPROVED, notes: "PA for the demo arena.", decidedAt: at(-2, 3) },
  ];
  for (const r of requests) {
    const { id, ...data } = r;
    await prisma.equipmentRequest.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  const lines = [
    { id: "eql_safety_mic", requestId: "eqr_safety_awaiting", equipmentId: EQ.mic, quantity: 2 },
    { id: "eql_ready_laptop", requestId: "eqr_ready_to_confirm", equipmentId: EQ.laptop, quantity: 2 },
    { id: "eql_flagged_mic", requestId: "eqr_flagged", equipmentId: EQ.mic, quantity: 3 },
    { id: "eql_in_review_projector", requestId: "eqr_in_review", equipmentId: EQ.projector, quantity: 12, technicalRequirements: "One per breakout room.", suggestedAlternativeId: EQ.laptop },
    { id: "eql_in_review_mic", requestId: "eqr_in_review", equipmentId: EQ.mic, quantity: 4 },
    // SCRUM-142: a line the Coordinator took off the request.
    { id: "eql_in_review_speaker", requestId: "eqr_in_review", equipmentId: EQ.speaker, quantity: 2, removedAt: at(-1, 3) },
    { id: "eql_rejected_speaker", requestId: "eqr_rejected", equipmentId: EQ.speaker, quantity: 10 },
    { id: "eql_cancelled_laptop", requestId: "eqr_cancelled", equipmentId: EQ.laptop, quantity: 5 },
    { id: "eql_ready_speaker", requestId: "eqr_ready_to_reserve", equipmentId: EQ.speaker, quantity: 2 },
    { id: "eql_ready_mic", requestId: "eqr_ready_to_reserve", equipmentId: EQ.mic, quantity: 3 },
  ];
  for (const l of lines) {
    const { id, ...data } = l;
    await prisma.equipmentRequestLine.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  const updates = [
    { id: "equ_in_review_1", requestId: "eqr_in_review", actorId: U.techSupport, fromStatus: EquipmentRequestStatus.PENDING_REVIEW, toStatus: EquipmentRequestStatus.IN_REVIEW, note: "Checking projector stock.", createdAt: at(-1, 4) },
    { id: "equ_in_review_2", requestId: "eqr_in_review", actorId: U.techSupport, note: "Suggested Laptop instead of Projector (only 10 exist).", createdAt: at(-1, 5) },
    { id: "equ_rejected_1", requestId: "eqr_rejected", actorId: U.techSupport, fromStatus: EquipmentRequestStatus.IN_REVIEW, toStatus: EquipmentRequestStatus.REJECTED, note: "Ten PA speakers is more than we own; please ask for at most seven.", createdAt: at(-9, 3) },
    { id: "equ_cancelled_1", requestId: "eqr_cancelled", actorId: U.coordinator, fromStatus: EquipmentRequestStatus.PENDING_REVIEW, toStatus: EquipmentRequestStatus.CANCELLED, note: "Withdrawn by the Coordinator.", createdAt: at(-8, 3) },
    { id: "equ_ready_1", requestId: "eqr_ready_to_reserve", actorId: U.techSupport, fromStatus: EquipmentRequestStatus.IN_REVIEW, toStatus: EquipmentRequestStatus.APPROVED, note: "Approved; to be reserved.", createdAt: at(-2, 3) },
  ];
  for (const u of updates) {
    const { id, ...data } = u;
    await prisma.equipmentRequestUpdate.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  const reservation = (id: string, eventId: string, requestId: string, equipmentId: string, quantity: number, day: number) => ({
    id, eventId, requestId, equipmentId, quantity, ...workday(day), status: ReservationStatus.CONFIRMED, reservedById: U.techSupport,
  });
  const reservations = [
    reservation("res_safety_mic", W.safetyAwaiting, "eqr_safety_awaiting", EQ.mic, 2, WD.safetyAwaiting),
    reservation("res_ready_laptop", W.readyToConfirm, "eqr_ready_to_confirm", EQ.laptop, 2, WD.readyToConfirm),
    // SCRUM-32/26: Technical Support reported it can't be provided.
    {
      ...reservation("res_flagged_mic", W.flagged, "eqr_flagged", EQ.mic, 3, WD.flagged),
      needsReconsideration: true,
      reconsiderationFlaggedAt: at(-1, 6),
      reconsiderationReason: "Two of the three microphones are booked for a graduation on the same day.",
    },
  ];
  for (const r of reservations) {
    const { id, ...data } = r;
    await prisma.reservation.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return { requests: requests.length, lines: lines.length, reservations: reservations.length };
}

/** SCRUM-166 — a check in every state, with the arrangements it covered. */
async function seedSafetyChecks() {
  const checks = [
    { id: "sfc_outdated", eventId: W.safetyAwaiting, status: SafetyCheckStatus.OUTDATED, requestedById: U.coordinator, outdatedAt: at(-3, 3), createdAt: at(-5, 3) },
    { id: "sfc_awaiting", eventId: W.safetyAwaiting, status: SafetyCheckStatus.AWAITING_REVIEW, requestedById: U.coordinator, createdAt: at(-2, 3) },
    { id: "sfc_changes", eventId: W.safetyChanges, status: SafetyCheckStatus.CHANGES_REQUESTED, requestedById: U.coordinator2, note: "Move the robot arena 3 m back from the front row and add a barrier.", decidedById: U.safetyOfficer, decidedAt: at(-1, 3), createdAt: at(-4, 3) },
    { id: "sfc_rejected", eventId: W.readyToConfirm, status: SafetyCheckStatus.REJECTED, requestedById: U.coordinator, note: "The first plan blocked a fire exit.", decidedById: U.safetyOfficer2, decidedAt: at(-6, 3), createdAt: at(-7, 3) },
    { id: "sfc_approved", eventId: W.readyToConfirm, status: SafetyCheckStatus.APPROVED, requestedById: U.coordinator, decidedById: U.safetyOfficer, decidedAt: at(-2, 3), createdAt: at(-3, 3) },
    // SCRUM-233: the Confirmed events passed their safety check first.
    { id: "sfc_cancellation_requested", eventId: W.cancellationRequested, status: SafetyCheckStatus.APPROVED, requestedById: U.coordinator, decidedById: U.safetyOfficer2, decidedAt: at(-6, 3), createdAt: at(-7, 3) },
    { id: "sfc_no_registration", eventId: W.noRegistration, status: SafetyCheckStatus.APPROVED, requestedById: U.coordinator, decidedById: U.safetyOfficer2, decidedAt: at(-6, 3), createdAt: at(-7, 3) },
  ];
  for (const c of checks) {
    const { id, ...data } = c;
    await prisma.safetyCheck.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  const arrangements = [
    { id: "sfa_awaiting_booking", checkId: "sfc_awaiting", bookingId: "bkg_safety_awaiting" },
    { id: "sfa_awaiting_reservation", checkId: "sfc_awaiting", reservationId: "res_safety_mic" },
    { id: "sfa_changes_booking", checkId: "sfc_changes", bookingId: "bkg_safety_changes" },
    { id: "sfa_approved_booking", checkId: "sfc_approved", bookingId: "bkg_ready_to_confirm" },
    { id: "sfa_approved_reservation", checkId: "sfc_approved", reservationId: "res_ready_laptop" },
    { id: "sfa_cancellation_requested_booking", checkId: "sfc_cancellation_requested", bookingId: "bkg_cancellation_requested" },
    { id: "sfa_no_registration_booking", checkId: "sfc_no_registration", bookingId: "bkg_no_registration" },
  ];
  for (const a of arrangements) {
    const { id, ...data } = a;
    await prisma.safetyCheckArrangement.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return checks.length;
}

async function seedWorkflowRegistrations() {
  const registrations = [
    // SCRUM-85 AC9: Attendees of the re-planned event. Only Aria gets the
    // seeded notice of the change: attendee-updates.spec.ts tells attendee2
    // of a change itself and looks for that title.
    { id: "reg_replanning_1", eventId: W.replanning, userId: U.attendee, status: RegistrationStatus.REGISTERED, registeredAt: at(-8, 4) },
    { id: "reg_replanning_2", eventId: W.replanning, userId: U.attendee2, status: RegistrationStatus.REGISTERED, registeredAt: at(-8, 5) },
    // SCRUM-76: a registration for an event that has taken place.
    { id: "reg_completed_1", eventId: E.completed, userId: U.attendee2, status: RegistrationStatus.REGISTERED, registeredAt: at(-40, 4) },
    // SCRUM-128 AC8: registrations a cancellation would cancel.
    { id: "reg_cancellation_1", eventId: W.cancellationRequested, userId: U.attendee, status: RegistrationStatus.REGISTERED, registeredAt: at(-2, 4) },
  ];
  for (const r of registrations) {
    const { id, ...data } = r;
    await prisma.registration.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  return registrations.length;
}

async function seedWorkflowRequests() {
  const clarifications = [
    // SCRUM-108: names the fields the Organiser may change in the answer.
    { id: "clr_editable", eventId: W.clarificationFields, requestedById: U.coordinator, message: "450 people in a theatre layout won't fit the Hall. Can you lower the attendance or choose another layout?", editableFields: ["expectedAttendance", "preferredLayout"], status: ClarificationStatus.OPEN, createdAt: at(-2, 3) },
    // SCRUM-18 AC5: earlier questions on the same event, answered and closed.
    { id: "clr_answered", eventId: W.readyToConfirm, requestedById: U.coordinator, message: "Do you need a coat check?", editableFields: [], status: ClarificationStatus.ANSWERED, response: "Yes, for about 50 coats.", respondedAt: at(-13, 5), createdAt: at(-13, 3) },
    { id: "clr_closed", eventId: W.flagged, requestedById: U.coordinator, message: "Is the panel livestreamed?", editableFields: [], status: ClarificationStatus.CLOSED, response: "No livestream.", respondedAt: at(-13, 6), createdAt: at(-13, 4) },
  ];
  for (const c of clarifications) {
    const { id, ...data } = c;
    await prisma.clarificationRequest.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  const changeRequests = [
    // SCRUM-128 AC4: approved, and it flagged the event's arrangements.
    { id: "chg_flagged_approved", eventId: W.flagged, requestedById: U.organiser, status: ChangeRequestStatus.APPROVED, reason: "Registrations from partner schools pushed attendance up.", decidedById: U.coordinator, decidedAt: at(-1, 5) },
    // SCRUM-128 AC3: rejected with a reason.
    { id: "chg_rejected", eventId: W.readyToConfirm, requestedById: U.organiser, status: ChangeRequestStatus.REJECTED, reason: "Could we move it to the Auditorium?", decidedById: U.coordinator, decidedAt: at(-4, 3), decisionReason: "The Auditorium is booked that evening." },
    // SCRUM-41 AC10, SCRUM-128 AC8: the Organiser asks to cancel a Confirmed event.
    { id: "chg_cancellation", eventId: W.cancellationRequested, requestedById: U.organiser, status: ChangeRequestStatus.PENDING_REVIEW, reason: "The headline act pulled out.", requestsCancellation: true },
  ];
  for (const c of changeRequests) {
    const { id, ...data } = c;
    await prisma.eventChangeRequest.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  const fields = [
    { id: "chgf_flagged_attendance", changeRequestId: "chg_flagged_approved", fieldName: "expectedAttendance", oldValue: "250", newValue: "350", isMajor: true },
    { id: "chgf_rejected_venue", changeRequestId: "chg_rejected", fieldName: "venueRequirements", oldValue: "Seminar Room 2.1", newValue: "Grand Auditorium", isMajor: true },
  ];
  for (const f of fields) {
    const { id, ...data } = f;
    await prisma.changeRequestField.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // SCRUM-172: notes can't be edited or deleted, so they are only ever added.
  await prisma.eventOperationalNote.createMany({
    skipDuplicates: true,
    data: [
      { id: "note_planning_coordinator", eventId: E.planning, authorId: U.coordinator, body: "The dean's office wants the projector tested the day before.", createdAt: at(-3, 3) },
      { id: "note_planning_venue", eventId: E.planning, authorId: U.venueStaff, body: "Seminar Room 2.1's aircon is serviced on day 15; fine for this date.", createdAt: at(-2, 3) },
      { id: "note_planning_tech", eventId: E.planning, authorId: U.techSupport, body: "Two spare microphone batteries will be at the desk.", createdAt: at(-1, 3) },
    ],
  });
  return { clarifications: clarifications.length, changeRequests: changeRequests.length };
}

/** SCRUM-37/30 — unavailability for every reason, well clear of every booking. */
async function seedWorkflowUnavailability() {
  const venueRows = [
    { id: "vun_auditorium_failure", venueId: V.auditorium, startAt: at(95, 0), endAt: at(96, 0), reason: VenueUnavailabilityReason.EQUIPMENT_FAILURE, note: "Stage lift out of order.", recordedById: U.venueStaff },
    { id: "vun_hall_renovation", venueId: V.hall, startAt: at(96, 0), endAt: at(99, 0), reason: VenueUnavailabilityReason.RENOVATION, note: "Floor resurfacing.", recordedById: U.venueStaff },
    { id: "vun_boardroom_safety", venueId: V.boardroom, startAt: at(weekdayFrom(100), 0), endAt: at(weekdayFrom(100) + 1, 0), reason: VenueUnavailabilityReason.SAFETY_CONCERN, note: "Ceiling tile inspection.", recordedById: U.venueStaff2 },
    { id: "vun_seminar_other", venueId: V.seminar, startAt: at(weekdayFrom(103), 0), endAt: at(weekdayFrom(103) + 1, 0), reason: VenueUnavailabilityReason.OTHER, note: "Reserved for faculty exams.", recordedById: U.venueStaff2 },
  ];
  for (const r of venueRows) {
    await prisma.venueUnavailability.upsert({ where: { id: r.id }, update: r, create: r });
  }
  const equipmentRows = [
    { id: "eun_laptop_closure", equipmentId: EQ.laptop, quantity: 15, startAt: at(95, 0), endAt: at(96, 0), reason: UnavailabilityReason.CLOSURE, note: "Store closed for stocktake.", recordedById: U.techSupport },
    { id: "eun_mic_other", equipmentId: EQ.mic, quantity: 2, startAt: at(97, 0), endAt: at(98, 0), reason: UnavailabilityReason.OTHER, note: "Lent to the library's open day.", recordedById: U.techSupport },
  ];
  for (const r of equipmentRows) {
    await prisma.equipmentUnavailability.upsert({ where: { id: r.id }, update: r, create: r });
  }
  return venueRows.length + equipmentRows.length;
}

/** SCRUM-45/48/85/124 — every notification type, for the person who'd get it. */
async function seedWorkflowNotifications() {
  const T = NotificationType;
  const rows = [
    { id: "ntf_reassigned", userId: U.organiser, type: T.COORDINATOR_REASSIGNED, title: "Your event has a new coordinator", message: "Morgan Multirole now coordinates Multi-role Coordinator — Debate Finals.", eventId: W.multiRoleCoordinated, createdAt: at(-5, 3) },
    { id: "ntf_equipment_updated", userId: U.coordinator, type: T.EQUIPMENT_REQUEST_UPDATED, title: "Equipment request in review", message: "Technical Support suggested Laptop instead of Projector for Equipment In Review — Media Workshop.", eventId: W.equipmentInReview, createdAt: at(-1, 5) },
    { id: "ntf_reservation_cancelled", userId: U.coordinator, type: T.RESERVATION_CANCELLED, title: "A reservation was cancelled", message: "Laptop × 2 for Cancelled — Winter Workshop was released.", eventId: E.cancelled, createdAt: at(-1, 3), readAt: at(-1, 4) },
    { id: "ntf_change_outcome", userId: U.organiser, type: T.CHANGE_REQUEST_OUTCOME, title: "Change request approved", message: "Your change to Flagged — Sustainability Forum was approved.", eventId: W.flagged, createdAt: at(-1, 5) },
    { id: "ntf_event_changed", userId: U.attendee, type: T.REGISTERED_EVENT_CHANGED, title: "An event you registered for has changed", message: "Re-planning — Jazz Night is being re-planned; we'll tell you when it's confirmed again.", eventId: W.replanning, createdAt: at(-2, 3) },
    { id: "ntf_booking_requested", userId: U.venueStaff, type: T.BOOKING_REQUESTED, title: "New venue request", message: "Exhibition Hall is requested for Equipment In Review — Media Workshop.", eventId: W.equipmentInReview, bookingId: "bkg_pending_2", createdAt: at(-2, 3) },
    { id: "ntf_equipment_submitted", userId: U.techSupport, type: T.EQUIPMENT_REQUEST_SUBMITTED, title: "New equipment request", message: "Equipment In Review — Media Workshop asks for projectors and microphones.", eventId: W.equipmentInReview, createdAt: at(-3, 3), readAt: at(-1, 4) },
    { id: "ntf_equipment_changed", userId: U.techSupport, type: T.EQUIPMENT_REQUEST_CHANGED, title: "Equipment request changed", message: "PA Speaker was taken off the request for Equipment In Review — Media Workshop.", eventId: W.equipmentInReview, createdAt: at(-1, 3) },
    { id: "ntf_booking_withdrawn", userId: U.venueStaff, type: T.BOOKING_REQUEST_WITHDRAWN, title: "Venue request withdrawn", message: "A request for Cancelled — Winter Workshop was withdrawn.", eventId: E.cancelled, createdAt: at(-1, 3), readAt: at(-1, 4) },
    { id: "ntf_equipment_withdrawn", userId: U.techSupport, type: T.EQUIPMENT_REQUEST_WITHDRAWN, title: "Equipment request withdrawn", message: "The Laptop request for Equipment In Review — Media Workshop was withdrawn.", eventId: W.equipmentInReview, createdAt: at(-8, 3), readAt: at(-8, 4) },
    { id: "ntf_booking_held", userId: U.coordinator, type: T.BOOKING_HELD, title: "Venue held", message: "Executive Boardroom is held for On Hold — Design Week Kickoff; Venue Staff will decide before the hold expires.", eventId: W.hold, bookingId: "bkg_held", createdAt: at(-1, 3) },
    // SCRUM-124 AC5: shown from 24 hours before the hold expires.
    { id: "ntf_hold_reminder", userId: U.coordinator, type: T.HOLD_EXPIRY_REMINDER, title: "Hold expires tomorrow", message: "The hold on Executive Boardroom for On Hold — Design Week Kickoff expires tomorrow.", eventId: W.hold, bookingId: "bkg_held", createdAt: at(-1, 3), showFromAt: at(4, 4) },
    { id: "ntf_hold_expired", userId: U.coordinator, type: T.HOLD_EXPIRED, title: "Hold expired", message: "The hold on Exhibition Hall for On Hold — Design Week Kickoff expired.", eventId: W.hold, bookingId: "bkg_expired", createdAt: at(-9, 3), showFromAt: at(-2, 3) },
    { id: "ntf_hold_approved", userId: U.coordinator, type: T.HOLD_APPROVED, title: "Hold approved", message: "Venue Staff approved the hold on Seminar Room 2.1 for Hold Approved — Founders' Breakfast. Confirm or release it.", eventId: W.holdApproved, bookingId: "bkg_hold_approved", createdAt: at(-2, 3) },
    { id: "ntf_hold_confirmed", userId: U.venueStaff, type: T.HOLD_CONFIRMED, title: "Hold confirmed", message: "The Coordinator confirmed the hold for Ready to Confirm — Alumni Networking Night.", eventId: W.readyToConfirm, createdAt: at(-8, 3), readAt: at(-8, 4) },
    { id: "ntf_hold_released", userId: U.venueStaff, type: T.HOLD_RELEASED, title: "Hold released", message: "The Coordinator released the hold on Exhibition Hall for On Hold — Design Week Kickoff.", eventId: W.hold, createdAt: at(-3, 3), readAt: at(-3, 4) },
    { id: "ntf_change_submitted", userId: U.coordinator, type: T.CHANGE_REQUEST_SUBMITTED, title: "Cancellation requested", message: "The Organiser asked to cancel Cancellation Requested — Spring Concert.", eventId: W.cancellationRequested, createdAt: at(-1, 3) },
    { id: "ntf_flagged_venue", userId: U.venueStaff, type: T.ARRANGEMENT_FLAGGED, title: "A booking needs reconsideration", message: "Grand Auditorium for Flagged — Sustainability Forum: attendance rose to 350.", eventId: W.flagged, bookingId: "bkg_flagged", createdAt: at(-1, 5) },
    { id: "ntf_flagged_coordinator", userId: U.coordinator, type: T.ARRANGEMENT_FLAGGED, title: "Arrangements need reconsideration", message: "Flagged — Sustainability Forum has a booking and a reservation to reconsider.", eventId: W.flagged, createdAt: at(-1, 6) },
    { id: "ntf_flag_resolved", userId: U.techSupport, type: T.ARRANGEMENT_FLAG_RESOLVED, title: "Flag resolved", message: "The Coordinator kept the reservation for Ready to Confirm — Alumni Networking Night.", eventId: W.readyToConfirm, createdAt: at(-6, 3), readAt: at(-6, 4) },
    { id: "ntf_awaiting_lead", userId: U.coordinatorLead, type: T.REQUEST_AWAITING_ASSIGNMENT, title: "A request needs a coordinator", message: "Submitted — Alumni Homecoming is waiting to be assigned.", eventId: E.submitted, createdAt: at(-2, 3) },
    { id: "ntf_awaiting_lead_2", userId: U.coordinatorLead2, type: T.REQUEST_AWAITING_ASSIGNMENT, title: "A request needs a coordinator", message: "Overdue — Orientation Volunteers Briefing is waiting to be assigned.", eventId: W.submittedOverdue, createdAt: at(-20, 3) },
    { id: "ntf_safety_requested", userId: U.safetyOfficer, type: T.SAFETY_CHECK_REQUESTED, title: "Safety check requested", message: "Safety Review — Engineering Open Day is ready for its safety check.", eventId: W.safetyAwaiting, createdAt: at(-2, 3) },
    { id: "ntf_safety_requested_2", userId: U.safetyOfficer2, type: T.SAFETY_CHECK_REQUESTED, title: "Safety check requested", message: "Safety Review — Engineering Open Day is ready for its safety check.", eventId: W.safetyAwaiting, createdAt: at(-2, 3) },
    { id: "ntf_safety_outcome", userId: U.coordinator2, type: T.SAFETY_CHECK_OUTCOME, title: "Safety check: changes requested", message: "Move the robot arena 3 m back from the front row and add a barrier.", eventId: W.safetyChanges, createdAt: at(-1, 3) },
    // SCRUM-163 AC5: a notice withdrawn when the hold it was about went away.
    { id: "ntf_withdrawn_reminder", userId: U.coordinator, type: T.HOLD_EXPIRY_REMINDER, title: "Hold expires tomorrow", message: "The hold on Exhibition Hall for On Hold — Design Week Kickoff expires tomorrow.", eventId: W.hold, bookingId: "bkg_expired", createdAt: at(-9, 3), showFromAt: at(-3, 3), withdrawnAt: at(-3, 2) },
  ];
  for (const n of rows) {
    const { id, ...data } = n;
    await prisma.notification.upsert({ where: { id }, update: data, create: { id, ...data } });
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
  await seedConfirmedDetails();
  const eq = await seedEquipmentRequests();
  const reservations = await seedReservations();
  const confirmedSafetyChecks = await seedConfirmedSafetyChecks();
  const registrations = await seedRegistrations();
  const clarifications = await seedClarifications();
  const changeFields = await seedChangeRequests();
  const notifications = await seedNotifications();
  const audit = await seedAuditLog();

  // SCRUM-238: the scenarios that give every role work to see and act on.
  const workflowEvents = await seedWorkflowEvents();
  const workflowBookings = await seedWorkflowBookings();
  await seedConfirmedDetails();
  const workflowEquipment = await seedWorkflowEquipment();
  const safetyChecks = await seedSafetyChecks();
  const workflowRegistrations = await seedWorkflowRegistrations();
  const workflowRequests = await seedWorkflowRequests();
  const workflowUnavailability = await seedWorkflowUnavailability();
  const workflowNotifications = await seedWorkflowNotifications();

  console.log("Seed complete:");
  console.log(`  ${users} users (one for each of the ${Object.values(Role).length} roles, plus extra organisers, coordinators and attendees)`);
  console.log(`  ${venues} venues, ${venueUnavail} venue unavailability period(s)`);
  console.log(`  ${equipment} equipment types, ${equipUnavail} equipment unavailability period(s)`);
  console.log(`  ${events} events (one per status except Approved, plus registration boundary cases)`);
  console.log(`  ${bookings} venue bookings`);
  console.log(`  ${eq.requests} equipment requests, ${eq.lines} lines, ${eq.updates} history entries`);
  console.log(`  ${reservations} equipment reservations, ${confirmedSafetyChecks} safety checks for the events that reached Confirmed`);
  console.log(`  ${registrations} registrations`);
  console.log(`  ${clarifications} clarification request(s), 1 change request with ${changeFields} fields`);
  console.log(`  ${notifications} notifications, ${audit} audit entries`);
  console.log("Every role's work (SCRUM-238):");
  console.log(`  ${workflowEvents} events, ${workflowBookings} venue bookings (held, expired, flagged, pending), ${workflowUnavailability} unavailability periods`);
  console.log(`  ${workflowEquipment.requests} equipment requests, ${workflowEquipment.lines} lines, ${workflowEquipment.reservations} reservations; ${safetyChecks} safety checks`);
  console.log(`  ${workflowRegistrations} registrations, ${workflowRequests.clarifications} clarifications, ${workflowRequests.changeRequests} change requests, 3 operational notes`);
  console.log(`  ${workflowNotifications} notifications, covering every notification type`);
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
