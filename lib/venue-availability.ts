import type {
  Prisma,
  PrismaClient,
  UnavailabilityReason,
} from "@prisma/client";

import { formatDateTime } from "@/lib/datetime";
import { overlapping, type Period } from "@/lib/period";

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
