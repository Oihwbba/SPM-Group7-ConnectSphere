"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { liveBookingWhere } from "@/lib/booking-holds";
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

/** Thrown inside a catalogue transaction for an expected refusal. */
class VenueError extends Error {
  constructor(
    message: string,
    readonly affectedBookings?: string[],
  ) {
    super(message);
  }
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

/** The pages that show a venue: the catalogue, search and the request form (AC6). */
function revalidateVenue(venueId: string) {
  revalidatePath("/venues");
  revalidatePath(`/venues/${venueId}`);
  revalidatePath("/bookings/new");
  revalidatePath("/bookings");
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
 *   no longer fitting is refused, and Venue Staff are shown those bookings
 *   with why. Flagging them Needs Reconsideration so their Coordinators
 *   decide is SCRUM-26's, which isn't merged; until it is, nothing is saved,
 *   so no booking is left on details its venue no longer meets.
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
export async function updateVenue(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "venue:manage");

    const parsed = venueUpdateSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
    const { venueId, ...data } = parsed.data;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
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
        .map(({ booking, reasons }) => describeAffected(booking, reasons));
      if (affected.length > 0) {
        throw new VenueError(VENUE_CHANGE_AFFECTS_BOOKINGS_MESSAGE, affected);
      }

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
    });

    revalidateVenue(venueId);
    return ok({ id: venueId });
  } catch (error) {
    if (error instanceof VenueError) {
      return err(
        error.message,
        error.affectedBookings && { affectedBookings: error.affectedBookings },
      );
    }
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
 * AC11: a venue with future Pending, Held or Approved bookings is not
 * retired, and Venue Staff are shown those bookings. Flagging them for their
 * Coordinators is SCRUM-26's, which isn't merged; until then refusing means
 * nothing is cancelled or stranded. The venue row is locked before it is
 * read, so a second retirement waits, then finds it retired and changes
 * nothing.
 */
export async function retireVenue(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "venue:manage");

    const parsed = venueRetireSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
    const { venueId } = parsed.data;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Venue" WHERE "id" = ${venueId} FOR UPDATE`;
      const venue = await tx.venue.findUnique({
        where: { id: venueId },
        select: { name: true, isActive: true },
      });
      if (!venue) throw new VenueError("Venue not found.");
      if (!venue.isActive) throw new VenueError("This venue is already retired.");

      const bookings = await tx.booking.findMany({
        where: { venueId, endAt: { gt: now }, ...liveBookingWhere(now) },
        select: { startAt: true, status: true, event: { select: { name: true } } },
        orderBy: { startAt: "asc" },
      });
      if (bookings.length > 0) {
        throw new VenueError(
          VENUE_RETIRE_HAS_BOOKINGS_MESSAGE,
          bookings.map((booking) => describeAffected(booking, [])),
        );
      }

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
    });

    revalidateVenue(venueId);
    return ok({ id: venueId });
  } catch (error) {
    if (error instanceof VenueError) {
      return err(
        error.message,
        error.affectedBookings && { affectedBookings: error.affectedBookings },
      );
    }
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
