import type {
  Prisma,
  PrismaClient,
  UnavailabilityReason,
} from "@prisma/client";

import { formatDateTime, parseSingaporeDateTime } from "@/lib/datetime";
import { overlapping, overlaps, type Period } from "@/lib/period";

type Db = PrismaClient | Prisma.TransactionClient;

/** Something that makes a venue unavailable for part of a period. */
export type VenueBlocker =
  | { kind: "booking"; id: string; startAt: Date; endAt: Date }
  | {
      kind: "unavailability";
      id: string;
      startAt: Date;
      endAt: Date;
      reason: UnavailabilityReason;
    };

/**
 * Everything that makes `venueId` unavailable for any part of `period`,
 * earliest first.
 *
 * Only APPROVED bookings and recorded unavailability (e.g. maintenance) count.
 * A PENDING request blocks nobody: several Coordinators may ask for the same
 * slot and Venue Staff choose between them (SCRUM-50/53). CANCELLED and
 * REJECTED bookings have released the venue.
 */
export async function findVenueBlockers(
  db: Db,
  venueId: string,
  period: Period,
): Promise<VenueBlocker[]> {
  const where = { venueId, ...overlapping(period) };
  const [bookings, unavailability] = await Promise.all([
    db.booking.findMany({
      where: { ...where, status: "APPROVED" },
      select: { id: true, startAt: true, endAt: true },
    }),
    db.venueUnavailability.findMany({
      where,
      select: { id: true, startAt: true, endAt: true, reason: true },
    }),
  ]);

  return [
    ...bookings.map((b) => ({ kind: "booking" as const, ...b })),
    ...unavailability.map((u) => ({ kind: "unavailability" as const, ...u })),
  ].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/**
 * One line per blocker, for telling a person why a venue is unavailable. Only
 * times are shown, never the other booking's event: ConnectSphere's clients
 * are competing organisations (the same reasoning as SCRUM-68).
 */
export function describeBlocker(blocker: VenueBlocker): string {
  const what =
    blocker.kind === "booking"
      ? "already booked"
      : `unavailable (${blocker.reason.toLowerCase()})`;
  return `${what} from ${formatDateTime(blocker.startAt)} to ${formatDateTime(blocker.endAt)}`;
}

/** One stretch of a day on the availability calendar (SCRUM-36). */
export type DaySegment =
  | { kind: "free"; startAt: Date; endAt: Date }
  | (VenueBlocker & { startAt: Date; endAt: Date });

export interface AvailabilityDay {
  /** "YYYY-MM-DD", a Singapore calendar day. */
  day: string;
  /** Covers the whole day, from midnight to midnight, with no gaps. */
  segments: DaySegment[];
}

/** Midnight at the start of a Singapore calendar day, as a UTC instant. */
export function startOfSgDay(day: string): Date {
  return parseSingaporeDateTime(`${day}T00:00`)!;
}

/** The "YYYY-MM-DD" day `offset` days after `day`. */
export function addDays(day: string, offset: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

/**
 * SCRUM-36 — each Singapore day from `fromDay` to `toDay` (inclusive), split
 * into free and unavailable stretches that cover the day exactly.
 *
 * Whether a blocker touches a day is decided by `overlaps` from
 * lib/period.ts — the one overlap rule — so a period ending at midnight does
 * not spill into the next day. Stretches are clipped to the day and laid end
 * to end: where one unavailable period ends exactly as another begins, they
 * sit flush, with no free sliver between them and no moment counted twice
 * (AC5). A day with nothing on it is one free stretch (AC6). Blockers never
 * overlap one another (the database refuses it — ADR 0010).
 */
export function availabilityByDay(
  blockers: VenueBlocker[],
  fromDay: string,
  toDay: string,
): AvailabilityDay[] {
  const days: AvailabilityDay[] = [];
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    const dayPeriod = {
      startAt: startOfSgDay(day),
      endAt: startOfSgDay(addDays(day, 1)),
    };
    const segments: DaySegment[] = [];
    let cursor = dayPeriod.startAt;

    const onThisDay = blockers
      .filter((b) => overlaps(b, dayPeriod))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    for (const blocker of onThisDay) {
      const startAt = blocker.startAt > cursor ? blocker.startAt : cursor;
      const endAt =
        blocker.endAt < dayPeriod.endAt ? blocker.endAt : dayPeriod.endAt;
      if (startAt > cursor) {
        segments.push({ kind: "free", startAt: cursor, endAt: startAt });
      }
      segments.push({ ...blocker, startAt, endAt });
      cursor = endAt;
    }
    if (cursor < dayPeriod.endAt) {
      segments.push({ kind: "free", startAt: cursor, endAt: dayPeriod.endAt });
    }
    days.push({ day, segments });
  }
  return days;
}
