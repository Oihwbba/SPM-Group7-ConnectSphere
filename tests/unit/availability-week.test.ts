import { describe, it, expect } from "vitest";

import { parseWeek } from "@/app/(app)/venues/availability/week";
import { startOfWeek } from "@/lib/venue-availability";

// SCRUM-36 AC7 — "View can be filtered by date range." The calendar shows one
// week, Monday to Sunday, and can be moved to any week.
describe("the calendar's week", () => {
  const today = "2035-03-14"; // a Wednesday

  it("SCRUM-36 AC7 — with no week asked for, shows this week, Monday to Sunday", () => {
    expect(parseWeek(undefined, today)).toEqual({
      from: "2035-03-12",
      to: "2035-03-18",
    });
  });

  it("SCRUM-36 AC7 — any date shows the week containing it", () => {
    expect(parseWeek("2036-02-01", today)).toEqual({
      from: "2036-01-28",
      to: "2036-02-03",
    });
  });

  it("SCRUM-36 AC7 — a Monday starts its own week and a Sunday ends it", () => {
    expect(startOfWeek("2036-01-28")).toBe("2036-01-28");
    expect(startOfWeek("2036-02-03")).toBe("2036-01-28");
  });

  it("walks back across a month and year end", () => {
    expect(startOfWeek("2036-01-01")).toBe("2035-12-31");
  });

  it("ignores a malformed or impossible date", () => {
    expect(parseWeek("nonsense", today).from).toBe("2035-03-12");
    expect(parseWeek("2035-13-45", today).from).toBe("2035-03-12");
  });
});
