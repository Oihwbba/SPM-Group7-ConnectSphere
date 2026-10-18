"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import {
  registerForEventSchema,
  withdrawRegistrationSchema,
} from "@/lib/schemas/registration";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  computeRegistrationState,
  canRegisterNow,
  remainingCapacity,
  totalCapacity,
} from "@/lib/registration-state";
import { notifyAboutEvent } from "@/lib/event-notifications";

type RegisterOutcome = { error: string } | { id: string };

/**
 * SCRUM-73/74 — an Attendee registers for a Confirmed, open event.
 *
 * "Registration capacity (SCRUM-74): lock the Event row" (README, "Two rules
 * the database cannot enforce"): the capacity check and the write must happen
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
      // SCRUM-171 AC4: an event that doesn't need registration takes none,
      // as if it weren't listed. NULL (requested before the choice existed)
      // still takes registrations, hence IS DISTINCT FROM.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Event"
        WHERE "id" = ${eventId} AND "status" = 'CONFIRMED'
          AND "registrationRequired" IS DISTINCT FROM false
        FOR UPDATE
      `;
      if (!locked.length) {
        return { error: "This event is not open for registration." };
      }

      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          name: true,
          organiserId: true,
          coordinatorId: true,
          expectedAttendance: true,
          registrationEnabled: true,
          registrationOpensAt: true,
          registrationClosesAt: true,
          startAt: true,
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

      // SCRUM-45 AC11: this registration took the last place.
      if (remainingCapacity(event, activeCount + 1) === 0) {
        await notifyAboutEvent(
          tx,
          [event.organiserId, event.coordinatorId],
          { id: eventId, name: event.name },
          {
            title: "Registration is full",
            message: `"${event.name}" has reached its capacity of ${totalCapacity(event)}.`,
          },
        );
      }

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

type WithdrawOutcome = { error: string } | { id: string; eventId: string };

/**
 * SCRUM-74/77 (partial) — an Attendee withdraws their own registration, so a
 * place they no longer need reopens for someone else. Only the slice SCRUM-74
 * actually needs is built here: status flips to WITHDRAWN (so it drops out of
 * the REGISTERED count `registerForEvent` and the browse/detail pages already
 * query) under the same event-row lock discipline, with the Attendee's own
 * Withdraw button on the detail page (./withdraw-button.tsx) as its entry
 * point. No organiser/coordinator registration view and no event-start-instant
 * cutoff — those are SCRUM-77's own remaining scope, not this one's.
 */
export async function withdrawRegistration(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();

  try {
    requirePermission(session?.user, "registration:withdraw");
    const userId = session!.user.id;

    const parsed = withdrawRegistrationSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please try again from your registrations.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { registrationId } = parsed.data;

    const result = await prisma.$transaction<WithdrawOutcome>(async (tx) => {
      // Not-found parity: someone else's registration id must look exactly
      // like a missing one, never "found but forbidden".
      const registration = await tx.registration.findUnique({
        where: { id: registrationId },
        select: { id: true, eventId: true, userId: true, status: true },
      });
      if (!registration || registration.userId !== userId) {
        return { error: "Registration not found." };
      }

      // Idempotent fast path: an already-terminal registration needs no
      // write and no lock — no capacity-affecting change is about to happen.
      if (registration.status !== "REGISTERED") {
        return { id: registration.id, eventId: registration.eventId };
      }

      // Same discipline as registerForEvent: lock the Event row so a
      // withdrawal and a concurrent registration for the place it just freed
      // can never interleave unsafely.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${registration.eventId} FOR UPDATE`;
      const event = await tx.event.findUniqueOrThrow({
        where: { id: registration.eventId },
        select: {
          id: true,
          name: true,
          organiserId: true,
          coordinatorId: true,
          expectedAttendance: true,
        },
      });
      const activeBefore = await tx.registration.count({
        where: { eventId: event.id, status: "REGISTERED" },
      });

      // Self-guarding write (ADR 0006's discipline, mirrored from
      // respondToClarification): the update only claims a row still
      // REGISTERED, so a stale read from before the lock can never overwrite
      // a status some other transition already moved this row to in the
      // meantime. Zero rows claimed is just another already-withdrawn no-op.
      const withdrawn = await tx.registration.updateMany({
        where: { id: registrationId, status: "REGISTERED" },
        data: { status: "WITHDRAWN", withdrawnAt: new Date() },
      });

      // SCRUM-45 AC11: an Attendee withdrew from a full event, so a place
      // is open again. An event with no capacity set was never full.
      if (
        withdrawn.count === 1 &&
        totalCapacity(event) > 0 &&
        remainingCapacity(event, activeBefore) === 0
      ) {
        await notifyAboutEvent(
          tx,
          [event.organiserId, event.coordinatorId],
          event,
          {
            title: "A place opened at a full event",
            message: `An attendee withdrew from "${event.name}", which was full, so one place is open again.`,
          },
        );
      }

      return { id: registration.id, eventId: registration.eventId };
    });

    if ("error" in result) return err(result.error);

    revalidatePath(`/events/${result.eventId}`);
    revalidatePath("/events");
    return ok({ id: result.id });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
