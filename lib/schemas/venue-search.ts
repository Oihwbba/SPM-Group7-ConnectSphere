import { z } from "zod";

import { parseSingaporeDateTime } from "@/lib/datetime";
import { isValidPeriod, type Period } from "@/lib/period";

/**
 * SCRUM-38 — what a venue search asks for. Search is a GET form, so its
 * criteria and filters live in the URL: refreshing or sharing a search shows
 * the same results, and changing one field leaves the others applied (AC14).
 * Dates and times are Singapore wall time, as everywhere in ConnectSphere, and
 * are turned into UTC instants here with lib/datetime.ts.
 */

export const INVALID_TIME_RANGE_MESSAGE =
  "The time range is invalid: the end must be after the start.";

export const EVENT_NOT_SCHEDULED_FOR_SEARCH_MESSAGE =
  "This event has no dates yet. Set them on the event before searching for a venue.";

/** "HH:mm" on a 24-hour clock, as a time input sends it. */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "YYYY-MM-DD" naming a day that exists, so 31 February isn't 3 March. */
function isCalendarDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === day;
}

/**
 * A query parameter as the form sends it: only the first of a repeated
 * single-valued one counts, and a blank one is the same as one left out.
 */
const single = (value: unknown) => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.trim() === "" ? undefined : first;
};

const optionalText = (max: number) =>
  z.preprocess(single, z.string().trim().max(max).optional());

/** A repeated query parameter (`?facility=a&facility=b`) arrives as an array. */
const manyValues = z.preprocess(
  (value) =>
    (value === undefined ? [] : Array.isArray(value) ? value : [value]).filter(
      (v) => typeof v === "string" && v.trim() !== "",
    ),
  z.array(z.string().trim().max(100)),
);

export const venueSearchSchema = z.object({
  /** AC1: the event the search was opened from. */
  event: optionalText(100),
  /** AC1: the flagged booking a replacement venue is being found for. */
  replace: optionalText(100),
  /** Sent by the form's Search button, so AC1's pre-fill applies only on arrival. */
  searched: optionalText(10),
  /** The event the form was showing when it was sent, so choosing another one counts as arriving. */
  searchedFor: optionalText(100),
  /** The start date. */
  date: z.preprocess(
    single,
    z.string().refine(isCalendarDay, "Enter a valid date.").optional(),
  ),
  endDate: z.preprocess(
    single,
    z.string().refine(isCalendarDay, "Enter a valid date.").optional(),
  ),
  from: z.preprocess(
    single,
    z.string().regex(TIME, "Enter a valid start time.").optional(),
  ),
  to: z.preprocess(
    single,
    z.string().regex(TIME, "Enter a valid end time.").optional(),
  ),
  location: optionalText(200),
  attendance: z.preprocess(
    single,
    z.coerce
      .number({ invalid_type_error: "Attendance must be a whole number." })
      .int("Attendance must be a whole number.")
      .positive("Attendance must be greater than zero.")
      .optional(),
  ),
  facility: manyValues,
  access: manyValues,
  layout: optionalText(100),
});

export type VenueSearchQuery = z.infer<typeof venueSearchSchema>;

type SentWith = Pick<VenueSearchQuery, "searched" | "searchedFor">;

/**
 * AC1 — whether search is arriving for `eventId`: opened from the event, or
 * the event was just chosen in the form. Only then does it start from the
 * event's values; after that, what the Coordinator sent counts.
 */
export function isArrivingFor(eventId: string, sent: SentWith): boolean {
  return !sent.searched || sent.searchedFor !== eventId;
}

/**
 * AC1 — the flagged booking to find a replacement for. It belongs to the
 * event it was opened for, so choosing another event leaves it behind.
 */
export function replacementToKeep(
  sent: SentWith & Pick<VenueSearchQuery, "event" | "replace">,
): string | undefined {
  return !sent.searched || sent.searchedFor === sent.event
    ? sent.replace
    : undefined;
}

/** The calendar day after "YYYY-MM-DD". */
function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * AC2, AC6 — the period a search opened on its own asks about, which may run
 * over several days. Dates and times can be used alone or together: a start
 * date alone is that whole day; with no end date the period ends on the start
 * date; times without a date are on `today`. A missing start time is the
 * start of the first day, and a missing end time the end of the last. Nothing
 * entered means no period, so availability isn't checked. An end that isn't
 * after the start is refused, with the time range reported as invalid.
 */
export function searchPeriod(
  query: Pick<VenueSearchQuery, "date" | "endDate" | "from" | "to">,
  today: string,
): { period: Period | null } | { error: string } {
  const { date, endDate, from, to } = query;
  if (!date && !endDate && !from && !to) return { period: null };

  const firstDay = date ?? endDate ?? today;
  const lastDay = endDate ?? firstDay;
  const period = {
    startAt: parseSingaporeDateTime(`${firstDay}T${from ?? "00:00"}`)!,
    endAt: parseSingaporeDateTime(
      to ? `${lastDay}T${to}` : `${nextDay(lastDay)}T00:00`,
    )!,
  };
  return isValidPeriod(period)
    ? { period }
    : { error: INVALID_TIME_RANGE_MESSAGE };
}
