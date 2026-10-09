import {
  formatDate,
  formatDayMonth,
  parseSingaporeDateTime,
} from "@/lib/datetime";
import { addDays, startOfWeek } from "@/lib/venue-availability";

const isDay = (value: string | undefined): value is string =>
  !!value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Noon on a Singapore day, so formatting never slips to the day before. */
const noon = (day: string) => parseSingaporeDateTime(`${day}T12:00`)!;

/**
 * SCRUM-36 AC1 — the week the calendar shows, read from the page's address:
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

/**
 * The week as a short label, naming the month and year once where they are
 * shared: "12 – 18 Oct 2026", "28 Sept – 4 Oct 2026",
 * "29 Dec 2025 – 4 Jan 2026".
 */
export function formatWeekRange(from: string, to: string): string {
  const end = formatDate(noon(to));
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${Number(from.slice(8))} – ${end}`;
  }
  if (from.slice(0, 4) === to.slice(0, 4)) {
    return `${formatDayMonth(noon(from))} – ${end}`;
  }
  return `${formatDate(noon(from))} – ${end}`;
}
