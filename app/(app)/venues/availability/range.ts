import { addDays } from "@/lib/venue-availability";

/** Two weeks, starting today, when no range is given. */
export const DEFAULT_RANGE_DAYS = 14;
/** The longest range the calendar will draw in one go. */
export const MAX_RANGE_DAYS = 31;

const isDay = (value: string | undefined): value is string =>
  !!value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/**
 * SCRUM-36 AC7 — the date range to show, read from the page's address.
 * Anything missing or malformed falls back to the next two weeks; an end
 * before the start is swapped rather than refused; a range longer than
 * MAX_RANGE_DAYS is cut to that length.
 */
export function parseRange(
  from: string | undefined,
  to: string | undefined,
  today: string,
): { from: string; to: string } {
  let start = isDay(from) ? from : today;
  let end = isDay(to) ? to : addDays(start, DEFAULT_RANGE_DAYS - 1);
  if (end < start) [start, end] = [end, start];
  const last = addDays(start, MAX_RANGE_DAYS - 1);
  return { from: start, to: end > last ? last : end };
}
