import type { Period } from "@/lib/period";

/**
 * SCRUM-34 — a venue's opening hours: for each day of the week (1 is Monday,
 * 7 is Sunday) an opening and a closing time in minutes after midnight SGT,
 * or neither when the venue is Closed that day (AC3). Pure, so the booking
 * actions (AC7), the catalogue and venue search (SCRUM-38) read them the same
 * way.
 */
export type OpeningDay = {
  weekday: number;
  opensMinute: number | null;
  closesMinute: number | null;
};

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const SG_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MINUTES = 24 * 60;

/** 540 -> "09:00" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "09:00" -> 540; anything that isn't a time of day -> null. */
export function timeToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** "09:00–18:00", or "Closed". */
export function describeHours(day: OpeningDay): string {
  return day.opensMinute === null || day.closesMinute === null
    ? "Closed"
    : `${minutesToTime(day.opensMinute)}–${minutesToTime(day.closesMinute)}`;
}

/** "Monday 09:00–18:00" or "Saturday Closed". */
export function describeDay(day: OpeningDay): string {
  return `${WEEKDAYS[day.weekday - 1]} ${describeHours(day)}`;
}

/** The SGT weekday (1–7) and midnight, as an instant, of the day `at` falls on. */
function sgDay(at: Date): { weekday: number; midnight: number } {
  const shifted = new Date(at.getTime() + SG_OFFSET_MS);
  const midnight =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - SG_OFFSET_MS;
  const weekday = ((shifted.getUTCDay() + 6) % 7) + 1;
  return { weekday, midnight };
}

/**
 * AC7 — the day whose hours a booking period breaks, or null when it is
 * within them. The period must start at or after opening and end at or
 * before closing on the day it starts (AC7's boundary: exactly at opening or
 * closing is within). A period running past midnight, or on a Closed day, is
 * outside. Setup and turnaround are not part of the booking period, so they
 * never make it outside (SCRUM-159 AC9 warns about them instead).
 *
 * A venue with no hours recorded (from before SCRUM-34) refuses nothing.
 */
export function dayOutsideOpeningHours(
  period: Period,
  hours: OpeningDay[],
): OpeningDay | null {
  if (hours.length === 0) return null;
  const { weekday, midnight } = sgDay(period.startAt);
  const day = hours.find((h) => h.weekday === weekday) ?? {
    weekday,
    opensMinute: null,
    closesMinute: null,
  };
  if (day.opensMinute === null || day.closesMinute === null) return day;

  const start = (period.startAt.getTime() - midnight) / 60_000;
  const end = (period.endAt.getTime() - midnight) / 60_000;
  const within =
    end <= DAY_MINUTES && start >= day.opensMinute && end <= day.closesMinute;
  return within ? null : day;
}

/**
 * SCRUM-38 AC4 — for a search with no booking period (a date without both
 * times): the SGT day `at` falls on, if the venue is Closed then, or null. A
 * search covers one day (AC2), so its start names the day. A weekday
 * with no row is Closed; a venue with no hours recorded is closed on no day.
 */
export function closedOn(at: Date, hours: OpeningDay[]): OpeningDay | null {
  if (hours.length === 0) return null;
  const { weekday } = sgDay(at);
  const day = hours.find((h) => h.weekday === weekday);
  if (!day) return { weekday, opensMinute: null, closesMinute: null };
  return day.opensMinute === null || day.closesMinute === null ? day : null;
}

/** AC7 — the refusal, with that day's opening hours. */
export function outsideOpeningHoursMessage(
  venueName: string,
  day: OpeningDay,
): string {
  const name = WEEKDAYS[day.weekday - 1];
  if (day.opensMinute === null || day.closesMinute === null) {
    return `${venueName} is closed on ${name}s, so it can't be booked then.`;
  }
  return `${venueName} is open ${minutesToTime(day.opensMinute)}–${minutesToTime(day.closesMinute)} on ${name}s. The booking must start and end within those hours on the same day.`;
}

/**
 * AC7 — why a booking period is refused at this venue, or null. The booking
 * actions refuse with it, and the Venue Staff queue shows it, so the card
 * staff decide from agrees with what Approve will do.
 */
export function openingHoursRefusal(
  period: Period,
  venue: { name: string; openingHours?: OpeningDay[] },
): string | null {
  const day = dayOutsideOpeningHours(period, venue.openingHours ?? []);
  return day && outsideOpeningHoursMessage(venue.name, day);
}
