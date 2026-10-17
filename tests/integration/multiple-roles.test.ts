import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  type Mock,
} from "vitest";
import type { Role } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { decideBookingRequest } from "@/app/(app)/bookings/actions";
import { notifyRole } from "@/lib/staff-notifications";
import { getMyNotifications } from "@/app/(app)/notifications/queries";

// SCRUM-121 against a real, seeded Postgres: an account holds several roles,
// existing accounts hold none extra, staff notices reach a role held as an
// additional one, and a member of staff can't decide a booking for an event
// they coordinate. Only the session is mocked. Test cases:
// docs/testing/SCRUM-121.md.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

// The seeded multirole@test.local: Venue Staff, with Technical Support,
// Coordinator and Organiser as additional roles. Seeded, not made here, because staff
// notices reach it while other suites run (SCRUM-124).
const BOTH_ID = "usr_multirole";
const BOTH: Session = {
  user: {
    id: BOTH_ID,
    role: "VENUE_STAFF",
    additionalRoles: ["TECH_SUPPORT", "COORDINATOR", "ORGANISER"],
    name: "Morgan Multirole",
    email: "multirole@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};
const STAMP = Date.now();
const START = new Date("2036-09-14T01:00:00.000Z");
const END = new Date("2036-09-14T05:00:00.000Z");

describe.skipIf(!usesLocalDatabase)("several roles on one account — real database (SCRUM-121)", () => {
  let venueId: string;
  let eventIds: string[];

  const pendingFor = (eventId: string) =>
    prisma.booking.create({
      data: {
        eventId,
        venueId,
        startAt: START,
        endAt: END,
        status: "PENDING",
        requestedAttendance: 40,
        requestedById: BOTH_ID,
      },
      select: { id: true },
    });

  async function clear() {
    const bookingIds = (
      await prisma.booking.findMany({ where: { venueId }, select: { id: true } })
    ).map((b) => b.id);
    // Only notices about its own events: the account is Venue Staff, so other
    // suites' notices reach it while they run, and they count them.
    await prisma.notification.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { venueId } });
  }

  beforeAll(async () => {
    eventIds = [];
    // [0] it coordinates, [1] someone else's, [2] it organises.
    for (const [organiserId, coordinatorId] of [
      ["usr_organiser", BOTH_ID],
      ["usr_organiser", "usr_coordinator_2"],
      [BOTH_ID, "usr_coordinator_2"],
    ]) {
      eventIds.push(
        (
          await prisma.event.create({
            data: {
              name: `Several roles event ${organiserId} ${coordinatorId} ${STAMP}`,
              status: "PLANNING",
              organiserId,
              coordinatorId,
              startAt: START,
              endAt: END,
              expectedAttendance: 40,
            },
            select: { id: true },
          })
        ).id,
      );
    }
    venueId = (
      await prisma.venue.create({
        data: { name: `Several roles venue ${STAMP}`, location: "Test block", capacity: 500 },
        select: { id: true },
      })
    ).id;
  });

  beforeEach(clear);

  afterAll(async () => {
    await clear();
    await prisma.venue.delete({ where: { id: venueId } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  });

  it("SCRUM-121 [AC1] TC-121-01: an account holds its additional roles, and every existing account starts with none", async () => {
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { id: BOTH_ID },
        select: { role: true, additionalRoles: true },
      }),
    ).toEqual({ role: "VENUE_STAFF", additionalRoles: ["TECH_SUPPORT", "COORDINATOR", "ORGANISER"] });
    expect(
      await prisma.user.findMany({
        where: { id: { in: ["usr_organiser", "usr_coordinator", "usr_venuestaff", "usr_techsupport"] } },
        select: { additionalRoles: true },
      }),
    ).toEqual(Array(4).fill({ additionalRoles: [] as Role[] }));
  });

  it("SCRUM-121 [AC2] TC-121-02: a notice for a role reaches someone who holds it as an additional role, once", async () => {
    await prisma.$transaction((tx) =>
      notifyRole(tx, "COORDINATOR", { id: eventIds[1] }, {
        type: "BOOKING_REQUESTED",
        title: "A venue was requested",
        message: "Test.",
        link: "/bookings",
      }),
    );

    const received = await prisma.notification.findMany({
      where: { eventId: eventIds[1], type: "BOOKING_REQUESTED" },
      select: { userId: true },
    });
    const users = received.map((n) => n.userId);
    expect(users).toContain(BOTH_ID);
    expect(users).toContain("usr_coordinator");
    expect(new Set(users).size).toBe(users.length);
  });

  it("SCRUM-48 [AC6] TC-48-10, SCRUM-121 [AC2] TC-121-02: an account that is Venue Staff and Technical Support sees the notices of both in one list", async () => {
    const notice = (title: string) => ({
      type: "BOOKING_REQUESTED" as const,
      title,
      message: `${title} ${STAMP}`,
      link: "/bookings",
    });
    await prisma.$transaction(async (tx) => {
      await notifyRole(tx, "VENUE_STAFF", { id: eventIds[1] }, notice("For Venue Staff"));
      await notifyRole(tx, "TECH_SUPPORT", { id: eventIds[1] }, notice("For Technical Support"));
    });
    mockAuth.mockResolvedValue(BOTH);

    const mine = (await getMyNotifications()).filter((n) => n.message.endsWith(`${STAMP}`));
    expect(mine.map((n) => n.title).sort()).toEqual(["For Technical Support", "For Venue Staff"]);
  });

  it("SCRUM-121 [AC5] TC-121-05: a member of Venue Staff who coordinates the event can't decide its booking, and it stays pending with nothing recorded", async () => {
    const { id } = await pendingFor(eventIds[0]);
    mockAuth.mockResolvedValue(BOTH);

    expect(await decideBookingRequest({ bookingId: id, decision: "APPROVED" })).toEqual({
      ok: false,
      error: "You do not have permission to do that.",
    });
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id }, select: { status: true } }),
    ).toEqual({ status: "PENDING" });
    expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(0);
  });

  it("SCRUM-121 [AC5] TC-121-05: nor a booking for an event it organises, which stays pending with nothing recorded", async () => {
    const { id } = await pendingFor(eventIds[2]);
    mockAuth.mockResolvedValue(BOTH);

    expect(
      await decideBookingRequest({ bookingId: id, decision: "REJECTED", reason: "Not needed." }),
    ).toEqual({ ok: false, error: "You do not have permission to do that." });
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id }, select: { status: true } }),
    ).toEqual({ status: "PENDING" });
    expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(0);
  });

  it("SCRUM-121 [AC2, AC5] TC-121-05: the same account decides a booking for an event it neither organises nor coordinates", async () => {
    const { id } = await pendingFor(eventIds[1]);
    mockAuth.mockResolvedValue(BOTH);

    expect(await decideBookingRequest({ bookingId: id, decision: "APPROVED" })).toEqual({
      ok: true,
      data: { status: "APPROVED" },
    });
  });
});
