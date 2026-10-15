"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { liveBookingWhere } from "@/lib/booking-holds";
import { flagArrangements } from "@/lib/reconsideration";
import {
  openingHoursRows,
  VENUE_CHANGE_AFFECTS_BOOKINGS_MESSAGE,
  VENUE_RETIRE_HAS_BOOKINGS_MESSAGE,
  venueRetireSchema,
  venueSchema,
  venueUpdateSchema,
  type VenueData,
} from "@/lib/schemas/venue";
import { describeAffected, newlyUnfit } from "@/lib/venue-changes";

/** A future booking a change affects, as Venue Staff are shown it (AC10, AC11). */
type Affected = { id: string; line: string; reason: string };

/** Thrown inside a catalogue transaction for an expected refusal. */
class VenueError extends Error {
  constructor(
    message: string,
    readonly affected?: Affected[],
  ) {
    super(message);
  }
}

function refused(error: VenueError) {
  return err(
    error.message,
    error.affected && {
      affectedBookings: error.affected.map((a) => a.line),
      affectedBookingIds: error.affected.map((a) => a.id),
    },
  );
}

/**
 * AC10, AC11 — the change waits until Venue Staff have seen every booking it
 * affects. A booking that became affected after they were warned (a new
 * request, or a different edit) warns again, with the list as it is now.
 */
function requireConfirmed(affected: Affected[], confirmedIds: string[], message: string) {
  const confirmed = new Set(confirmedIds);
  if (affected.some(({ id }) => !confirmed.has(id))) {
    throw new VenueError(message, affected);
  }
}

/**
 * AC10, AC11 — flag the affected bookings Needs Reconsideration (SCRUM-26),
 * each with its own reason, for its Coordinator to decide. Nothing is
 * cancelled and no status changes.
 */
async function flagAffected(tx: Prisma.TransactionClient, affected: Affected[], now: Date) {
  let flagged = 0;
  for (const { id, reason } of affected) {
    const result = await flagArrangements(
      tx,
      { bookingIds: [id], reservationIds: [] },
      reason,
      now,
    );
    flagged += result.bookings;
  }
  return flagged;
}

function invalid(fieldErrors: Record<string, string[] | undefined>) {
  return err(
    "Please fix the highlighted fields.",
    fieldErrors as Record<string, string[]>,
  );
}

function venueFields(venue: VenueData) {
  return {
    name: venue.name,
    location: venue.location,
    capacity: venue.capacity,
    facilities: venue.facilities,
    accessibilityFeatures: venue.accessibilityFeatures,
    supportedLayouts: venue.supportedLayouts,
    setupMinutes: venue.setupMinutes,
    turnaroundMinutes: venue.turnaroundMinutes,
    knownRestrictions: venue.knownRestrictions || null,
  };
}

/**
 * The pages that show a venue: the catalogue, search and the request form
 * (AC6), and the events whose bookings were flagged.
 */
function revalidateVenue(venueId: string, flagged = 0) {
  revalidatePath("/venues");
  revalidatePath(`/venues/${venueId}`);
  revalidatePath("/bookings/new");
  revalidatePath("/bookings");
  if (flagged > 0) revalidatePath("/events");
}

/**
 * SCRUM-34 AC3–AC5 — Venue Staff add a venue: name, location, capacity and
 * opening hours for each day are required; setup and turnaround start at 0;
 * known restrictions are optional. An invalid capacity or a day whose closing
 * time isn't after its opening time is reported against that field, and
 * nothing is saved (the database refuses such hours too,
 * `venue_opening_hours_valid`).
 */
export async function createVenue(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "venue:manage");

    const parsed = venueSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);

    const venue = await prisma.$transaction(async (tx) => {
      const created = await tx.venue.create({
        data: {
          ...venueFields(parsed.data),
          openingHours: { create: openingHoursRows(parsed.data) },
        },
        select: { id: true },
      });
      // SCRUM-71: who added which venue, and when.
      await tx.auditLog.create({
        data: {
          entityType: "Venue",
          entityId: created.id,
          action: "CREATED",
          actorId: user!.id,
          summary: parsed.data.name,
        },
      });
      return created;
    });

    revalidateVenue(venue.id);
    return ok(venue);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-34 AC6, AC10–AC12 — Venue Staff edit a venue; the change shows at
 * once wherever the venue is read (AC6).
 *
 * - AC10: a change to capacity, facilities, accessibility features, layouts
 *   or opening hours that leaves a future Pending, Held or Approved booking
 *   no longer fitting isn't saved at first: Venue Staff are warned and shown
 *   those bookings with why. Once they confirm, the change is saved and the
 *   bookings are flagged Needs Reconsideration (SCRUM-26) for their
 *   Coordinators to decide.
 * - AC12: opening hours only judge a booking's own period; setup or
 *   turnaround outside the new hours doesn't count (SCRUM-159 AC9 warns).
 * - A booking that already didn't fit in the same way doesn't count: the
 *   edit didn't cause it (a request isn't refused for a missing facility
 *   or layout, SCRUM-50).
 * - A longer setup or turnaround time is saved as entered; the clashes it
 *   creates are SCRUM-160's.
 *
 * The venue row is locked first, so two edits, or an edit and a retirement,
 * can't both judge the bookings against a venue the other is changing.
 */
export async function updateVenue(
  input: unknown,
): Promise<ActionResult<{ id: string; flagged: number }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "venue:manage");

    const parsed = venueUpdateSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
    const { venueId, confirmedBookingIds, ...data } = parsed.data;
    const now = new Date();

    const flagged = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Venue" WHERE "id" = ${venueId} FOR UPDATE`;
      const current = await tx.venue.findUnique({
        where: { id: venueId },
        select: {
          isActive: true,
          capacity: true,
          facilities: true,
          supportedLayouts: true,
          openingHours: {
            select: { weekday: true, opensMinute: true, closesMinute: true },
          },
        },
      });
      if (!current) throw new VenueError("Venue not found.");
      if (!current.isActive) {
        throw new VenueError("A retired venue can't be edited.");
      }

      const after = { ...data, openingHours: openingHoursRows(data) };
      const bookings = await tx.booking.findMany({
        where: { venueId, endAt: { gt: now }, ...liveBookingWhere(now) },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          status: true,
          requestedAttendance: true,
          requiredFacilities: true,
          requestedLayout: true,
          event: { select: { name: true } },
        },
        orderBy: { startAt: "asc" },
      });
      const affected = bookings
        .map((booking) => ({ booking, reasons: newlyUnfit(current, after, booking) }))
        .filter(({ reasons }) => reasons.length > 0)
        .map(({ booking, reasons }) => ({
          id: booking.id,
          line: describeAffected(booking, reasons),
          reason: `${data.name} changed: ${reasons.join("; ")}`,
        }));
      requireConfirmed(affected, confirmedBookingIds, VENUE_CHANGE_AFFECTS_BOOKINGS_MESSAGE);

      await tx.venue.update({ where: { id: venueId }, data: venueFields(data) });
      for (const day of after.openingHours) {
        await tx.venueOpeningHours.upsert({
          where: { venueId_weekday: { venueId, weekday: day.weekday } },
          create: { venueId, ...day },
          update: { opensMinute: day.opensMinute, closesMinute: day.closesMinute },
        });
      }
      // SCRUM-71: who changed the venue, and when.
      await tx.auditLog.create({
        data: {
          entityType: "Venue",
          entityId: venueId,
          action: "UPDATED",
          actorId: user!.id,
          summary: data.name,
        },
      });
      return flagAffected(tx, affected, now);
    });

    revalidateVenue(venueId, flagged);
    return ok({ id: venueId, flagged });
  } catch (error) {
    if (error instanceof VenueError) return refused(error);
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-34 AC8, AC11 — Venue Staff retire a venue. A retired venue leaves
 * search, filtering, the request form and new booking requests, which all
 * read active venues only; it is never deleted, so the bookings that name it
 * stay readable.
 *
 * AC11: a venue with future Pending, Held or Approved bookings isn't
 * retired at first: Venue Staff are warned and shown those bookings. Once
 * they confirm, it is retired and the bookings are flagged Needs
 * Reconsideration (SCRUM-26); none is cancelled. The venue row is locked
 * before it is read, so a second retirement waits, then finds it retired and
 * changes nothing.
 */
export async function retireVenue(
  input: unknown,
): Promise<ActionResult<{ id: string; flagged: number }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "venue:manage");

    const parsed = venueRetireSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
    const { venueId, confirmedBookingIds } = parsed.data;
    const now = new Date();

    const flagged = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Venue" WHERE "id" = ${venueId} FOR UPDATE`;
      const venue = await tx.venue.findUnique({
        where: { id: venueId },
        select: { name: true, isActive: true },
      });
      if (!venue) throw new VenueError("Venue not found.");
      if (!venue.isActive) throw new VenueError("This venue is already retired.");

      const bookings = await tx.booking.findMany({
        where: { venueId, endAt: { gt: now }, ...liveBookingWhere(now) },
        select: { id: true, startAt: true, status: true, event: { select: { name: true } } },
        orderBy: { startAt: "asc" },
      });
      const affected = bookings.map((booking) => ({
        id: booking.id,
        line: describeAffected(booking, []),
        reason: `${venue.name} has been retired.`,
      }));
      requireConfirmed(affected, confirmedBookingIds, VENUE_RETIRE_HAS_BOOKINGS_MESSAGE);

      await tx.venue.update({ where: { id: venueId }, data: { isActive: false } });
      await tx.auditLog.create({
        data: {
          entityType: "Venue",
          entityId: venueId,
          action: "RETIRED",
          actorId: user!.id,
          fieldName: "isActive",
          oldValue: "true",
          newValue: "false",
          summary: venue.name,
        },
      });
      return flagAffected(tx, affected, now);
    });

    revalidateVenue(venueId, flagged);
    return ok({ id: venueId, flagged });
  } catch (error) {
    if (error instanceof VenueError) return refused(error);
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
