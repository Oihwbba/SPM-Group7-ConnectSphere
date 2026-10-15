import { prisma } from "@/lib/db";
import { readVenueOptions } from "@/lib/venue-options";

/**
 * SCRUM-34 — the venue catalogue's reads. Every page reads the saved record
 * as it is now (AC2).
 */

/** AC2, AC8 — the venues to list; retired ones only when asked for. */
export async function getVenueCatalogue({ includeRetired }: { includeRetired: boolean }) {
  return prisma.venue.findMany({
    where: includeRetired ? {} : { isActive: true },
    select: {
      id: true,
      name: true,
      location: true,
      capacity: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * AC1 — one venue with everything its detail view shows. A retired venue is
 * still found, so the bookings that name it stay readable (AC8).
 */
export async function getVenueDetail(id: string) {
  return prisma.venue.findUnique({
    where: { id },
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
      knownRestrictions: true,
      operatingHours: true,
      isActive: true,
      openingHours: {
        select: { weekday: true, opensMinute: true, closesMinute: true },
        orderBy: { weekday: "asc" },
      },
    },
  });
}

export type VenueDetail = NonNullable<Awaited<ReturnType<typeof getVenueDetail>>>;

/** AC3, AC6 — what the venue form offers for facilities, accessibility and layouts. */
export function getVenueOptions() {
  return readVenueOptions(prisma);
}
