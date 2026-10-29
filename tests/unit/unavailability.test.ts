import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { recordUnavailability } from "@/app/(app)/venues/availability/actions";

// SCRUM-37 / SCRUM-161 — recording venue unavailability, with the database
// mocked: permission, validation, the confirmation step, flagging and every
// refusal branch. The same criteria are proven against real Postgres in
// tests/integration/unavailability.test.ts, and the race in
// tests/integration/concurrency.test.ts.
const db = vi.hoisted(() => ({
  venue: { findFirst: vi.fn() },
  booking: { findMany: vi.fn(), updateMany: vi.fn() },
  venueUnavailability: { findMany: vi.fn(), create: vi.fn() },
  auditLog: { createMany: vi.fn() },
  notification: { createMany: vi.fn() },
  user: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;

function sessionFor(role: Role, id = `usr_${role.toLowerCase()}`): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

// 3 May 2034, 9:00 am to 5:00 pm SGT.
const START = "2034-05-03T01:00:00.000Z";
const END = "2034-05-03T09:00:00.000Z";
const valid = {
  venueId: "ven_1",
  startAt: START,
  endAt: END,
  reason: "MAINTENANCE",
};

/** A booking row as findAffectedBookings selects it. */
function bookingRow(
  id: string,
  start: string,
  end: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    status: "APPROVED",
    startAt: new Date(start),
    endAt: new Date(end),
    setupMinutes: 0,
    turnaroundMinutes: 0,
    requestedById: "usr_requester",
    needsReconsideration: false,
    venue: { setupMinutes: 0, turnaroundMinutes: 0 },
    event: {
      id: `evt_${id}`,
      name: `Event ${id}`,
      coordinatorId: "usr_coordinator",
      coordinator: { name: "Cody Coordinator" },
    },
    ...overrides,
  };
}

/** Inside the period: 3 May 2034, 10:00 am to 12:00 pm SGT. */
const inside = (id: string, overrides: Record<string, unknown> = {}) =>
  bookingRow(
    id,
    "2034-05-03T02:00:00.000Z",
    "2034-05-03T04:00:00.000Z",
    overrides,
  );

/** The SQL text of each $queryRaw call, with "?" for each parameter. */
const rawSql = () =>
  db.$queryRaw.mock.calls.map(([strings]) => (strings as string[]).join("?"));

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((work: (tx: typeof db) => unknown) =>
    work(db),
  );
  mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF", "usr_staff"));
  db.venue.findFirst.mockResolvedValue({ name: "Seminar Room" });
  db.booking.findMany.mockResolvedValue([]);
  db.booking.updateMany.mockResolvedValue({ count: 0 });
  db.venueUnavailability.findMany.mockResolvedValue([]);
  db.venueUnavailability.create.mockResolvedValue({ id: "vun_1" });
  db.user.findMany.mockResolvedValue([
    { id: "usr_staff" },
    { id: "usr_staff2" },
  ]);
});

describe("recordUnavailability — SCRUM-37 behaviour that still stands", () => {
  it("SCRUM-37 [AC1, AC2] TC-37-02: venue staff record a period and a reason; the calendar is refreshed", async () => {
    const result = await recordUnavailability({
      ...valid,
      note: "  Aircon.  ",
    });

    expect(result).toEqual({
      ok: true,
      data: { recorded: true, id: "vun_1", created: true, flagged: 0 },
    });
    expect(db.venueUnavailability.create).toHaveBeenCalledWith({
      data: {
        venueId: "ven_1",
        startAt: new Date(START),
        endAt: new Date(END),
        reason: "MAINTENANCE",
        note: "Aircon.",
        recordedById: "usr_staff",
      },
      select: { id: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/venues/availability");
    // TC-161-02: with nothing booked, nothing is flagged or notified.
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.notification.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it("SCRUM-37 [AC1] TC-37-02: a blank note is stored as none", async () => {
    await recordUnavailability({ ...valid, note: "   " });

    expect(db.venueUnavailability.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ note: null }),
      }),
    );
  });

  it("SCRUM-37 [AC6] TC-37-03: only venue staff may record unavailability", async () => {
    for (const role of [
      "ORGANISER",
      "COORDINATOR",
      "TECH_SUPPORT",
      "ATTENDEE",
      "COORDINATOR_LEAD",
      "SAFETY_OFFICER",
    ] as Role[]) {
      mockAuth.mockResolvedValue(sessionFor(role));
      expect(await recordUnavailability(valid)).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
    }
    expect(db.venueUnavailability.create).not.toHaveBeenCalled();
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-37 [AC1] TC-37-03: an end at or before the start is refused as an invalid period", async () => {
    const result = await recordUnavailability({ ...valid, endAt: START });

    expect(result).toMatchObject({
      ok: false,
      error:
        "The requested period is invalid: the end must be after the start.",
    });
    expect(db.venue.findFirst).not.toHaveBeenCalled();
  });

  it("SCRUM-37 [AC1] TC-37-03: a period with no reason is refused with field errors", async () => {
    const result = await recordUnavailability({ ...valid, reason: "" });

    expect(result).toMatchObject({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { reason: ["Choose a reason."] },
    });
  });

  it("SCRUM-37 [AC1] TC-37-03: an unknown or retired venue is refused", async () => {
    db.venue.findFirst.mockResolvedValue(null);

    expect(await recordUnavailability(valid)).toEqual({
      ok: false,
      error: "Venue not found.",
    });
  });

  it("SCRUM-172 [AC5] TC-172-05: the five venue reasons are accepted, and Damaged and Closure no longer are", async () => {
    for (const reason of [
      "MAINTENANCE",
      "EQUIPMENT_FAILURE",
      "RENOVATION",
      "SAFETY_CONCERN",
      "OTHER",
    ]) {
      expect(await recordUnavailability({ ...valid, reason })).toMatchObject({
        ok: true,
      });
    }
    for (const reason of ["DAMAGED", "CLOSURE"]) {
      expect(await recordUnavailability({ ...valid, reason })).toMatchObject({
        ok: false,
        fieldErrors: { reason: ["Choose a reason."] },
      });
    }
    expect(db.venueUnavailability.create).toHaveBeenCalledTimes(5);
  });

  it("SCRUM-37: does not swallow an unexpected database error", async () => {
    db.venueUnavailability.create.mockRejectedValue(
      new Error("connection lost"),
    );

    await expect(recordUnavailability(valid)).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("recordUnavailability — over existing bookings (SCRUM-161)", () => {
  it("SCRUM-161 [AC1, AC2] TC-161-01: a period over a booking saves nothing until each affected booking is confirmed", async () => {
    db.booking.findMany.mockResolvedValue([
      inside("bkg_1"),
      inside("bkg_2", {
        status: "PENDING",
        event: {
          id: "evt_2",
          name: "Robotics Expo",
          coordinatorId: null,
          coordinator: null,
        },
      }),
    ]);

    const result = await recordUnavailability(valid);

    expect(result).toEqual({
      ok: true,
      data: {
        recorded: false,
        affected: [
          {
            bookingId: "bkg_1",
            eventName: "Event bkg_1",
            coordinatorName: "Cody Coordinator",
            status: "Approved",
            startAt: new Date("2034-05-03T02:00:00.000Z"),
            endAt: new Date("2034-05-03T04:00:00.000Z"),
          },
          {
            bookingId: "bkg_2",
            eventName: "Robotics Expo",
            coordinatorName: null,
            status: "Pending",
            startAt: new Date("2034-05-03T02:00:00.000Z"),
            endAt: new Date("2034-05-03T04:00:00.000Z"),
          },
        ],
      },
    });
    expect(db.venueUnavailability.create).not.toHaveBeenCalled();
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("SCRUM-161 [AC1, AC2] TC-161-01: once every affected booking is confirmed, the period is saved over it", async () => {
    db.booking.findMany.mockResolvedValue([inside("bkg_1")]);
    db.booking.updateMany.mockResolvedValue({ count: 1 });

    const result = await recordUnavailability({
      ...valid,
      confirmedBookingIds: ["bkg_1"],
    });

    expect(result).toEqual({
      ok: true,
      data: { recorded: true, id: "vun_1", created: true, flagged: 1 },
    });
    expect(db.venueUnavailability.create).toHaveBeenCalledTimes(1);
    for (const path of ["/venues/availability", "/bookings", "/events"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("SCRUM-161 [AC2] TC-161-07: a booking not among those confirmed is shown again, and nothing is saved", async () => {
    db.booking.findMany.mockResolvedValue([inside("bkg_1"), inside("bkg_new")]);

    const result = await recordUnavailability({
      ...valid,
      confirmedBookingIds: ["bkg_1"],
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        recorded: false,
        affected: [{ bookingId: "bkg_1" }, { bookingId: "bkg_new" }],
      },
    });
    expect(db.venueUnavailability.create).not.toHaveBeenCalled();
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-161 [AC3] TC-161-04: only the flag is written, with the reason and period", async () => {
    db.booking.findMany.mockResolvedValue([
      inside("bkg_1"),
      inside("bkg_2", { status: "HELD" }),
      inside("bkg_3", { status: "PENDING" }),
    ]);

    await recordUnavailability({
      ...valid,
      reason: "SAFETY_CONCERN",
      note: "Fire exit blocked",
      confirmedBookingIds: ["bkg_1", "bkg_2", "bkg_3"],
    });

    const reason =
      "Seminar Room is unavailable: Safety concern from 3 May 2034, 9:00 am SGT to 3 May 2034, 5:00 pm SGT. Note: Fire exit blocked";
    expect(db.booking.updateMany).toHaveBeenCalledTimes(1);
    const [{ where, data }] = db.booking.updateMany.mock.calls[0];
    expect(where).toEqual({
      id: { in: ["bkg_1", "bkg_2", "bkg_3"] },
      needsReconsideration: false,
    });
    // AC3: the status, the times and the event are not in the write.
    expect(data).toEqual({
      needsReconsideration: true,
      reconsiderationFlaggedAt: expect.any(Date),
      reconsiderationReason: reason,
      reconsiderationResolvedAt: null,
      reconsiderationResolvedById: null,
    });
    expect(db.auditLog.createMany).toHaveBeenCalledWith({
      data: ["bkg_1", "bkg_2", "bkg_3"].map((id) => ({
        entityType: "Booking",
        entityId: id,
        action: "RECONSIDERATION_FLAGGED",
        actorId: "usr_staff",
        fieldName: "needsReconsideration",
        oldValue: "false",
        newValue: "true",
        summary: reason,
      })),
    });
  });

  it("SCRUM-161 [AC3] TC-161-05: bookings that only touch the period, before or after it, are not affected", async () => {
    db.booking.findMany.mockResolvedValue([
      // Ends exactly as it begins, and begins exactly as it ends.
      bookingRow("bkg_before", "2034-05-02T23:00:00.000Z", START),
      bookingRow("bkg_after", END, "2034-05-03T11:00:00.000Z"),
    ]);

    const result = await recordUnavailability(valid);

    expect(result).toMatchObject({
      ok: true,
      data: { recorded: true, created: true, flagged: 0 },
    });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-161 [AC3] TC-161-05: an approved booking's own turnaround reaching into the period makes it affected, and one only touching it doesn't", async () => {
    db.booking.findMany.mockResolvedValue([
      // Ends 15 minutes before the period; 15 minutes' turnaround touches it.
      bookingRow(
        "bkg_touch",
        "2034-05-02T23:00:00.000Z",
        "2034-05-03T00:45:00.000Z",
        {
          turnaroundMinutes: 15,
        },
      ),
      // Ends 15 minutes before; 16 minutes' turnaround overlaps it.
      bookingRow(
        "bkg_reach",
        "2034-05-02T23:00:00.000Z",
        "2034-05-03T00:45:00.000Z",
        {
          turnaroundMinutes: 16,
        },
      ),
    ]);

    const result = await recordUnavailability(valid);

    expect(result).toMatchObject({
      ok: true,
      data: { recorded: false, affected: [{ bookingId: "bkg_reach" }] },
    });
  });

  it("SCRUM-161 [AC3] TC-161-05: a pending request is measured with the venue's current setup time, a held one with its own", async () => {
    // Both start 30 minutes after the period ends.
    const after = [
      "2034-05-03T09:30:00.000Z",
      "2034-05-03T11:00:00.000Z",
    ] as const;
    db.booking.findMany.mockResolvedValue([
      bookingRow("bkg_pending", ...after, {
        status: "PENDING",
        venue: { setupMinutes: 45, turnaroundMinutes: 0 },
      }),
      bookingRow("bkg_held", ...after, {
        status: "HELD",
        setupMinutes: 30,
        venue: { setupMinutes: 45, turnaroundMinutes: 0 },
      }),
    ]);

    const result = await recordUnavailability(valid);

    expect(result).toMatchObject({
      ok: true,
      data: { recorded: false, affected: [{ bookingId: "bkg_pending" }] },
    });
  });

  it("SCRUM-161 [AC3] TC-161-05: only Pending, live Held and Approved bookings near the period are looked for", async () => {
    await recordUnavailability(valid);

    const [{ where }] = db.booking.findMany.mock.calls[0];
    expect(where).toEqual({
      venueId: "ven_1",
      OR: [
        { status: { in: ["PENDING", "APPROVED"] } },
        { status: "HELD", holdExpiresAt: { gt: expect.any(Date) } },
      ],
      // The period widened by a day either side: the longest setup or turnaround.
      startAt: { lt: new Date("2034-05-04T09:00:00.000Z") },
      endAt: { gt: new Date("2034-05-02T01:00:00.000Z") },
    });
  });

  it("SCRUM-161 [AC4] TC-161-06: the assigned Coordinator is told alternative arrangements are required, with venue, reason and period", async () => {
    db.booking.findMany.mockResolvedValue([
      inside("bkg_1"),
      // An event with no Coordinator: the requester is told instead.
      inside("bkg_2", {
        status: "PENDING",
        event: {
          id: "evt_2",
          name: "Robotics Expo",
          coordinatorId: null,
          coordinator: null,
        },
      }),
    ]);

    await recordUnavailability({
      ...valid,
      reason: "EQUIPMENT_FAILURE",
      confirmedBookingIds: ["bkg_1", "bkg_2"],
    });

    const period =
      "Equipment failure from 3 May 2034, 9:00 am SGT to 3 May 2034, 5:00 pm SGT";
    expect(db.notification.createMany).toHaveBeenNthCalledWith(1, {
      data: [
        {
          userId: "usr_coordinator",
          type: "ARRANGEMENT_FLAGGED",
          title: "Alternative venue arrangements required",
          message: `"Event bkg_1": Seminar Room is unavailable (${period}), which overlaps your approved booking there. Alternative arrangements are required: find a replacement venue, then cancel this booking.`,
          link: "/events",
          eventId: "evt_bkg_1",
          bookingId: "bkg_1",
        },
        {
          userId: "usr_requester",
          type: "ARRANGEMENT_FLAGGED",
          title: "Alternative venue arrangements required",
          message: `"Robotics Expo": Seminar Room is unavailable (${period}), which overlaps your pending booking there. Alternative arrangements are required: find a replacement venue, then cancel this booking.`,
          link: "/events",
          eventId: "evt_2",
          bookingId: "bkg_2",
        },
      ],
    });
    // SCRUM-124 AC8: every Venue Staff member, once per flagged booking.
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { OR: [{ role: "VENUE_STAFF" }, { additionalRoles: { has: "VENUE_STAFF" } }] },
      select: { id: true },
    });
    expect(db.notification.createMany).toHaveBeenNthCalledWith(2, {
      data: ["usr_staff", "usr_staff2"].map((userId) => ({
        userId,
        eventId: "evt_bkg_1",
        type: "ARRANGEMENT_FLAGGED",
        title: "Booking needs reconsideration",
        message: `"Event bkg_1": its approved booking of Seminar Room, 3 May 2034, 10:00 am SGT to 3 May 2034, 12:00 pm SGT, is flagged because the venue is unavailable (${period}).`,
        link: "/bookings",
      })),
    });
    expect(db.notification.createMany).toHaveBeenCalledTimes(3);
  });

  it("SCRUM-161 [AC3, AC4] TC-161-15: a booking already flagged keeps its first reason, and its Coordinator is still told", async () => {
    db.booking.findMany.mockResolvedValue([
      inside("bkg_1", { needsReconsideration: true }),
    ]);

    const result = await recordUnavailability({
      ...valid,
      confirmedBookingIds: ["bkg_1"],
    });

    expect(result).toMatchObject({
      ok: true,
      data: { created: true, flagged: 0 },
    });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.createMany).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "usr_coordinator",
          bookingId: "bkg_1",
        }),
      ],
    });
  });

  it("SCRUM-161 [AC1] TC-161-03: unavailability over unavailability already recorded is refused, and nothing is flagged", async () => {
    db.booking.findMany.mockResolvedValue([inside("bkg_1")]);
    db.venueUnavailability.findMany.mockResolvedValue([
      {
        id: "vun_0",
        startAt: new Date("2034-05-03T00:00:00.000Z"),
        endAt: new Date("2034-05-03T02:00:00.000Z"),
        reason: "MAINTENANCE",
      },
    ]);

    expect(
      await recordUnavailability({ ...valid, confirmedBookingIds: ["bkg_1"] }),
    ).toEqual({
      ok: false,
      error:
        "Not recorded: Seminar Room is unavailable (maintenance) from 3 May 2034, 8:00 am SGT to 3 May 2034, 10:00 am SGT.",
    });
    expect(db.venueUnavailability.create).not.toHaveBeenCalled();
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-161 [AC6] TC-161-13: the same unavailability again saves nothing and flags nothing", async () => {
    db.booking.findMany.mockResolvedValue([inside("bkg_1")]);
    db.venueUnavailability.findMany.mockResolvedValue([
      {
        id: "vun_0",
        startAt: new Date(START),
        endAt: new Date(END),
        reason: "MAINTENANCE",
      },
    ]);

    expect(
      await recordUnavailability({ ...valid, confirmedBookingIds: ["bkg_1"] }),
    ).toEqual({
      ok: true,
      data: { recorded: true, id: "vun_0", created: false, flagged: 0 },
    });
    expect(db.venueUnavailability.create).not.toHaveBeenCalled();
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("SCRUM-161 [AC6] TC-161-13: the same period with a different reason is not the same unavailability, so it is refused as an overlap", async () => {
    db.venueUnavailability.findMany.mockResolvedValue([
      {
        id: "vun_0",
        startAt: new Date(START),
        endAt: new Date(END),
        reason: "RENOVATION",
      },
    ]);

    expect(await recordUnavailability(valid)).toMatchObject({
      ok: false,
      error: expect.stringMatching(
        /^Not recorded: Seminar Room is unavailable \(renovation\)/,
      ),
    });
  });

  it("SCRUM-161 [AC5] TC-161-12: the affected events, then the bookings, then the venue are locked before anything is decided", async () => {
    db.booking.findMany.mockResolvedValue([
      inside("bkg_b", {
        event: {
          id: "evt_2",
          name: "B",
          coordinatorId: "usr_coordinator",
          coordinator: null,
        },
      }),
      inside("bkg_a", {
        event: {
          id: "evt_1",
          name: "A",
          coordinatorId: "usr_coordinator",
          coordinator: null,
        },
      }),
      inside("bkg_c", {
        event: {
          id: "evt_1",
          name: "A",
          coordinatorId: "usr_coordinator",
          coordinator: null,
        },
      }),
    ]);

    await recordUnavailability({
      ...valid,
      confirmedBookingIds: ["bkg_a", "bkg_b", "bkg_c"],
    });

    expect(rawSql()).toEqual([
      'SELECT "id" FROM "Event" WHERE "id" IN (?) ORDER BY "id" FOR KEY SHARE',
      'SELECT "id" FROM "Booking" WHERE "id" IN (?) ORDER BY "id" FOR UPDATE',
      'SELECT "id" FROM "Venue" WHERE "id" = ? FOR NO KEY UPDATE',
    ]);
    // Each id once, sorted, so two writers lock in the same order.
    expect(db.$queryRaw.mock.calls[0][1].values).toEqual(["evt_1", "evt_2"]);
    expect(db.$queryRaw.mock.calls[1][1].values).toEqual([
      "bkg_a",
      "bkg_b",
      "bkg_c",
    ]);
    expect(db.$queryRaw.mock.calls[2].slice(1)).toEqual(["ven_1"]);

    // The decision is made on what is read after the venue is locked.
    const venueLocked = db.$queryRaw.mock.invocationCallOrder[2];
    expect(db.booking.findMany.mock.invocationCallOrder[1]).toBeGreaterThan(
      venueLocked,
    );
    expect(
      db.venueUnavailability.findMany.mock.invocationCallOrder[0],
    ).toBeGreaterThan(venueLocked);
    expect(
      db.venueUnavailability.create.mock.invocationCallOrder[0],
    ).toBeGreaterThan(venueLocked);
  });

  it("SCRUM-37 [AC4] TC-37-06: with no booking affected, only the venue is locked, before the check and the write", async () => {
    await recordUnavailability(valid);

    expect(rawSql()).toEqual([
      'SELECT "id" FROM "Venue" WHERE "id" = ? FOR NO KEY UPDATE',
    ]);
    const locked = db.$queryRaw.mock.invocationCallOrder[0];
    expect(locked).toBeLessThan(
      db.venueUnavailability.findMany.mock.invocationCallOrder[0],
    );
    expect(locked).toBeLessThan(
      db.venueUnavailability.create.mock.invocationCallOrder[0],
    );
  });

  it("SCRUM-161 [AC5] TC-161-12: a save Postgres aborts as a deadlock is retried once", async () => {
    const deadlock = Object.assign(new Error("deadlock detected"), {
      cause: { originalCode: "40P01", originalMessage: "deadlock detected" },
    });
    db.$transaction
      .mockRejectedValueOnce(deadlock)
      .mockImplementationOnce((work: (tx: typeof db) => unknown) => work(db));

    expect(await recordUnavailability(valid)).toMatchObject({
      ok: true,
      data: { recorded: true, created: true },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });
});
