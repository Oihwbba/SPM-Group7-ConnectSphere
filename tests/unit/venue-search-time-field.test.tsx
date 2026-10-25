import { describe, it, expect } from "vitest";

import {
  fromClock,
  roundUpTo,
  toClock,
} from "@/components/app/date-time-picker";

// SCRUM-38 AC2 — the start and end time are picked as hour, minute and AM or
// PM, and sent as the 24-hour "HH:mm" the search reads. The venue search
// uses the app's time picker (components/app/date-time-picker.tsx); no time
// at all is its Clear, which sends "".
describe("the time picker's hour, minute and AM/PM — SCRUM-38 AC2", () => {
  it("SCRUM-38 [AC2] TC-38-21: an hour and PM with the minutes left at 00 is that hour in the afternoon", () => {
    expect(fromClock("05", "00", "PM")).toBe("17:00");
    expect(fromClock("09", "00", "AM")).toBe("09:00");
  });

  it("SCRUM-38 [AC2] TC-38-21: 12 AM is midnight and 12 PM is noon", () => {
    expect(fromClock("12", "00", "AM")).toBe("00:00");
    expect(fromClock("12", "30", "PM")).toBe("12:30");
    expect(fromClock("11", "59", "PM")).toBe("23:59");
  });

  it("SCRUM-38 [AC2] TC-38-21: a time searched shows again as it was picked", () => {
    expect(toClock("17:05")).toEqual({
      hour: "05",
      minute: "05",
      period: "PM",
    });
    expect(toClock("00:00")).toEqual({
      hour: "12",
      minute: "00",
      period: "AM",
    });
    expect(toClock("12:00")).toEqual({
      hour: "12",
      minute: "00",
      period: "PM",
    });
    for (const time of ["00:00", "07:30", "12:00", "15:01", "23:59"]) {
      const { hour, minute, period } = toClock(time);
      expect(fromClock(hour, minute, period)).toBe(time);
    }
  });
});

describe("the first time a stepped picker offers — shared page conventions", () => {
  it("SCRUM-207 TC-207-22: rounds up to the next step, and keeps a time already on it", () => {
    expect(roundUpTo("09:10", 30)).toBe("09:30");
    expect(roundUpTo("09:30", 30)).toBe("09:30");
    expect(roundUpTo("09:01", 15)).toBe("09:15");
    expect(roundUpTo("09:07", 1)).toBe("09:07");
  });

  it("SCRUM-207 TC-207-22: has nothing to offer past the last step of the day", () => {
    expect(roundUpTo("23:31", 30)).toBeNull();
    expect(roundUpTo("23:45", 15)).toBe("23:45");
  });
});
