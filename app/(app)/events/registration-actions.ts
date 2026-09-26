"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { registerForEventSchema } from "@/lib/schemas/registration";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  computeRegistrationState,
  canRegisterNow,
} from "@/lib/registration-state";

type RegisterOutcome = { error: string } | { id: string };

/**
 * SCRUM-73/74 — an Attendee registers for a Confirmed, open event.
 *
 * "Registration capacity (SCRUM-74) — lock the Event row" (README §Two rules
 * the database cannot enforce): the capacity check and the write must happen
 * under the SAME lock, or two Attendees registering for the last place could
 * both read "one remaining" before either commits (SCRUM-74's concurrency
 * rule). Mirrors the exact pattern app/(app)/equipment/actions.ts uses for
 * its own counted pool.
 *
 * `computeRegistrationState`/`canRegisterNow` (lib/registration-state.ts) are
 * the SAME functions the browse list and detail page use to decide what to
 * show — reusing them here is what keeps "why can't I register" consistent
 * between what an Attendee sees and what the server actually enforces.
 */
export async function registerForEvent(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();

  try {
    requirePermission(session?.user, "registration:create");
    const userId = session!.user.id;

    const parsed = registerForEventSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please try again from the event page.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { eventId } = parsed.data;

    const result = await prisma.$transaction<RegisterOutcome>(async (tx) => {
      // Lock first: the capacity read below must see every registration a
      // concurrent request already committed, and no concurrent request may
      // read this event's state until this transaction is done with it.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Event" WHERE "id" = ${eventId} AND "status" = 'CONFIRMED' FOR UPDATE
      `;
      if (!locked.length) {
        return { error: "This event is not open for registration." };
      }

      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          expectedAttendance: true,
          registrationEnabled: true,
          registrationOpensAt: true,
          registrationClosesAt: true,
        },
      });

      // SCRUM-73: "The same Attendee cannot hold two active registrations
      // for the same event." The @@unique([eventId, userId]) constraint
      // means re-registering after a withdrawal must flip the SAME row
      // rather than insert a second one — so an existing row is read first,
      // both to refuse an already-REGISTERED repeat and to know whether this
      // write is an insert or a flip-back.
      const existing = await tx.registration.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { status: true },
      });
      if (existing?.status === "REGISTERED") {
        return { error: "You are already registered for this event." };
      }

      const activeCount = await tx.registration.count({
        where: { eventId, status: "REGISTERED" },
      });
      const state = computeRegistrationState(event, activeCount);
      if (!canRegisterNow(state)) {
        return {
          error:
            state === "FULL"
              ? "This event is full."
              : "Registration for this event is not currently open.",
        };
      }

      const registration = await tx.registration.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, status: "REGISTERED" },
        update: {
          status: "REGISTERED",
          registeredAt: new Date(),
          withdrawnAt: null,
        },
        select: { id: true },
      });

      return { id: registration.id };
    });

    if ("error" in result) return err(result.error);

    revalidatePath(`/events/${eventId}`);
    revalidatePath("/events");
    return ok({ id: result.id });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
