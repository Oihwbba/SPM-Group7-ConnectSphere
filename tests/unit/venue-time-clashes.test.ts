import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";

import {
  TIMES_CHANGED_REASON,
  describeClash,
  findTimeClashes,
  flagTimeClashes,
  lengthens,
  listTimeClashFlags,
  type TimeClash,
} from "@/lib/venue-time-clashes";

// SCRUM-160 — finding and flagging the bookings a longer setup or turnaround
// time makes clash. Test cases: docs/testing/SCRUM-160.md. The database is
// mocked; tests/integration/venue-time-clashes.test.ts runs the same rules
// against Postgres.

const db = {
  booking: { findMany: vi.fn(), updateMany: vi.fn() },
  reservation: { updateMany: vi.fn() },
  venueUnavailability: { findMany: vi.fn() },
  auditLog: { findMany: vi.fn(), createMany: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
  user: { findMany: vi.fn() },
};
const tx = db as unknown as Prisma.TransactionClient;

const NOW = new Date("2031-03-01T00:00:00Z");
const at = (hhmm: string, day = "2031-03-10") => new Date(`${day}T${hhmm}:00Z`);
const TIMES = { setupMinutes: 30, turnaroundMinutes: 45 };

let seq = 0;
function booking(over: Record<string, unknown> = {}) {
  seq += 1;
  return {
    id: `bkg_${seq}`,
    status: "APPROVED",
    startAt: at("10:00"),
    endAt: at("12:00"),
    setupMinutes: 0,
    turnaroundMinutes: 0,
    heldAt: null,
    decidedAt: new Date(`2031-01-0${seq}T00:00:00Z`),
    // Requested in the opposite order to their approval, so a test passes
    // only if the approval time decides which is later.
    createdAt: new Date(`2030-12-0${9 - seq}T00:00:00Z`),
    needsReconsideration: false,
    reconsiderationReason: null,
    event: {
      id: `evt_${seq}`,
      name: `Event ${seq}`,
      coordinatorId: `usr_coord_${seq}`,
      coordinator: { name: `Coordinator ${seq}` },
    },
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  seq = 0;
  db.venueUnavailability.findMany.mockResolvedValue([]);
  db.auditLog.findMany.mockResolvedValue([]);
  db.booking.updateMany.mockResolvedValue({ count: 1 });
  db.reservation.updateMany.mockResolvedValue({ count: 0 });
  db.user.findMany.mockResolvedValue([{ id: "usr_staff1" }, { id: "usr_staff2" }]);
});

describe("lengthens — SCRUM-160 AC6", () => {
  it.each([
    [{ setupMinutes: 0, turnaroundMinutes: 0 }, { setupMinutes: 30, turnaroundMinutes: 0 }, true],
    [{ setupMinutes: 0, turnaroundMinutes: 0 }, { setupMinutes: 0, turnaroundMinutes: 45 }, true],
    [{ setupMinutes: 30, turnaroundMinutes: 45 }, { setupMinutes: 15, turnaroundMinutes: 60 }, true],
    [{ setupMinutes: 30, turnaroundMinutes: 45 }, { setupMinutes: 15, turnaroundMinutes: 30 }, false],
    [{ setupMinutes: 30, turnaroundMinutes: 45 }, { setupMinutes: 30, turnaroundMinutes: 45 }, false],
  ])(
    "SCRUM-160 [AC6] TC-160-06: %o → %o lengthens: %s",
    (before, after, expected) => {
      expect(lengthens(before, after)).toBe(expected);
    },
  );
});

describe("findTimeClashes — SCRUM-160 AC1, AC2", () => {
  it("SCRUM-160 [AC1] TC-160-01: reads the venue's Approved and live Held bookings and its unavailability that could still reach the future", async () => {
    db.booking.findMany.mockResolvedValue([]);

    expect(await findTimeClashes(tx, "ven_1", TIMES, NOW)).toEqual([]);

    const since = new Date(NOW.getTime() - 1440 * 60 * 1000);
    expect(db.booking.findMany.mock.calls[0][0].where).toEqual({
      venueId: "ven_1",
      OR: [{ status: "APPROVED" }, { status: "HELD", holdExpiresAt: { gt: NOW } }],
      endAt: { gt: since },
    });
    expect(db.venueUnavailability.findMany.mock.calls[0][0].where).toEqual({
      venueId: "ven_1",
      endAt: { gt: since },
    });
  });

  it("SCRUM-160 [AC1, AC2] TC-160-01: two bookings that only clash under the new times: the one approved later is listed, with what it clashes with", async () => {
    // 10:00–12:00 occupies to 12:45; 13:00–15:00 now occupies from 12:30.
    const first = booking();
    const second = booking({ startAt: at("13:00"), endAt: at("15:00") });
    db.booking.findMany.mockResolvedValue([second, first]);

    const clashes = await findTimeClashes(tx, "ven_1", TIMES, NOW);

    expect(clashes).toEqual([
      {
        booking: {
          id: second.id,
          status: "APPROVED",
          startAt: second.startAt,
          endAt: second.endAt,
          eventId: second.event.id,
          eventName: "Event 2",
          coordinatorId: "usr_coord_2",
          coordinatorName: "Coordinator 2",
          needsReconsideration: false,
          reconsiderationReason: null,
        },
        with: {
          kind: "booking",
          id: first.id,
          startAt: first.startAt,
          endAt: first.endAt,
          eventName: "Event 1",
        },
      },
    ]);
  });

  it("SCRUM-160 [AC1] TC-160-02: occupied periods that only touch don't clash", async () => {
    // 10:00–12:00 occupies to 12:45; 13:15–15:00 occupies from 12:45.
    db.booking.findMany.mockResolvedValue([
      booking(),
      booking({ startAt: at("13:15"), endAt: at("15:00") }),
    ]);

    expect(await findTimeClashes(tx, "ven_1", TIMES, NOW)).toEqual([]);
  });

  it("SCRUM-160 [AC2] TC-160-03: a booking held first and approved later counts from when it was held", async () => {
    const heldFirst = booking({
      heldAt: new Date("2030-12-15T00:00:00Z"),
      decidedAt: new Date("2031-02-01T00:00:00Z"),
    });
    const approvedBetween = booking({
      startAt: at("13:00"),
      endAt: at("15:00"),
      decidedAt: new Date("2031-01-15T00:00:00Z"),
    });
    db.booking.findMany.mockResolvedValue([heldFirst, approvedBetween]);

    const [clash] = await findTimeClashes(tx, "ven_1", TIMES, NOW);

    expect(clash.booking.id).toBe(approvedBetween.id);
    expect(clash.with.id).toBe(heldFirst.id);
  });

  it("SCRUM-160 [AC2] TC-160-03: a seeded booking with no decision time counts from when it was created", async () => {
    const created = (day: string) => new Date(`2030-12-${day}T00:00:00Z`);
    const older = booking({ decidedAt: null, createdAt: created("01") });
    const newer = booking({ decidedAt: null, createdAt: created("05"), startAt: at("13:00"), endAt: at("15:00") });
    db.booking.findMany.mockResolvedValue([newer, older]);

    const [clash] = await findTimeClashes(tx, "ven_1", TIMES, NOW);

    expect(clash.booking.id).toBe(newer.id);
  });

  it("SCRUM-160 [AC2] TC-160-03: two bookings that took the venue at the same moment: the higher id is the later", async () => {
    const same = new Date("2031-01-01T00:00:00Z");
    const a = booking({ id: "bkg_a", decidedAt: same });
    const b = booking({ id: "bkg_b", decidedAt: same, startAt: at("13:00"), endAt: at("15:00") });
    db.booking.findMany.mockResolvedValue([b, a]);

    const [clash] = await findTimeClashes(tx, "ven_1", TIMES, NOW);

    expect(clash.booking.id).toBe("bkg_b");

    db.booking.findMany.mockResolvedValue([a, b]);
    const [again] = await findTimeClashes(tx, "ven_1", TIMES, NOW);
    expect(again.booking.id).toBe("bkg_b");
  });

  it("SCRUM-160 [AC1] TC-160-04: one booking clashing with two periods of unavailability is listed with each, earliest first", async () => {
    const b = booking();
    db.booking.findMany.mockResolvedValue([b]);
    db.venueUnavailability.findMany.mockResolvedValue([
      { id: "una_after", startAt: at("12:30"), endAt: at("13:00"), reason: "OTHER" },
      { id: "una_before", startAt: at("09:00"), endAt: at("09:45"), reason: "OTHER" },
    ]);

    const clashes = await findTimeClashes(tx, "ven_1", TIMES, NOW);

    expect(clashes.map((c) => c.with.id)).toEqual(["una_before", "una_after"]);
  });

  it("SCRUM-160 [AC1, AC2] TC-160-04: a booking whose new occupied period overlaps recorded unavailability is listed with it", async () => {
    const b = booking({ event: { id: "evt_x", name: "Gala", coordinatorId: null, coordinator: null } });
    db.booking.findMany.mockResolvedValue([b]);
    const maintenance = {
      id: "una_1",
      startAt: at("12:30"),
      endAt: at("14:00"),
      reason: "MAINTENANCE",
    };
    db.venueUnavailability.findMany.mockResolvedValue([
      maintenance,
      { id: "una_2", startAt: at("12:45"), endAt: at("14:00"), reason: "OTHER" },
    ]);

    const clashes = await findTimeClashes(tx, "ven_1", TIMES, NOW);

    expect(clashes).toHaveLength(1);
    expect(clashes[0].booking).toMatchObject({ id: b.id, coordinatorId: null, coordinatorName: null });
    expect(clashes[0].with).toEqual({ kind: "unavailability", ...maintenance });
  });

  it("SCRUM-160 [AC1] TC-160-05: a booking already under way keeps its own minutes and isn't listed; the upcoming one it clashes with is, whenever it was approved", async () => {
    const underWay = booking({
      startAt: at("22:00", "2031-02-28"),
      endAt: at("00:30", "2031-03-01"),
      decidedAt: new Date("2031-02-20T00:00:00Z"),
    });
    const next = booking({
      startAt: at("00:45", "2031-03-01"),
      endAt: at("02:00", "2031-03-01"),
      decidedAt: new Date("2031-01-01T00:00:00Z"),
    });
    db.booking.findMany.mockResolvedValue([underWay, next]);

    // Under way, it occupies to 00:30; the next one's setup now starts at 00:15.
    const [clash] = await findTimeClashes(tx, "ven_1", TIMES, NOW);

    expect(clash.booking.id).toBe(next.id);
    expect(clash.with.id).toBe(underWay.id);
  });

  it("SCRUM-160 [AC1] TC-160-05: two bookings already under way are never listed, and neither is one under way against unavailability", async () => {
    db.booking.findMany.mockResolvedValue([
      booking({ startAt: at("20:00", "2031-02-28"), endAt: at("01:00", "2031-03-01"), turnaroundMinutes: 60 }),
      booking({ startAt: at("22:00", "2031-02-28"), endAt: at("01:00", "2031-03-01") }),
    ]);
    db.venueUnavailability.findMany.mockResolvedValue([
      { id: "una_1", startAt: at("00:00", "2031-03-01"), endAt: at("03:00", "2031-03-01"), reason: "MAINTENANCE" },
    ]);

    expect(await findTimeClashes(tx, "ven_1", TIMES, NOW)).toEqual([]);
  });

  it("SCRUM-160 [AC1] TC-160-01: clashes are listed soonest first", async () => {
    const early = booking();
    const lateA = booking({ startAt: at("10:00", "2031-03-12"), endAt: at("12:00", "2031-03-12") });
    const lateB = booking({ startAt: at("13:00", "2031-03-12"), endAt: at("15:00", "2031-03-12") });
    db.booking.findMany.mockResolvedValue([lateA, lateB, early]);
    db.venueUnavailability.findMany.mockResolvedValue([
      { id: "una_late", startAt: at("15:30"), endAt: at("16:00"), reason: "OTHER" },
      { id: "una_early", startAt: at("09:00"), endAt: at("09:45"), reason: "OTHER" },
    ]);

    const clashes = await findTimeClashes(tx, "ven_1", TIMES, NOW);

    expect(clashes.map((c) => [c.booking.id, c.with.id])).toEqual([
      [early.id, "una_early"],
      [lateB.id, lateA.id],
    ]);
  });
});

function clash(over: Partial<TimeClash["booking"]> = {}, withId = "bkg_other"): TimeClash {
  return {
    booking: {
      id: "bkg_1",
      status: "APPROVED",
      startAt: at("13:00"),
      endAt: at("15:00"),
      eventId: "evt_1",
      eventName: "Robotics Expo",
      coordinatorId: "usr_coord",
      coordinatorName: "Cody",
      needsReconsideration: false,
      reconsiderationReason: null,
      ...over,
    },
    with: {
      kind: "booking",
      id: withId,
      startAt: at("10:00"),
      endAt: at("12:00"),
      eventName: "Career Fair",
    },
  };
}

describe("flagTimeClashes — SCRUM-160 AC2, AC3, AC7", () => {
  const venue = { name: "Exhibition Hall" };

  it("SCRUM-160 [AC2, AC3] TC-160-07: flags the booking with the reason, records the clash, and notifies its Coordinator and every Venue Staff member", async () => {
    expect(await flagTimeClashes(tx, venue, [clash()], "usr_staff", NOW)).toBe(1);

    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["bkg_1"] },
        OR: [
          { status: { in: ["PENDING", "APPROVED"] } },
          { status: "HELD", holdExpiresAt: { gt: NOW } },
        ],
        needsReconsideration: false,
      },
      data: expect.objectContaining({
        needsReconsideration: true,
        reconsiderationReason: TIMES_CHANGED_REASON,
        reconsiderationFlaggedAt: NOW,
      }),
    });
    expect(db.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          entityType: "Booking",
          entityId: "bkg_1",
          action: "RECONSIDERATION_FLAGGED",
          actorId: "usr_staff",
          fieldName: "clashesWith",
          newValue: "booking:bkg_other",
          summary:
            'Setup or turnaround time changed: it now clashes with "Career Fair"\'s booking from 10 Mar 2031, 6:00 pm SGT to 10 Mar 2031, 8:00 pm SGT (SCRUM-160).',
          createdAt: NOW,
        },
      ],
    });
    expect(db.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_coord",
        type: "ARRANGEMENT_FLAGGED",
        title: "Booking needs reconsideration",
        message:
          '"Robotics Expo": Exhibition Hall, 10 Mar 2031, 9:00 pm SGT to 10 Mar 2031, 11:00 pm SGT. Setup or turnaround time changed, so it now clashes with another booking from 10 Mar 2031, 6:00 pm SGT to 10 Mar 2031, 8:00 pm SGT. Decide whether it still stands.',
        link: "/events",
        eventId: "evt_1",
      },
    });
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { role: "VENUE_STAFF" },
      select: { id: true },
    });
    const staffNotices = db.notification.createMany.mock.calls[0][0].data;
    expect(staffNotices.map((n: { userId: string }) => n.userId)).toEqual(["usr_staff1", "usr_staff2"]);
    expect(staffNotices[0]).toMatchObject({
      type: "ARRANGEMENT_FLAGGED",
      link: "/bookings",
      eventId: "evt_1",
      message: expect.stringContaining('clashes with "Career Fair"\'s booking'),
    });
  });

  it("SCRUM-160 [AC2, AC3] TC-160-07: a booking with two clashes is flagged once, with one notice listing both and both recorded", async () => {
    const two = [clash(), clash({}, "bkg_third")];

    expect(await flagTimeClashes(tx, venue, two, "usr_staff", NOW)).toBe(1);

    expect(db.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(db.notification.create).toHaveBeenCalledTimes(1);
    expect(db.notification.create.mock.calls[0][0].data.message).toContain("; another booking");
    expect(db.auditLog.createMany.mock.calls[0][0].data.map((d: { newValue: string }) => d.newValue)).toEqual([
      "booking:bkg_other",
      "booking:bkg_third",
    ]);
  });

  it("SCRUM-160 [AC3] TC-160-07: with no Coordinator assigned, only Venue Staff are notified", async () => {
    await flagTimeClashes(tx, venue, [clash({ coordinatorId: null })], "usr_staff", NOW);

    expect(db.notification.create).not.toHaveBeenCalled();
    expect(db.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it("SCRUM-160 [AC7] TC-160-08: a clash already recorded for the booking flags nothing, even after its flag was resolved", async () => {
    db.auditLog.findMany.mockResolvedValue([{ entityId: "bkg_1", newValue: "booking:bkg_other" }]);

    expect(await flagTimeClashes(tx, venue, [clash()], "usr_staff", NOW)).toBe(0);

    expect(db.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        entityType: "Booking",
        entityId: { in: ["bkg_1"] },
        action: "RECONSIDERATION_FLAGGED",
        fieldName: "clashesWith",
      },
      select: { entityId: true, newValue: true },
    });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.createMany).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("SCRUM-160 [AC6, AC7] TC-160-09: a booking still waiting for this reason gains the new clash, with no second flag or notice", async () => {
    const waiting = clash({ needsReconsideration: true, reconsiderationReason: TIMES_CHANGED_REASON });

    expect(await flagTimeClashes(tx, venue, [waiting], "usr_staff", NOW)).toBe(0);

    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
    expect(db.auditLog.createMany).toHaveBeenCalledTimes(1);
  });

  it("SCRUM-160 [AC6] TC-160-09: a booking waiting for another reason keeps it, and this clash isn't recorded", async () => {
    const other = clash({ needsReconsideration: true, reconsiderationReason: "Change approved: date and time." });

    expect(await flagTimeClashes(tx, venue, [other], "usr_staff", NOW)).toBe(0);

    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-160 [AC7] TC-160-08: a booking flagged by someone else since it was read is left alone", async () => {
    db.booking.updateMany.mockResolvedValue({ count: 0 });

    expect(await flagTimeClashes(tx, venue, [clash()], "usr_staff", NOW)).toBe(0);

    expect(db.auditLog.createMany).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("SCRUM-160 [AC6] TC-160-09: no clashes, nothing read or written", async () => {
    expect(await flagTimeClashes(tx, venue, [], "usr_staff", NOW)).toBe(0);
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });
});

describe("describeClash — SCRUM-160", () => {
  const una = {
    kind: "unavailability" as const,
    id: "una_1",
    startAt: at("12:00"),
    endAt: at("14:00"),
    reason: "MAINTENANCE" as const,
  };

  it("SCRUM-160 [AC3] TC-160-07: a Coordinator is told only the other booking's times; Venue Staff also see its event", () => {
    const other = clash().with;
    expect(describeClash(other)).toBe(
      "another booking from 10 Mar 2031, 6:00 pm SGT to 10 Mar 2031, 8:00 pm SGT",
    );
    expect(describeClash(other, true)).toBe(
      '"Career Fair"\'s booking from 10 Mar 2031, 6:00 pm SGT to 10 Mar 2031, 8:00 pm SGT',
    );
    expect(describeClash(una)).toBe(
      "unavailability (maintenance) from 10 Mar 2031, 8:00 pm SGT to 10 Mar 2031, 10:00 pm SGT",
    );
  });
});

describe("listTimeClashFlags — SCRUM-160 AC5", () => {
  const flaggedAt = new Date("2031-02-20T00:00:00Z");
  const row = {
    id: "bkg_1",
    status: "APPROVED",
    startAt: at("13:00"),
    endAt: at("15:00"),
    reconsiderationFlaggedAt: flaggedAt,
    venue: { name: "Exhibition Hall" },
    event: { name: "Robotics Expo", coordinator: { name: "Cody" } },
  };

  it("SCRUM-160 [AC5] TC-160-11: lists each booking flagged for this reason with its venue, event, Coordinator and the clashes recorded since it was flagged", async () => {
    db.booking.findMany
      .mockResolvedValueOnce([row, { ...row, id: "bkg_2", event: { name: "Quiz Night", coordinator: null } }])
      .mockResolvedValueOnce([
        { id: "bkg_other", startAt: at("10:00"), endAt: at("12:00"), event: { name: "Career Fair" } },
      ]);
    db.auditLog.findMany.mockResolvedValue([
      // From an earlier flag, since resolved.
      { entityId: "bkg_1", newValue: "booking:bkg_old", createdAt: new Date("2031-01-01T00:00:00Z") },
      { entityId: "bkg_1", newValue: "booking:bkg_other", createdAt: flaggedAt },
      { entityId: "bkg_2", newValue: "unavailability:una_1", createdAt: flaggedAt },
      { entityId: "bkg_2", newValue: "unavailability:una_gone", createdAt: flaggedAt },
    ]);
    db.venueUnavailability.findMany.mockResolvedValue([
      { id: "una_1", startAt: at("12:00"), endAt: at("14:00"), reason: "MAINTENANCE" },
    ]);

    const flags = await listTimeClashFlags(tx);

    expect(db.booking.findMany.mock.calls[0][0].where).toEqual({
      needsReconsideration: true,
      reconsiderationReason: TIMES_CHANGED_REASON,
    });
    expect(db.booking.findMany.mock.calls[1][0].where).toEqual({
      id: { in: ["bkg_old", "bkg_other"] },
    });
    expect(db.venueUnavailability.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["una_1", "una_gone"] },
    });
    expect(flags).toEqual([
      {
        bookingId: "bkg_1",
        status: "APPROVED",
        startAt: row.startAt,
        endAt: row.endAt,
        venueName: "Exhibition Hall",
        eventName: "Robotics Expo",
        coordinatorName: "Cody",
        flaggedAt,
        clashesWith: [
          '"Career Fair"\'s booking from 10 Mar 2031, 6:00 pm SGT to 10 Mar 2031, 8:00 pm SGT',
        ],
      },
      expect.objectContaining({
        bookingId: "bkg_2",
        coordinatorName: null,
        clashesWith: [
          "unavailability (maintenance) from 10 Mar 2031, 8:00 pm SGT to 10 Mar 2031, 10:00 pm SGT",
          "unavailability that has since been removed",
        ],
      }),
    ]);
  });

  it("SCRUM-160 [AC5, AC6] TC-160-11: with nothing flagged for this reason, the list is empty and nothing else is read", async () => {
    db.booking.findMany.mockResolvedValue([]);

    expect(await listTimeClashFlags(tx)).toEqual([]);
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("SCRUM-160 [AC5] TC-160-11: a flag with no time shows no clashes rather than every recorded one", async () => {
    db.booking.findMany
      .mockResolvedValueOnce([{ ...row, reconsiderationFlaggedAt: null }])
      .mockResolvedValueOnce([]);
    db.auditLog.findMany.mockResolvedValue([
      { entityId: "bkg_1", newValue: "booking:bkg_other", createdAt: flaggedAt },
    ]);

    const [flag] = await listTimeClashFlags(tx);
    expect(flag.clashesWith).toEqual([]);
  });
});
