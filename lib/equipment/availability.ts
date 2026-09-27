/**
 * SCRUM-29 (check availability) and SCRUM-30 (view conflicts).
 *
 * The overlap rule itself lives in lib/period.ts, shared with venue bookings.
 * A period is half-open, `[startAt, endAt)`: a reservation that ends at
 * exactly the moment another begins does NOT overlap it. SCRUM-29, SCRUM-30
 * and SCRUM-31 all state this criterion, so they all call `overlaps` rather
 * than restating the comparison.
 *
 * WHY A PEAK AND NOT A SUM. Equipment is a counted pool, so what matters is
 * how many units are committed at the busiest single instant of the period —
 * not how many bookings happen to touch the period. Two reservations of three
 * units that do not overlap each other commit three units, not six, however
 * long the window asking about them is. Summing is the trap here: it is safe
 * in the sense that it never over-allocates, but it refuses reservations that
 * are genuinely free, which is SCRUM-29's "at or below the available quantity
 * for the whole period" read backwards.
 */

import { overlaps } from "@/lib/period";

/** A span of time that commits `quantity` units of one equipment type. */
export interface Commitment {
  startAt: Date;
  endAt: Date;
  quantity: number;
}

export { overlaps };

/**
 * The greatest number of units committed at any single instant inside
 * `[windowStart, windowEnd)`.
 *
 * The committed total only ever rises at the moment a commitment starts, so
 * it is enough to evaluate the window's own start and each commitment's start
 * that falls inside it. The input is one equipment type's commitments and is
 * measured in tens, so the straightforward O(n²) sweep is the readable choice.
 */
export function peakCommitted(
  commitments: Commitment[],
  windowStart: Date,
  windowEnd: Date,
): number {
  const window = { startAt: windowStart, endAt: windowEnd };
  const relevant = commitments.filter((c) => overlaps(c, window));
  if (relevant.length === 0) return 0;

  const instants = [
    windowStart,
    ...relevant
      .map((c) => c.startAt)
      .filter((start) => start > windowStart && start < windowEnd),
  ];

  let peak = 0;
  for (const instant of instants) {
    let committed = 0;
    for (const c of relevant) {
      if (c.startAt <= instant && c.endAt > instant) committed += c.quantity;
    }
    if (committed > peak) peak = committed;
  }
  return peak;
}

export interface Availability {
  total: number;
  available: number;
  /** Units committed at the busiest instant of the period. */
  committed: number;
}

/**
 * SCRUM-29 — what is free for the whole of `[startAt, endAt)`.
 *
 * Reservations and unavailability draw on the same pool, so they are weighed
 * together: five units reserved and three in for repair at the same moment
 * commit eight.
 */
export function summariseAvailability({
  total,
  reservations,
  unavailability,
  startAt,
  endAt,
}: {
  total: number;
  reservations: Commitment[];
  unavailability: Commitment[];
  startAt: Date;
  endAt: Date;
}): Availability {
  const committed = peakCommitted(
    [...reservations, ...unavailability],
    startAt,
    endAt,
  );
  return { total, committed, available: Math.max(0, total - committed) };
}

export interface AvailabilityVerdict extends Availability {
  requested: number;
  sufficient: boolean;
  /** How many units short, 0 when the request fits. */
  shortfall: number;
}

/**
 * SCRUM-29 — the answer to "can we fulfil this?", stated on both sides: the
 * accepted case reports what is free, the refused case reports the shortfall.
 */
export function checkQuantity(
  availability: Availability,
  requested: number,
): AvailabilityVerdict {
  const shortfall = Math.max(0, requested - availability.available);
  return {
    ...availability,
    requested,
    sufficient: shortfall === 0,
    shortfall,
  };
}

/** One row of an equipment item's schedule (SCRUM-30). */
export interface ScheduleEntry {
  id: string;
  kind: "reservation" | "unavailability";
  startAt: Date;
  endAt: Date;
  quantity: number;
  /** The event a reservation is committed to; null for unavailability. */
  eventName: string | null;
  /** Why the units are out of the pool; null for a reservation. */
  reason: string | null;
  note: string | null;
}

/**
 * SCRUM-30 — which commitments share time with the requested period.
 *
 * `during` is exactly the set that `summariseAvailability` weighs for that
 * period, because both use `overlaps`: a commitment that only touches the
 * period at an endpoint is in `other` and does not reduce what is free. With
 * no valid period yet, nothing can be "during" it, so everything is `other`.
 * Order is preserved, so a sorted schedule splits into two sorted lists.
 */
export function splitByPeriod<T extends { startAt: Date; endAt: Date }>(
  entries: T[],
  period: { startAt: Date; endAt: Date } | null,
): { during: T[]; other: T[] } {
  const during: T[] = [];
  const other: T[] = [];
  for (const entry of entries) {
    (period && overlaps(entry, period) ? during : other).push(entry);
  }
  return { during, other };
}

/**
 * SCRUM-30 — how commitments during the requested period are shown.
 *
 * Amber while the requested quantity still fits: they reduce what is free but
 * are not a problem. Red only when the request exceeds what is free — the one
 * case the story calls a hard conflict. With no verdict yet (no valid quantity
 * or no availability loaded) they are amber, because nothing has been shown to
 * be short. Commitments outside the period are never toned; they are neutral
 * even when they overlap one another.
 */
export function requestedPeriodTone(
  verdict: Pick<AvailabilityVerdict, "sufficient"> | null,
): "amber" | "red" {
  return verdict && !verdict.sufficient ? "red" : "amber";
}

/** Chronological, earliest first; ties broken by id so the order is stable. */
export function sortSchedule<T extends ScheduleEntry>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) =>
      a.startAt.getTime() - b.startAt.getTime() ||
      a.endAt.getTime() - b.endAt.getTime() ||
      a.id.localeCompare(b.id),
  );
}
