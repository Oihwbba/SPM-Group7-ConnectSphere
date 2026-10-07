import { describe, it, expect } from "vitest";
import {
  TIME_ZONE,
  formatDate,
  formatDayMonth,
  formatMonth,
  formatWeekdayDate,
  formatDateTime,
  formatEventTime,
  formatTime,
  parseSingaporeDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
} from "@/lib/datetime";

describe("lib/datetime helpers — SCRUM-31", () => {
  const instant = "2026-09-22T06:42:00.000Z"; // 14:42 (02:42 PM) in Asia/Singapore (UTC+8)

  it("formats date in Singapore timezone", () => {
    expect(formatDate(instant)).toContain("2026");
    expect(formatDate(instant)).toContain("Sep");
  });

  it("formats date and time in Singapore timezone", () => {
    const formatted = formatDateTime(instant);
    expect(formatted).toContain("2026");
    expect(formatted).toContain("Sep");
    expect(formatted.toLowerCase()).toMatch(/(2:42|02:42)\s*(pm|pm)/);
  });

  it("formats time only in Singapore timezone", () => {
    const formatted = formatTime(instant);
    expect(formatted.toLowerCase()).toMatch(/(2:42|02:42)\s*(pm|pm)/);
  });

  it("converts Singapore wall-time string to UTC ISO instant", () => {
    expect(sgWallTimeToUtcIso("2026-09-22T14:42")).toBe(
      "2026-09-22T06:42:00.000Z",
    );
    expect(sgWallTimeToUtcIso("")).toBeUndefined();
    expect(sgWallTimeToUtcIso("invalid")).toBeUndefined();
  });

  it("parses Singapore wall-time into correct Date instant", () => {
    const d = parseSingaporeDateTime("2026-09-22T14:42");
    expect(d?.toISOString()).toBe("2026-09-22T06:42:00.000Z");
    expect(parseSingaporeDateTime("")).toBeNull();
    expect(parseSingaporeDateTime("T14:42")).toBeNull();
    expect(parseSingaporeDateTime("2026-09-22T")).toBeNull();
    expect(parseSingaporeDateTime("aaaa-bb-ccTdd:ee")).toBeNull();
  });

  it("converts UTC instant or Date to Singapore wall-time string (YYYY-MM-DDTHH:mm)", () => {
    expect(utcToSgWallTime("2026-09-22T06:42:00.000Z")).toBe(
      "2026-09-22T14:42",
    );
    expect(utcToSgWallTime(new Date("2026-09-22T06:42:00.000Z"))).toBe(
      "2026-09-22T14:42",
    );
    expect(utcToSgWallTime(null)).toBe("");
    expect(utcToSgWallTime(undefined)).toBe("");
    expect(utcToSgWallTime("")).toBe("");
    expect(utcToSgWallTime("invalid")).toBe("");
    expect(utcToSgWallTime(new Date("invalid"))).toBe("");
  });
});

describe("SCRUM-129 — Show and store all event times in Singapore time", () => {
  it("SCRUM-129 [AC1 - Singapore timezone]: the event timezone is Asia/Singapore (UTC+8)", () => {
    expect(TIME_ZONE).toBe("Asia/Singapore");
    // 00:00 UTC is 08:00 in Singapore, all year round.
    expect(utcToSgWallTime("2026-01-15T00:00:00.000Z")).toBe(
      "2026-01-15T08:00",
    );
    expect(utcToSgWallTime("2026-07-15T00:00:00.000Z")).toBe(
      "2026-07-15T08:00",
    );
  });

  it("SCRUM-129 [AC1 - Singapore timezone]: an early-morning Singapore time lands on the previous UTC day", () => {
    expect(sgWallTimeToUtcIso("2026-07-15T03:30")).toBe(
      "2026-07-14T19:30:00.000Z",
    );
  });

  it("SCRUM-129 [AC2 - Existing events]: an instant stored under another timezone is shown in Singapore time, unchanged", () => {
    // A legacy event entered as 09:00 New York (EDT) was stored as 13:00 UTC.
    const stored = new Date("2026-07-15T13:00:00.000Z");
    expect(formatDateTime(stored)).toBe("15 Jul 2026, 9:00 pm SGT");
    expect(utcToSgWallTime(stored)).toBe("2026-07-15T21:00");
  });

  it("SCRUM-129 [AC3 - SGT label]: every displayed time is labelled SGT", () => {
    expect(formatDateTime("2026-07-15T06:42:00.000Z")).toBe(
      "15 Jul 2026, 2:42 pm SGT",
    );
    expect(formatTime("2026-07-15T06:42:00.000Z")).toBe("2:42 pm SGT");
  });

  it("SCRUM-129 [AC3 - SGT label]: date-only formats carry no time, so no label", () => {
    const instant = "2026-09-22T06:42:00.000Z";
    for (const formatted of [
      formatDate(instant),
      formatDayMonth(instant),
      formatMonth(instant),
      formatWeekdayDate(instant),
    ]) {
      expect(formatted).not.toContain("SGT");
    }
  });

  it("SCRUM-129 [AC4 - UTC storage]: a Singapore wall time round-trips through the UTC instant it is stored as", () => {
    const stored = sgWallTimeToUtcIso("2026-12-31T23:30");
    expect(stored).toBe("2026-12-31T15:30:00.000Z");
    expect(utcToSgWallTime(stored)).toBe("2026-12-31T23:30");
  });
});

describe("formatMonth — SCRUM-50 calendar heading", () => {
  it("names the month in Singapore time, even when the UTC instant is still the previous month", () => {
    // 20:00 UTC on 31 Jan is 04:00 on 1 Feb in Singapore.
    expect(formatMonth("2035-01-31T20:00:00.000Z")).toBe("February 2035");
  });
});

describe("formatWeekdayDate — SCRUM-36 day headings", () => {
  it("names the weekday and date in Singapore time", () => {
    // 20:00 UTC on Fri 9 Mar 2035 is 04:00 on Saturday 10 Mar in Singapore.
    expect(formatWeekdayDate("2035-03-09T20:00:00.000Z")).toBe(
      "Sat, 10 Mar 2035",
    );
  });
});

describe("formatEventTime — SCRUM-72 AC2, SCRUM-76 AC1: an event's date with its start and end time", () => {
  const start = new Date("2031-06-01T02:00:00Z"); // 10:00 am SGT
  const sameDayEnd = new Date("2031-06-01T08:00:00Z"); // 4:00 pm SGT
  const nextDayEnd = new Date("2031-06-02T02:00:00Z");

  it("[Positive] SCRUM-72 AC2: a same-day event shows its date, start time and end time", () => {
    expect(formatEventTime(start, sameDayEnd)).toBe(
      `${formatDateTime(start)} – ${formatTime(sameDayEnd)}`,
    );
  });

  it("[Positive] SCRUM-72 AC2: an event that ends on a later day shows the full end date", () => {
    expect(formatEventTime(start, nextDayEnd)).toBe(
      `${formatDateTime(start)} – ${formatDateTime(nextDayEnd)}`,
    );
  });

  it("[Boundary] an event that ends just after midnight Singapore time counts as a later day", () => {
    const afterMidnight = new Date("2031-06-01T16:30:00Z"); // 12:30 am SGT, 2 Jun
    expect(formatEventTime(start, afterMidnight)).toBe(
      `${formatDateTime(start)} – ${formatDateTime(afterMidnight)}`,
    );
  });

  it("[Boundary] an event with no end shows only its start", () => {
    expect(formatEventTime(start, null)).toBe(formatDateTime(start));
  });

  it("[Boundary] an event with no start shows that the date is to be confirmed", () => {
    expect(formatEventTime(null, null)).toBe("Date to be confirmed");
  });
});
