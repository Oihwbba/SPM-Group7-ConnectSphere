import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { BookingStatus, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  bookingStatusAt,
  holdReminderAt,
  liveHoldWhere,
  reservingWhere,
  withdrawPendingHoldNotices,
} from "@/lib/booking-holds";
import { getReadinessChecklist } from "@/lib/event-readiness";
import { formatDateTime } from "@/lib/datetime";
import {
  confirmHold,
  decideBookingRequest,
  holdBookingRequest,
  releaseHold,
} from "@/app/(app)/bookings/actions";

// SCRUM-163 — tentative venue holds, with the database mocked: every refusal
// branch, and exactly what each action writes. The same rules against a real
// Postgres, including two holds at once and the database's own expiry
// guard, are in tests/integration/holds.test.ts.
const db = vi.hoisted(() => ({
  booking: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  venueUnavailability: { findMany: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
  safetyCheck: { updateMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;
const sessionFor = (role: Role, id = `usr_${role.toLowerCase()}`): Session => ({
  user: { id, role, name: "Test User", email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const STAFF = sessionFor("VENUE_STAFF", "usr_staff");
const CODY = sessionFor("COORDINATOR", "usr_cody");

const HOUR = 60 * 60 * 1000;
const fromNow = (ms: number) => new Date(Date.now() + ms);
const postgresRefusal = (code: string, message: string) =>
  Object.assign(new Error(message), {
    name: "DriverAdapterError",
    cause: { originalCode: code, originalMessage: message },
  });

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((cb: (tx: typeof db) => unknown) =>
    cb(db),
  );
  db.booking.findMany.mockResolvedValue([]);
  db.venueUnavailability.findMany.mockResolvedValue([]);
  db.booking.updateMany.mockResolvedValue({ count: 1 });
  db.notification.createMany.mockResolvedValue({ count: 3 });
  db.notification.updateMany.mockResolvedValue({ count: 2 });
  db.auditLog.create.mockResolvedValue({});
});

const expectNothingWritten = () => {
  expect(db.booking.updateMany).not.toHaveBeenCalled();
  expect(db.notification.create).not.toHaveBeenCalled();
  expect(db.notification.createMany).not.toHaveBeenCalled();
  expect(db.notification.updateMany).not.toHaveBeenCalled();
  expect(db.auditLog.create).not.toHaveBeenCalled();
};

describe("the hold rules — SCRUM-163", () => {
  const now = new Date("2031-05-01T08:00:00.000Z");

  it("SCRUM-163 [AC2, AC4] TC-163-04: a hold reserves its venue until, but not at, its expiry", () => {
    expect(liveHoldWhere(now)).toEqual({
      status: "HELD",
      holdExpiresAt: { gt: now },
    });
    expect(reservingWhere(now)).toEqual({
      OR: [{ status: "APPROVED" }, { status: "HELD", holdExpiresAt: { gt: now } }],
    });
  });

  it("SCRUM-163 [AC4] TC-163-08: a hold reads as Expired from its expiry on, and as Held one millisecond before", () => {
    const held = (holdExpiresAt: Date) => ({
      status: "HELD" as BookingStatus,
      holdExpiresAt,
    });

    expect(bookingStatusAt(held(new Date(now.getTime() + 1)), now)).toBe("HELD");
    expect(bookingStatusAt(held(now), now)).toBe("EXPIRED");
    expect(bookingStatusAt(held(new Date(now.getTime() - 1)), now)).toBe(
      "EXPIRED",
    );
  });

  it.each(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"] as const)(
    "SCRUM-163 [AC4] TC-163-08: a %s booking keeps its own status",
    (status) => {
      expect(bookingStatusAt({ status, holdExpiresAt: now }, now)).toBe(status);
    },
  );

  it("SCRUM-163 [AC5] TC-163-09: the reminder shows 24 hours before the expiry, or straight away when less than that remains", () => {
    const at = (hours: number) => new Date(now.getTime() + hours * HOUR);

    expect(holdReminderAt(at(48), now)).toEqual(at(24));
    expect(holdReminderAt(at(24), now)).toEqual(now);
    expect(holdReminderAt(at(23), now)).toEqual(now);
  });

  it("SCRUM-163 [AC5, AC9] TC-163-10: withdrawing a hold's notices touches only those not yet shown, for one booking or all of an event's", async () => {
    const tx = { notification: { updateMany: vi.fn() } };

    await withdrawPendingHoldNotices(
      tx as unknown as Prisma.TransactionClient,
      { bookingId: "bkg_1" },
      now,
    );
    await withdrawPendingHoldNotices(
      tx as unknown as Prisma.TransactionClient,
      { eventId: "evt_1" },
      now,
    );

    const shownLater = { withdrawnAt: null, showFromAt: { gt: now } };
    expect(tx.notification.updateMany.mock.calls).toEqual([
      [{ where: { bookingId: "bkg_1", ...shownLater }, data: { withdrawnAt: now } }],
      [
        {
          where: { eventId: "evt_1", bookingId: { not: null }, ...shownLater },
          data: { withdrawnAt: now },
        },
      ],
    ]);
  });
});

describe("holdBookingRequest — SCRUM-163 AC1, AC2, AC5", () => {
  const START = fromNow(72 * HOUR);
  const pending = (overrides: Record<string, unknown> = {}) => ({
    id: "bkg_1",
    venueId: "ven_1",
    startAt: START,
    endAt: new Date(START.getTime() + 2 * HOUR),
    status: "PENDING",
    holdExpiresAt: null,
    // SCRUM-159: the venue's setup and turnaround, which a hold copies (AC8).
    venue: { name: "Hall", setupMinutes: 0, turnaroundMinutes: 0 },
    requestedById: "usr_requester",
    event: { id: "evt_1", name: "Symposium", coordinatorId: "usr_cody" },
    ...overrides,
  });
  const valid = (holdExpiresAt: Date) => ({
    bookingId: "bkg_1",
    holdExpiresAt: holdExpiresAt.toISOString(),
    holdNote: "Confirm catering numbers.",
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue(STAFF);
    db.booking.findUnique.mockResolvedValue(pending());
  });

  it("SCRUM-163 [AC1, AC5] TC-163-01, TC-163-09: holds a pending request and writes the Coordinator's three notices with their show-from times", async () => {
    const expiry = fromNow(48 * HOUR);
    const before = Date.now();

    const result = await holdBookingRequest(valid(expiry));

    expect(result).toEqual({
      ok: true,
      data: { status: "HELD", holdExpiresAt: expiry },
    });
    const update = db.booking.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({
      id: "bkg_1",
      status: "PENDING",
      needsReconsideration: false,
    });
    expect(update.data).toEqual({
      status: "HELD",
      heldAt: expect.any(Date),
      holdExpiresAt: expiry,
      holdNote: "Confirm catering numbers.",
      // SCRUM-159 AC8: a hold keeps the venue's minutes it was held with.
      setupMinutes: 0,
      turnaroundMinutes: 0,
    });
    const heldAt = update.data.heldAt as Date;
    expect(heldAt.getTime()).toBeGreaterThanOrEqual(before);

    const notices = db.notification.createMany.mock.calls[0][0].data;
    expect(
      notices.map((n: { type: string; showFromAt: Date }) => [n.type, n.showFromAt]),
    ).toEqual([
      ["BOOKING_HELD", heldAt],
      ["HOLD_EXPIRY_REMINDER", new Date(expiry.getTime() - 24 * HOUR)],
      ["HOLD_EXPIRED", expiry],
    ]);
    for (const notice of notices) {
      expect(notice).toMatchObject({
        userId: "usr_cody",
        eventId: "evt_1",
        bookingId: "bkg_1",
      });
    }
    expect(notices[0].message).toContain("Confirm catering numbers.");
    // AC3 (Week 9): the Coordinator confirms only once Venue Staff approve.
    for (const notice of notices.slice(0, 2)) {
      expect(notice.message).toContain("Once Venue Staff approve");
    }
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: "bkg_1",
        action: "HELD",
        actorId: "usr_staff",
        oldValue: "PENDING",
        newValue: "HELD",
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/venues/availability");
  });

  it("SCRUM-163 [AC2] TC-163-05: the hold locks the event before the booking, the order withdrawing a request and rejecting the event use, so they can't deadlock", async () => {
    await holdBookingRequest(valid(fromNow(48 * HOUR)));

    const [sql, eventId] = db.$queryRaw.mock.calls[0];
    expect(sql.join("?")).toContain('FROM "Event" WHERE "id" = ? FOR KEY SHARE');
    expect(eventId).toBe("evt_1");
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.booking.updateMany.mock.invocationCallOrder[0],
    );
  });

  it("SCRUM-163 [AC5] TC-163-09: with less than 24 hours left, the reminder shows straight away", async () => {
    await holdBookingRequest(valid(fromNow(2 * HOUR)));

    const [held, reminder] = db.notification.createMany.mock.calls[0][0].data;
    expect(reminder.showFromAt).toEqual(held.showFromAt);
  });

  it("SCRUM-163 [AC5] TC-163-09: an event with no Coordinator yet notifies whoever requested the venue", async () => {
    db.booking.findUnique.mockResolvedValue(
      pending({ event: { id: "evt_1", name: "Symposium", coordinatorId: null } }),
    );

    await holdBookingRequest(valid(fromNow(48 * HOUR)));

    const notices = db.notification.createMany.mock.calls[0][0].data;
    expect(notices.map((n: { userId: string }) => n.userId)).toEqual([
      "usr_requester",
      "usr_requester",
      "usr_requester",
    ]);
  });

  it.each([
    ["now", () => new Date()],
    ["an hour ago", () => fromNow(-HOUR)],
    ["the booking's start", () => START],
    ["after the booking's start", () => new Date(START.getTime() + 1)],
  ])(
    "SCRUM-163 [AC1] TC-163-02: an expiry at %s is refused, and nothing is written",
    async (_, expiry) => {
      const result = await holdBookingRequest(valid(expiry()));

      expect(result).toMatchObject({
        ok: false,
        error: expect.stringMatching(
          /^The hold must expire after now and before the booking starts/,
        ),
        fieldErrors: { holdExpiresAt: [expect.any(String)] },
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-163 [AC1] TC-163-02: an expiry one millisecond before the booking starts is accepted", async () => {
    const result = await holdBookingRequest(
      valid(new Date(START.getTime() - 1)),
    );

    expect(result.ok).toBe(true);
  });

  it.each([
    [{ bookingId: "bkg_1", holdExpiresAt: "", holdNote: "x" }, "Choose when the hold expires."],
    [{ bookingId: "bkg_1", holdExpiresAt: "soon", holdNote: "x" }, "Choose when the hold expires."],
    [
      { bookingId: "bkg_1", holdExpiresAt: fromNow(HOUR).toISOString(), holdNote: "  " },
      "Say what the Coordinator must finalise.",
    ],
    [{}, "Choose when the hold expires."],
    [
      { holdExpiresAt: fromNow(HOUR).toISOString(), holdNote: "x" },
      "Please provide a valid hold.",
    ],
  ])(
    "SCRUM-163 [AC1] TC-163-03: %j is refused before anything is read",
    async (input, error) => {
      expect(await holdBookingRequest(input)).toMatchObject({ ok: false, error });
      expect(db.booking.findUnique).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it.each(["COORDINATOR", "TECH_SUPPORT", "ORGANISER"] as const)(
    "SCRUM-163 [AC1] TC-163-03: a %s can't hold a request, and nothing is read or written",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      expect(await holdBookingRequest(valid(fromNow(HOUR)))).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
      expect(db.booking.findUnique).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("SCRUM-163 [AC1] TC-163-03: a request that doesn't exist is not found", async () => {
    db.booking.findUnique.mockResolvedValue(null);

    expect(await holdBookingRequest(valid(fromNow(HOUR)))).toEqual({
      ok: false,
      error: "Booking request not found.",
    });
    expectNothingWritten();
  });

  it.each([
    ["HELD", fromNow(HOUR), /^This request is already held for its Coordinator\. You can approve or reject the hold/],
    ["HELD", fromNow(-HOUR), /^This hold expired at .*Make a new request/],
    ["APPROVED", null, /^This request has already been approved/],
    ["REJECTED", null, /^This request has already been rejected/],
  ])(
    "SCRUM-163 [AC1, AC7] TC-163-03: a %s request can't be held again, and nothing is written",
    async (status, holdExpiresAt, error) => {
      db.booking.findUnique.mockResolvedValue(pending({ status, holdExpiresAt }));

      expect(await holdBookingRequest(valid(fromNow(HOUR)))).toMatchObject({
        ok: false,
        error: expect.stringMatching(error),
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-163 [AC2] TC-163-04: a venue already approved or held for the period refuses the hold and names the clash", async () => {
    db.booking.findMany.mockResolvedValue([
      {
        id: "bkg_other",
        startAt: START,
        endAt: new Date(START.getTime() + HOUR),
        status: "HELD",
        holdExpiresAt: fromNow(HOUR),
        setupMinutes: 0,
        turnaroundMinutes: 0,
      },
    ]);

    const result = await holdBookingRequest(valid(fromNow(2 * HOUR)));

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(
        /^Conflicting: Hall is held from .*This request is still pending\.$/,
      ),
    });
    expectNothingWritten();
  });

  it("SCRUM-159 [AC3, AC8] TC-159-17: a hold is refused where only setup or turnaround clash, and otherwise keeps the venue's minutes", async () => {
    const withTimes = { name: "Hall", setupMinutes: 30, turnaroundMinutes: 45 };
    db.booking.findUnique.mockResolvedValue(pending({ venue: withTimes }));
    // Ends 20 minutes before the request starts: inside its 30 minutes' setup.
    db.booking.findMany.mockResolvedValue([
      {
        id: "bkg_before",
        startAt: new Date(START.getTime() - HOUR),
        endAt: new Date(START.getTime() - 20 * 60 * 1000),
        status: "APPROVED",
        holdExpiresAt: null,
        setupMinutes: 0,
        turnaroundMinutes: 0,
      },
    ]);

    expect(await holdBookingRequest(valid(fromNow(2 * HOUR)))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/^Conflicting: Hall is already booked from /),
    });
    expectNothingWritten();

    db.booking.findMany.mockResolvedValue([]);
    await holdBookingRequest(valid(fromNow(2 * HOUR)));
    expect(db.booking.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "HELD",
      setupMinutes: 30,
      turnaroundMinutes: 45,
    });
  });

  it("SCRUM-163 [AC1] TC-163-03: a request decided by someone else first keeps that decision, with no notice or history written", async () => {
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    db.booking.findUniqueOrThrow.mockResolvedValue({
      status: "APPROVED",
      holdExpiresAt: null,
    });

    expect(await holdBookingRequest(valid(fromNow(HOUR)))).toEqual({
      ok: false,
      error:
        "This request has already been approved; the original decision stands.",
    });
    expect(db.notification.createMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      "booking_no_double_booking",
      /^Conflicting: another booking overlapping this period was approved or held at the same moment/,
    ],
    [
      "booking_overlaps_unavailability",
      /^Conflicting: the venue was recorded as unavailable for this period at the same moment/,
    ],
  ])(
    "SCRUM-163 [AC2] TC-163-05: the database refusing the hold as %s is reported as a conflict",
    async (constraint, error) => {
      db.$transaction.mockRejectedValue(
        postgresRefusal(
          "23P01",
          `conflicting key value violates exclusion constraint "${constraint}"`,
        ),
      );

      expect(await holdBookingRequest(valid(fromNow(HOUR)))).toMatchObject({
        ok: false,
        error: expect.stringMatching(error),
      });
    },
  );

  it("SCRUM-163 [AC1] TC-163-03: an unexpected database failure is not swallowed", async () => {
    db.$transaction.mockRejectedValue(new Error("connection lost"));

    await expect(holdBookingRequest(valid(fromNow(HOUR)))).rejects.toThrow(
      "connection lost",
    );
  });

  const FLAGGED =
    "This request needs reconsideration, so it can't be approved or held until its event's coordinator resolves it. It can still be rejected.";

  it("SCRUM-26 [AC5] TC-26-09: holding a flagged Pending request is refused and nothing is written", async () => {
    db.booking.findUnique.mockResolvedValue(pending({ needsReconsideration: true }));

    expect(await holdBookingRequest(valid(fromNow(HOUR)))).toEqual({
      ok: false,
      error: FLAGGED,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("SCRUM-26 [AC5] TC-26-09: a flag raised after the request was read still stops the hold", async () => {
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    db.booking.findUniqueOrThrow.mockResolvedValue({ status: "PENDING", holdExpiresAt: null });

    expect(await holdBookingRequest(valid(fromNow(HOUR)))).toEqual({
      ok: false,
      error: FLAGGED,
    });
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("confirmHold and releaseHold — SCRUM-163 AC3, AC4, AC7, AC8", () => {
  const held = (overrides: Record<string, unknown> = {}) => ({
    status: "HELD",
    holdExpiresAt: fromNow(HOUR),
    holdApprovedAt: fromNow(-HOUR),
    event: {
      organiserId: "usr_org",
      coordinatorId: "usr_cody",
      status: "PLANNING",
    },
    ...overrides,
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue(CODY);
    db.booking.findUnique.mockResolvedValue(held());
  });

  it("SCRUM-163 [AC3, AC5] TC-163-06, TC-163-10: confirming a live hold Venue Staff approved makes it Approved, withdraws its notices still to come, and records who", async () => {
    expect(await confirmHold({ bookingId: "bkg_1" })).toEqual({
      ok: true,
      data: { status: "APPROVED" },
    });

    const update = db.booking.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({
      id: "bkg_1",
      status: "HELD",
      holdExpiresAt: { gt: expect.any(Date) },
      holdApprovedAt: { not: null },
      needsReconsideration: false,
    });
    expect(update.data).toEqual({
      status: "APPROVED",
      decidedById: "usr_cody",
      decidedAt: expect.any(Date),
    });
    expect(db.notification.updateMany.mock.calls[0][0].where).toMatchObject({
      bookingId: "bkg_1",
      withdrawnAt: null,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "HOLD_CONFIRMED",
        actorId: "usr_cody",
        oldValue: "HELD",
        newValue: "APPROVED",
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/venues/availability");
  });

  it("SCRUM-163 [AC3] TC-163-16: a hold Venue Staff haven't approved can't be confirmed, and nothing is written", async () => {
    db.booking.findUnique.mockResolvedValue(held({ holdApprovedAt: null }));

    expect(await confirmHold({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error:
        "Venue Staff haven't approved this hold yet. You can confirm it once they have.",
    });
    expectNothingWritten();
  });

  it("SCRUM-163 [AC3] TC-163-16: a confirmation that finds the hold still unapproved under the lock changes nothing", async () => {
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    db.booking.findUniqueOrThrow.mockResolvedValue({
      status: "HELD",
      holdExpiresAt: fromNow(HOUR),
    });

    expect(await confirmHold({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error:
        "Venue Staff haven't approved this hold yet. You can confirm it once they have.",
    });
    expect(db.notification.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("SCRUM-163 [AC3, AC5] TC-163-07, TC-163-10: releasing a live hold cancels it, approved by Venue Staff or not, and withdraws its notices still to come", async () => {
    db.booking.findUnique.mockResolvedValue(held({ holdApprovedAt: null }));

    expect(await releaseHold({ bookingId: "bkg_1" })).toEqual({
      ok: true,
      data: { status: "CANCELLED" },
    });

    expect(db.booking.updateMany.mock.calls[0][0]).toEqual({
      where: {
        id: "bkg_1",
        status: "HELD",
        holdExpiresAt: { gt: expect.any(Date) },
      },
      data: { status: "CANCELLED" },
    });
    expect(db.notification.updateMany).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "HOLD_RELEASED",
        newValue: "CANCELLED",
      }),
    });
  });

  it.each([
    ["confirm", confirmHold],
    ["release", releaseHold],
  ] as const)(
    "SCRUM-163 [AC4] TC-163-08: a hold whose expiry has passed can't be settled (%s), and nothing is written",
    async (_, settle) => {
      db.booking.findUnique.mockResolvedValue(
        held({ holdExpiresAt: fromNow(-1000) }),
      );

      expect(await settle({ bookingId: "bkg_1" })).toMatchObject({
        ok: false,
        error: expect.stringMatching(
          /^This hold expired at .*Make a new request if you still need it\.$/,
        ),
      });
      expectNothingWritten();
    },
  );

  it.each([
    ["APPROVED", "This hold has already been confirmed."],
    ["CANCELLED", "This hold has already been released."],
    ["REJECTED", "Venue Staff rejected this hold."],
    ["PENDING", "This request isn't held."],
  ])(
    "SCRUM-163 [AC7] TC-163-12: settling a %s booking changes nothing",
    async (status, error) => {
      db.booking.findUnique.mockResolvedValue(held({ status }));

      expect(await confirmHold({ bookingId: "bkg_1" })).toEqual({
        ok: false,
        error,
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-163 [AC7] TC-163-12: a hold settled by a simultaneous click first is settled once, with one history entry", async () => {
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    db.booking.findUniqueOrThrow.mockResolvedValue({
      status: "APPROVED",
      holdExpiresAt: fromNow(HOUR),
    });

    expect(await confirmHold({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error: "This hold has already been confirmed.",
    });
    expect(db.notification.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("SCRUM-163 [AC8] TC-163-14: a confirmation the database judges to be at or after the expiry is refused as expired", async () => {
    db.$transaction.mockRejectedValue(
      postgresRefusal(
        "23514",
        'new row for relation "Booking" violates check constraint "booking_hold_expired"',
      ),
    );

    expect(await confirmHold({ bookingId: "bkg_1" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/^This hold expired at /),
    });
  });

  it("SCRUM-163 [AC8] TC-163-14: a different database failure is not mistaken for an expiry", async () => {
    db.$transaction.mockRejectedValue(
      postgresRefusal("23514", 'violates check constraint "booking_hold_complete"'),
    );

    await expect(confirmHold({ bookingId: "bkg_1" })).rejects.toThrow(
      "booking_hold_complete",
    );
  });

  it("SCRUM-163 [AC3] TC-163-15: a Coordinator not assigned to the event gets the same not found as a missing hold", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cara"));

    expect(await confirmHold({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error: "Venue hold not found.",
    });
    db.booking.findUnique.mockResolvedValue(null);
    expect(await releaseHold({ bookingId: "bkg_missing" })).toEqual({
      ok: false,
      error: "Venue hold not found.",
    });
    expectNothingWritten();
  });

  it("SCRUM-163 [AC3] TC-163-15: an unassigned event's hold can't be settled by any Coordinator", async () => {
    db.booking.findUnique.mockResolvedValue(
      held({
        event: { organiserId: "usr_org", coordinatorId: null, status: "PLANNING" },
      }),
    );

    expect(await confirmHold({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error: "Venue hold not found.",
    });
    expectNothingWritten();
  });

  it.each(["VENUE_STAFF", "ORGANISER", "ATTENDEE"] as const)(
    "SCRUM-163 [AC3] TC-163-15: a %s can't confirm or release a hold, and nothing is read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      for (const settle of [confirmHold, releaseHold]) {
        expect(await settle({ bookingId: "bkg_1" })).toEqual({
          ok: false,
          error: "You do not have permission to do that.",
        });
      }
      expect(db.booking.findUnique).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-163 [AC3] TC-163-15: a request with no booking id is not found, before anything is read", async () => {
    expect(await confirmHold({})).toEqual({
      ok: false,
      error: "Venue hold not found.",
    });
    expect(db.booking.findUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-163 [AC3] TC-163-15: an unexpected database failure is not swallowed", async () => {
    db.booking.findUnique.mockRejectedValue(new Error("connection lost"));

    await expect(releaseHold({ bookingId: "bkg_1" })).rejects.toThrow(
      "connection lost",
    );
  });

  const FLAGGED_HOLD =
    "This hold needs reconsideration, so it can't be confirmed until you resolve the flag. You can still release it.";

  it("SCRUM-26 [AC5] TC-26-09: confirming a flagged hold is refused and nothing is written", async () => {
    db.booking.findUnique.mockResolvedValue(held({ needsReconsideration: true }));

    expect(await confirmHold({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error: FLAGGED_HOLD,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("SCRUM-26 [AC5] TC-26-09: a flag raised after the hold was read still stops the confirmation", async () => {
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    db.booking.findUniqueOrThrow.mockResolvedValue({
      status: "HELD",
      holdExpiresAt: fromNow(HOUR),
      needsReconsideration: true,
    });

    expect(await confirmHold({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error: FLAGGED_HOLD,
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("SCRUM-26 [AC5] TC-26-09: a flagged hold can still be released", async () => {
    db.booking.findUnique.mockResolvedValue(held({ needsReconsideration: true }));

    expect(await releaseHold({ bookingId: "bkg_1" })).toEqual({
      ok: true,
      data: { status: "CANCELLED" },
    });
    expect(db.booking.updateMany.mock.calls[0][0].where).not.toHaveProperty(
      "needsReconsideration",
    );
  });
});

describe("decideBookingRequest on a hold — SCRUM-163 AC7", () => {
  const booking = (
    status: string,
    holdExpiresAt: Date | null,
    overrides: Record<string, unknown> = {},
  ) => ({
    id: "bkg_1",
    venueId: "ven_1",
    startAt: fromNow(72 * HOUR),
    endAt: fromNow(74 * HOUR),
    status,
    holdExpiresAt,
    holdApprovedAt: null,
    requestedById: "usr_requester",
    venue: { name: "Hall", setupMinutes: 0, turnaroundMinutes: 0 },
    event: { id: "evt_1", name: "Symposium", coordinatorId: "usr_cody" },
    ...overrides,
  });

  beforeEach(() => mockAuth.mockResolvedValue(STAFF));

  it("SCRUM-163 [AC7, AC5] TC-163-12, TC-163-10: Venue Staff can reject a live hold with a reason, withdrawing its notices still to come", async () => {
    db.booking.findUnique.mockResolvedValue(booking("HELD", fromNow(HOUR)));

    expect(
      await decideBookingRequest({
        bookingId: "bkg_1",
        decision: "REJECTED",
        reason: "Roof repairs.",
      }),
    ).toEqual({ ok: true, data: { status: "REJECTED" } });

    const update = db.booking.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({
      id: "bkg_1",
      status: "HELD",
      holdExpiresAt: { gt: expect.any(Date) },
    });
    expect(update.data).toMatchObject({
      status: "REJECTED",
      decisionReason: "Roof repairs.",
    });
    expect(db.notification.updateMany).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ oldValue: "HELD", newValue: "REJECTED" }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/venues/availability");
  });

  it("SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC4] TC-124-04: Venue Staff approve a live hold: it stays Held, records who and when, and tells its Coordinator", async () => {
    const expiry = fromNow(HOUR);
    db.booking.findUnique.mockResolvedValue(booking("HELD", expiry));
    const before = Date.now();

    expect(
      await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" }),
    ).toEqual({ ok: true, data: { status: "HELD" } });

    const update = db.booking.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({
      id: "bkg_1",
      status: "HELD",
      holdExpiresAt: { gt: expect.any(Date) },
      holdApprovedAt: null,
      needsReconsideration: false,
    });
    expect(update.data).toEqual({
      holdApprovedAt: expect.any(Date),
      holdApprovedById: "usr_staff",
    });
    expect(update.data.holdApprovedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: "bkg_1",
        action: "HOLD_APPROVED",
        actorId: "usr_staff",
      }),
    });
    expect(db.notification.create).toHaveBeenCalledTimes(1);
    const notice = db.notification.create.mock.calls[0][0].data;
    expect(notice).toMatchObject({
      userId: "usr_cody",
      eventId: "evt_1",
      bookingId: "bkg_1",
      type: "HOLD_APPROVED",
      title: "Venue Staff approved your hold",
    });
    expect(notice.message).toBe(
      `Venue Staff approved the hold on Hall for "Symposium". Confirm it before ${formatDateTime(expiry)} to secure the venue.`,
    );
    // Nothing is withdrawn: the reminder and expiry notice still apply.
    expect(db.notification.updateMany).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/bookings");
    expect(revalidatePath).toHaveBeenCalledWith("/events");
  });

  it("SCRUM-163 [AC7] TC-163-17: approving locks the event before the booking, the order holding a request uses", async () => {
    db.booking.findUnique.mockResolvedValue(booking("HELD", fromNow(HOUR)));

    await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" });

    const [sql, eventId] = db.$queryRaw.mock.calls[0];
    expect(sql.join("?")).toContain('FROM "Event" WHERE "id" = ? FOR KEY SHARE');
    expect(eventId).toBe("evt_1");
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.booking.updateMany.mock.invocationCallOrder[0],
    );
  });

  it("SCRUM-124 [AC4] TC-124-04: an event with no Coordinator yet tells whoever requested the venue", async () => {
    db.booking.findUnique.mockResolvedValue(
      booking("HELD", fromNow(HOUR), {
        event: { id: "evt_1", name: "Symposium", coordinatorId: null },
      }),
    );

    await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" });

    expect(db.notification.create.mock.calls[0][0].data.userId).toBe(
      "usr_requester",
    );
  });

  const FLAGGED_HOLD_APPROVAL =
    "This hold needs reconsideration, so it can't be approved until its event's coordinator resolves it. It can still be rejected.";

  it("SCRUM-26 [AC5] TC-26-09: Venue Staff can't approve a flagged hold, and nothing is written", async () => {
    db.booking.findUnique.mockResolvedValue(
      booking("HELD", fromNow(HOUR), { needsReconsideration: true }),
    );

    expect(
      await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" }),
    ).toEqual({ ok: false, error: FLAGGED_HOLD_APPROVAL });
    expectNothingWritten();
  });

  it("SCRUM-26 [AC5] TC-26-09: a flag raised after the hold was read still stops Venue Staff approving it", async () => {
    db.booking.findUnique.mockResolvedValue(booking("HELD", fromNow(HOUR)));
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    db.booking.findUniqueOrThrow.mockResolvedValue({
      status: "HELD",
      holdExpiresAt: fromNow(HOUR),
      needsReconsideration: true,
    });

    expect(
      await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" }),
    ).toEqual({ ok: false, error: FLAGGED_HOLD_APPROVAL });
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("SCRUM-26 [AC5] TC-26-09: a flagged hold can still be rejected by Venue Staff", async () => {
    db.booking.findUnique.mockResolvedValue(
      booking("HELD", fromNow(HOUR), { needsReconsideration: true }),
    );

    expect(
      await decideBookingRequest({
        bookingId: "bkg_1",
        decision: "REJECTED",
        reason: "The event moved.",
      }),
    ).toEqual({ ok: true, data: { status: "REJECTED" } });
  });

  it("SCRUM-163 [AC7] TC-163-17: approving a hold a second time changes nothing", async () => {
    db.booking.findUnique.mockResolvedValue(
      booking("HELD", fromNow(HOUR), { holdApprovedAt: fromNow(-HOUR) }),
    );

    expect(
      await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" }),
    ).toEqual({
      ok: false,
      error:
        "Venue Staff have already approved this hold. It is waiting for its Coordinator to confirm it.",
    });
    expectNothingWritten();
  });

  it.each([
    [
      "approved by someone else",
      { status: "HELD", holdExpiresAt: fromNow(HOUR) },
      /^Venue Staff have already approved this hold\./,
    ],
    [
      "confirmed",
      { status: "APPROVED", holdExpiresAt: fromNow(HOUR) },
      /^This request has already been approved; the original decision stands\.$/,
    ],
    [
      "released",
      { status: "CANCELLED", holdExpiresAt: fromNow(HOUR) },
      /^This request has already been cancelled/,
    ],
    [
      "lapsed",
      { status: "HELD", holdExpiresAt: fromNow(-1) },
      /^This hold expired at /,
    ],
  ])(
    "SCRUM-163 [AC7] TC-163-17: a hold %s at the same moment is approved once, with no second notice or history entry",
    async (_, latest, error) => {
      db.booking.findUnique.mockResolvedValue(booking("HELD", fromNow(HOUR)));
      db.booking.updateMany.mockResolvedValue({ count: 0 });
      db.booking.findUniqueOrThrow.mockResolvedValue(latest);

      expect(
        await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" }),
      ).toMatchObject({ ok: false, error: expect.stringMatching(error) });
      expect(db.auditLog.create).not.toHaveBeenCalled();
      expect(db.notification.create).not.toHaveBeenCalled();
    },
  );

  it.each(["REJECTED", "APPROVED"] as const)(
    "SCRUM-163 [AC4, AC7] TC-163-08: a hold whose expiry has passed can't be decided (%s); it has already released the venue",
    async (decision) => {
      db.booking.findUnique.mockResolvedValue(booking("HELD", fromNow(-1000)));

      expect(
        await decideBookingRequest({
          bookingId: "bkg_1",
          decision,
          reason: "Too late.",
        }),
      ).toMatchObject({
        ok: false,
        error: expect.stringMatching(/^This hold expired at /),
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-163 [AC7] TC-163-12: a hold that expires while being rejected is reported as expired, and nothing more is written", async () => {
    db.booking.findUnique.mockResolvedValue(booking("HELD", fromNow(HOUR)));
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    db.booking.findUniqueOrThrow.mockResolvedValue({
      status: "EXPIRED",
      holdExpiresAt: fromNow(-1),
    });

    expect(
      await decideBookingRequest({
        bookingId: "bkg_1",
        decision: "REJECTED",
        reason: "Roof repairs.",
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/^This hold expired at /),
    });
    expect(db.notification.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("the readiness checklist's venue item — SCRUM-163 AC6", () => {
  const START = new Date("2031-06-01T01:00:00Z");
  const END = new Date("2031-06-01T09:00:00Z");
  const NOW = new Date("2031-05-20T00:00:00Z");
  const row = (
    status: string,
    n: number,
    holdExpiresAt: Date | null = null,
  ) => ({
    id: `bkg_${n}`,
    status,
    holdExpiresAt,
    holdApprovedAt: null as Date | null,
    decisionReason: status === "REJECTED" ? "Too small." : null,
    createdAt: new Date(Date.UTC(2031, 0, n)),
    startAt: START,
    endAt: END,
  });
  const venueOf = async (bookings: ReturnType<typeof row>[]) => {
    const client = {
      event: {
        findUnique: vi.fn().mockResolvedValue({
          status: "PLANNING",
          startAt: START,
          endAt: END,
          bookings,
          equipmentRequests: [],
          reservations: [],
        }),
      },
    } as unknown as Prisma.TransactionClient;
    const checklist = await getReadinessChecklist(client, "evt_1", NOW);
    return { ready: checklist!.ready, venue: checklist!.items[0] };
  };

  it("SCRUM-163 [AC6] TC-163-11: a live hold reads 'Held until … – confirm to secure', keeps the venue incomplete, and names the hold to confirm", async () => {
    expect(
      await venueOf([row("HELD", 1, new Date("2031-05-25T10:00:00Z"))]),
    ).toEqual({
      ready: false,
      venue: {
        name: "Venue booking",
        complete: false,
        state: "Held until 25 May 2031, 6:00 pm SGT – confirm to secure",
        reason: null,
        heldBookingId: "bkg_1",
        holdApproved: false,
      },
    });
  });

  it("SCRUM-163 [AC3, AC6, AC7] TC-163-16: a hold Venue Staff approved still keeps the venue incomplete until confirmed, and says it may now be confirmed", async () => {
    const hold = {
      ...row("HELD", 1, new Date("2031-05-25T10:00:00Z")),
      holdApprovedAt: new Date("2031-05-19T03:00:00Z"),
    };

    expect(await venueOf([hold])).toEqual({
      ready: false,
      venue: {
        name: "Venue booking",
        complete: false,
        state: "Held until 25 May 2031, 6:00 pm SGT – confirm to secure",
        reason: null,
        heldBookingId: "bkg_1",
        holdApproved: true,
      },
    });
  });

  it("SCRUM-163 [AC4, AC6] TC-163-11: a hold past its expiry reads 'Hold expired', even while the row still says Held", async () => {
    expect(await venueOf([row("HELD", 1, NOW)])).toEqual({
      ready: false,
      venue: {
        name: "Venue booking",
        complete: false,
        state: "Hold expired",
        reason: null,
      },
    });
    expect((await venueOf([row("EXPIRED", 1, NOW)])).venue.state).toBe(
      "Hold expired",
    );
  });

  it("SCRUM-163 [AC6] TC-163-11: an expired hold counts like a rejection: the newer of the two describes the venue", async () => {
    expect(
      (await venueOf([row("REJECTED", 1), row("EXPIRED", 2, NOW)])).venue.state,
    ).toBe("Hold expired");
    expect(
      (await venueOf([row("EXPIRED", 1, NOW), row("REJECTED", 2)])).venue,
    ).toMatchObject({ state: "Rejected", reason: "Too small." });
  });

  it("SCRUM-163 [AC6] TC-163-11: a pending request after an expired hold reads Pending; an approval covering the event still wins over a hold", async () => {
    expect(
      (await venueOf([row("EXPIRED", 1, NOW), row("PENDING", 2)])).venue.state,
    ).toBe("Pending");
    expect(
      await venueOf([
        row("HELD", 1, new Date("2031-05-25T10:00:00Z")),
        row("APPROVED", 2),
      ]),
    ).toMatchObject({ ready: true, venue: { state: "Approved" } });
  });
});
