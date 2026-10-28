import { describe, it, expect, afterAll, beforeAll, vi, type Mock } from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getAssignedFromQueue } from "@/app/(app)/queue/queries";
import {
  getDecidedBookings,
  getPendingBookingQueue,
} from "@/app/(app)/bookings/queries";
import { getDecidedSafetyChecks } from "@/app/(app)/safety-checks/queries";

// SCRUM-211 AC2 — the Decided filter's reads against a real database: what
// each queue lists once decided, and who may read it. Only the session is
// mocked. Test cases: docs/testing/SCRUM-211.md.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const signInAs = (id: string | null, role = "COORDINATOR_LEAD") =>
  (auth as unknown as Mock).mockResolvedValue(
    id
      ? ({
          user: { id, role, name: id, email: `${id}@test.local` },
          expires: "2999-01-01T00:00:00.000Z",
        } as Session)
      : null,
  );

const STAMP = Date.now();
const PERIOD = {
  startAt: new Date("2033-02-14T02:00:00Z"),
  endAt: new Date("2033-02-14T04:00:00Z"),
};

describe.skipIf(!usesLocalDatabase)("SCRUM-211 — what each queue's Decided filter reads", () => {
  const ids: Record<string, string> = {};

  async function event(key: string, data: object) {
    const { id } = await prisma.event.create({
      data: {
        name: `SCRUM-211 decided ${key} ${STAMP}`,
        organiserId: "usr_organiser",
        expectedAttendance: 40,
        submittedAt: new Date(),
        ...PERIOD,
        ...data,
      },
      select: { id: true },
    });
    ids[key] = id;
    return id;
  }

  beforeAll(async () => {
    await event("assigned", {
      status: "UNDER_REVIEW",
      coordinatorId: "usr_coordinator",
      supervisingLeadId: "usr_coordinatorlead",
    });
    await event("waiting", { status: "SUBMITTED" });

    // The second Coordinator's, so no other suite's list of Cody's events
    // (SCRUM-50 TC-50-09) ever includes it.
    const planning = await event("planning", {
      status: "PLANNING",
      coordinatorId: "usr_coordinator_2",
    });
    const booking = (status: "APPROVED" | "PENDING" | "REJECTED", venueId: string, decided: boolean) =>
      prisma.booking.create({
        data: {
          eventId: planning,
          venueId,
          ...PERIOD,
          status,
          requestedAttendance: 40,
          requestedById: "usr_coordinator_2",
          ...(decided
            ? { decidedById: "usr_venuestaff", decidedAt: new Date(), decisionReason: status === "REJECTED" ? "Too small" : null }
            : {}),
        },
        select: { id: true },
      });
    ids.approved = (await booking("APPROVED", "ven_hall", true)).id;
    ids.pending = (await booking("PENDING", "ven_seminar", false)).id;

    // SCRUM-163 holds Venue Staff placed that ended without a decision: one
    // the Coordinator released, one marked Expired, and one whose expiry has
    // passed but which nothing has marked yet; and a live hold, still waiting.
    const hold = (
      status: "CANCELLED" | "EXPIRED" | "HELD",
      venueId: string,
      heldAt: Date,
      holdExpiresAt: Date,
    ) =>
      prisma.booking.create({
        data: {
          eventId: planning,
          venueId,
          ...PERIOD,
          status,
          requestedAttendance: 40,
          requestedById: "usr_coordinator_2",
          heldAt,
          holdExpiresAt,
          holdNote: "Confirm the catering numbers",
        },
        select: { id: true },
      });
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
    ids.released = (await hold("CANCELLED", "ven_auditorium", daysAgo(3), daysAgo(1))).id;
    ids.expired = (await hold("EXPIRED", "ven_boardroom", daysAgo(5), daysAgo(2))).id;
    ids.lapsed = (await hold("HELD", "ven_auditorium", daysAgo(4), daysAgo(1))).id;
    ids.liveHold = (await hold("HELD", "ven_boardroom", daysAgo(1), daysAgo(-3))).id;

    // A check this officer may review, decided; one awaiting review; and a
    // decided one for an event the officer coordinates, which they may not see.
    const check = (eventId: string, status: "APPROVED" | "AWAITING_REVIEW") =>
      prisma.safetyCheck.create({
        data: {
          eventId,
          status,
          requestedById: "usr_coordinator_2",
          ...(status === "APPROVED" ? { decidedById: "usr_safetyofficer_2", decidedAt: new Date() } : {}),
        },
        select: { id: true },
      });
    ids.checkDecided = (await check(planning, "APPROVED")).id;
    ids.checkWaiting = (await check(planning, "AWAITING_REVIEW")).id;
    const own = await event("own", { status: "PLANNING", coordinatorId: "usr_safetyofficer" });
    ids.checkOwn = (await check(own, "APPROVED")).id;
  });

  afterAll(async () => {
    const eventIds = Object.entries(ids)
      .filter(([key]) => ["assigned", "waiting", "planning", "own"].includes(key))
      .map(([, id]) => id);
    await prisma.safetyCheck.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  });

  it("SCRUM-211 [AC2] TC-211-03: the Unassigned Queue's Decided lists requests a Lead assigned, with their Coordinator, and not those still waiting", async () => {
    signInAs("usr_coordinatorlead");
    const decided = await getAssignedFromQueue();

    expect(decided.find((e) => e.id === ids.assigned)).toMatchObject({
      coordinator: { name: "Cody Coordinator" },
    });
    expect(decided.map((e) => e.id)).not.toContain(ids.waiting);
  });

  it("SCRUM-211 [AC2] TC-211-03: only a Lead reads it; anyone else, or no one, reads nothing", async () => {
    signInAs("usr_coordinator", "COORDINATOR");
    expect(await getAssignedFromQueue()).toEqual([]);
    signInAs(null);
    expect(await getAssignedFromQueue()).toEqual([]);
  });

  it("SCRUM-211 [AC2] TC-211-03: Bookings' Decided lists decided requests with the decision, and not those pending", async () => {
    const decided = await getDecidedBookings();

    expect(decided.find((b) => b.id === ids.approved)).toMatchObject({
      status: "APPROVED",
      decidedBy: { name: "Vera Venue" },
      venue: { name: "Exhibition Hall" },
    });
    expect(decided.map((b) => b.id)).not.toContain(ids.pending);
  });

  it("SCRUM-211 [AC2] TC-211-12: a hold that was released or expired is under Decided, newest first by when it was held, and no longer waiting", async () => {
    const decided = await getDecidedBookings();
    const waiting = (await getPendingBookingQueue()).map((b) => b.id);
    const ended = decided.filter((b) =>
      [ids.released, ids.expired, ids.lapsed].includes(b.id),
    );

    // Held 3, 4 and 5 days ago: the most recently held first.
    expect(ended.map((b) => [b.id, b.status])).toEqual([
      [ids.released, "CANCELLED"],
      [ids.lapsed, "EXPIRED"],
      [ids.expired, "EXPIRED"],
    ]);
    expect(ended.every((b) => b.decidedAt === null && b.heldAt !== null)).toBe(true);
    for (const id of [ids.released, ids.expired, ids.lapsed]) {
      expect(waiting).not.toContain(id);
    }
    // The other side: a hold still live waits, and is not decided.
    expect(waiting).toContain(ids.liveHold);
    expect(decided.map((b) => b.id)).not.toContain(ids.liveHold);
  });

  it("SCRUM-211 [AC2] TC-211-12: a decided request ranks by its decision, before a hold placed earlier", async () => {
    const decided = (await getDecidedBookings()).map((b) => b.id);

    expect(decided.indexOf(ids.approved)).toBeLessThan(decided.indexOf(ids.released));
  });

  it("SCRUM-211 [AC2] TC-211-03: Safety Checks' Decided lists recorded checks the officer may review, and not those awaiting review or their own event's (SCRUM-166 AC6)", async () => {
    const decided = await getDecidedSafetyChecks({
      id: "usr_safetyofficer",
      role: "SAFETY_OFFICER",
    });
    const mine = decided.map((c) => c.id);

    expect(decided.find((c) => c.id === ids.checkDecided)).toMatchObject({
      status: "APPROVED",
      requestedBy: "Cara Coordinator",
      event: { expectedAttendance: 40 },
    });
    expect(mine).not.toContain(ids.checkWaiting);
    expect(mine).not.toContain(ids.checkOwn);
  });
});
