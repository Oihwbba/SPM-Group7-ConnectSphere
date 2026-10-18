import type { EventStatus } from "@prisma/client";

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
