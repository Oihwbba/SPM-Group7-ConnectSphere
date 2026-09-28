import { addDays, startOfWeek } from "@/lib/venue-availability";

const isDay = (value: string | undefined): value is string =>
  !!value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/**
 * SCRUM-36 AC7 — the week the calendar shows, read from the page's address:
 * Monday to Sunday of the week containing `week`, or this week when it is
 * missing or malformed.
 */
export function parseWeek(
  week: string | undefined,
  today: string,
): { from: string; to: string } {
  const from = startOfWeek(isDay(week) ? week : today);
  return { from, to: addDays(from, 6) };
}
