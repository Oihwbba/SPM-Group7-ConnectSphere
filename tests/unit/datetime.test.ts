import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDateTimeInTimezone,
  formatTime,
  parseSingaporeDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
  timezoneWallTimeToUtcIso,
  utcToTimezoneWallTime,
  parseIanaZone,
  normalizeTimezoneOption,
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
    expect(sgWallTimeToUtcIso("2026-09-22T14:42")).toBe("2026-09-22T06:42:00.000Z");
    expect(sgWallTimeToUtcIso("")).toBeUndefined();
    expect(sgWallTimeToUtcIso("invalid")).toBeUndefined();
  });

  it("parses Singapore wall-time into correct Date instant", () => {
    const d = parseSingaporeDateTime("2026-09-22T14:42");
    expect(d?.toISOString()).toBe("2026-09-22T06:42:00.000Z");
    expect(parseSingaporeDateTime("")).toBeNull();
    expect(parseSingaporeDateTime("T14:42")).toBeNull();
    expect(parseSingaporeDateTime("aaaa-bb-ccTdd:ee")).toBeNull();
  });

  it("converts UTC instant or Date to Singapore wall-time string (YYYY-MM-DDTHH:mm)", () => {
    expect(utcToSgWallTime("2026-09-22T06:42:00.000Z")).toBe("2026-09-22T14:42");
    expect(utcToSgWallTime(new Date("2026-09-22T06:42:00.000Z"))).toBe("2026-09-22T14:42");
    expect(utcToSgWallTime(null)).toBe("");
    expect(utcToSgWallTime(undefined)).toBe("");
    expect(utcToSgWallTime("")).toBe("");
    expect(utcToSgWallTime("invalid")).toBe("");
    expect(utcToSgWallTime(new Date("invalid"))).toBe("");
  });

  it("converts IANA timezone wall-time to UTC ISO instant handling DST accurately", () => {
    // Summer date (EDT -04:00): July 15 09:00 NY time => 13:00 UTC
    expect(timezoneWallTimeToUtcIso("2026-07-15T09:00", "America/New_York")).toBe("2026-07-15T13:00:00.000Z");
    // Winter date (EST -05:00): Dec 15 09:00 NY time => 14:00 UTC
    expect(timezoneWallTimeToUtcIso("2026-12-15T09:00", "America/New_York")).toBe("2026-12-15T14:00:00.000Z");
    // Summer date (BST +01:00): July 15 10:00 London time => 09:00 UTC
    expect(timezoneWallTimeToUtcIso("2026-07-15T10:00", "Europe/London")).toBe("2026-07-15T09:00:00.000Z");
  });

  it("formats UTC instant to wall-time string in target IANA timezone", () => {
    expect(utcToTimezoneWallTime("2026-07-15T13:00:00.000Z", "America/New_York")).toBe("2026-07-15T09:00");
    expect(utcToTimezoneWallTime("2026-12-15T14:00:00.000Z", "America/New_York")).toBe("2026-12-15T09:00");
  });

  it("handles invalid or edge-case inputs for timezoneWallTimeToUtcIso and utcToTimezoneWallTime", () => {
    expect(timezoneWallTimeToUtcIso(null)).toBeUndefined();
    expect(timezoneWallTimeToUtcIso(undefined)).toBeUndefined();
    expect(timezoneWallTimeToUtcIso("")).toBeUndefined();
    expect(timezoneWallTimeToUtcIso("invalid")).toBeUndefined();
    expect(timezoneWallTimeToUtcIso("2026-07-15")).toBeUndefined();
    expect(timezoneWallTimeToUtcIso("aaaa-bb-ccTdd:ee")).toBeUndefined();

    expect(utcToTimezoneWallTime(null)).toBe("");
    expect(utcToTimezoneWallTime(undefined)).toBe("");
    expect(utcToTimezoneWallTime("")).toBe("");
    expect(utcToTimezoneWallTime("invalid")).toBe("");
  });

  it("formats datetimes in specified target timezones with appropriate suffix, including UTC", () => {
    // NY Summer (EDT -4): 13:00 UTC => 9:00 AM NY
    const nyFormatted = formatDateTimeInTimezone("2026-07-15T13:00:00.000Z", "America/New_York (-05:00)");
    expect(nyFormatted).toContain("America/New_York");

    // UTC (+00:00)
    const utcFormatted = formatDateTimeInTimezone("2026-07-15T13:00:00.000Z", "UTC (+00:00)");
    expect(utcFormatted).toContain("UTC");
    expect(utcFormatted).toContain("1:00 pm");

    // Tokyo (+09:00): 13:00 UTC => 10:00 PM Tokyo
    const tokyoFormatted = formatDateTimeInTimezone("2026-07-15T13:00:00.000Z", "Asia/Tokyo (+09:00)");
    expect(tokyoFormatted).toContain("Asia/Tokyo");

    // London (+00:00 summer BST +1): 13:00 UTC => 2:00 PM London
    const londonFormatted = formatDateTimeInTimezone("2026-07-15T13:00:00.000Z", "Europe/London (+00:00)");
    expect(londonFormatted).toContain("Europe/London");

    // Singapore default
    const sgFormatted = formatDateTimeInTimezone("2026-07-15T13:00:00.000Z", "Asia/Singapore (+08:00)");
    expect(sgFormatted).not.toContain("Asia/Singapore");

    // Null or empty handling
    expect(formatDateTimeInTimezone(null)).toBe("—");
    expect(formatDateTimeInTimezone(undefined)).toBe("—");
    expect(formatDateTimeInTimezone("invalid")).toBe("—");
  });

  it("parses IANA zone strings and normalizes stored timezone option values across global timezones", () => {
    // Priority / Common choices
    expect(parseIanaZone("UTC (+00:00)")).toBe("UTC");
    expect(parseIanaZone("Asia/Tokyo (+09:00)")).toBe("Asia/Tokyo");
    expect(parseIanaZone("Europe/London (+00:00)")).toBe("Europe/London");
    expect(parseIanaZone("America/New_York (-05:00)")).toBe("America/New_York");
    expect(parseIanaZone("Asia/Singapore (+08:00)")).toBe("Asia/Singapore");

    // Additional global timezones across continents
    expect(parseIanaZone("Australia/Sydney (+10:00)")).toBe("Australia/Sydney");
    expect(parseIanaZone("Asia/Dubai (+04:00)")).toBe("Asia/Dubai");
    expect(parseIanaZone("America/Los_Angeles (-08:00)")).toBe("America/Los_Angeles");
    expect(parseIanaZone("Europe/Paris (+01:00)")).toBe("Europe/Paris");
    expect(parseIanaZone("Pacific/Auckland (+12:00)")).toBe("Pacific/Auckland");
    expect(parseIanaZone("")).toBe("Asia/Singapore");

    expect(normalizeTimezoneOption("UTC")).toBe("UTC (+00:00)");
    expect(normalizeTimezoneOption("Asia/Tokyo")).toBe("Asia/Tokyo (+09:00)");
    expect(normalizeTimezoneOption("Europe/London")).toBe("Europe/London (+00:00)");
    expect(normalizeTimezoneOption("America/New_York")).toBe("America/New_York (-05:00)");
    expect(normalizeTimezoneOption("Asia/Singapore")).toBe("Asia/Singapore (+08:00)");

    // Global timezone normalization
    expect(normalizeTimezoneOption("Australia/Sydney")).toContain("Australia/Sydney");
    expect(normalizeTimezoneOption("Asia/Dubai")).toContain("Asia/Dubai");
    expect(normalizeTimezoneOption("America/Los_Angeles")).toContain("America/Los_Angeles");
    expect(normalizeTimezoneOption(null)).toBe("Asia/Singapore (+08:00)");
  });
});

