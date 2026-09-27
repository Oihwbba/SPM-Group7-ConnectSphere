import { describe, it, expect } from "vitest";

import { parseRange } from "@/app/(app)/venues/availability/range";

// SCRUM-36 AC7 — "View can be filtered by date range."
describe("parseRange — the calendar's date range", () => {
  const today = "2035-03-10";

  it("SCRUM-36 AC7 — shows the range asked for", () => {
    expect(parseRange("2035-04-01", "2035-04-07", today)).toEqual({
      from: "2035-04-01",
      to: "2035-04-07",
    });
  });

  it("SCRUM-36 AC7 — with no range, shows two weeks from today", () => {
    expect(parseRange(undefined, undefined, today)).toEqual({
      from: "2035-03-10",
      to: "2035-03-23",
    });
  });

  it("SCRUM-36 AC7 — with only a start, shows two weeks from it", () => {
    expect(parseRange("2035-04-01", undefined, today)).toEqual({
      from: "2035-04-01",
      to: "2035-04-14",
    });
  });

  it("SCRUM-36 AC7 — a single day is a valid range", () => {
    expect(parseRange("2035-04-01", "2035-04-01", today)).toEqual({
      from: "2035-04-01",
      to: "2035-04-01",
    });
  });

  it("swaps an end before the start rather than showing nothing", () => {
    expect(parseRange("2035-04-07", "2035-04-01", today)).toEqual({
      from: "2035-04-01",
      to: "2035-04-07",
    });
  });

  it("cuts a range longer than 31 days to 31", () => {
    expect(parseRange("2035-04-01", "2035-12-31", today)).toEqual({
      from: "2035-04-01",
      to: "2035-05-01",
    });
  });

  it("ignores a malformed or impossible date", () => {
    expect(parseRange("nonsense", "2035-13-45", today)).toEqual({
      from: "2035-03-10",
      to: "2035-03-23",
    });
  });
});
