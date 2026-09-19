import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, formatTime } from "@/lib/datetime";

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
});
