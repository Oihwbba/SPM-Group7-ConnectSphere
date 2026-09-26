import { describe, it, expect } from "vitest";

import {
  checkQuantity,
  overlaps,
  peakCommitted,
  requestedPeriodTone,
  sortSchedule,
  splitByPeriod,
  summariseAvailability,
  type ScheduleEntry,
} from "@/lib/equipment/availability";

// SCRUM-29 (check availability) and SCRUM-30 (commitments by requested period). The overlap
// rule is half-open and is stated in one place; these tests pin both the rule
// and the counted-pool arithmetic that depends on it.

const at = (hour: number) => new Date(Date.UTC(2026, 9, 1, hour));
const span = (from: number, to: number, quantity = 1) => ({
  startAt: at(from),
  endAt: at(to),
  quantity,
});

describe("overlaps — the endpoint rule (SCRUM-29/30/31)", () => {
  it("does not treat periods that touch at an endpoint as overlapping", () => {
    expect(overlaps(span(9, 11), span(11, 13))).toBe(false);
    expect(overlaps(span(11, 13), span(9, 11))).toBe(false);
  });

  it("treats any shared instant as an overlap, in either order", () => {
    expect(overlaps(span(9, 12), span(11, 13))).toBe(true);
    expect(overlaps(span(11, 13), span(9, 12))).toBe(true);
    // Fully contained.
    expect(overlaps(span(9, 17), span(11, 12))).toBe(true);
  });
});

describe("peakCommitted — busiest instant, not the sum (SCRUM-29)", () => {
  // The bug this replaces: summing everything that touches the window said
  // six units were committed across a day when only three ever were at once.
  it("counts back-to-back commitments once, not twice", () => {
    const morning = span(9, 12, 3);
    const afternoon = span(12, 17, 3);

    expect(peakCommitted([morning, afternoon], at(9), at(17))).toBe(3);
  });

  it("adds commitments that genuinely share an instant", () => {
    expect(peakCommitted([span(9, 12, 3), span(11, 13, 2)], at(9), at(13))).toBe(
      5,
    );
  });

  it("ignores commitments outside the window, including ones that only touch it", () => {
    expect(peakCommitted([span(6, 9, 4)], at(9), at(12))).toBe(0);
    expect(peakCommitted([span(12, 15, 4)], at(9), at(12))).toBe(0);
    expect(peakCommitted([], at(9), at(12))).toBe(0);
  });

  it("finds a peak that starts partway through the window", () => {
    const entries = [span(8, 18, 1), span(10, 11, 5), span(10, 11, 2)];

    expect(peakCommitted(entries, at(9), at(17))).toBe(8);
  });
});

describe("summariseAvailability — reservations and repairs share one pool", () => {
  it("weighs reservations and unavailability together at the same instant", () => {
    const result = summariseAvailability({
      total: 10,
      reservations: [span(9, 12, 5)],
      unavailability: [span(9, 12, 3)],
      startAt: at(9),
      endAt: at(12),
    });

    expect(result).toEqual({ total: 10, committed: 8, available: 2 });
  });

  it("frees a reservation that ends exactly when the requested period starts", () => {
    const result = summariseAvailability({
      total: 4,
      reservations: [span(7, 9, 4)],
      unavailability: [],
      startAt: at(9),
      endAt: at(11),
    });

    expect(result.available).toBe(4);
  });

  it("never reports a negative pool when more is committed than exists", () => {
    const result = summariseAvailability({
      total: 2,
      reservations: [span(9, 12, 3)],
      unavailability: [],
      startAt: at(9),
      endAt: at(12),
    });

    expect(result).toEqual({ total: 2, committed: 3, available: 0 });
  });
});

describe("checkQuantity — an answer on both sides (SCRUM-29)", () => {
  const availability = { total: 10, committed: 7, available: 3 };

  it("accepts a quantity at the limit and reports no shortfall", () => {
    expect(checkQuantity(availability, 3)).toMatchObject({
      sufficient: true,
      shortfall: 0,
      requested: 3,
      available: 3,
    });
  });

  it("refuses a quantity over the limit and states how many short", () => {
    expect(checkQuantity(availability, 5)).toMatchObject({
      sufficient: false,
      shortfall: 2,
      requested: 5,
    });
  });
});

const entry = (
  id: string,
  from: number,
  to: number,
  extra: Partial<ScheduleEntry> = {},
): ScheduleEntry => ({
  id,
  kind: "reservation",
  startAt: at(from),
  endAt: at(to),
  quantity: 1,
  eventName: `Event ${id}`,
  reason: null,
  note: null,
  ...extra,
});

describe("splitByPeriod — SCRUM-30", () => {
  const period = { startAt: at(9), endAt: at(12) };

  it("AC 8: puts commitments that share time with the requested period under it", () => {
    const inside = entry("inside", 10, 11);
    const straddlingStart = entry("start", 8, 10);
    const straddlingEnd = entry("end", 11, 14);
    const covering = entry("cover", 6, 18);

    const { during, other } = splitByPeriod(
      [inside, straddlingStart, straddlingEnd, covering],
      period,
    );

    expect(during.map((e) => e.id)).toEqual(["inside", "start", "end", "cover"]);
    expect(other).toEqual([]);
  });

  it("AC 3 & 9: a commitment that only touches the period at an endpoint is an other commitment", () => {
    const endsAtStart = entry("before", 6, 9);
    const startsAtEnd = entry("after", 12, 15);

    const { during, other } = splitByPeriod([endsAtStart, startsAtEnd], period);

    expect(during).toEqual([]);
    expect(other.map((e) => e.id)).toEqual(["before", "after"]);
  });

  it("AC 9: commitments wholly outside the period are other commitments, even if they overlap each other", () => {
    const early = entry("early", 13, 16);
    const clashing = entry("clash", 14, 17);
    const inside = entry("inside", 10, 11);

    const { during, other } = splitByPeriod([inside, early, clashing], period);

    expect(during.map((e) => e.id)).toEqual(["inside"]);
    expect(other.map((e) => e.id)).toEqual(["early", "clash"]);
  });

  it("puts everything under other commitments while there is no valid period", () => {
    const rows = [entry("a", 9, 12), entry("b", 13, 14)];

    expect(splitByPeriod(rows, null)).toEqual({ during: [], other: rows });
  });

  // The split must agree with the availability number above it: whatever is
  // "during" is exactly what summariseAvailability weighs for the period.
  it("splits on the same rule the requested-period availability is computed from", () => {
    const rows = [entry("a", 6, 9, { quantity: 4 }), entry("b", 10, 11, { quantity: 3 })];

    const { during } = splitByPeriod(rows, period);
    const availability = summariseAvailability({
      total: 4,
      reservations: rows,
      unavailability: [],
      startAt: period.startAt,
      endAt: period.endAt,
    });

    expect(during.reduce((sum, e) => sum + e.quantity, 0)).toBe(availability.committed);
  });

  it("keeps the schedule's order within each list", () => {
    const rows = sortSchedule([entry("c", 14, 15), entry("a", 10, 11), entry("b", 11, 12)]);

    const { during, other } = splitByPeriod(rows, period);

    expect(during.map((e) => e.id)).toEqual(["a", "b"]);
    expect(other.map((e) => e.id)).toEqual(["c"]);
  });
});

describe("requestedPeriodTone — SCRUM-30", () => {
  it("AC 2: amber while the requested quantity can still be fulfilled", () => {
    expect(requestedPeriodTone({ sufficient: true })).toBe("amber");
  });

  it("AC 4 & 7: red only when the requested quantity exceeds what is free", () => {
    expect(requestedPeriodTone({ sufficient: false })).toBe("red");
  });

  // Nothing has been shown to be short yet — no valid quantity, or no
  // availability loaded — so the commitments are not flagged as a conflict.
  it("amber when there is no verdict yet", () => {
    expect(requestedPeriodTone(null)).toBe("amber");
  });

  it("agrees with checkQuantity at the boundary: exactly the free quantity is amber, one more is red", () => {
    const availability = { total: 4, committed: 1, available: 3 };

    expect(requestedPeriodTone(checkQuantity(availability, 3))).toBe("amber");
    expect(requestedPeriodTone(checkQuantity(availability, 4))).toBe("red");
  });
});

describe("sortSchedule", () => {
  it("orders chronologically, then by end, and stays stable when two rows are identical in time", () => {
    const rows = [
      entry("late", 15, 16),
      entry("b", 9, 12),
      entry("short", 9, 10),
      entry("a", 9, 12),
    ];

    expect(sortSchedule(rows).map((e) => e.id)).toEqual(["short", "a", "b", "late"]);
  });

  it("does not reorder the list it was given", () => {
    const rows = [entry("b", 12, 13), entry("a", 9, 10)];

    sortSchedule(rows);

    expect(rows.map((e) => e.id)).toEqual(["b", "a"]);
  });
});
