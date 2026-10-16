import type { Prisma, PrismaClient } from "@prisma/client";

import type { Period } from "@/lib/period";
import { liveBookingWhere } from "@/lib/reconsideration";
import { findVenueBlockers, occupiedPeriod } from "@/lib/venue-availability";

/**
 * SCRUM-38 — search venues by period and location, and filter them by what
 * the event needs. Test cases: docs/testing/SCRUM-38.md.
 *
 * Whether a venue is free is decided by `findVenueBlockers`, the same check
 * the booking request form and Venue Staff's approval use, so search never
 * calls a venue free that requesting it would refuse ("Booking Conflict
 * Detection is delivered jointly…; their overlap rule must stay identical").
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** AC11–AC13 — the filters, each optional, applied together. */
export type VenueFilters = {
  attendance?: number;
  facilities: string[];
  accessibilityFeatures: string[];
  layout?: string;
};

type FilterableVenue = {
  capacity: number;
  facilities: string[];
  accessibilityFeatures: string[];
  supportedLayouts: string[];
};

/**
 * AC11–AC13 — does a venue pass every filter that is on? Capacity equal to
 * the attendance fits (AC12, the boundary SCRUM-50 and SCRUM-40 use); a venue
 * must have every facility and accessibility feature asked for (AC13).
 */
export function matchesFilters(
  venue: FilterableVenue,
  filters: VenueFilters,
): boolean {
  return (
    (filters.attendance === undefined ||
      venue.capacity >= filters.attendance) &&
    filters.facilities.every((f) => venue.facilities.includes(f)) &&
    filters.accessibilityFeatures.every((a) =>
      venue.accessibilityFeatures.includes(a),
    ) &&
    (filters.layout === undefined ||
      venue.supportedLayouts.includes(filters.layout))
  );
}

export type VenueSearch = {
  /** The period searched, or null when no date or time was given (AC2). */
  period: Period | null;
  location?: string;
  filters: VenueFilters;
  /** AC9: the event the search was opened from, to mark venues it has asked for. */
  eventId?: string;
};

export type VenueSearchResult = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  facilities: string[];
  accessibilityFeatures: string[];
  supportedLayouts: string[];
  /** AC9: the event already has a Pending, Held or Approved booking here. */
  alreadyRequested: boolean;
};

/**
 * The venues a search finds, by name.
 *
 * AC7: retired venues never appear. AC2: the location is one picked from the
 * venues' own (getFilterOptions), so it matches exactly. AC3, AC5: with a
 * period, a venue is left out when an Approved booking, a live hold or
 * recorded unavailability overlaps the occupied period a booking for that
 * period would have there (the venue's setup and turnaround included,
 * SCRUM-159); periods that only touch don't overlap. AC11–AC13: the filters.
 */
export async function searchVenues(
  db: Db,
  search: VenueSearch,
  now = new Date(),
): Promise<VenueSearchResult[]> {
  const venues = await db.venue.findMany({
    where: {
      isActive: true,
      ...(search.location && { location: search.location }),
    },
    select: {
      id: true,
      name: true,
      location: true,
      capacity: true,
      facilities: true,
      accessibilityFeatures: true,
      supportedLayouts: true,
      setupMinutes: true,
      turnaroundMinutes: true,
    },
    orderBy: { name: "asc" },
  });

  const candidates = venues.filter((venue) =>
    matchesFilters(venue, search.filters),
  );
  const { period } = search;
  const free = period
    ? await Promise.all(
        candidates.map(
          async (venue) =>
            (
              await findVenueBlockers(
                db,
                venue.id,
                occupiedPeriod(period, venue),
                now,
              )
            ).length === 0,
        ),
      )
    : candidates.map(() => true);
  const found = candidates.filter((_, index) => free[index]);

  const requested = search.eventId
    ? await db.booking.findMany({
        where: {
          eventId: search.eventId,
          venueId: { in: found.map((venue) => venue.id) },
          ...liveBookingWhere(now),
        },
        select: { venueId: true },
      })
    : [];
  const requestedVenues = new Set(requested.map((b) => b.venueId));

  return found.map((venue) => ({
    id: venue.id,
    name: venue.name,
    location: venue.location,
    capacity: venue.capacity,
    facilities: venue.facilities,
    accessibilityFeatures: venue.accessibilityFeatures,
    supportedLayouts: venue.supportedLayouts,
    alreadyRequested: requestedVenues.has(venue.id),
  }));
}
