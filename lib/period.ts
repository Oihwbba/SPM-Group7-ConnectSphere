/**
 * THE overlap rule, stated once for the whole system. Venue bookings
 * (SCRUM-50/53), venue availability (SCRUM-36/37) and equipment
 * (SCRUM-29/30/31) all ask "do these two periods overlap?", and they must all
 * get the same answer — otherwise the search says a venue is free while the
 * booking form says it is taken.
 *
 * A period runs from `startAt` INCLUSIVE to `endAt` EXCLUSIVE: `[startAt, endAt)`.
 * Two periods overlap when each begins before the other ends, so a 2pm–4pm
 * booking and a 4pm–6pm booking touch but do not overlap. The database's
 * `tsrange(startAt, endAt, '[)')` exclusion constraint on Booking uses the same
 * bounds, so the application and the database cannot disagree.
 */

export interface Period {
  startAt: Date;
  endAt: Date;
}

/**
 * A period whose end is earlier than or equal to its start is not a period.
 * Callers refuse it before doing anything else (SCRUM-50 AC5).
 */
export function isValidPeriod(period: Period): boolean {
  const start = period.startAt.getTime();
  const end = period.endAt.getTime();
  return !Number.isNaN(start) && !Number.isNaN(end) && end > start;
}

/** Half-open comparison: touching at an endpoint is adjacent, not overlapping. */
export function overlaps(a: Period, b: Period): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

/**
 * The same rule as a Prisma `where` fragment, for loading only the rows that
 * overlap `period`. Kept beside `overlaps` so the two cannot drift apart.
 */
export function overlapping(period: Period) {
  return { startAt: { lt: period.endAt }, endAt: { gt: period.startAt } };
}
