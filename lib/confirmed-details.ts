import type { EventStatus, RegistrationStatus } from "@prisma/client";

/**
 * SCRUM-85 — what Attendees were last told about an event, and whether that
 * has changed. Set when the event is Confirmed (SCRUM-81); see the
 * `confirmed*` fields on Event.
 */
export type ConfirmedDetails = {
  confirmedStartAt: Date | null;
  confirmedEndAt: Date | null;
  confirmedVenues: string[];
};

/** How a venue is listed to Attendees: "Name — Location". */
export function venueLabel(venue: { name: string; location: string }): string {
  return `${venue.name} — ${venue.location}`;
}

/**
 * AC2, AC11 — confirming again changed the date, time or any venue. A first
 * confirmation (nothing confirmed before) is not a change.
 */
export function confirmedDetailsChanged(
  before: ConfirmedDetails,
  now: { startAt: Date | null; endAt: Date | null; venues: string[] },
): boolean {
  if (before.confirmedStartAt === null) return false;
  const sameTime = (a: Date | null, b: Date | null) =>
    a?.getTime() === b?.getTime();
  return (
    !sameTime(before.confirmedStartAt, now.startAt) ||
    !sameTime(before.confirmedEndAt, now.endAt) ||
    before.confirmedVenues.join("\n") !== now.venues.join("\n")
  );
}

/**
 * AC8, AC9 — a Confirmed event that went back to Planning to be re-planned
 * (SCRUM-128, SCRUM-26), as opposed to one never confirmed.
 */
export function isBeingReplanned(event: {
  status: EventStatus;
  confirmedStartAt: Date | null;
}): boolean {
  return event.status === "PLANNING" && event.confirmedStartAt !== null;
}

/**
 * AC8, AC9 — a registration still active is shown what was last confirmed
 * while its event is re-planned. One that was withdrawn is not (AC5).
 */
export function showsLastConfirmed(
  status: RegistrationStatus,
  event: { status: EventStatus; confirmedStartAt: Date | null },
): boolean {
  return status === "REGISTERED" && isBeingReplanned(event);
}

/**
 * The date and time a My Registrations row shows. The row and the list's order
 * both ask here, so a row is never ordered by a date it doesn't show (SCRUM-252 AC2).
 */
export function shownEventTime(
  status: RegistrationStatus,
  event: {
    status: EventStatus;
    startAt: Date | null;
    endAt: Date | null;
    confirmedStartAt: Date | null;
    confirmedEndAt: Date | null;
  },
): { startAt: Date | null; endAt: Date | null } {
  return showsLastConfirmed(status, event)
    ? { startAt: event.confirmedStartAt, endAt: event.confirmedEndAt }
    : { startAt: event.startAt, endAt: event.endAt };
}
