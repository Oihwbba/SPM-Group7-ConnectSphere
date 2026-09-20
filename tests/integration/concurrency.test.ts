import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createReservation } from "@/app/(app)/equipment/actions";
import { transitionEventStatus, submitEventRequest } from "@/app/(app)/events/actions";
import {
  requestClarification,
  respondToClarification,
} from "@/app/(app)/events/clarification-actions";

// The "at the same moment" cases (SCRUM-31/53/74). These are the acceptance
// criteria the database constraints and row locks exist to satisfy, so each one
// needs a real concurrent test against a live Postgres — see
// docs/data-model.md §4.4. Replace each `it.todo` as the feature lands.
describe("concurrency", () => {
  // Enforced by the `booking_no_double_booking` EXCLUDE constraint.
  it.todo("rejects the second of two simultaneous overlapping approvals (SCRUM-53)");
  it.todo("allows a booking that starts exactly when another ends (SCRUM-38/50)");

  // Enforced by SELECT ... FOR UPDATE on the Event row.
  it.todo("gives the last remaining place to exactly one of two simultaneous registrations (SCRUM-74)");
});

// SCRUM-31 — enforced by SELECT ... FOR UPDATE on the Equipment row; a counted
// pool cannot use an exclusion constraint. These WRITE to the database (a
// throwaway Equipment row and its reservations, removed afterwards), so they only
// run against a localhost database — CI's service container, or the Docker DB —
// and never against the shared Supabase database that `.env` points at.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const TECH_SUPPORT: Session = {
  user: {
    id: "usr_techsupport",
    role: "TECH_SUPPORT",
    name: "Theo Tech",
    email: "techsupport@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

// Seeded APPROVED event (prisma/seed.ts).
const APPROVED_EVENT_ID = "evt_approved";

describe.skipIf(!usesLocalDatabase)("concurrency — equipment pool (SCRUM-31)", () => {
  let equipmentId: string;

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue(TECH_SUPPORT);
    // A pool of exactly ONE unit, so any over-allocation is unmistakable.
    const pool = await prisma.equipment.create({
      data: { type: `Concurrency test pool ${Date.now()}`, totalQuantity: 1 },
      select: { id: true },
    });
    equipmentId = pool.id;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { equipmentId } });
    await prisma.equipment.delete({ where: { id: equipmentId } });
  });

  it("does not over-allocate equipment when two staff reserve the last unit (SCRUM-31)", async () => {
    const period = {
      eventId: APPROVED_EVENT_ID,
      equipmentId,
      quantity: 1,
      startAt: "2031-03-01T01:00:00.000Z",
      endAt: "2031-03-01T05:00:00.000Z",
    };

    const results = await Promise.all([
      createReservation(period),
      createReservation(period),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);

    const reserved = await prisma.reservation.aggregate({
      where: {
        equipmentId,
        status: "CONFIRMED",
        startAt: { lt: new Date(period.endAt) },
        endAt: { gt: new Date(period.startAt) },
      },
      _sum: { quantity: true },
    });
    expect(reserved._sum.quantity).toBe(1);
  });

  it("accepts reservations that touch at an endpoint — periods sharing an endpoint do not overlap (SCRUM-31)", async () => {
    const base = { eventId: APPROVED_EVENT_ID, equipmentId, quantity: 1 };

    // One unit, three back-to-back periods: each ends exactly when the next begins.
    const morning = await createReservation({
      ...base,
      startAt: "2031-04-01T01:00:00.000Z",
      endAt: "2031-04-01T03:00:00.000Z",
    });
    const midday = await createReservation({
      ...base,
      startAt: "2031-04-01T03:00:00.000Z",
      endAt: "2031-04-01T05:00:00.000Z",
    });
    const dawn = await createReservation({
      ...base,
      startAt: "2031-03-31T23:00:00.000Z",
      endAt: "2031-04-01T01:00:00.000Z",
    });

    expect(morning.ok).toBe(true);
    expect(midday.ok).toBe(true);
    expect(dawn.ok).toBe(true);
  });
});

describe.skipIf(!usesLocalDatabase)("concurrency — status transitions (SCRUM-24)", () => {
  let eventId: string | undefined;

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue(TECH_SUPPORT);
    const event = await prisma.event.create({
      data: {
        name: `SCRUM-24 Concurrency Event ${Date.now()}`,
        status: "SUBMITTED",
        organiserId: "usr_organiser",
      },
      select: { id: true },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    if (eventId) {
      await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
      await prisma.event.delete({ where: { id: eventId } });
    }
  });

  it("SCRUM-24: the loser of two simultaneous decisions is told to refresh, and no audit entry is written", async () => {
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_coordinator", role: "COORDINATOR", name: "Cody", email: "coordinator@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });

    const results = await Promise.all([
      transitionEventStatus({ eventId, nextStatus: "APPROVED" }),
      transitionEventStatus({ eventId, nextStatus: "REJECTED", decisionReason: "Too large" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);

    expect(await prisma.auditLog.count({ where: { entityId: eventId } })).toBe(1);
  });
});


// SCRUM-14 — a repeat submission must not create a second request or send
// another notification. It lives in this file, ahead of the SCRUM-20 block,
// because it triggers a coordinator assignment: within one file the blocks run
// in order, so it cannot interleave with the SCRUM-20 test's assignments the
// way a separate (parallel) test file could.
describe.skipIf(!usesLocalDatabase)("event submission — repeat submission (SCRUM-14)", () => {
  const name = `SCRUM-14 Repeat Submission ${Date.now()}`;
  let eventId: string;

  const submission = (id: string, eventName: string) => ({
    id,
    name: eventName,
    purpose: "Repeat submission coverage",
    description: "SCRUM-14 integration coverage",
    startAt: "2031-07-01T09:00:00.000Z",
    endAt: "2031-07-01T17:00:00.000Z",
    expectedAttendance: 10,
    venueRequirements: "Any room",
    accessibilityNeeds: "None",
    preferredLayout: "Classroom",
    equipmentRequirements: "None",
    registrationNotes: "None",
  });

  beforeAll(async () => {
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_organiser", role: "ORGANISER", name: "Olivia Organiser", email: "organiser@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });
    const draft = await prisma.event.create({
      data: { name, status: "DRAFT", organiserId: "usr_organiser" },
      select: { id: true },
    });
    eventId = draft.id;
  });

  afterAll(async () => {
    // Every event this block creates is named `${name}…`.
    const ids = (
      await prisma.event.findMany({
        where: { name: { startsWith: name } },
        select: { id: true },
      })
    ).map((e) => e.id);
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  it("SCRUM-14 AC: submitting the same event again is refused, creates no second request and sends no additional notification", async () => {
    const first = await submitEventRequest(submission(eventId, name));
    expect(first.ok).toBe(true);

    const notificationsBefore = await prisma.notification.count({ where: { eventId } });

    const second = await submitEventRequest(submission(eventId, name));

    expect(second.ok).toBe(false);
    expect(await prisma.event.count({ where: { name } })).toBe(1);
    expect(await prisma.notification.count({ where: { eventId } })).toBe(notificationsBefore);
  });

  it("SCRUM-14 AC: two simultaneous submissions of one draft succeed once and notify once", async () => {
    const raceName = `${name} (simultaneous)`;
    const draft = await prisma.event.create({
      data: { name: raceName, status: "DRAFT", organiserId: "usr_organiser" },
      select: { id: true },
    });

    const results = await Promise.all([
      submitEventRequest(submission(draft.id, raceName)),
      submitEventRequest(submission(draft.id, raceName)),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    // One assignment: one notification each for the organiser and the
    // coordinator, and a single ASSIGNED audit row.
    expect(await prisma.notification.count({ where: { eventId: draft.id } })).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: { entityId: draft.id, action: "ASSIGNED" },
      }),
    ).toBe(1);
  });
});

describe.skipIf(!usesLocalDatabase)("concurrency — coordinator auto-assignment (SCRUM-20)", () => {
  let coordinatorAId: string;
  let coordinatorBId: string;

  const ORGANISER: Session = {
    user: {
      id: "usr_organiser",
      role: "ORGANISER",
      name: "Olivia Organiser",
      email: "organiser@test.local",
    },
    expires: "2999-01-01T00:00:00.000Z",
  };

  beforeAll(async () => {
    // Two throwaway coordinators, both starting at zero active events, so the
    // fairness rule has an actual tie to resolve under concurrency.
    const [a, b] = await Promise.all([
      prisma.user.create({
        data: {
          email: `concurrency-coord-a-${Date.now()}@test.local`,
          name: "Concurrency Coord A",
          role: "COORDINATOR",
          passwordHash: "not-used-in-this-test",
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `concurrency-coord-b-${Date.now()}@test.local`,
          name: "Concurrency Coord B",
          role: "COORDINATOR",
          passwordHash: "not-used-in-this-test",
        },
        select: { id: true },
      }),
    ]);
    coordinatorAId = a.id;
    coordinatorBId = b.id;
  });

  afterAll(async () => {
    // Dependents first: the assignment notifications reference the throwaway
    // coordinators through the required Notification.user FK, so deleting the
    // users while they exist throws P2003.
    const eventIds = (
      await prisma.event.findMany({
        where: { name: { startsWith: "SCRUM-20 Concurrency Event" } },
        select: { id: true },
      })
    ).map((e) => e.id);
    const coordinatorIds = [coordinatorAId, coordinatorBId];

    await prisma.notification.deleteMany({
      where: {
        OR: [{ eventId: { in: eventIds } }, { userId: { in: coordinatorIds } }],
      },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: coordinatorIds } } });
  });

  it("SCRUM-20: two events submitted at the same instant each end up with exactly one coordinator, and neither is left unassigned", async () => {
    (auth as unknown as Mock).mockResolvedValue(ORGANISER);

    const base = {
      purpose: "Concurrency test",
      description: "SCRUM-20 concurrency coverage",
      startAt: "2031-05-01T09:00:00.000Z",
      endAt: "2031-05-01T17:00:00.000Z",
      expectedAttendance: 10,
      venueRequirements: "Any room",
      accessibilityNeeds: "None",
      preferredLayout: "Classroom",
      equipmentRequirements: "None",
      registrationNotes: "None",
    };

    const results = await Promise.all([
      submitEventRequest({ ...base, name: `SCRUM-20 Concurrency Event A ${Date.now()}` }),
      submitEventRequest({ ...base, name: `SCRUM-20 Concurrency Event B ${Date.now()}` }),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);

    const events = await prisma.event.findMany({
      where: { name: { startsWith: "SCRUM-20 Concurrency Event" } },
      select: { id: true, coordinatorId: true, status: true },
    });

    expect(events).toHaveLength(2);
    // AC: "An event has at most one assigned Coordinator at any moment" —
    // both submissions found a coordinator (there were two available) and
    // neither was left unassigned.
    for (const event of events) {
      expect(event.coordinatorId).not.toBeNull();
      expect(event.status).toBe("UNDER_REVIEW");
    }

    // Fairness under concurrency: pickCoordinator holds an advisory lock
    // until the assignment commits, so the second submission sees the first's
    // load. At least two coordinators (the throwaway pair) start at zero
    // active events, so a fair rule cannot hand both events to one of them.
    expect(new Set(events.map((e) => e.coordinatorId)).size).toBe(2);
  });
});

// SCRUM-18 — enforced by SELECT ... FOR UPDATE on the Event row (requesting)
// and a conditional `status: "OPEN"` claim (responding). The unit tests only
// prove the calls are made; these prove the database actually serialises them.
describe.skipIf(!usesLocalDatabase)("concurrency — clarification (SCRUM-18)", () => {
  let eventId: string;
  const raceEventName = `SCRUM-18 Decision Race Event ${Date.now()}`;

  const asCoordinator = () =>
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_coordinator", role: "COORDINATOR", name: "Cody", email: "coordinator@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });
  const asOrganiser = () =>
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "usr_organiser", role: "ORGANISER", name: "Olivia Organiser", email: "organiser@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    });

  beforeAll(async () => {
    const event = await prisma.event.create({
      data: {
        name: `SCRUM-18 Concurrency Event ${Date.now()}`,
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
      },
      select: { id: true },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    const raceIds = (
      await prisma.event.findMany({
        where: { name: raceEventName },
        select: { id: true },
      })
    ).map((e) => e.id);
    const ids = [eventId, ...raceIds];
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.clarificationRequest.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  it("SCRUM-18: two simultaneous requests on one event create exactly one OPEN clarification and refuse the other", async () => {
    asCoordinator();

    const results = await Promise.all([
      requestClarification({ eventId, message: "Question one" }),
      requestClarification({ eventId, message: "Question two" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    expect(
      await prisma.clarificationRequest.count({ where: { eventId, status: "OPEN" } }),
    ).toBe(1);
  });

  it("SCRUM-18: two simultaneous replies leave one ANSWERED row, refuse the other, and notify the coordinator once", async () => {
    asOrganiser();
    const open = await prisma.clarificationRequest.findFirstOrThrow({
      where: { eventId, status: "OPEN" },
      select: { id: true },
    });

    const results = await Promise.all([
      respondToClarification({ clarificationId: open.id, response: "Reply one" }),
      respondToClarification({ clarificationId: open.id, response: "Reply two" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok);
    expect(loser && !loser.ok && loser.error).toMatch(/already been answered/i);

    const row = await prisma.clarificationRequest.findUniqueOrThrow({
      where: { id: open.id },
    });
    expect(row.status).toBe("ANSWERED");
    // The winner's reply was kept, not overwritten by the loser's.
    const winnerIndex = results.findIndex((r) => r.ok);
    expect(row.response).toBe(winnerIndex === 0 ? "Reply one" : "Reply two");

    expect(
      await prisma.notification.count({
        where: { eventId, userId: "usr_coordinator", title: "Clarification answered" },
      }),
    ).toBe(1);
  });

  it("SCRUM-18: a question asked at the same instant as a decision never leaves an OPEN clarification on the decided event", async () => {
    asCoordinator();
    const event = await prisma.event.create({
      data: {
        name: raceEventName,
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
      },
      select: { id: true },
    });

    // Either order is legal: the question lands first and the decision closes
    // it, or the decision lands first and the question is refused. What must
    // never happen is the question slipping in after the decision.
    await Promise.all([
      requestClarification({ eventId: event.id, message: "Question during a decision" }),
      transitionEventStatus({ eventId: event.id, nextStatus: "APPROVED" }),
    ]);

    expect(
      await prisma.event.findUniqueOrThrow({ where: { id: event.id } }),
    ).toMatchObject({ status: "APPROVED" });
    expect(
      await prisma.clarificationRequest.count({
        where: { eventId: event.id, status: "OPEN" },
      }),
    ).toBe(0);
  });
});
