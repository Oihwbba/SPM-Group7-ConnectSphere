import { describe, it, expect } from "vitest";

import { isValidPeriod, overlapping, overlaps } from "@/lib/period";

// The one overlap rule (lib/period.ts). Pure: no mocks, no database. The
// database-enforced half of the rule is proven in
// tests/integration/bookings.test.ts.
const day = "2030-06-01";
const at = (hhmm: string) => new Date(`${day}T${hhmm}:00.000Z`);
const period = (start: string, end: string) => ({
  startAt: at(start),
  endAt: at(end),
});

describe("overlaps — SCRUM-50 AC3 / SCRUM-53 AC5, AC8: overlapping periods conflict", () => {
  it("SCRUM-50 AC3 — periods that clearly overlap conflict, whichever is asked about first", () => {
    expect(overlaps(period("14:00", "16:00"), period("15:00", "17:00"))).toBe(
      true,
    );
    expect(overlaps(period("15:00", "17:00"), period("14:00", "16:00"))).toBe(
      true,
    );
  });

  it("SCRUM-50 AC3 — a period entirely inside another conflicts, both ways round", () => {
    expect(overlaps(period("09:00", "18:00"), period("12:00", "13:00"))).toBe(
      true,
    );
    expect(overlaps(period("12:00", "13:00"), period("09:00", "18:00"))).toBe(
      true,
    );
  });

  it("SCRUM-50 AC3 — identical periods conflict", () => {
    expect(overlaps(period("14:00", "16:00"), period("14:00", "16:00"))).toBe(
      true,
    );
  });

  it("SCRUM-50 AC3 — periods sharing a start but ending differently conflict", () => {
    expect(overlaps(period("14:00", "15:00"), period("14:00", "18:00"))).toBe(
      true,
    );
  });

  it("SCRUM-50 AC3 — a one-minute overlap is still an overlap", () => {
    expect(overlaps(period("14:00", "16:01"), period("16:00", "18:00"))).toBe(
      true,
    );
  });
});

describe("overlaps — SCRUM-50 AC4 / SCRUM-53 AC6: touching periods do not conflict", () => {
  it("SCRUM-50 AC4 — a period beginning exactly as another ends does not conflict", () => {
    expect(overlaps(period("14:00", "16:00"), period("16:00", "18:00"))).toBe(
      false,
    );
  });

  it("SCRUM-50 AC4 — a period ending exactly as another begins does not conflict", () => {
    expect(overlaps(period("16:00", "18:00"), period("14:00", "16:00"))).toBe(
      false,
    );
  });

  it("SCRUM-50 AC4 — separate periods with a gap between them do not conflict", () => {
    expect(overlaps(period("09:00", "10:00"), period("11:00", "12:00"))).toBe(
      false,
    );
  });
});

describe("isValidPeriod — SCRUM-50 AC5: an end at or before the start is invalid", () => {
  it("SCRUM-50 AC5 — an end before the start is invalid", () => {
    expect(isValidPeriod(period("16:00", "14:00"))).toBe(false);
  });

  it("SCRUM-50 AC5 — an end equal to the start is invalid", () => {
    expect(isValidPeriod(period("14:00", "14:00"))).toBe(false);
  });

  it("SCRUM-50 AC5 — an end one minute after the start is valid", () => {
    expect(isValidPeriod(period("14:00", "14:01"))).toBe(true);
  });

  it("SCRUM-50 AC5 — an unparseable date is invalid", () => {
    expect(
      isValidPeriod({ startAt: new Date("nonsense"), endAt: at("14:00") }),
    ).toBe(false);
    expect(
      isValidPeriod({ startAt: at("14:00"), endAt: new Date("nonsense") }),
    ).toBe(false);
  });
});

describe("overlapping — the same rule as a database filter", () => {
  it("selects rows that start before the period ends and end after it starts (strict, so touching rows are excluded)", () => {
    const p = period("14:00", "16:00");
    expect(overlapping(p)).toEqual({
      startAt: { lt: p.endAt },
      endAt: { gt: p.startAt },
    });
  });
});

describe("SCRUM-129 [AC5 - One period convention]: a period includes its start and excludes its end", () => {
  it("SCRUM-129 [AC5 - One period convention]: periods that only touch do not overlap, in either order", () => {
    expect(overlaps(period("09:00", "13:00"), period("13:00", "17:00"))).toBe(false);
    expect(overlaps(period("13:00", "17:00"), period("09:00", "13:00"))).toBe(false);
  });

  it("SCRUM-129 [AC5 - One period convention]: the start instant is inside the period and the end instant is not", () => {
    const booked = period("09:00", "13:00");
    const instant = (hhmm: string) => ({ startAt: at(hhmm), endAt: new Date(at(hhmm).getTime() + 1) });
    expect(overlaps(booked, instant("09:00"))).toBe(true);
    expect(overlaps(booked, instant("13:00"))).toBe(false);
  });

  it("SCRUM-129 [AC5 - One period convention]: the database filter uses the same bounds", () => {
    expect(overlapping(period("09:00", "13:00"))).toEqual({
      startAt: { lt: at("13:00") },
      endAt: { gt: at("09:00") },
    });
  });
});
