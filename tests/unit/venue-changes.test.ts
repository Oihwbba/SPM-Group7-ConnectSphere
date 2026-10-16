import { describe, it, expect } from "vitest";

import {
  describeAffected,
  newlyUnfit,
  type BookingNeeds,
  type CatalogueVenue,
} from "@/lib/venue-changes";
import type { OpeningDay } from "@/lib/venue-hours";

// SCRUM-34 AC10, AC12 — which future bookings a venue edit would stop
// fitting. 4 March 2036 is a Tuesday.
const at = (sgt: string) => new Date(`${sgt}+08:00`);

const everyDay = (opens: number, closes: number): OpeningDay[] =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opensMinute: opens, closesMinute: closes }));

const venue: CatalogueVenue = {
  capacity: 120,
  facilities: ["projector", "sound-system"],
  supportedLayouts: ["theatre", "banquet"],
  openingHours: everyDay(9 * 60, 22 * 60),
};

/** TC-34-12's booking: 100 people, a projector and a theatre layout, Tuesday 10:00–14:00. */
const booking: BookingNeeds = {
  startAt: at("2036-03-04T10:00"),
  endAt: at("2036-03-04T14:00"),
  requestedAttendance: 100,
  requiredFacilities: ["projector"],
  requestedLayout: "theatre",
};

describe("what a venue edit stops fitting — SCRUM-34 AC10", () => {
  it.each([
    ["capacity lowered below the attendance", { capacity: 80 }, "Capacity 80 < attendance 100"],
    ["a facility it asked for removed", { facilities: ["sound-system"] }, "Missing facility: projector"],
    ["its layout no longer supported", { supportedLayouts: ["banquet"] }, "Theatre layout not supported"],
    [
      "opening hours narrowed past its period",
      { openingHours: everyDay(11 * 60, 18 * 60) },
      "Outside opening hours (Tuesday 11:00–18:00)",
    ],
  ])("SCRUM-34 [AC10] TC-34-12: %s affects the booking, with why", (_label, change, reason) => {
    expect(newlyUnfit(venue, { ...venue, ...change }, booking)).toEqual([reason]);
  });

  it("SCRUM-34 [AC10] TC-34-12: every reason that applies is listed", () => {
    expect(
      newlyUnfit(venue, { ...venue, capacity: 50, supportedLayouts: [] }, booking),
    ).toEqual(["Capacity 50 < attendance 100", "Theatre layout not supported"]);
  });

  it("SCRUM-34 [AC10] TC-34-13: facilities and layouts are compared as tags, however they were written", () => {
    const asked = { ...booking, requiredFacilities: ["Sound System"], requestedLayout: "Theatre" };
    expect(newlyUnfit(venue, { ...venue, capacity: 110 }, asked)).toEqual([]);
    expect(newlyUnfit(venue, { ...venue, facilities: ["projector"] }, asked)).toEqual([
      "Missing facility: sound system",
    ]);
  });

  it("SCRUM-34 [AC10] TC-34-13: a booking that named no attendance or layout isn't judged on them", () => {
    const unstated = { ...booking, requestedAttendance: null, requestedLayout: null };
    expect(
      newlyUnfit(venue, { ...venue, capacity: 1, supportedLayouts: [] }, unstated),
    ).toEqual([]);
  });

  it("SCRUM-34 [AC10] TC-34-13: capacity lowered to exactly the attendance still fits", () => {
    expect(newlyUnfit(venue, { ...venue, capacity: 100 }, booking)).toEqual([]);
  });

  it("SCRUM-34 [AC10] TC-34-13: a change to something the booking didn't ask for affects nothing", () => {
    expect(
      newlyUnfit(venue, { ...venue, facilities: ["projector"], supportedLayouts: ["theatre"] }, booking),
    ).toEqual([]);
  });

  it("SCRUM-34 [AC10] TC-34-13: a mismatch the edit didn't cause doesn't count", () => {
    const tooBigAlready = { ...booking, requestedAttendance: 150 };
    // Over capacity before and after: the edit didn't cause it.
    expect(newlyUnfit(venue, { ...venue, capacity: 110 }, tooBigAlready)).toEqual([]);
    // ...but a new failure on top of it still counts.
    expect(
      newlyUnfit(venue, { ...venue, capacity: 110, facilities: [] }, tooBigAlready),
    ).toEqual(["Missing facility: projector"]);
  });

  it("SCRUM-34 [AC10] TC-34-12: hours recorded for the first time count against a booking outside them", () => {
    const noHoursYet = { ...venue, openingHours: [] };
    expect(
      newlyUnfit(noHoursYet, { ...venue, openingHours: everyDay(12 * 60, 18 * 60) }, booking),
    ).toEqual(["Outside opening hours (Tuesday 12:00–18:00)"]);
  });
});

describe("new opening hours judge the booking period only — SCRUM-34 AC12", () => {
  it("SCRUM-34 [AC12] TC-34-15: hours that start exactly when the booking does still fit", () => {
    // The venue's setup would start before 10:00; setup isn't part of the period.
    expect(newlyUnfit(venue, { ...venue, openingHours: everyDay(10 * 60, 18 * 60) }, booking)).toEqual(
      [],
    );
  });

  it("SCRUM-34 [AC12] TC-34-15: hours starting a minute after the booking does affect it", () => {
    expect(
      newlyUnfit(venue, { ...venue, openingHours: everyDay(10 * 60 + 1, 18 * 60) }, booking),
    ).toEqual(["Outside opening hours (Tuesday 10:01–18:00)"]);
  });
});

describe("how an affected booking is shown — SCRUM-34 AC10, AC11", () => {
  it("SCRUM-34 [AC10, AC11] TC-34-12, TC-34-14: the event, start and status, with why when there is a why", () => {
    const shown = { startAt: at("2036-03-04T10:00"), status: "APPROVED" as const, event: { name: "Spring Gala" } };
    expect(describeAffected(shown, ["Capacity 80 < attendance 100"])).toBe(
      "Spring Gala, 4 Mar 2036, 10:00 am SGT (Approved): Capacity 80 < attendance 100",
    );
    expect(describeAffected(shown, [])).toBe("Spring Gala, 4 Mar 2036, 10:00 am SGT (Approved)");
  });
});
