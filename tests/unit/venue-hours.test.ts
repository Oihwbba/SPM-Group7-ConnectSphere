import { describe, it, expect } from "vitest";

import {
  dayOutsideOpeningHours,
  describeDay,
  minutesToTime,
  outsideOpeningHoursMessage,
  timeToMinutes,
  type OpeningDay,
} from "@/lib/venue-hours";

// SCRUM-34 AC3, AC7 — opening hours per weekday in SGT, and whether a booking
// period falls within them. 4 March 2036 is a Tuesday, 8 March a Saturday.
const at = (sgt: string) => new Date(`${sgt}+08:00`);
const period = (start: string, end: string) => ({ startAt: at(start), endAt: at(end) });

/** Executive Boardroom: weekdays 09:00–18:00, Closed at weekends. */
const boardroom: OpeningDay[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
  weekday <= 5
    ? { weekday, opensMinute: 540, closesMinute: 1080 }
    : { weekday, opensMinute: null, closesMinute: null },
);

describe("opening hours — SCRUM-34 AC7", () => {
  it("SCRUM-34 [AC7] TC-34-08: a period starting exactly at opening and ending exactly at closing is within", () => {
    expect(
      dayOutsideOpeningHours(period("2036-03-04T09:00", "2036-03-04T18:00"), boardroom),
    ).toBeNull();
  });

  it.each([
    ["starts a minute before opening", "2036-03-04T08:59", "2036-03-04T12:00"],
    ["ends a minute after closing", "2036-03-04T15:00", "2036-03-04T18:01"],
    ["runs past midnight", "2036-03-04T17:00", "2036-03-05T01:00"],
  ])("SCRUM-34 [AC7] TC-34-08: a period that %s is outside, and Tuesday's hours are named", (_label, start, end) => {
    const day = dayOutsideOpeningHours(period(start, end), boardroom);
    expect(day).toEqual({ weekday: 2, opensMinute: 540, closesMinute: 1080 });
    expect(outsideOpeningHoursMessage("Executive Boardroom", day!)).toBe(
      "Executive Boardroom is open 09:00–18:00 on Tuesdays. The booking must start and end within those hours on the same day.",
    );
  });

  it("SCRUM-34 [AC7] TC-34-08: a period on a Closed day is outside", () => {
    const day = dayOutsideOpeningHours(period("2036-03-08T10:00", "2036-03-08T12:00"), boardroom);
    expect(day).toEqual({ weekday: 6, opensMinute: null, closesMinute: null });
    expect(outsideOpeningHoursMessage("Executive Boardroom", day!)).toBe(
      "Executive Boardroom is closed on Saturdays, so it can't be booked then.",
    );
  });

  it("SCRUM-34 [AC7] TC-34-08: a day with no row counts as Closed, once a venue has hours", () => {
    const weekdaysOnly = boardroom.filter((d) => d.weekday <= 5);
    expect(
      dayOutsideOpeningHours(period("2036-03-09T10:00", "2036-03-09T12:00"), weekdaysOnly),
    ).toEqual({ weekday: 7, opensMinute: null, closesMinute: null });
  });

  it("SCRUM-34 [AC7] TC-34-08: a venue with no hours recorded refuses nothing", () => {
    expect(dayOutsideOpeningHours(period("2036-03-08T03:00", "2036-03-08T05:00"), [])).toBeNull();
  });

  it("SCRUM-34 [AC7] TC-34-08: the SGT day decides, not the UTC one", () => {
    // 07:30 SGT on Tuesday is still Monday in UTC.
    expect(
      dayOutsideOpeningHours(period("2036-03-04T07:30", "2036-03-04T08:30"), boardroom)?.weekday,
    ).toBe(2);
  });
});

describe("reading and writing opening hours — SCRUM-34 AC3", () => {
  it.each([
    ["00:00", 0],
    ["09:30", 570],
    ["23:59", 1439],
  ])("SCRUM-34 [AC3] TC-34-03: %s is %i minutes after midnight, and back", (time, minutes) => {
    expect(timeToMinutes(time)).toBe(minutes);
    expect(minutesToTime(minutes)).toBe(time);
  });

  it.each(["24:00", "9:00", "09:60", "", "noon"])(
    "SCRUM-34 [AC3] TC-34-04: %j isn't a time of day",
    (time) => {
      expect(timeToMinutes(time)).toBeNull();
    },
  );

  it("SCRUM-34 [AC1] TC-34-01: a day reads as its hours, or Closed", () => {
    expect(describeDay(boardroom[0])).toBe("Monday 09:00–18:00");
    expect(describeDay(boardroom[6])).toBe("Sunday Closed");
  });
});
