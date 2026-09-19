import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateTime,
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
});

