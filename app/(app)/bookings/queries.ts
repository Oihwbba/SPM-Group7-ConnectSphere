import { prisma } from "@/lib/db";
import { BOOKABLE_EVENT_STATUSES } from "@/lib/schemas/booking";
import { findVenueBlockers, occupiedPeriod } from "@/lib/venue-availability";
import { liveHoldWhere } from "@/lib/booking-holds";

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
      // SCRUM-40 AC8: who may judge a venue for it is decided by can().
      organiserId: true,
      coordinatorId: true,
      status: true,
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
      accessibilityFeatures: true,
      supportedLayouts: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * SCRUM-40 AC8 — the Coordinator's suitability judgements for these events,
 * one per event and venue, so the request form can show the one for the
 * venue chosen beside the automatic result.
 */
export async function getSuitabilityJudgements(eventIds: string[]) {
  const rows = await prisma.venueSuitabilityJudgement.findMany({
    where: { eventId: { in: eventIds } },
    select: {
      eventId: true,
      venueId: true,
      suitable: true,
      note: true,
      recordedAt: true,
      recordedBy: { select: { name: true } },
    },
  });
  return rows.map(({ recordedBy, ...row }) => ({
    ...row,
    recordedByName: recordedBy.name,
  }));
}

/**
 * SCRUM-52 — every pending request, soonest first, with what Venue Staff need
 * to decide without going hunting: the venue's own capacity, facilities and
 * layouts beside what was asked for, who asked, and whether the venue is
 * actually free for that period right now — with setup and turnaround
 * counted (SCRUM-159 AC3): a pending request's with the venue's minutes, as
 * approving or holding would copy them; a held one's with its own (AC8).
 *
 * SCRUM-163 AC7: Held bookings stay in the queue, with their expiry and note,
 * until they are confirmed, released, rejected or expire, and say whether
 * Venue Staff have approved them. One whose expiry has passed leaves at that
 * moment, even before anything marks it Expired.
 */
export async function getPendingBookingQueue(now = new Date()) {
  const pending = await prisma.booking.findMany({
    where: { OR: [{ status: "PENDING" }, liveHoldWhere(now)] },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      status: true,
      holdExpiresAt: true,
      holdNote: true,
      holdApprovedAt: true,
      startAt: true,
      endAt: true,
      setupMinutes: true,
      turnaroundMinutes: true,
      requestedAttendance: true,
      requiredFacilities: true,
      requiredAccessibilityFeatures: true,
      requestedLayout: true,
      requestNotes: true,
      createdAt: true,
      eventId: true,
      event: { select: { name: true } },
      requestedBy: { select: { name: true, email: true } },
      venue: {
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
      },
    },
  });

  // SCRUM-40 AC10 — the Coordinator's judgement for each request's event and
  // venue, if they recorded one.
  const judgements = await getSuitabilityJudgements(
    pending.map((booking) => booking.eventId),
  );
  // A held request reserves its own period, so it isn't its own blocker.
  return Promise.all(
    pending.map(async (booking) => ({
      ...booking,
      blockers: (
        await findVenueBlockers(
          prisma,
          booking.venue.id,
          occupiedPeriod(booking, booking.status === "HELD" ? booking : booking.venue),
          now,
        )
      ).filter((blocker) => blocker.id !== booking.id),
      judgement:
        judgements.find(
          (j) => j.eventId === booking.eventId && j.venueId === booking.venue.id,
        ) ?? null,
    })),
  );
}

export type PendingBookingRow = Awaited<
  ReturnType<typeof getPendingBookingQueue>
>[number];
export type BookableEvent = Awaited<
  ReturnType<typeof getBookableEvents>
>[number];
export type JudgementRow = Awaited<
  ReturnType<typeof getSuitabilityJudgements>
>[number];
export type RequestableVenue = Awaited<
  ReturnType<typeof getRequestableVenues>
>[number];
