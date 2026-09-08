/**
 * The one place datetimes are formatted for display.
 *
 * Rule for the whole codebase: datetimes are stored in UTC (Prisma gives us
 * `Date` objects that are UTC instants) and displayed in Asia/Singapore. Never
 * call `toLocaleString` ad hoc in a component — the server and the browser may
 * be in different timezones, which causes hydration mismatches. Use these.
 */

const TIME_ZONE = "Asia/Singapore";

const dateTimeFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  dateStyle: "medium",
});

/** e.g. "15 Jan 2026, 10:00 am" — a date and time in Singapore time. */
export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

/** e.g. "15 Jan 2026" — a date only, in Singapore time. */
export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}
