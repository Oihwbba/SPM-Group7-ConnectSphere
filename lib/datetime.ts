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

const timeFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  timeStyle: "short",
});

/** e.g. "15 Jan 2026, 10:00 am" — a date and time in Singapore time. */
export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

/** e.g. "15 Jan 2026" — a date only, in Singapore time. */
export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

/** e.g. "10:00 am" — a time only, in Singapore time. */
export function formatTime(value: Date | string): string {
  return timeFormatter.format(new Date(value));
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
 * Convert a naive "YYYY-MM-DDTHH:mm" wall-time string in a specified IANA timezone
 * to a UTC ISO string ("...Z"). Handles Daylight Saving Time (DST) accurately via Intl.
 */
export function timezoneWallTimeToUtcIso(
  localValue: string | null | undefined,
  timeZone: string = "Asia/Singapore",
): string | undefined {
  if (!localValue || !localValue.includes("T")) return undefined;
  const [datePart, timePart] = localValue.split("T");
  if (!datePart || !timePart) return undefined;
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.slice(0, 5).split(":").map(Number);
  if (
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d) ||
    Number.isNaN(h) ||
    Number.isNaN(min)
  ) {
    return undefined;
  }

  // Create a UTC target date first
  const targetUtcDate = new Date(Date.UTC(y, m - 1, d, h, min, 0));

  // Determine actual offset for the specific target date in the specified IANA timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(targetUtcDate);
  const getPart = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const tzY = getPart("year");
  const tzM = getPart("month");
  const tzD = getPart("day");
  const tzH = getPart("hour");
  const tzMin = getPart("minute");

  const asTzUtc = Date.UTC(tzY, tzM - 1, tzD, tzH, tzMin, 0);
  const offsetMs = asTzUtc - targetUtcDate.getTime();

  // Subtract offset to reach the exact UTC instant matching the wall time in that timezone
  const finalUtcDate = new Date(targetUtcDate.getTime() - offsetMs);
  return finalUtcDate.toISOString();
}

/**
 * Format a Date or ISO string into wall-time "YYYY-MM-DDTHH:mm" format for datetime-local input
 * in a specified IANA timezone.
 */
export function utcToTimezoneWallTime(
  value: Date | string | number | null | undefined,
  timeZone: string = "Asia/Singapore",
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(d);
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");

  if (!year || !month || !day || !hour || !minute) return "";
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function utcToSgWallTime(
  value: Date | string | number | null | undefined,
): string {
  return utcToTimezoneWallTime(value, "Asia/Singapore");
}

