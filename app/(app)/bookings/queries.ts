import { prisma } from "@/lib/db";
import { BOOKABLE_EVENT_STATUSES } from "@/lib/schemas/booking";

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

export type BookableEvent = Awaited<
  ReturnType<typeof getBookableEvents>
>[number];
export type RequestableVenue = Awaited<
  ReturnType<typeof getRequestableVenues>
>[number];
