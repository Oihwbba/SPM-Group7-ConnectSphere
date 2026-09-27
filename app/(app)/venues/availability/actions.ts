"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { violatesExclusion } from "@/lib/db-errors";
import { INVALID_PERIOD_MESSAGE } from "@/lib/schemas/booking";
import { recordUnavailabilitySchema } from "@/lib/schemas/unavailability";
import { describeBlocker, findVenueBlockers } from "@/lib/venue-availability";

/** The database refusals that mean "this period is already taken". */
const OCCUPANCY_RULES = [
  "unavailability_overlaps_booking",
  "unavailability_overlaps_unavailability",
];

/**
 * SCRUM-37 — Venue Staff record that a venue is unavailable for a reason other
 * than a booking (maintenance, closure, ...).
 *
 * - Once recorded, the period blocks requests and approvals on the same terms
 *   as an approved booking (AC3), through the same lib/venue-availability.ts
 *   lookup — there is no second rule.
 * - A period that overlaps an approved booking (or a period already recorded)
 *   is not saved; the clash is put in front of staff instead (AC4). Touching at
 *   an endpoint is not a clash (AC5).
 * - The check below is for the message. The guarantee is the database's
 *   occupancy trigger, which refuses the same overlap even when an approval
 *   lands at the same instant (ADR 0010, 2026-09-28 addendum).
 */
export async function recordUnavailability(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "unavailability:record");

    const parsed = recordUnavailabilitySchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return err(
        fieldErrors.endAt?.includes(INVALID_PERIOD_MESSAGE)
          ? INVALID_PERIOD_MESSAGE
          : "Please fix the highlighted fields.",
        fieldErrors,
      );
    }

    const data = parsed.data;
    const period = {
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
    };

    const venue = await prisma.venue.findFirst({
      where: { id: data.venueId, isActive: true },
      select: { name: true },
    });
    if (!venue) return err("Venue not found.");

    const clash = async () => {
      const blockers = await findVenueBlockers(prisma, data.venueId, period);
      return blockers.length > 0
        ? `Not recorded: ${venue.name} is ${blockers
            .map(describeBlocker)
            .join("; ")}.`
        : null;
    };

    const before = await clash();
    if (before) return err(before);

    try {
      const created = await prisma.venueUnavailability.create({
        data: {
          venueId: data.venueId,
          startAt: period.startAt,
          endAt: period.endAt,
          reason: data.reason,
          note: data.note || null,
          recordedById: user!.id,
        },
        select: { id: true },
      });
      revalidatePath("/venues/availability");
      return ok(created);
    } catch (error) {
      // An approval (or another record) committed between the check and the
      // write; the database refused this one. Show what it collided with.
      if (!OCCUPANCY_RULES.some((rule) => violatesExclusion(error, rule))) {
        throw error;
      }
      return err(
        (await clash()) ??
          "Not recorded: the venue was booked for this period at the same moment.",
      );
    }
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
