import { describe, it, expect, vi } from "vitest";

import {
  availabilityByDay,
  describeBlocker,
  findVenueBlockers,
  findVenueCalendar,
} from "@/lib/venue-availability";

// SCRUM-50 AC3 / SCRUM-53 AC4, AC8 — what makes a venue unavailable. The query is
// checked against a stub; the same rule is exercised against real rows in
// tests/integration/bookings.test.ts.
const period = {
  startAt: new Date("2030-06-01T06:00:00.000Z"),
  endAt: new Date("2030-06-01T08:00:00.000Z"),
};

function stubDb(bookings: unknown[], unavailability: unknown[]) {
  return {
    booking: { findMany: vi.fn().mockResolvedValue(bookings) },
    venueUnavailability: {
      findMany: vi.fn().mockResolvedValue(unavailability),
    },
  };
}

describe("findVenueBlockers", () => {
  it("SCRUM-50 [AC3, AC10] TC-50-04: asks only for APPROVED bookings that overlap the period — a pending request blocks nobody", async () => {
    const db = stubDb([], []);

    await findVenueBlockers(db as never, "ven_1", period);

    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          venueId: "ven_1",
          status: "APPROVED",
          startAt: { lt: period.endAt },
          endAt: { gt: period.startAt },
        },
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
      { kind: "booking", ...late },
    ]);
  });
});

describe("describeBlocker", () => {
  it("names an approved booking by its times only — never the other organisation's event", () => {
    expect(describeBlocker({ kind: "booking", id: "b", ...period })).toBe(
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

  it("SCRUM-36 — a period across midnight is split between the two days; one ending at midnight does not spill over", () => {
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

  it("walks the range across a month end", () => {
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

  it("SCRUM-36 [AC2, AC4] TC-36-01: like the blocker lookup, asks only for APPROVED bookings overlapping the period", async () => {
    const db = stubDb([], []);

    await findVenueCalendar(db as never, "ven_1", period);

    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          venueId: "ven_1",
          status: "APPROVED",
          startAt: { lt: period.endAt },
          endAt: { gt: period.startAt },
        },
      }),
    );
  });

  it("SCRUM-36 — carries what a hover shows: the booking's event, requester and needs; the unavailability's note and recorder", async () => {
    const entries = await findVenueCalendar(
      stubDb([booked], [closed]) as never,
      "ven_1",
      period,
    );

    // Earliest first.
    expect(entries.map((e) => e.id)).toEqual(["vun_1", "bkg_1"]);
    expect(entries[1].details).toEqual({
      kind: "booking",
      startAt: booked.startAt,
      endAt: booked.endAt,
      eventName: "Research Symposium",
      requestedBy: "Cody Coordinator",
      attendance: 120,
      layout: "theatre",
    });
    expect(entries[0]).toMatchObject({
      kind: "unavailability",
      reason: "MAINTENANCE",
      details: { note: "Aircon service", recordedBy: "Vera Venue" },
    });
  });

  it("SCRUM-36 — a stretch clipped to one day keeps the whole period in its details", async () => {
    const entries = await findVenueCalendar(
      stubDb([], [closed]) as never,
      "ven_1",
      period,
    );

    // 10 pm on 9 Mar to 9 am on 10 Mar, Singapore time: split across two days.
    const [, day] = availabilityByDay(entries, "2035-03-09", "2035-03-10");
    const stretch = day.segments[0];
    expect(stretch.startAt).toEqual(new Date("2035-03-09T16:00:00.000Z"));
    expect(stretch.kind !== "free" && stretch.details?.startAt).toEqual(
      closed.startAt,
    );
  });
});
