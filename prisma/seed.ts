/**
 * Idempotent seed. Run with `npm run db:seed` (or automatically by
 * `npm run db:reset`). Safe to run repeatedly — every row is upserted on a
 * stable key, and all primary keys are deterministic so tests and Playwright
 * can rely on them.
 *
 * Why this matters: without a shared seed, five local databases drift apart,
 * role-based access is untestable, and Playwright has no account to sign in as.
 */
import { PrismaClient, Role, EventStatus } from "@prisma/client";
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

// Fixed instants so seeded data is identical on every machine and every run.
const JAN_2026 = new Date("2026-01-15T02:00:00.000Z"); // 10:00 SGT
const JAN_2026_END = new Date("2026-01-15T06:00:00.000Z"); // 14:00 SGT

// Deterministic user IDs. Referenced directly by tests, so do not change them
// without updating the tests that hard-code them.
const USER_IDS = {
  organiser: "usr_organiser",
  coordinator: "usr_coordinator",
  venueStaff: "usr_venuestaff",
  techSupport: "usr_techsupport",
  attendee: "usr_attendee",
  organiser2: "usr_organiser_2",
  coordinator2: "usr_coordinator_2",
} as const;

async function seedUsers(passwordHash: string) {
  const users: Array<{
    id: string;
    email: string;
    name: string;
    role: Role;
  }> = [
    { id: USER_IDS.organiser, email: "organiser@test.local", name: "Olivia Organiser", role: Role.ORGANISER },
    { id: USER_IDS.coordinator, email: "coordinator@test.local", name: "Cody Coordinator", role: Role.COORDINATOR },
    { id: USER_IDS.venueStaff, email: "venuestaff@test.local", name: "Vera Venue", role: Role.VENUE_STAFF },
    { id: USER_IDS.techSupport, email: "techsupport@test.local", name: "Theo Tech", role: Role.TECH_SUPPORT },
    { id: USER_IDS.attendee, email: "attendee@test.local", name: "Aria Attendee", role: Role.ATTENDEE },
    // Second organiser + coordinator exist so cross-user access denial is
    // testable (Organiser A must not be able to load Organiser B's event).
    { id: USER_IDS.organiser2, email: "organiser2@test.local", name: "Owen Organiser", role: Role.ORGANISER },
    { id: USER_IDS.coordinator2, email: "coordinator2@test.local", name: "Cara Coordinator", role: Role.COORDINATOR },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash },
      create: { ...u, passwordHash },
    });
  }
}

async function seedVenues() {
  const venues = [
    { id: "ven_auditorium", name: "Grand Auditorium", location: "Level 1, Block A", capacity: 500, facilities: ["stage", "projector", "sound-system", "wheelchair-access"] },
    { id: "ven_seminar", name: "Seminar Room 2.1", location: "Level 2, Block B", capacity: 60, facilities: ["projector", "whiteboard", "wheelchair-access"] },
    { id: "ven_hall", name: "Exhibition Hall", location: "Level 1, Block C", capacity: 200, facilities: ["open-floor", "loading-bay"] },
  ];

  for (const v of venues) {
    await prisma.venue.upsert({ where: { id: v.id }, update: v, create: v });
  }
}

async function seedEquipment() {
  const equipment = [
    { id: "eqp_projector", type: "Projector", totalQuantity: 10 },
    { id: "eqp_mic", type: "Wireless Microphone", totalQuantity: 25 },
    { id: "eqp_laptop", type: "Laptop", totalQuantity: 15 },
    { id: "eqp_speaker", type: "PA Speaker", totalQuantity: 8 },
  ];

  for (const e of equipment) {
    await prisma.equipment.upsert({ where: { id: e.id }, update: e, create: e });
  }
}

async function seedEvents() {
  // One event in each of the nine statuses, all owned by the first organiser.
  // A coordinator is assigned once an event is past initial review, mirroring
  // the real workflow. Draft carries no times (it is intentionally incomplete).
  const events: Array<{
    id: string;
    name: string;
    status: EventStatus;
    withTimes: boolean;
    withCoordinator: boolean;
  }> = [
    { id: "evt_draft", name: "Draft — Annual Tech Summit", status: EventStatus.DRAFT, withTimes: false, withCoordinator: false },
    { id: "evt_submitted", name: "Submitted — Alumni Homecoming", status: EventStatus.SUBMITTED, withTimes: true, withCoordinator: false },
    { id: "evt_under_review", name: "Under Review — Career Fair", status: EventStatus.UNDER_REVIEW, withTimes: true, withCoordinator: true },
    { id: "evt_approved", name: "Approved — Research Symposium", status: EventStatus.APPROVED, withTimes: true, withCoordinator: true },
    { id: "evt_planning", name: "Planning — Freshman Orientation", status: EventStatus.PLANNING, withTimes: true, withCoordinator: true },
    { id: "evt_confirmed", name: "Confirmed — Charity Gala", status: EventStatus.CONFIRMED, withTimes: true, withCoordinator: true },
    { id: "evt_completed", name: "Completed — Hackathon 2025", status: EventStatus.COMPLETED, withTimes: true, withCoordinator: true },
    { id: "evt_cancelled", name: "Cancelled — Winter Workshop", status: EventStatus.CANCELLED, withTimes: true, withCoordinator: true },
    { id: "evt_rejected", name: "Rejected — Overcapacity Concert", status: EventStatus.REJECTED, withTimes: true, withCoordinator: false },
  ];

  for (const e of events) {
    const data = {
      name: e.name,
      description: `Seeded example event in ${e.status} status.`,
      status: e.status,
      startAt: e.withTimes ? JAN_2026 : null,
      endAt: e.withTimes ? JAN_2026_END : null,
      expectedAttendance: e.withTimes ? 150 : null,
      organiserId: USER_IDS.organiser,
      coordinatorId: e.withCoordinator ? USER_IDS.coordinator : null,
    };

    await prisma.event.upsert({
      where: { id: e.id },
      update: data,
      create: { id: e.id, ...data },
    });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  await seedUsers(passwordHash);
  await seedVenues();
  await seedEquipment();
  await seedEvents();

  console.log("Seed complete:");
  console.log("  7 users (5 roles + 2nd organiser + 2nd coordinator)");
  console.log("  3 venues, 4 equipment types");
  console.log("  9 events (one per status), owned by organiser@test.local");
  console.log(`  All users share the password: ${DEV_PASSWORD}`);
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
