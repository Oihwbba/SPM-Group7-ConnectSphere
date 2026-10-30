import { formatDate } from "@/lib/datetime";

/** What a venue request's search needs to know about it. */
export type SearchableBooking = {
  event: { name: string };
  venue: { name: string; location: string };
  requestedBy: { name: string; email: string };
  requestedLayout: string | null;
  requestNotes: string | null;
  requiredFacilities: string[];
  startAt: Date;
  endAt: Date;
};

/**
 * SCRUM-52 AC1 (TC-52-05) — the words Bookings' search box matches besides
 * the event's name: the venue and its location, the Coordinator who asked
 * and their email, the layout, the notes, the facilities and the dates. The
 * box itself is the one every queue shares (SCRUM-211 AC2).
 */
export function bookingSearchText(booking: SearchableBooking): string {
  return [
    booking.venue.name,
    booking.venue.location,
    booking.requestedBy.name,
    booking.requestedBy.email,
    booking.requestedLayout,
    booking.requestNotes,
    formatDate(booking.startAt),
    formatDate(booking.endAt),
    ...booking.requiredFacilities,
  ]
    .filter(Boolean)
    .join(" ");
}
