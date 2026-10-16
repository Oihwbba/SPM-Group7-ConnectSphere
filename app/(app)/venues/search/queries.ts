import { can, type SessionUser } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import type { Period } from "@/lib/period";
import { flaggedLiveBookingWhere } from "@/lib/reconsideration";
import { BOOKABLE_EVENT_STATUSES } from "@/lib/schemas/booking";
import { EVENT_NOT_SCHEDULED_FOR_SEARCH_MESSAGE } from "@/lib/schemas/venue-search";

/**
 * SCRUM-38 AC1 — what venue search knows when it is opened from an event: the
 * period it is fixed to and what it starts with. Test cases:
 * docs/testing/SCRUM-38.md.
 */
export type SearchEvent = {
  id: string;
  name: string;
  /**
   * AC1, AC2: the event's own period, exactly as the event has it ("search
   * period does not differ from event period", 2026-10-10).
   */
  period: Period;
  /** The flagged booking a replacement is being found for, if any. */
  replacing: { id: string; venueName: string } | null;
  /** What the search starts with, before the Coordinator changes anything. */
  prefill: {
    attendance?: number;
    facilities: string[];
    layout?: string;
  };
};

export const SEARCH_EVENT_NOT_FOUND_MESSAGE = "Event not found.";
export const REPLACED_BOOKING_NOT_FOUND_MESSAGE =
  "That booking isn't flagged for reconsideration, so there is nothing to replace.";
export const EVENT_NOT_BOOKABLE_MESSAGE =
  "Venues can be searched for an event once it has been approved.";

/**
 * AC1 — the event the search was opened from, for a Coordinator who may
 * request a venue for it (the same relationship SCRUM-50's request form
 * uses). Anyone else gets "Event not found.", the same as for an event that
 * doesn't exist (SCRUM-68). The period is fixed to the event's; the attendance
 * starts as the event's expected attendance. Opened from a flagged booking,
 * the attendance, facilities and layout come from that booking request
 * instead.
 */
export async function getSearchEvent(
  user: SessionUser,
  eventId: string,
  replaceId?: string,
  now = new Date(),
): Promise<{ ok: true; event: SearchEvent } | { ok: false; error: string }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      status: true,
      organiserId: true,
      coordinatorId: true,
      startAt: true,
      endAt: true,
      expectedAttendance: true,
    },
  });
  if (!event || !can(user, "booking:request", { kind: "event", ...event })) {
    return { ok: false, error: SEARCH_EVENT_NOT_FOUND_MESSAGE };
  }
  if (!BOOKABLE_EVENT_STATUSES.includes(event.status)) {
    return { ok: false, error: EVENT_NOT_BOOKABLE_MESSAGE };
  }
  if (!event.startAt || !event.endAt) {
    return { ok: false, error: EVENT_NOT_SCHEDULED_FOR_SEARCH_MESSAGE };
  }
  const period = { startAt: event.startAt, endAt: event.endAt };

  let replacing: SearchEvent["replacing"] = null;
  let prefill: SearchEvent["prefill"] = {
    attendance: event.expectedAttendance ?? undefined,
    facilities: [],
  };
  if (replaceId) {
    const booking = await prisma.booking.findFirst({
      where: { id: replaceId, eventId, ...flaggedLiveBookingWhere(now) },
      select: {
        id: true,
        requestedAttendance: true,
        requiredFacilities: true,
        requestedLayout: true,
        venue: { select: { name: true } },
      },
    });
    if (!booking) {
      return { ok: false, error: REPLACED_BOOKING_NOT_FOUND_MESSAGE };
    }
    replacing = { id: booking.id, venueName: booking.venue.name };
    prefill = {
      attendance: booking.requestedAttendance ?? undefined,
      facilities: booking.requiredFacilities,
      layout: booking.requestedLayout ?? undefined,
    };
  }

  return {
    ok: true,
    event: { id: event.id, name: event.name, period, replacing, prefill },
  };
}

/**
 * AC11, AC13 — the values the filters offer: every facility, accessibility
 * feature and layout an active venue lists, so each one can match a venue.
 */
export async function getFilterOptions() {
  const venues = await prisma.venue.findMany({
    where: { isActive: true },
    select: {
      location: true,
      facilities: true,
      accessibilityFeatures: true,
      supportedLayouts: true,
    },
  });
  const sorted = (values: string[]) => Array.from(new Set(values)).sort();
  return {
    locations: sorted(venues.map((v) => v.location)),
    facilities: sorted(venues.flatMap((v) => v.facilities)),
    accessibilityFeatures: sorted(
      venues.flatMap((v) => v.accessibilityFeatures),
    ),
    layouts: sorted(venues.flatMap((v) => v.supportedLayouts)),
  };
}

export type FilterOptions = Awaited<ReturnType<typeof getFilterOptions>>;
