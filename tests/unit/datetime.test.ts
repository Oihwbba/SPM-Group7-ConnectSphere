import { describe, it, expect, vi } from "vitest";
import {
  formatDate,
  formatMonth,
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
    expect(parseSingaporeDateTime("2026-09-22T")).toBeNull();
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

    expect(normalizeTimezoneOption("UTC")).toContain("UTC");
    expect(normalizeTimezoneOption("Asia/Tokyo")).toContain("Asia/Tokyo");
    expect(normalizeTimezoneOption("Europe/London")).toContain("Europe/London");
    expect(normalizeTimezoneOption("America/New_York")).toContain("America/New_York");
    expect(normalizeTimezoneOption("Asia/Singapore")).toContain("Asia/Singapore");

    // Global timezone normalization
    expect(normalizeTimezoneOption("Australia/Sydney")).toContain("Australia/Sydney");
    expect(normalizeTimezoneOption("Asia/Dubai")).toContain("Asia/Dubai");
    expect(normalizeTimezoneOption("America/Los_Angeles")).toContain("America/Los_Angeles");
    expect(normalizeTimezoneOption(null)).toContain("Asia/Singapore");
  });

  it("handles legacy formats, raw IANA IDs, substring heuristics, and invalid string fallbacks in parseIanaZone and normalizeTimezoneOption", () => {
    // Legacy format string
    expect(parseIanaZone("America/New_York (EST/EDT)")).toBe("America/New_York");
    // Raw IANA ID
    expect(parseIanaZone("Asia/Seoul")).toBe("Asia/Seoul");
    // Substring heuristic match
    expect(parseIanaZone("Tokyo Custom Region")).toBe("Asia/Tokyo");
    expect(parseIanaZone("London UK Base")).toBe("Europe/London");
    // Invalid / unrecognised string fallback to Singapore
    expect(parseIanaZone("invalid-timezone-string")).toBe("Asia/Singapore");

    // Normalization fallbacks
    expect(normalizeTimezoneOption("America/New_York (EST/EDT)")).toContain("America/New_York");
    expect(normalizeTimezoneOption("Asia/Seoul")).toContain("Asia/Seoul");
    expect(normalizeTimezoneOption("unrecognised-tz")).toContain("Asia/Singapore");
    expect(normalizeTimezoneOption(null)).toContain("Asia/Singapore");
  });

  it("covers the Intl.supportedValuesOf catch, UTC formatting and the unmapped normalize return", async () => {
    // 1. Line 23: Stub Intl.supportedValuesOf BEFORE module load using vi.resetModules
    const originalSupportedValuesOf = Intl.supportedValuesOf;
    try {
      vi.resetModules();
      (Intl as Record<string, unknown>).supportedValuesOf = () => {
        throw new Error("Not supported");
      };
      const datetimeModule = await import("@/lib/datetime");
      expect(datetimeModule.TIMEZONE_OPTIONS.map((o) => o.iana)).toEqual([
        "Asia/Singapore",
        "Asia/Tokyo",
        "Europe/London",
        "America/New_York",
        "UTC",
      ]);
    } finally {
      Intl.supportedValuesOf = originalSupportedValuesOf;
      vi.resetModules();
    }

    // Restore standard module
    const { formatDateTimeInTimezone: formatTz, normalizeTimezoneOption: normTz } = await import("@/lib/datetime");

    // 2. Formatting an instant in UTC. The GMT/UTC label branch of the option
    //    generator is pinned separately below, with a stubbed Intl.
    const utcFormatted = formatTz("2026-07-15T12:00:00.000Z", "UTC");
    expect(utcFormatted).toContain("12:00 pm");

    // 3. Line 138: Stored IANA timezone string absent from TIMEZONE_OPTIONS reaches return tz
    const unmappedResult = normTz("Africa/Asmara");
    expect(unmappedResult).toBe("Africa/Asmara");
  });

  // Which label ICU gives a zero offset ("GMT" or "GMT+0") differs between Node
  // versions, so both label shapes are pinned with a stub instead of relying on
  // whichever one the runtime happens to produce.
  it("SCRUM-13 [AC6 - Timezone]: labels a zero-offset zone +00:00 and leaves a zone with no offset name unlabelled", async () => {
    const RealDateTimeFormat = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      if (options?.timeZoneName === "shortOffset" && options.timeZone === "UTC") {
        return { formatToParts: () => [{ type: "timeZoneName", value: "GMT" }] };
      }
      if (options?.timeZoneName === "shortOffset" && options.timeZone === "Asia/Tokyo") {
        return { formatToParts: () => [] };
      }
      return new RealDateTimeFormat(locales, options);
    } as unknown as typeof Intl.DateTimeFormat);

    try {
      vi.resetModules();
      const { TIMEZONE_OPTIONS } = await import("@/lib/datetime");

      expect(TIMEZONE_OPTIONS.find((o) => o.iana === "UTC")).toEqual({
        value: "UTC (+00:00)",
        label: "UTC (UTC+00:00)",
        iana: "UTC",
      });
      expect(TIMEZONE_OPTIONS.find((o) => o.iana === "Asia/Tokyo")).toEqual({
        value: "Asia/Tokyo",
        label: "Asia/Tokyo",
        iana: "Asia/Tokyo",
      });
    } finally {
      spy.mockRestore();
      vi.resetModules();
    }
  });

  it("SCRUM-13 [AC6 - Timezone]: maps free-text New York and Singapore labels that name no IANA zone to their zone", () => {
    expect(parseIanaZone("New_York office")).toBe("America/New_York");
    expect(parseIanaZone("Singapore HQ")).toBe("Asia/Singapore");
  });

  it("SCRUM-13 [AC6 - Timezone]: an instant with no stored timezone is shown in Singapore time without a zone suffix", () => {
    const formatted = formatDateTimeInTimezone("2026-07-15T13:00:00.000Z", null);
    expect(formatted).toContain("9:00 pm");
    expect(formatted).not.toContain("(");
  });

  it("SCRUM-13 [AC6 - Timezone]: a wall-time with a date but no time is not converted", () => {
    expect(timezoneWallTimeToUtcIso("2026-07-15T")).toBeUndefined();
  });

  it("SCRUM-13 [AC6 - Timezone]: converts nothing when Intl returns no date parts, rather than building a date from zeros", () => {
    const spy = vi
      .spyOn(Intl.DateTimeFormat.prototype, "formatToParts")
      .mockReturnValue([]);
    try {
      expect(timezoneWallTimeToUtcIso("2026-07-15T09:00", "America/New_York")).toBeUndefined();
      expect(utcToTimezoneWallTime("2026-07-15T13:00:00.000Z", "America/New_York")).toBe("");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("formatMonth — SCRUM-50 calendar heading", () => {
  it("names the month in Singapore time, even when the UTC instant is still the previous month", () => {
    // 20:00 UTC on 31 Jan is 04:00 on 1 Feb in Singapore.
    expect(formatMonth("2035-01-31T20:00:00.000Z")).toBe("February 2035");
  });
});
