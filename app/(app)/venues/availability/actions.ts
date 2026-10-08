"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { INVALID_PERIOD_MESSAGE } from "@/lib/schemas/booking";
import { recordUnavailabilitySchema } from "@/lib/schemas/unavailability";
import { describeBlocker, findVenueBlockers } from "@/lib/venue-availability";

/**
 * SCRUM-37 — Venue Staff record that a venue is unavailable for a reason other
 * than a booking (maintenance, closure, ...).
 *
 * - Once recorded, the period blocks requests and approvals on the same terms
 *   as an approved booking (AC2), through the same lib/venue-availability.ts
 *   lookup — there is no second rule.
 * - A period that overlaps an approved booking (or a period already recorded)
 *   is not saved; the clash is put in front of staff instead (AC3). Touching at
 *   an endpoint is not a clash (AC5).
 * - Since SCRUM-172 the database lets unavailability overlap a booking, for
 *   SCRUM-161, which will save it and flag the booking instead. Until then
 *   this action keeps the refusal itself: the check and the write run under
 *   the venue lock every approval takes (the occupancy trigger), so an
 *   approval can't land between them (ADR 0010, 2026-10-08 addendum).
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

    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Venue" WHERE "id" = ${data.venueId} FOR NO KEY UPDATE`;

      const blockers = await findVenueBlockers(tx, data.venueId, period);
      if (blockers.length > 0) {
        return {
          kind: "clash" as const,
          message: `Not recorded: ${venue.name} is ${blockers
            .map(describeBlocker)
            .join("; ")}.`,
        };
      }

      const created = await tx.venueUnavailability.create({
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
      return { kind: "created" as const, created };
    });
    if (outcome.kind === "clash") return err(outcome.message);

    revalidatePath("/venues/availability");
    return ok(outcome.created);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
