import { describe, it, expect } from "vitest";

import { monthGrid } from "@/app/(app)/bookings/new/date-picker";

// SCRUM-50 — the in-app calendar the Request Venue form opens for its dates.
describe("monthGrid", () => {
  it("lays a month out in Monday-first weeks, with blanks before the 1st", () => {
    // 1 March 2035 is a Thursday: three blanks (Mo, Tu, We) come first.
    const cells = monthGrid(2035, 2);
    expect(cells.slice(0, 4)).toEqual([null, null, null, "2035-03-01"]);
    expect(cells).toContain("2035-03-31");
    expect(cells.length % 7).toBe(0);
  });

  it("starts a month that begins on a Monday with no blanks", () => {
    expect(monthGrid(2035, 9)[0]).toBe("2035-10-01");
  });

  it("knows February's length, including leap years", () => {
    const days = (y: number) => monthGrid(y, 1).filter(Boolean).at(-1);
    expect(days(2035)).toBe("2035-02-28");
    expect(days(2036)).toBe("2036-02-29");
  });
});
