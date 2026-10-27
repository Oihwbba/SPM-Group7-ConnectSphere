/**
 * The one place datetimes are formatted for display.
 *
 * Rule for the whole codebase: datetimes are stored in UTC (Prisma gives us
 * `Date` objects that are UTC instants) and displayed in Asia/Singapore. Never
 * call `toLocaleString` ad hoc in a component — the server and the browser may
 * be in different timezones, which causes hydration mismatches. Use these.
 *
 * SCRUM-129: every event is entered and shown in Singapore time, whatever
 * timezone an older event was saved with, and every displayed time is
 * labelled "SGT" so nobody reads it on another clock.
 */

/** The only timezone events are entered and displayed in (SCRUM-129 AC1). */
export const TIME_ZONE = "Asia/Singapore";

/** The label every displayed time carries (SCRUM-129 AC3). */
export const TIME_ZONE_LABEL = "SGT";

// Singapore has kept UTC+8 all year since 1982, with no daylight saving, so a
// fixed offset converts wall time both ways.
const SG_OFFSET_MS = 8 * 60 * 60 * 1000;

const dateTimeFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  dateStyle: "medium",
});

const monthFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  month: "long",
  year: "numeric",
});

const dayMonthFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});

const weekdayDateFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  timeStyle: "short",
});

/** e.g. "15 Jan 2026, 10:00 am SGT" — a date and time in Singapore time. */
export function formatDateTime(value: Date | string): string {
  return `${dateTimeFormatter.format(new Date(value))} ${TIME_ZONE_LABEL}`;
}

/** e.g. "January 2026" — a calendar month's heading, in Singapore time. */
export function formatMonth(value: Date | string): string {
  return monthFormatter.format(new Date(value));
}

/** e.g. "15 Jan" — a day and month without the year, in Singapore time. */
export function formatDayMonth(value: Date | string): string {
  return dayMonthFormatter.format(new Date(value));
}

/** e.g. "Thu, 15 Jan 2026" — a day heading, in Singapore time. */
export function formatWeekdayDate(value: Date | string): string {
  return weekdayDateFormatter.format(new Date(value));
}

/** e.g. "15 Jan 2026" — a date only, in Singapore time. */
export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

/** e.g. "10:00 am SGT" — a time only, in Singapore time. */
export function formatTime(value: Date | string): string {
  return `${timeFormatter.format(new Date(value))} ${TIME_ZONE_LABEL}`;
}

/**
 * An event's date with its start and end time (SCRUM-72 AC2, SCRUM-76 AC1),
 * e.g. "15 Jan 2026, 10:00 am SGT – 4:00 pm SGT", or the full end date when
 * the event ends on a later day.
 */
export function formatEventTime(
  startAt: Date | null,
  endAt: Date | null,
): string {
  if (!startAt) return "Date to be confirmed";
  if (!endAt) return formatDateTime(startAt);
  const end =
    formatDate(startAt) === formatDate(endAt)
      ? formatTime(endAt)
      : formatDateTime(endAt);
  return `${formatDateTime(startAt)} – ${end}`;
}

/**
 * Parse a naive "YYYY-MM-DDTHH:mm" wall-time string as an Asia/Singapore (+08:00) instant.
 * ConnectSphere treats all user-entered wall-clock dates and times as Singapore time.
 */
export function parseSingaporeDateTime(value: string): Date | null {
  if (!value || !value.includes("T") || value.startsWith("T")) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.slice(0, 5).split(":").map(Number);
  if (
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d) ||
    Number.isNaN(h) ||
    Number.isNaN(min)
  ) {
    return null;
  }
  return new Date(Date.UTC(y, m - 1, d, h - 8, min, 0));
}

/**
 * Converts a naive "YYYY-MM-DDTHH:mm" wall-time string entered in Asia/Singapore time
 * into a UTC ISO string ("...Z") for server storage.
 */
export function sgWallTimeToUtcIso(localValue: string): string | undefined {
  if (!localValue) return undefined;
  const d = parseSingaporeDateTime(localValue);
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
}

/**
 * Format a UTC instant as the Singapore wall time "YYYY-MM-DDTHH:mm" a
 * datetime-local input expects.
 */
export function utcToSgWallTime(
  value: Date | string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + SG_OFFSET_MS).toISOString().slice(0, 16);
}

/** The Singapore calendar date, "YYYY-MM-DD", an instant falls on. */
export function sgDate(value: Date | string): string {
  return utcToSgWallTime(value).slice(0, 10);
}

/** The three fields an event's period is entered as (SCRUM-190 AC1). */
export type EventPeriodFields = {
  date: string;
  startTime: string;
  endTime: string;
};

/**
 * SCRUM-190 AC1 — a stored period as the request form's one date and two
 * times, in Singapore time. The date is the start's.
 */
export function splitEventPeriod(
  startAt: Date | string | null | undefined,
  endAt: Date | string | null | undefined,
): EventPeriodFields {
  const start = utcToSgWallTime(startAt);
  const end = utcToSgWallTime(endAt);
  return {
    date: start.slice(0, 10) || end.slice(0, 10),
    startTime: start.slice(11, 16),
    endTime: end.slice(11, 16),
  };
}

/**
 * SCRUM-190 AC1 — the one date and two times as UTC ISO instants. A time
 * without the date, or the date without that time, gives no instant.
 */
export function joinEventPeriod({ date, startTime, endTime }: EventPeriodFields): {
  startAt?: string;
  endAt?: string;
} {
  return {
    startAt: date && startTime ? sgWallTimeToUtcIso(`${date}T${startTime}`) : undefined,
    endAt: date && endTime ? sgWallTimeToUtcIso(`${date}T${endTime}`) : undefined,
  };
}
