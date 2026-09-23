import { describe, it, expect } from "vitest";

import {
  checkQuantity,
  markConflicts,
  overlaps,
  peakCommitted,
  sortSchedule,
  summariseAvailability,
  type ScheduleEntry,
} from "@/lib/equipment/availability";

// SCRUM-29 (check availability) and SCRUM-30 (view conflicts). The overlap
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

describe("markConflicts — SCRUM-30", () => {
  const entry = (
    id: string,
    from: number,
    to: number,
    quantity: number,
    extra: Partial<ScheduleEntry> = {},
  ): ScheduleEntry => ({
    id,
    kind: "reservation",
    startAt: at(from),
    endAt: at(to),
    quantity,
    eventName: `Event ${id}`,
    reason: null,
    note: null,
    ...extra,
  });

  it("flags two reservations that share time, naming each other", () => {
    const [a, b] = markConflicts([entry("a", 9, 12, 1), entry("b", 11, 13, 1)], 10);

    expect(a.hasConflict).toBe(true);
    expect(a.conflictsWith).toEqual(["b"]);
    expect(b.conflictsWith).toEqual(["a"]);
  });

  it("does NOT flag reservations that touch at an endpoint", () => {
    const marked = markConflicts([entry("a", 9, 12, 1), entry("b", 12, 15, 1)], 10);

    expect(marked.every((row) => row.hasConflict)).toBe(false);
    expect(marked.flatMap((row) => row.conflictsWith)).toEqual([]);
  });

  // Overlapping is worth showing; over-committed is the actual fault. A pool
  // of ten carrying two overlapping reservations of two is fine.
  it("separates a harmless overlap from one that oversubscribes the pool", () => {
    const fine = markConflicts([entry("a", 9, 12, 2), entry("b", 10, 13, 2)], 10);
    expect(fine.every((row) => row.hasConflict)).toBe(true);
    expect(fine.every((row) => row.overCommitted)).toBe(false);

    const broken = markConflicts([entry("a", 9, 12, 6), entry("b", 10, 13, 6)], 10);
    expect(broken.every((row) => row.overCommitted)).toBe(true);
    expect(broken[0].committedDuringEntry).toBe(12);
  });

  it("carries the reason and duration of unavailability through (SCRUM-30)", () => {
    const [row] = markConflicts(
      [
        entry("u", 9, 17, 3, {
          kind: "unavailability",
          eventName: null,
          reason: "MAINTENANCE",
          note: "Annual service",
        }),
      ],
      10,
    );

    expect(row).toMatchObject({
      kind: "unavailability",
      reason: "MAINTENANCE",
      note: "Annual service",
      quantity: 3,
      hasConflict: false,
    });
    expect(row.endAt.getTime() - row.startAt.getTime()).toBe(8 * 3600_000);
  });

  it("marks a lone entry as conflict-free", () => {
    expect(markConflicts([entry("a", 9, 12, 1)], 10)[0]).toMatchObject({
      hasConflict: false,
      conflictsWith: [],
      overCommitted: false,
    });
  });
});

describe("sortSchedule", () => {
  it("orders chronologically and stays stable when two start together", () => {
    const rows = markConflicts(
      [
        {
          id: "late",
          kind: "reservation",
          startAt: at(15),
          endAt: at(16),
          quantity: 1,
          eventName: null,
          reason: null,
          note: null,
        },
        {
          id: "b",
          kind: "reservation",
          startAt: at(9),
          endAt: at(12),
          quantity: 1,
          eventName: null,
          reason: null,
          note: null,
        },
        {
          id: "a",
          kind: "reservation",
          startAt: at(9),
          endAt: at(12),
          quantity: 1,
          eventName: null,
          reason: null,
          note: null,
        },
      ],
      10,
    );

    expect(sortSchedule(rows).map((row) => row.id)).toEqual(["a", "b", "late"]);
  });
});
