import { describe, it, expect, vi } from "vitest";

import {
  availabilityByDay,
  describeBlocker,
  findVenueBlockers,
  findVenueCalendar,
  occupiedPeriod,
  type CalendarEntry,
} from "@/lib/venue-availability";

// SCRUM-50 AC3 / SCRUM-53 AC4, AC8 — what makes a venue unavailable. The query is
// checked against a stub; the same rule is exercised against real rows in
// tests/integration/bookings.test.ts and, with setup and turnaround time
// (SCRUM-159), tests/integration/setup-turnaround.test.ts.
const period = {
  startAt: new Date("2030-06-01T06:00:00.000Z"),
  endAt: new Date("2030-06-01T08:00:00.000Z"),
};

const DAY_MS = 24 * 60 * 60 * 1000;

function stubDb(bookings: unknown[], unavailability: unknown[]) {
  return {
    booking: { findMany: vi.fn().mockResolvedValue(bookings) },
    venueUnavailability: {
      findMany: vi.fn().mockResolvedValue(unavailability),
    },
  };
}

/** The booking details a hover shows; only the times matter to these tests. */
const detailsOf = (entry: CalendarEntry | undefined) =>
  entry && "details" in entry ? entry.details : undefined;

describe("findVenueBlockers", () => {
  // SCRUM-163 AC2 replaced "only Approved blocks" (SCRUM-50 AC10): a hold
  // that hasn't expired blocks too.
  it("SCRUM-50 [AC3, AC10] TC-50-04, SCRUM-159 [AC3] TC-159-15, SCRUM-163 [AC2, AC4] TC-163-04: asks only for APPROVED bookings and unexpired holds — a pending request blocks nobody — near enough for their setup or turnaround to reach the period", async () => {
    const db = stubDb([], []);
    const now = new Date("2030-05-01T00:00:00.000Z");

    await findVenueBlockers(db as never, "ven_1", period, now);

    // A booking's setup and turnaround are at most 1,440 minutes (SCRUM-159
    // AC1), so only bookings within a day either side can reach the period;
    // each one loaded is then checked against its own occupied period. A hold
    // whose expiry has passed no longer reserves the venue (SCRUM-163 AC4).
    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          venueId: "ven_1",
          OR: [
            { status: "APPROVED" },
            { status: "HELD", holdExpiresAt: { gt: now } },
          ],
          startAt: { lt: new Date(period.endAt.getTime() + DAY_MS) },
          endAt: { gt: new Date(period.startAt.getTime() - DAY_MS) },
        },
        select: expect.objectContaining({
          setupMinutes: true,
          turnaroundMinutes: true,
        }),
      }),
    );
    expect(db.venueUnavailability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          venueId: "ven_1",
          startAt: { lt: period.endAt },
          endAt: { gt: period.startAt },
        },
      }),
    );
  });

  it("SCRUM-50 [AC3] TC-50-03: merges bookings and unavailability, earliest first", async () => {
    const late = {
      id: "bkg_late",
      startAt: new Date("2030-06-01T07:30:00.000Z"),
      endAt: new Date("2030-06-01T09:00:00.000Z"),
      setupMinutes: 0,
      turnaroundMinutes: 0,
    };
    const early = {
      id: "vun_early",
      startAt: new Date("2030-06-01T05:00:00.000Z"),
      endAt: new Date("2030-06-01T06:30:00.000Z"),
      reason: "MAINTENANCE",
    };

    const blockers = await findVenueBlockers(
      stubDb([late], [early]) as never,
      "ven_1",
      period,
    );

    expect(blockers).toEqual([
      { kind: "unavailability", ...early },
      { kind: "booking", ...late, heldUntil: null },
    ]);
  });

  it("SCRUM-163 [AC2] TC-163-04: a held booking carries its expiry, an approved one none", async () => {
    const expiry = new Date("2030-05-30T10:00:00.000Z");
    const held = {
      id: "bkg_held",
      startAt: new Date("2030-06-01T06:00:00.000Z"),
      endAt: new Date("2030-06-01T07:00:00.000Z"),
      status: "HELD",
      holdExpiresAt: expiry,
      setupMinutes: 0,
      turnaroundMinutes: 0,
    };
    const approved = {
      id: "bkg_approved",
      startAt: new Date("2030-06-01T07:00:00.000Z"),
      endAt: new Date("2030-06-01T08:00:00.000Z"),
      status: "APPROVED",
      holdExpiresAt: null,
      setupMinutes: 0,
      turnaroundMinutes: 0,
    };

    const blockers = await findVenueBlockers(
      stubDb([approved, held], []) as never,
      "ven_1",
      period,
    );

    expect(blockers.map((b) => [b.id, b.kind === "booking" && b.heldUntil])).toEqual([
      ["bkg_held", expiry],
      ["bkg_approved", null],
    ]);
  });

  describe("SCRUM-159 — occupied periods", () => {
    // Singapore wall time, as a UTC instant.
    const sg = (hhmm: string) => new Date(`2032-02-10T${hhmm}:00+08:00`);
    /** An approved 10:00–12:00 booking with 30 minutes' setup and 45 minutes' turnaround. */
    const tenToNoon = {
      id: "bkg_ten",
      startAt: sg("10:00"),
      endAt: sg("12:00"),
      setupMinutes: 30,
      turnaroundMinutes: 45,
    };
    /** A request's occupied period at the same venue, with its 30 and 45 minutes. */
    const asked = (start: string, end: string) =>
      occupiedPeriod(
        { startAt: sg(start), endAt: sg(end) },
        { setupMinutes: 30, turnaroundMinutes: 45 },
      );

    it("SCRUM-159 [AC2] TC-159-04: a booking occupies its venue from its start minus the setup time to its end plus the turnaround time", () => {
      expect(
        occupiedPeriod(
          { startAt: sg("10:00"), endAt: sg("12:00") },
          { setupMinutes: 30, turnaroundMinutes: 45 },
        ),
      ).toEqual({ startAt: sg("09:30"), endAt: sg("12:45") });
      // With no setup or turnaround, the occupied period is the booked period.
      expect(
        occupiedPeriod(
          { startAt: sg("10:00"), endAt: sg("12:00") },
          { setupMinutes: 0, turnaroundMinutes: 0 },
        ),
      ).toEqual({ startAt: sg("10:00"), endAt: sg("12:00") });
    });

    it("SCRUM-159 [AC3] TC-159-05: an approved booking blocks where its turnaround overlaps the asked-for occupied period, though the booked periods don't overlap", async () => {
      // 12:30–14:00 is clear of 10:00–12:00 as booked, but its setup starts
      // at 12:00, inside the existing booking's turnaround (to 12:45).
      const blockers = await findVenueBlockers(
        stubDb([tenToNoon], []) as never,
        "ven_1",
        asked("12:30", "14:00"),
      );

      expect(blockers).toEqual([{ kind: "booking", ...tenToNoon, heldUntil: null }]);
    });

    it("SCRUM-159 [AC3] TC-159-05: an approved booking blocks where its setup overlaps the asked-for occupied period", async () => {
      // 08:00–09:30 ends as the existing booking's setup begins, but its own
      // turnaround runs to 10:15.
      const blockers = await findVenueBlockers(
        stubDb([tenToNoon], []) as never,
        "ven_1",
        asked("08:00", "09:30"),
      );

      expect(blockers.map((b) => b.id)).toEqual(["bkg_ten"]);
    });

    it("SCRUM-159 [AC4] TC-159-08: occupied periods that only touch don't conflict: 13:15–15:00 is free after 10:00–12:00, but 13:00–15:00 is not", async () => {
      // 13:15 minus 30 minutes' setup is 12:45, exactly where the booking's
      // turnaround ends.
      expect(
        await findVenueBlockers(
          stubDb([tenToNoon], []) as never,
          "ven_1",
          asked("13:15", "15:00"),
        ),
      ).toEqual([]);
      // 13:00 minus 30 minutes is 12:30, 15 minutes into the turnaround.
      expect(
        await findVenueBlockers(
          stubDb([tenToNoon], []) as never,
          "ven_1",
          asked("13:00", "15:00"),
        ),
      ).toHaveLength(1);
    });

    it("SCRUM-159 [AC3] TC-159-07: recorded unavailability is compared with the asked-for occupied period, setup and turnaround included", async () => {
      const db = stubDb([], []);
      const occupied = asked("10:00", "12:00");

      await findVenueBlockers(db as never, "ven_1", occupied);

      expect(db.venueUnavailability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            venueId: "ven_1",
            startAt: { lt: sg("12:45") },
            endAt: { gt: sg("09:30") },
          },
        }),
      );
    });

    it("SCRUM-159 [AC3]: a booking loaded because it is near, but whose occupied period doesn't reach, is not a blocker", async () => {
      const morning = {
        ...tenToNoon,
        id: "bkg_morning",
        startAt: sg("06:00"),
        endAt: sg("07:00"),
      };

      expect(
        await findVenueBlockers(
          stubDb([morning], []) as never,
          "ven_1",
          asked("13:15", "15:00"),
        ),
      ).toEqual([]);
    });
  });
});

describe("describeBlocker", () => {
  it("names an approved booking by its times only — never the other organisation's event", () => {
    expect(describeBlocker({ kind: "booking", id: "b", ...period })).toBe(
      "already booked from 1 Jun 2030, 2:00 pm SGT to 1 Jun 2030, 4:00 pm SGT",
    );
  });

  it("SCRUM-163 [AC2] TC-163-04: names a hold by its times, without its expiry, which only the calendar shows", () => {
    expect(
      describeBlocker({
        kind: "booking",
        id: "b",
        ...period,
        heldUntil: new Date("2030-05-30T10:00:00.000Z"),
      }),
    ).toBe(
      "held from 1 Jun 2030, 2:00 pm SGT to 1 Jun 2030, 4:00 pm SGT",
    );
  });

  it("SCRUM-159 [AC3] TC-159-14: names a booking with setup or turnaround by the whole time it occupies the venue, so the refusal explains itself", () => {
    expect(
      describeBlocker({
        kind: "booking",
        id: "b",
        ...period,
        setupMinutes: 30,
        turnaroundMinutes: 45,
      }),
    ).toBe(
      "already booked from 1 Jun 2030, 1:30 pm SGT to 1 Jun 2030, 4:45 pm SGT, including setup and turnaround",
    );
    // Turnaround only still counts.
    expect(
      describeBlocker({
        kind: "booking",
        id: "b",
        ...period,
        setupMinutes: 0,
        turnaroundMinutes: 15,
      }),
    ).toBe(
      "already booked from 1 Jun 2030, 2:00 pm SGT to 1 Jun 2030, 4:15 pm SGT, including setup and turnaround",
    );
  });

  it("SCRUM-159 [AC3] TC-159-15: names a held booking as held, with its whole occupied time", () => {
    expect(
      describeBlocker({
        kind: "booking",
        id: "b",
        ...period,
        heldUntil: new Date("2030-05-30T10:00:00.000Z"),
        setupMinutes: 30,
        turnaroundMinutes: 45,
      }),
    ).toBe(
      "held from 1 Jun 2030, 1:30 pm SGT to 1 Jun 2030, 4:45 pm SGT, including setup and turnaround",
    );
  });

  it("SCRUM-159 [AC3] TC-159-14: a booking with no setup or turnaround reads exactly as before", () => {
    expect(
      describeBlocker({
        kind: "booking",
        id: "b",
        ...period,
        setupMinutes: 0,
        turnaroundMinutes: 0,
      }),
    ).toBe(
      "already booked from 1 Jun 2030, 2:00 pm SGT to 1 Jun 2030, 4:00 pm SGT",
    );
  });

  it("names recorded unavailability with its reason", () => {
    expect(
      describeBlocker({
        kind: "unavailability",
        id: "u",
        ...period,
        reason: "EQUIPMENT_FAILURE",
      }),
    ).toBe(
      "unavailable (equipment failure) from 1 Jun 2030, 2:00 pm SGT to 1 Jun 2030, 4:00 pm SGT",
    );
  });
});

describe("availabilityByDay — SCRUM-36", () => {
  // Singapore wall time on 10 Mar 2035, as a UTC instant.
  const sg = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+08:00`);
  const booking = (start: Date, end: Date) => ({
    kind: "booking" as const,
    id: "bkg",
    startAt: start,
    endAt: end,
  });
  const maintenance = (start: Date, end: Date) => ({
    kind: "unavailability" as const,
    id: "vun",
    startAt: start,
    endAt: end,
    reason: "MAINTENANCE" as const,
  });
  const shape = (segments: { kind: string; startAt: Date; endAt: Date }[]) =>
    segments.map((s) => [
      s.kind,
      s.startAt.toISOString(),
      s.endAt.toISOString(),
    ]);

  it("SCRUM-36 [AC6] TC-36-04: a venue with nothing in the range is free across every day of it, not empty", () => {
    const days = availabilityByDay([], "2035-03-10", "2035-03-12");

    expect(days.map((d) => d.day)).toEqual([
      "2035-03-10",
      "2035-03-11",
      "2035-03-12",
    ]);
    for (const { day, segments } of days) {
      expect(shape(segments)).toEqual([
        [
          "free",
          sg(day, "00:00").toISOString(),
          new Date(sg(day, "00:00").getTime() + 86_400_000).toISOString(),
        ],
      ]);
    }
  });

  it("SCRUM-36 [AC2] TC-36-01: an approved booking reads as unavailable, with free time either side", () => {
    const [day] = availabilityByDay(
      [booking(sg("2035-03-10", "09:00"), sg("2035-03-10", "13:00"))],
      "2035-03-10",
      "2035-03-10",
    );

    expect(day.segments.map((s) => s.kind)).toEqual([
      "free",
      "booking",
      "free",
    ]);
    expect(day.segments[1].startAt).toEqual(sg("2035-03-10", "09:00"));
    expect(day.segments[1].endAt).toEqual(sg("2035-03-10", "13:00"));
  });

  it("SCRUM-36 [AC3] TC-36-02: recorded maintenance reads as unavailable and stays distinguishable from a booking", () => {
    const [day] = availabilityByDay(
      [maintenance(sg("2035-03-10", "09:00"), sg("2035-03-10", "12:00"))],
      "2035-03-10",
      "2035-03-10",
    );

    expect(day.segments[1]).toMatchObject({
      kind: "unavailability",
      reason: "MAINTENANCE",
    });
  });

  it("SCRUM-36 [AC5] TC-36-03: two periods meeting at an endpoint show no gap, and no moment is counted twice", () => {
    const [day] = availabilityByDay(
      [
        // Given out of order on purpose.
        maintenance(sg("2035-03-10", "13:00"), sg("2035-03-10", "17:00")),
        booking(sg("2035-03-10", "09:00"), sg("2035-03-10", "13:00")),
      ],
      "2035-03-10",
      "2035-03-10",
    );

    expect(day.segments.map((s) => s.kind)).toEqual([
      "free",
      "booking",
      "unavailability",
      "free",
    ]);
    // Each stretch starts exactly where the last one ended, and together they
    // cover the day exactly once.
    for (let i = 1; i < day.segments.length; i++) {
      expect(day.segments[i].startAt).toEqual(day.segments[i - 1].endAt);
    }
    const covered = day.segments.reduce(
      (ms, s) => ms + (s.endAt.getTime() - s.startAt.getTime()),
      0,
    );
    expect(covered).toBe(86_400_000);
  });

  it("SCRUM-36 [AC5] TC-36-03: a period across midnight is split between the two days; one ending at midnight does not spill over", () => {
    const days = availabilityByDay(
      [
        maintenance(sg("2035-03-10", "22:00"), sg("2035-03-11", "02:00")),
        booking(sg("2035-03-11", "20:00"), sg("2035-03-12", "00:00")),
      ],
      "2035-03-10",
      "2035-03-12",
    );

    expect(shape(days[0].segments).at(-1)).toEqual([
      "unavailability",
      sg("2035-03-10", "22:00").toISOString(),
      sg("2035-03-11", "00:00").toISOString(),
    ]);
    expect(shape(days[1].segments)[0]).toEqual([
      "unavailability",
      sg("2035-03-11", "00:00").toISOString(),
      sg("2035-03-11", "02:00").toISOString(),
    ]);
    expect(days[1].segments.at(-1)?.kind).toBe("booking");
    // The booking ends exactly at midnight, so 12 Mar is wholly free.
    expect(days[2].segments.map((s) => s.kind)).toEqual(["free"]);
  });

  it("SCRUM-36: walks the range across a month end", () => {
    const days = availabilityByDay([], "2035-02-27", "2035-03-02");
    expect(days.map((d) => d.day)).toEqual([
      "2035-02-27",
      "2035-02-28",
      "2035-03-01",
      "2035-03-02",
    ]);
  });
});

describe("findVenueCalendar — SCRUM-36 hover details", () => {
  const booked = {
    id: "bkg_1",
    startAt: new Date("2035-03-10T01:00:00.000Z"),
    endAt: new Date("2035-03-10T05:00:00.000Z"),
    setupMinutes: 0,
    turnaroundMinutes: 0,
    requestedAttendance: 120,
    requestedLayout: "theatre",
    event: { name: "Research Symposium" },
    requestedBy: { name: "Cody Coordinator" },
  };
  const closed = {
    id: "vun_1",
    startAt: new Date("2035-03-09T14:00:00.000Z"),
    endAt: new Date("2035-03-10T01:00:00.000Z"),
    reason: "MAINTENANCE",
    note: "Aircon service",
    recordedBy: { name: "Vera Venue" },
  };

  it("SCRUM-36 [AC2, AC4] TC-36-01, SCRUM-159 [AC7], SCRUM-163 [AC2] TC-163-04: like the blocker lookup, asks only for APPROVED bookings and unexpired holds near enough for their setup or turnaround to reach the period", async () => {
    const db = stubDb([], []);
    const now = new Date("2030-05-01T00:00:00.000Z");

    await findVenueCalendar(db as never, "ven_1", period, now);

    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          venueId: "ven_1",
          OR: [
            { status: "APPROVED" },
            { status: "HELD", holdExpiresAt: { gt: now } },
          ],
          startAt: { lt: new Date(period.endAt.getTime() + DAY_MS) },
          endAt: { gt: new Date(period.startAt.getTime() - DAY_MS) },
        },
      }),
    );
  });

  it("SCRUM-36 TC-36-08: carries what a hover shows: the booking's event, requester and needs; the unavailability's note and recorder", async () => {
    // The week of 5–11 Mar 2035, which holds both.
    const entries = await findVenueCalendar(
      stubDb([booked], [closed]) as never,
      "ven_1",
      {
        startAt: new Date("2035-03-04T16:00:00.000Z"),
        endAt: new Date("2035-03-11T16:00:00.000Z"),
      },
    );

    // Earliest first.
    expect(entries.map((e) => e.id)).toEqual(["vun_1", "bkg_1"]);
    expect(detailsOf(entries[1])).toEqual({
      kind: "booking",
      startAt: booked.startAt,
      endAt: booked.endAt,
      heldUntil: null,
      eventName: "Research Symposium",
      requestedBy: "Cody Coordinator",
      attendance: 120,
      layout: "theatre",
      setupMinutes: 0,
      turnaroundMinutes: 0,
    });
    expect(entries[0]).toMatchObject({
      kind: "unavailability",
      reason: "MAINTENANCE",
      details: { note: "Aircon service", recordedBy: "Vera Venue" },
    });
  });

  it("SCRUM-36 TC-36-08: a stretch clipped to one day keeps the whole period in its details", async () => {
    const entries = await findVenueCalendar(
      stubDb([], [closed]) as never,
      "ven_1",
      period,
    );

    // 10 pm on 9 Mar to 9 am on 10 Mar, Singapore time: split across two days.
    const [, day] = availabilityByDay(entries, "2035-03-09", "2035-03-10");
    const stretch = day.segments[0];
    expect(stretch.startAt).toEqual(new Date("2035-03-09T16:00:00.000Z"));
    expect(
      stretch.kind !== "free" && detailsOf(stretch)?.startAt,
    ).toEqual(closed.startAt);
  });

  describe("SCRUM-159 [AC7] — setup and turnaround around a booking", () => {
    // Singapore wall time on 10 Mar 2035, as a UTC instant.
    const sg = (hhmm: string, day = "2035-03-10") =>
      new Date(`${day}T${hhmm}:00+08:00`);
    const week = {
      startAt: sg("00:00", "2035-03-05"),
      endAt: sg("00:00", "2035-03-12"),
    };
    const withTimes = {
      ...booked,
      startAt: sg("10:00"),
      endAt: sg("12:00"),
      setupMinutes: 30,
      turnaroundMinutes: 45,
    };

    it("SCRUM-159 [AC7] TC-159-10: a booking with setup and turnaround brings a setup stretch before it and a turnaround stretch after it, named for its event", async () => {
      const entries = await findVenueCalendar(
        stubDb([withTimes], []) as never,
        "ven_1",
        week,
      );

      expect(
        entries.map((e) => [e.kind, e.startAt, e.endAt]),
      ).toEqual([
        ["setup", sg("09:30"), sg("10:00")],
        ["booking", sg("10:00"), sg("12:00")],
        ["turnaround", sg("12:00"), sg("12:45")],
      ]);
      expect(entries[0]).toMatchObject({ eventName: "Research Symposium" });
      expect(entries[2]).toMatchObject({ eventName: "Research Symposium" });
    });

    it("SCRUM-159 [AC7] TC-159-10: on the day's timeline the setup, the booking and the turnaround sit flush, each its own kind of stretch", async () => {
      const entries = await findVenueCalendar(
        stubDb([withTimes], []) as never,
        "ven_1",
        week,
      );

      const [day] = availabilityByDay(entries, "2035-03-10", "2035-03-10");
      expect(day.segments.map((s) => s.kind)).toEqual([
        "free",
        "setup",
        "booking",
        "turnaround",
        "free",
      ]);
      expect(day.segments[1].endAt).toEqual(day.segments[2].startAt);
      expect(day.segments[2].endAt).toEqual(day.segments[3].startAt);
    });

    it("SCRUM-159 [AC7] TC-159-11: a booking with no setup or turnaround brings no extra stretch, and one with only turnaround brings only that", async () => {
      expect(
        (
          await findVenueCalendar(stubDb([booked], []) as never, "ven_1", week)
        ).map((e) => e.kind),
      ).toEqual(["booking"]);
      expect(
        (
          await findVenueCalendar(
            stubDb([{ ...withTimes, setupMinutes: 0 }], []) as never,
            "ven_1",
            week,
          )
        ).map((e) => e.kind),
      ).toEqual(["booking", "turnaround"]);
    });

    it("SCRUM-159 [AC7] TC-159-11: a booking just after the week whose setup reaches into it is shown for that setup; one that doesn't reach is left out", async () => {
      // Starts at 00:15 on the Monday after the week, with 30 minutes' setup:
      // its setup runs from 23:45 on the Sunday, inside the week.
      const nextMonday = {
        ...withTimes,
        id: "bkg_next",
        startAt: sg("00:15", "2035-03-12"),
        endAt: sg("02:00", "2035-03-12"),
      };
      const farther = {
        ...nextMonday,
        id: "bkg_far",
        startAt: sg("09:00", "2035-03-12"),
        endAt: sg("10:00", "2035-03-12"),
      };

      const entries = await findVenueCalendar(
        stubDb([nextMonday, farther], []) as never,
        "ven_1",
        week,
      );

      expect(entries.map((e) => e.id)).toEqual([
        "bkg_next-setup",
        "bkg_next",
        "bkg_next-turnaround",
      ]);
      const [sunday] = availabilityByDay(entries, "2035-03-11", "2035-03-11");
      expect(sunday.segments.at(-1)).toMatchObject({
        kind: "setup",
        startAt: sg("23:45", "2035-03-11"),
        endAt: sg("00:00", "2035-03-12"),
      });
    });
  });
});

describe("availabilityByDay — unavailability over a booking (SCRUM-161)", () => {
  const DAY = "2035-03-10";
  const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00+08:00`);
  const booking = { kind: "booking" as const, id: "bkg", startAt: at("10:00"), endAt: at("12:00") };
  const maintenance = (start: string, end: string) => ({
    kind: "unavailability" as const,
    id: "vun",
    startAt: at(start),
    endAt: at(end),
    reason: "MAINTENANCE" as const,
  });
  const shape = (blockers: CalendarEntry[]) =>
    availabilityByDay(blockers, DAY, DAY)[0].segments.map((s) => [
      s.kind,
      s.startAt.toISOString(),
      s.endAt.toISOString(),
    ]);
  const seg = (kind: string, start: string, end: string) => [
    kind,
    (start === "24:00" ? new Date(`2035-03-11T00:00:00+08:00`) : at(start)).toISOString(),
    (end === "24:00" ? new Date(`2035-03-11T00:00:00+08:00`) : at(end)).toISOString(),
  ];

  it("SCRUM-161 [AC1, AC3] TC-161-17: maintenance inside a booking that still stands shows in its place, with the booking either side, and no hour of it shows as free", () => {
    expect(shape([booking, maintenance("10:30", "11:00")])).toEqual([
      seg("free", "00:00", "10:00"),
      seg("booking", "10:00", "10:30"),
      seg("unavailability", "10:30", "11:00"),
      seg("booking", "11:00", "12:00"),
      seg("free", "12:00", "24:00"),
    ]);
  });

  it("SCRUM-161 [AC1, AC3] TC-161-17: maintenance that starts inside a booking and runs past it shows from where it starts", () => {
    expect(shape([booking, maintenance("11:30", "13:00")])).toEqual([
      seg("free", "00:00", "10:00"),
      seg("booking", "10:00", "11:30"),
      seg("unavailability", "11:30", "13:00"),
      seg("free", "13:00", "24:00"),
    ]);
  });

  it("SCRUM-161 [AC1] TC-161-17: however blockers overlap, the stretches cover the day once, in order, with none running backwards", () => {
    const segments = availabilityByDay(
      [booking, maintenance("09:00", "10:30"), maintenance("11:00", "11:15"), maintenance("11:45", "12:15")],
      DAY,
      DAY,
    )[0].segments;
    for (const [i, s] of segments.entries()) {
      expect(s.endAt.getTime()).toBeGreaterThan(s.startAt.getTime());
      if (i > 0) expect(s.startAt).toEqual(segments[i - 1].endAt);
    }
    expect(segments[0].startAt).toEqual(at("00:00"));
    expect(segments.at(-1)!.endAt).toEqual(new Date("2035-03-11T00:00:00+08:00"));
  });
});
