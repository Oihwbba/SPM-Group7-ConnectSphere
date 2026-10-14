"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { onceMoreOnDeadlock } from "@/lib/db-errors";
import { overlapping } from "@/lib/period";
import { INVALID_PERIOD_MESSAGE } from "@/lib/schemas/booking";
import { recordUnavailabilitySchema } from "@/lib/schemas/unavailability";
import { describeBlocker } from "@/lib/venue-availability";
import {
  affectedBookingView,
  findAffectedBookings,
  flagForUnavailability,
  lockAffectedBookings,
} from "@/lib/venue-unavailability";

/** AC2 — a booking the period affects, as Venue Staff are shown it. */
export type AffectedBookingView = ReturnType<typeof affectedBookingView>;

export type UnavailabilityOutcome =
  /** AC2: nothing saved yet; confirm these bookings to save and flag them. */
  | { recorded: false; affected: AffectedBookingView[] }
  /** `created` is false when the same unavailability was already recorded (AC8). */
  | { recorded: true; id: string; created: boolean; flagged: number };

/**
 * SCRUM-37, SCRUM-161 — Venue Staff record that a venue is unavailable for a
 * reason other than a booking.
 *
 * - The period may overlap future bookings, holds and pending requests
 *   (SCRUM-161 AC1). If it does, nothing is saved at first: each affected
 *   booking is returned for Venue Staff to see (AC2), and the period is saved
 *   once they send it again confirming every one of them. A booking that
 *   became affected in between is shown first too.
 * - Saving flags each affected booking Needs Reconsideration and tells its
 *   Coordinator (AC3, AC4); statuses, times and events don't change. Bookings
 *   whose occupied period only touches the period aren't affected.
 * - Unavailability overlapping unavailability already recorded is refused
 *   (SCRUM-37 AC3), and recording the very same period and reason again
 *   saves nothing new and flags nothing (SCRUM-161 AC8).
 * - Once recorded, the period blocks requests, holds and approvals like an
 *   approved booking (SCRUM-37 AC2, SCRUM-161 AC6), through
 *   lib/venue-availability.ts and the database's occupancy trigger.
 * - The venue is locked before anything is decided, as every approval and
 *   hold locks it, so an approval landing at the same moment is either
 *   refused or seen and flagged (AC7, ADR 0010).
 */
export async function recordUnavailability(
  input: unknown,
): Promise<ActionResult<UnavailabilityOutcome>> {
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
    const unavailability = {
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      reason: data.reason,
      note: data.note || null,
    };
    const period = {
      startAt: unavailability.startAt,
      endAt: unavailability.endAt,
    };

    const venue = await prisma.venue.findFirst({
      where: { id: data.venueId, isActive: true },
      select: { name: true },
    });
    if (!venue) return err("Venue not found.");

    const now = new Date();
    const record = () =>
      prisma.$transaction(async (tx) => {
        await lockAffectedBookings(
          tx,
          await findAffectedBookings(tx, data.venueId, period, now),
        );
        await tx.$queryRaw`SELECT "id" FROM "Venue" WHERE "id" = ${data.venueId} FOR NO KEY UPDATE`;

        const recorded = await tx.venueUnavailability.findMany({
          where: { venueId: data.venueId, ...overlapping(period) },
          select: { id: true, startAt: true, endAt: true, reason: true },
          orderBy: { startAt: "asc" },
        });
        const same = recorded.find(
          (u) =>
            u.startAt.getTime() === period.startAt.getTime() &&
            u.endAt.getTime() === period.endAt.getTime() &&
            u.reason === data.reason,
        );
        if (same) {
          return {
            recorded: true as const,
            id: same.id,
            created: false,
            flagged: 0,
          };
        }
        if (recorded.length > 0) {
          return `Not recorded: ${venue.name} is ${recorded
            .map((u) => describeBlocker({ kind: "unavailability", ...u }))
            .join("; ")}.`;
        }

        const affected = await findAffectedBookings(
          tx,
          data.venueId,
          period,
          now,
        );
        if (affected.some((b) => !data.confirmedBookingIds.includes(b.id))) {
          return {
            recorded: false as const,
            affected: affected.map(affectedBookingView),
          };
        }

        const created = await tx.venueUnavailability.create({
          data: {
            venueId: data.venueId,
            ...unavailability,
            recordedById: user!.id,
          },
          select: { id: true },
        });
        const flagged = await flagForUnavailability(
          tx,
          venue.name,
          unavailability,
          affected,
          user!.id,
          now,
        );
        return {
          recorded: true as const,
          id: created.id,
          created: true,
          flagged,
        };
      });
    const outcome = await onceMoreOnDeadlock(record);
    if (typeof outcome === "string") return err(outcome);

    if (outcome.recorded && outcome.created) {
      revalidatePath("/venues/availability");
      revalidatePath("/bookings");
      revalidatePath("/events");
    }
    return ok(outcome);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
