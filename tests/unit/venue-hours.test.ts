import { describe, it, expect } from "vitest";

import {
  closedOn,
  dayOutsideOpeningHours,
  describeDay,
  minutesToTime,
  openingHoursRefusal,
  outsideOpeningHoursMessage,
  setupTurnaroundWarning,
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

  it("SCRUM-34 [AC7] TC-34-08: the refusal names the venue and that day's hours, or is null within them or with no hours recorded", () => {
    const venue = { name: "Executive Boardroom", openingHours: boardroom };

    expect(openingHoursRefusal(period("2036-03-08T10:00", "2036-03-08T12:00"), venue)).toBe(
      "Executive Boardroom is closed on Saturdays, so it can't be booked then.",
    );
    expect(openingHoursRefusal(period("2036-03-04T09:00", "2036-03-04T18:00"), venue)).toBeNull();
    expect(
      openingHoursRefusal(period("2036-03-08T10:00", "2036-03-08T12:00"), { name: "Annex" }),
    ).toBeNull();
  });

  describe("SCRUM-159 AC9 — setup or turnaround outside opening hours", () => {
    const venue = { name: "Executive Boardroom", openingHours: boardroom };
    const thirtyAndFortyFive = { setupMinutes: 30, turnaroundMinutes: 45 };

    it("SCRUM-159 [AC9] TC-159-18: setup starting before opening is named, with when it starts and that day's hours", () => {
      expect(
        setupTurnaroundWarning(period("2036-03-04T09:00", "2036-03-04T12:00"), thirtyAndFortyFive, venue),
      ).toBe(
        "The setup time (30 minutes, from 08:30) falls outside Executive Boardroom's opening hours, 09:00–18:00 on Tuesdays. You can still hold or approve it.",
      );
    });

    it("SCRUM-159 [AC9] TC-159-18: turnaround ending after closing is named, with when it ends", () => {
      expect(
        setupTurnaroundWarning(period("2036-03-04T15:00", "2036-03-04T17:30"), thirtyAndFortyFive, venue),
      ).toMatch(/^The turnaround time \(45 minutes, until 18:15\) falls outside/);
    });

    it("SCRUM-159 [AC9] TC-159-18: both outside are named together", () => {
      expect(
        setupTurnaroundWarning(period("2036-03-04T09:00", "2036-03-04T18:00"), thirtyAndFortyFive, venue),
      ).toMatch(
        /^The setup time \(30 minutes, from 08:30\) and turnaround time \(45 minutes, until 18:45\) fall outside/,
      );
    });

    it("SCRUM-159 [AC9] TC-159-19: setup ending exactly at opening and turnaround exactly at closing warn of nothing", () => {
      expect(
        setupTurnaroundWarning(period("2036-03-04T09:30", "2036-03-04T17:15"), thirtyAndFortyFive, venue),
      ).toBeNull();
    });

    it("SCRUM-159 [AC9] TC-159-19: no warning with no hours recorded, or when the booking itself is outside them (SCRUM-34 AC7 refuses it instead)", () => {
      expect(
        setupTurnaroundWarning(period("2036-03-04T09:00", "2036-03-04T12:00"), thirtyAndFortyFive, {
          name: "Annex",
        }),
      ).toBeNull();
      expect(
        setupTurnaroundWarning(period("2036-03-08T10:00", "2036-03-08T12:00"), thirtyAndFortyFive, venue),
      ).toBeNull();
    });

    it("SCRUM-159 [AC9] TC-159-18: a setup starting the evening before reads as that time", () => {
      const allDay = [{ weekday: 2, opensMinute: 0, closesMinute: 1380 }];
      expect(
        setupTurnaroundWarning(period("2036-03-04T00:00", "2036-03-04T02:00"), thirtyAndFortyFive, {
          name: "Studio",
          openingHours: allDay,
        }),
      ).toMatch(/^The setup time \(30 minutes, from 23:30\) falls outside/);
    });
  });

  it("SCRUM-34 [AC7] TC-34-08: the SGT day decides, not the UTC one", () => {
    // 07:30 SGT on Tuesday is still Monday in UTC.
    expect(
      dayOutsideOpeningHours(period("2036-03-04T07:30", "2036-03-04T08:30"), boardroom)?.weekday,
    ).toBe(2);
  });
});

describe("the closed day in a search without times — SCRUM-38 AC4", () => {
  it("SCRUM-38 [AC4] TC-38-20: a weekday searched as a whole day isn't a closed day, though the venue isn't open all of it", () => {
    expect(closedOn(at("2036-03-04T00:00"), boardroom)).toBeNull();
  });

  it("SCRUM-38 [AC4] TC-38-20: a day the venue is Closed is named", () => {
    expect(closedOn(at("2036-03-08T00:00"), boardroom)).toEqual({
      weekday: 6,
      opensMinute: null,
      closesMinute: null,
    });
  });

  it("SCRUM-38 [AC4] TC-38-20: the SGT day decides, not the UTC one", () => {
    // 00:30 SGT on Saturday is still Friday in UTC.
    expect(closedOn(at("2036-03-08T00:30"), boardroom)?.weekday).toBe(6);
    // 23:30 SGT on Friday is the Friday, open, though 00:00 Saturday is next.
    expect(closedOn(at("2036-03-07T23:30"), boardroom)).toBeNull();
  });

  it("SCRUM-38 [AC4] TC-38-20: a weekday with no row is Closed, and a venue with no hours is never closed", () => {
    const weekdaysOnly = boardroom.filter((d) => d.weekday <= 5);
    expect(closedOn(at("2036-03-08T00:00"), weekdaysOnly)).toEqual({
      weekday: 6,
      opensMinute: null,
      closesMinute: null,
    });
    expect(closedOn(at("2036-03-08T00:00"), [])).toBeNull();
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
