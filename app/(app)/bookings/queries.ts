import { prisma } from "@/lib/db";
import { BOOKABLE_EVENT_STATUSES } from "@/lib/schemas/booking";
import { findVenueBlockers, occupiedPeriod } from "@/lib/venue-availability";

/**
 * SCRUM-50 — the events a coordinator may request a venue for: approved ones
 * they can act on. The coordinator half mirrors `can()`'s event relationship
 * exactly (assigned to them, or not yet picked up by anyone), so the form
 * never offers an event the action would refuse.
 */
export async function getBookableEvents(coordinatorId: string) {
  return prisma.event.findMany({
    where: {
      status: { in: BOOKABLE_EVENT_STATUSES },
      OR: [{ coordinatorId }, { coordinatorId: null }],
    },
    select: {
      id: true,
      name: true,
      startAt: true,
      endAt: true,
      expectedAttendance: true,
      requiredFacilities: true,
      preferredLayout: true,
    },
    orderBy: { startAt: "asc" },
  });
}

/** SCRUM-50 — the venues a request can be made for. Retired venues are not offered. */
export async function getRequestableVenues() {
  return prisma.venue.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      capacity: true,
      facilities: true,
      supportedLayouts: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * SCRUM-52 — every pending request, soonest first, with what Venue Staff need
 * to decide without going hunting: the venue's own capacity, facilities and
 * layouts beside what was asked for, who asked, and whether the venue is
 * actually free for that period right now — with the venue's setup and
 * turnaround counted, as approving would count them (SCRUM-159 AC3).
 */
export async function getPendingBookingQueue() {
  const pending = await prisma.booking.findMany({
    where: { status: "PENDING" },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      requestedAttendance: true,
      requiredFacilities: true,
      requestedLayout: true,
      requestNotes: true,
      createdAt: true,
      event: { select: { name: true } },
      requestedBy: { select: { name: true, email: true } },
      venue: {
        select: {
          id: true,
          name: true,
          location: true,
          capacity: true,
          facilities: true,
          supportedLayouts: true,
          setupMinutes: true,
          turnaroundMinutes: true,
        },
      },
    },
  });

  return Promise.all(
    pending.map(async (booking) => ({
      ...booking,
      blockers: await findVenueBlockers(
        prisma,
        booking.venue.id,
        occupiedPeriod(booking, booking.venue),
      ),
    })),
  );
}

export type PendingBookingRow = Awaited<
  ReturnType<typeof getPendingBookingQueue>
>[number];
export type BookableEvent = Awaited<
  ReturnType<typeof getBookableEvents>
>[number];
export type RequestableVenue = Awaited<
  ReturnType<typeof getRequestableVenues>
>[number];
