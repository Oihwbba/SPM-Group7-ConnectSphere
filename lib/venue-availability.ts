import type {
  Prisma,
  PrismaClient,
  VenueUnavailabilityReason,
} from "@prisma/client";

import { reservingWhere } from "@/lib/booking-holds";
import { formatDateTime, parseSingaporeDateTime } from "@/lib/datetime";
import { overlapping, overlaps, type Period } from "@/lib/period";
import { UNAVAILABILITY_REASON_LABEL } from "@/lib/schemas/unavailability";
import { MAX_SETUP_TURNAROUND_MINUTES } from "@/lib/schemas/venue";

type Db = PrismaClient | Prisma.TransactionClient;

const MINUTE_MS = 60 * 1000;

/** A venue's, or a booking's, setup and turnaround time in minutes. */
export type SetupTurnaround = {
  setupMinutes: number;
  turnaroundMinutes: number;
};

/**
 * SCRUM-159 AC2 — the time a booking keeps its venue busy: from its start
 * minus the setup time to its end plus the turnaround time. An event from
 * 10:00 to 12:00 with 30 and 45 minutes occupies the venue from 09:30 to
 * 12:45. The database's `booking_occupied_period` computes the same range, so
 * the application and the database cannot disagree.
 */
export function occupiedPeriod(period: Period, times: SetupTurnaround): Period {
  return {
    startAt: new Date(period.startAt.getTime() - times.setupMinutes * MINUTE_MS),
    endAt: new Date(period.endAt.getTime() + times.turnaroundMinutes * MINUTE_MS),
  };
}

/**
 * SCRUM-160 — a venue's setup and turnaround, read under the lock on its row
 * that every write making the venue unavailable already takes (the occupancy
 * trigger, ADR 0010). Changing the times and approving a booking both read
 * them this way, so they take turns: a booking approved during a change
 * either copies the new minutes, or is already Approved when the change
 * looks for clashes. Null when there is no such venue.
 */
export async function lockVenueTimes(
  tx: Prisma.TransactionClient,
  venueId: string,
): Promise<SetupTurnaround | null> {
  const [times] = await tx.$queryRaw<SetupTurnaround[]>`
    SELECT "setupMinutes", "turnaroundMinutes" FROM "Venue"
    WHERE "id" = ${venueId} FOR NO KEY UPDATE`;
  return times ?? null;
}

/**
 * The booked periods that could occupy any part of `period`. A booking's
 * setup and turnaround never exceed MAX_SETUP_TURNAROUND_MINUTES, so a
 * booking more than that far away cannot reach it; the rows this loads are
 * then checked exactly against their occupied periods.
 */
function reachingInto(period: Period) {
  const reach = MAX_SETUP_TURNAROUND_MINUTES * MINUTE_MS;
  return overlapping({
    startAt: new Date(period.startAt.getTime() - reach),
    endAt: new Date(period.endAt.getTime() + reach),
  });
}

/**
 * What the availability calendar shows when a booking or unavailability is
 * hovered (SCRUM-36). `startAt`/`endAt` are the whole period, even where the
 * calendar clips it to one day.
 */
export type BlockerDetails = { startAt: Date; endAt: Date } & (
  | {
      kind: "booking";
      /** SCRUM-163 AC2: a live hold's expiry; null for an Approved booking. */
      heldUntil: Date | null;
      eventName: string;
      requestedBy: string;
      attendance: number | null;
      layout: string | null;
      /** SCRUM-159 AC7: the booking's own setup and turnaround, in minutes. */
      setupMinutes: number;
      turnaroundMinutes: number;
    }
  | { kind: "unavailability"; note: string | null; recordedBy: string }
);

/**
 * Something that makes a venue unavailable for part of a period. A booking's
 * `startAt`/`endAt` are its booked period; its setup and turnaround minutes
 * (the ones it was held or approved with, SCRUM-159 AC8) say how far it
 * reaches either side.
 */
export type VenueBlocker =
  | {
      kind: "booking";
      id: string;
      startAt: Date;
      endAt: Date;
      /** SCRUM-163 AC2: a live hold's expiry; null for an Approved booking. */
      heldUntil?: Date | null;
      setupMinutes?: number;
      turnaroundMinutes?: number;
      details?: BlockerDetails;
    }
  | {
      kind: "unavailability";
      id: string;
      startAt: Date;
      endAt: Date;
      reason: VenueUnavailabilityReason;
      details?: BlockerDetails;
    };

/**
 * SCRUM-159 AC7 — the setup before, or the turnaround after, an approved or
 * held booking on the availability calendar. The venue is busy then, but no
 * event is running, so the calendar draws it differently from the booking.
 */
type StretchAroundBooking = {
  id: string;
  startAt: Date;
  endAt: Date;
  eventName: string;
};
export type SetupTurnaroundStretch =
  | (StretchAroundBooking & { kind: "setup" })
  | (StretchAroundBooking & { kind: "turnaround" });

/** One entry on the availability calendar. */
export type CalendarEntry = VenueBlocker | SetupTurnaroundStretch;

function heldUntil(booking: {
  status: string;
  holdExpiresAt: Date | null;
}): Date | null {
  return booking.status === "HELD" ? booking.holdExpiresAt : null;
}

/**
 * Everything that makes `venueId` unavailable for any part of `occupied`,
 * earliest first.
 *
 * `occupied` is the period being asked about as it would occupy the venue:
 * for a booking, its occupied period with the venue's setup and turnaround
 * (SCRUM-159 AC2, see `occupiedPeriod`); for recorded unavailability, the
 * period itself. Each approved or held booking counts for its own occupied
 * period, so a request is refused wherever the two occupied periods overlap
 * (SCRUM-159 AC3). Periods that only touch don't overlap (AC4).
 *
 * Approved bookings, holds that haven't expired at `now` (SCRUM-163 AC2) and
 * recorded unavailability (e.g. maintenance) count. A PENDING request blocks
 * nobody: several Coordinators may ask for the same slot and Venue Staff
 * choose between them (SCRUM-50/53). CANCELLED, REJECTED and EXPIRED bookings
 * have released the venue, and so has a hold whose expiry has passed, even
 * before anything has marked it Expired (SCRUM-163 AC4).
 */
export async function findVenueBlockers(
  db: Db,
  venueId: string,
  occupied: Period,
  now = new Date(),
): Promise<VenueBlocker[]> {
  const [bookings, unavailability] = await Promise.all([
    db.booking.findMany({
      where: { venueId, ...reservingWhere(now), ...reachingInto(occupied) },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        holdExpiresAt: true,
        setupMinutes: true,
        turnaroundMinutes: true,
      },
    }),
    db.venueUnavailability.findMany({
      where: { venueId, ...overlapping(occupied) },
      select: { id: true, startAt: true, endAt: true, reason: true },
    }),
  ]);

  return [
    ...bookings
      .filter((b) => overlaps(occupiedPeriod(b, b), occupied))
      .map((b) => ({
        kind: "booking" as const,
        id: b.id,
        startAt: b.startAt,
        endAt: b.endAt,
        heldUntil: heldUntil(b),
        setupMinutes: b.setupMinutes,
        turnaroundMinutes: b.turnaroundMinutes,
      })),
    ...unavailability.map((u) => ({ kind: "unavailability" as const, ...u })),
  ].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** SCRUM-134 — another Pending request competing for the same venue. */
export type CompetingRequest = {
  id: string;
  startAt: Date;
  endAt: Date;
  /** When it was submitted: the earlier is decided first (AC2). */
  createdAt: Date;
  eventName: string;
};

/** SCRUM-134 AC2 — `a` was submitted before `b`; the id breaks a tie. */
export function submittedBefore(
  a: { id: string; createdAt: Date },
  b: { id: string; createdAt: Date },
): boolean {
  const diff = a.createdAt.getTime() - b.createdAt.getTime();
  return diff < 0 || (diff === 0 && a.id < b.id);
}

/**
 * SCRUM-134 AC1, AC3 — every other Pending request for the venue whose
 * occupied period overlaps this one's, earliest submitted first. Both are
 * Pending, so both occupy the venue with its current setup and turnaround
 * (SCRUM-159). Periods that only touch don't compete.
 */
export async function findCompetingRequests(
  db: Db,
  booking: { id: string; venueId: string; startAt: Date; endAt: Date },
  venue: SetupTurnaround,
): Promise<CompetingRequest[]> {
  const occupied = occupiedPeriod(booking, venue);
  const pending = await db.booking.findMany({
    where: {
      venueId: booking.venueId,
      status: "PENDING",
      id: { not: booking.id },
      ...reachingInto(occupied),
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      createdAt: true,
      event: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return pending
    .filter((other) => overlaps(occupiedPeriod(other, venue), occupied))
    .map(({ event, ...other }) => ({ ...other, eventName: event.name }));
}

/**
 * SCRUM-36 — the same blockers as `findVenueBlockers`, carrying what the
 * calendar shows on hover: the booking's event, who requested it and what it
 * needs, or the unavailability's note and who recorded it. The calendar is
 * for internal staff only (Coordinators and Venue Staff), so the event is
 * named here, unlike in `describeBlocker`. A live hold carries its expiry, so
 * the calendar can show it as held (SCRUM-163 AC2).
 *
 * SCRUM-159 AC7 — each booking with setup or turnaround time also brings a
 * stretch before and after it for that time. A booking just outside the week
 * whose setup or turnaround reaches into it is included for that reason.
 */
export async function findVenueCalendar(
  db: Db,
  venueId: string,
  period: Period,
  now = new Date(),
): Promise<CalendarEntry[]> {
  const [bookings, unavailability] = await Promise.all([
    db.booking.findMany({
      where: { venueId, ...reservingWhere(now), ...reachingInto(period) },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        holdExpiresAt: true,
        setupMinutes: true,
        turnaroundMinutes: true,
        requestedAttendance: true,
        requestedLayout: true,
        event: { select: { name: true } },
        requestedBy: { select: { name: true } },
      },
    }),
    db.venueUnavailability.findMany({
      where: { venueId, ...overlapping(period) },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        reason: true,
        note: true,
        recordedBy: { select: { name: true } },
      },
    }),
  ]);

  const bookingEntries = bookings
    .filter((b) => overlaps(occupiedPeriod(b, b), period))
    .flatMap((b): CalendarEntry[] => {
      const occupied = occupiedPeriod(b, b);
      const booking: CalendarEntry = {
        kind: "booking",
        id: b.id,
        startAt: b.startAt,
        endAt: b.endAt,
        heldUntil: heldUntil(b),
        details: {
          kind: "booking",
          startAt: b.startAt,
          endAt: b.endAt,
          heldUntil: heldUntil(b),
          eventName: b.event.name,
          requestedBy: b.requestedBy.name,
          attendance: b.requestedAttendance,
          layout: b.requestedLayout,
          setupMinutes: b.setupMinutes,
          turnaroundMinutes: b.turnaroundMinutes,
        },
      };
      const setup: CalendarEntry[] =
        b.setupMinutes > 0
          ? [
              {
                kind: "setup",
                id: `${b.id}-setup`,
                startAt: occupied.startAt,
                endAt: b.startAt,
                eventName: b.event.name,
              },
            ]
          : [];
      const turnaround: CalendarEntry[] =
        b.turnaroundMinutes > 0
          ? [
              {
                kind: "turnaround",
                id: `${b.id}-turnaround`,
                startAt: b.endAt,
                endAt: occupied.endAt,
                eventName: b.event.name,
              },
            ]
          : [];
      return [...setup, booking, ...turnaround];
    });

  return [
    ...bookingEntries,
    ...unavailability.map((u) => ({
      kind: "unavailability" as const,
      id: u.id,
      startAt: u.startAt,
      endAt: u.endAt,
      reason: u.reason,
      details: {
        kind: "unavailability" as const,
        startAt: u.startAt,
        endAt: u.endAt,
        note: u.note,
        recordedBy: u.recordedBy.name,
      },
    })),
  ].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** The Monday of the week containing `day` ("YYYY-MM-DD"). */
export function startOfWeek(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const sinceMonday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(day, -sinceMonday);
}

/**
 * One line per blocker, for telling a person why a venue is unavailable. Only
 * times are shown, never the other booking's event: ConnectSphere's clients
 * are competing organisations (the same reasoning as SCRUM-68). A hold's
 * expiry isn't given: only the availability calendar shows "Held until"
 * (SCRUM-163 AC2).
 *
 * SCRUM-159 — a booking with setup or turnaround time is described by the
 * whole time it occupies the venue, so the times given explain the refusal.
 */
export function describeBlocker(blocker: VenueBlocker): string {
  if (blocker.kind === "unavailability") {
    const reason = UNAVAILABILITY_REASON_LABEL[blocker.reason].toLowerCase();
    return `unavailable (${reason}) from ${formatDateTime(blocker.startAt)} to ${formatDateTime(blocker.endAt)}`;
  }
  const what = blocker.heldUntil ? "held" : "already booked";
  const setupMinutes = blocker.setupMinutes ?? 0;
  const turnaroundMinutes = blocker.turnaroundMinutes ?? 0;
  if (setupMinutes === 0 && turnaroundMinutes === 0) {
    return `${what} from ${formatDateTime(blocker.startAt)} to ${formatDateTime(blocker.endAt)}`;
  }
  const occupied = occupiedPeriod(blocker, { setupMinutes, turnaroundMinutes });
  return `${what} from ${formatDateTime(occupied.startAt)} to ${formatDateTime(occupied.endAt)}, including setup and turnaround`;
}

/** One stretch of a day on the availability calendar (SCRUM-36). */
export type DaySegment =
  | { kind: "free"; startAt: Date; endAt: Date }
  | (CalendarEntry & { startAt: Date; endAt: Date });

export interface AvailabilityDay {
  /** "YYYY-MM-DD", a Singapore calendar day. */
  day: string;
  /** Covers the whole day, from midnight to midnight, with no gaps. */
  segments: DaySegment[];
}

/** Where blockers overlap, the lower number is shown (SCRUM-161). */
const PRECEDENCE: Record<CalendarEntry["kind"], number> = {
  unavailability: 0,
  booking: 1,
  setup: 2,
  turnaround: 2,
};

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
 * (AC5). A day with nothing on it is one free stretch (AC6).
 *
 * Bookings never overlap one another (the database refuses it — ADR 0010),
 * setup and turnaround included (SCRUM-159). Unavailability can lie over a
 * booking that still stands, flagged (SCRUM-161 AC1, AC3), so where blockers
 * overlap each moment shows the one that matters most: unavailability, then
 * the booking, then its setup or turnaround. A booking with maintenance in
 * its middle shows as booking, maintenance, booking.
 */
export function availabilityByDay(
  blockers: CalendarEntry[],
  fromDay: string,
  toDay: string,
): AvailabilityDay[] {
  const days: AvailabilityDay[] = [];
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    const dayPeriod = {
      startAt: startOfSgDay(day),
      endAt: startOfSgDay(addDays(day, 1)),
    };
    const onThisDay = blockers.filter((b) => overlaps(b, dayPeriod));
    // Every instant where what is on the calendar can change, within the day.
    const cuts = [
      ...new Set(
        [
          dayPeriod.startAt,
          dayPeriod.endAt,
          ...onThisDay.flatMap((b) => [b.startAt, b.endAt]),
        ]
          .map((t) => t.getTime())
          .filter((t) => t >= dayPeriod.startAt.getTime() && t <= dayPeriod.endAt.getTime()),
      ),
    ].sort((a, b) => a - b);

    const segments: DaySegment[] = [];
    let lastSource: CalendarEntry | "free" | undefined;
    for (let i = 0; i < cuts.length - 1; i++) {
      const startAt = new Date(cuts[i]);
      const endAt = new Date(cuts[i + 1]);
      const covering = onThisDay
        .filter((b) => b.startAt <= startAt && b.endAt >= endAt)
        .sort((a, b) => PRECEDENCE[a.kind] - PRECEDENCE[b.kind]);
      const source: CalendarEntry | "free" = covering.length > 0 ? covering[0] : "free";
      const last = segments.at(-1);
      if (last && source === lastSource) {
        last.endAt = endAt;
      } else {
        segments.push(
          source === "free" ? { kind: "free", startAt, endAt } : { ...source, startAt, endAt },
        );
        lastSource = source;
      }
    }
    days.push({ day, segments });
  }
  return days;
}
