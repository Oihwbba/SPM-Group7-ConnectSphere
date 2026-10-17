import type { BookingStatus } from "@prisma/client";

import { formatDateTime } from "@/lib/datetime";
import { toTag } from "@/lib/schemas/venue";
import {
  dayOutsideOpeningHours,
  describeDay,
  type OpeningDay,
} from "@/lib/venue-hours";

/**
 * SCRUM-34 AC10–AC12 — which of a venue's future bookings an edit would stop
 * fitting. Pure, so the action and its tests ask the same question.
 *
 * A booking records the attendance, facilities and layout it asked for
 * (SCRUM-50), so those are judged, with the opening hours. It doesn't record
 * the accessibility features it needs yet: SCRUM-40 adds that, and the
 * suitability check (SCRUM-40) words its reasons the same way as these.
 */

export type CatalogueVenue = {
  capacity: number;
  facilities: string[];
  supportedLayouts: string[];
  openingHours: OpeningDay[];
};

/** What a booking asked of its venue (SCRUM-50). */
export type BookingNeeds = {
  startAt: Date;
  endAt: Date;
  requestedAttendance: number | null;
  requiredFacilities: string[];
  requestedLayout: string | null;
};

/** "sound-system" -> "sound system" */
function readable(tag: string): string {
  return toTag(tag).replace(/-/g, " ");
}

/**
 * Each requirement the booking fails at this venue, keyed so the same failure
 * before and after an edit can be matched, with why. Attendance equal to
 * capacity fits. Facilities and layouts are compared as tags. AC12: opening
 * hours are judged on the booking period alone.
 */
function failures(venue: CatalogueVenue, booking: BookingNeeds): Map<string, string> {
  const failing = new Map<string, string>();
  if (booking.requestedAttendance !== null && booking.requestedAttendance > venue.capacity) {
    failing.set(
      "capacity",
      `Capacity ${venue.capacity} < attendance ${booking.requestedAttendance}`,
    );
  }
  const facilities = new Set(venue.facilities.map(toTag));
  for (const facility of booking.requiredFacilities) {
    if (!facilities.has(toTag(facility))) {
      failing.set(`facility:${toTag(facility)}`, `Missing facility: ${readable(facility)}`);
    }
  }
  if (
    booking.requestedLayout &&
    !venue.supportedLayouts.map(toTag).includes(toTag(booking.requestedLayout))
  ) {
    const layout = readable(booking.requestedLayout);
    failing.set(
      "layout",
      `${layout.charAt(0).toUpperCase()}${layout.slice(1)} layout not supported`,
    );
  }
  const day = dayOutsideOpeningHours(booking, venue.openingHours);
  if (day) failing.set("hours", `Outside opening hours (${describeDay(day)})`);
  return failing;
}

/**
 * AC10 — why this booking stops fitting once `before` becomes `after`: the
 * requirements it fails after the edit and didn't fail before. Empty when the
 * edit doesn't affect it, including when it already didn't fit in the same
 * way: the edit didn't cause that.
 */
export function newlyUnfit(
  before: CatalogueVenue,
  after: CatalogueVenue,
  booking: BookingNeeds,
): string[] {
  const was = failures(before, booking);
  return [...failures(after, booking)]
    .filter(([key]) => !was.has(key))
    .map(([, reason]) => reason);
}

/** One affected booking as Venue Staff are shown it (AC10, AC11). */
export function describeAffected(
  booking: { startAt: Date; status: BookingStatus; event: { name: string } },
  reasons: string[],
): string {
  const status = booking.status.charAt(0) + booking.status.slice(1).toLowerCase();
  const line = `${booking.event.name}, ${formatDateTime(booking.startAt)} (${status})`;
  return reasons.length > 0 ? `${line}: ${reasons.join("; ")}` : line;
}
