import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Role } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/can";
import { getEventPageData } from "@/app/(app)/events/[id]/event-page-data";

// SCRUM-208 against a real Postgres: what the event's own page reads, for its
// Organiser and its Coordinator, and the same "not found" for everyone else.
// It writes throwaway events, so it runs only against a localhost database
// (CI's, or the Docker one), never the shared Supabase one.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const as = (id: string, role: Role): SessionUser =>
  ({ id, role, name: "Test", email: `${id}@test.local` }) as SessionUser;
const organiser = as("usr_organiser", "ORGANISER");
const coordinator = as("usr_coordinator", "COORDINATOR");

const STAMP = Date.now();
const PERIOD = {
  startAt: new Date("2036-09-01T01:00:00Z"),
  endAt: new Date("2036-09-01T05:00:00Z"),
};

describe.skipIf(!usesLocalDatabase)("SCRUM-208 — the event page's data, against a real database", () => {
  const ids: Record<string, string> = {};

  async function event(key: string, data: object) {
    const { id } = await prisma.event.create({
      data: {
        name: `SCRUM-208 page data ${key} ${STAMP}`,
        organiserId: "usr_organiser",
        ...PERIOD,
        ...data,
      },
      select: { id: true },
    });
    ids[key] = id;
    return id;
  }

  beforeAll(async () => {
    const planning = await event("planning", { status: "PLANNING", coordinatorId: "usr_coordinator" });
    await prisma.booking.create({
      data: {
        eventId: planning,
        venueId: "ven_hall",
        ...PERIOD,
        status: "APPROVED",
        requestedAttendance: 40,
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
        needsReconsideration: true,
        reconsiderationFlaggedAt: new Date(),
        reconsiderationReason: "The attendance changed.",
      },
    });
    await event("approved", { status: "APPROVED", coordinatorId: "usr_coordinator" });
    const question = await event("question", { status: "UNDER_REVIEW", coordinatorId: "usr_coordinator" });
    await prisma.clarificationRequest.create({
      data: { eventId: question, requestedById: "usr_coordinator", message: "Which hall?" },
    });
    const cancelled = await event("cancelled", {
      status: "CANCELLED",
      cancelledAt: new Date("2036-08-01T00:00:00Z"),
      cancellationReason: "Speaker withdrew.",
    });
    await prisma.auditLog.create({
      data: {
        entityType: "Event",
        entityId: cancelled,
        action: "STATUS_CHANGED",
        fieldName: "status",
        oldValue: "PLANNING",
        newValue: "CANCELLED",
      },
    });
    await event("cancelled-unlogged", { status: "CANCELLED" });
    await event("discarded", { status: "DRAFT", discardedAt: new Date() });
  });

  afterAll(async () => {
    const eventIds = Object.values(ids);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: eventIds } } });
    await prisma.clarificationRequest.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  });

  it("SCRUM-208 [AC2] TC-208-06: the Coordinator counts the flagged booking, and is told to decide it first", async () => {
    const data = await getEventPageData(coordinator, ids.planning);

    expect(data).toMatchObject({
      viewer: "coordinator",
      organiserName: "Olivia Organiser",
      coordinatorName: "Cody Coordinator",
      cancelledFrom: null,
      attention: { openClarification: false, pendingChangeRequests: 0, flaggedArrangements: 1 },
      step: { kind: "yours", text: "Your turn: decide what happens to the flagged arrangements" },
    });
  });

  it("SCRUM-208 [AC2, AC4] TC-208-05: the Organiser reads the same event without the flags, waiting on the Coordinator", async () => {
    const data = await getEventPageData(organiser, ids.planning);

    expect(data).toMatchObject({
      viewer: "organiser",
      attention: { flaggedArrangements: 0 },
      step: { kind: "waiting", text: "Waiting for Cody Coordinator to decide the flagged venue booking" },
    });
  });

  it("SCRUM-208 [AC2] TC-208-05: an Approved event's next step comes from its checklist too", async () => {
    expect(await getEventPageData(coordinator, ids.approved)).toMatchObject({
      step: { kind: "yours", text: "Your turn: request a venue" },
    });
  });

  it("SCRUM-208 [AC2] TC-208-03: an open question is counted, and is the Organiser's turn", async () => {
    expect(await getEventPageData(organiser, ids.question)).toMatchObject({
      attention: { openClarification: true },
      step: { kind: "yours", text: "Your turn: answer the Coordinator's question" },
    });
  });

  it("SCRUM-208 [AC2] TC-208-07: a Cancelled event shows its reason and when, and the status it was cancelled from", async () => {
    expect(await getEventPageData(organiser, ids.cancelled)).toMatchObject({
      coordinatorName: null,
      cancelledFrom: "PLANNING",
      step: {
        kind: "outcome",
        reason: "Speaker withdrew.",
        detail: "2036-08-01T00:00:00.000Z",
      },
    });
    expect(await getEventPageData(organiser, ids["cancelled-unlogged"])).toMatchObject({
      cancelledFrom: null,
      step: { kind: "outcome", detail: null },
    });
  });

  it.each([
    { who: "another Organiser", user: as("usr_organiser_2", "ORGANISER"), key: "planning" },
    { who: "a Coordinator it isn't assigned to", user: as("usr_coordinator_2", "COORDINATOR"), key: "planning" },
    { who: "its Organiser, once the draft is discarded", user: organiser, key: "discarded" },
    { who: "anyone, for an id that doesn't exist", user: organiser, key: "missing" },
  ])("SCRUM-208 [AC5] TC-208-13: $who gets not found", async ({ user, key }) => {
    expect(await getEventPageData(user, ids[key] ?? `evt_missing_${STAMP}`)).toBeNull();
  });
});
