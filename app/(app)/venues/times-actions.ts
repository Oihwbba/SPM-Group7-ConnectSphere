"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { venueTimesChangeSchema } from "@/lib/schemas/venue";
import { lockVenueTimes } from "@/lib/venue-availability";
import {
  describeClash,
  findTimeClashes,
  flagTimeClashes,
  lengthens,
} from "@/lib/venue-time-clashes";

/** AC1 — a booking the change would make clash, as Venue Staff are shown it. */
export type ClashPreview = {
  bookingId: string;
  eventName: string;
  coordinatorName: string | null;
  startAt: Date;
  endAt: Date;
  clashesWith: string;
};

export type VenueTimesOutcome =
  | { saved: false; clashes: ClashPreview[] }
  | { saved: true; flagged: number };

/**
 * SCRUM-160 — Venue Staff save a venue's setup and turnaround time. The edit
 * form is SCRUM-34's; this is the save it calls.
 *
 * - Lengthening either time first returns the bookings it would make clash,
 *   unsaved (AC1). Sent again with `confirmed`, the times are saved and those
 *   bookings flagged in the same transaction (AC2, AC3).
 * - Shortening, or lengthening with no clash, just saves (AC6). Saving the
 *   same times changes nothing (AC7).
 * - The venue row is locked first, as an approval locks it, so no booking is
 *   approved with the old minutes while the clashes are being found.
 */
export async function changeVenueTimes(
  input: unknown,
): Promise<ActionResult<VenueTimesOutcome>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "venue:edit");

    const parsed = venueTimesChangeSchema.safeParse(input);
    if (!parsed.success) {
      return err("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
    }
    const { venueId, confirmed, ...times } = parsed.data;

    const now = new Date();
    const outcome = await prisma.$transaction(async (tx) => {
      const before = await lockVenueTimes(tx, venueId);
      if (!before) return null;
      if (
        before.setupMinutes === times.setupMinutes &&
        before.turnaroundMinutes === times.turnaroundMinutes
      ) {
        return { saved: true as const, flagged: 0 };
      }

      const clashes = lengthens(before, times)
        ? await findTimeClashes(tx, venueId, times, now)
        : [];
      if (clashes.length > 0 && !confirmed) {
        return {
          saved: false as const,
          clashes: clashes.map(
            (c): ClashPreview => ({
              bookingId: c.booking.id,
              eventName: c.booking.eventName,
              coordinatorName: c.booking.coordinatorName,
              startAt: c.booking.startAt,
              endAt: c.booking.endAt,
              clashesWith: describeClash(c.with, true),
            }),
          ),
        };
      }

      const venue = await tx.venue.update({
        where: { id: venueId },
        data: times,
        select: { name: true },
      });
      await tx.auditLog.createMany({
        data: (["setupMinutes", "turnaroundMinutes"] as const)
          .filter((field) => before[field] !== times[field])
          .map((field) => ({
            entityType: "Venue",
            entityId: venueId,
            action: "UPDATED",
            actorId: user!.id,
            fieldName: field,
            oldValue: String(before[field]),
            newValue: String(times[field]),
          })),
      });
      const flagged = await flagTimeClashes(tx, venue, clashes, user!.id, now);
      return { saved: true as const, flagged };
    });
    if (!outcome) return err("Venue not found.");

    if (outcome.saved) {
      revalidatePath("/bookings");
      revalidatePath("/events");
    }
    return ok(outcome);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
