"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import {
  requestClarificationSchema,
  respondClarificationSchema,
} from "@/lib/schemas/clarification";
import { ok, err, type ActionResult } from "@/lib/action-result";

/**
 * SCRUM-18 — Coordinator requests clarification on a submitted/under-review
 * event. The event's own status is untouched (it stays SUBMITTED or
 * UNDER_REVIEW); "awaiting clarification" is this ClarificationRequest row,
 * not a tenth EventStatus value (see prisma/schema.prisma's note on
 * EventStatus).
 */
export async function requestClarification(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "clarification:request");

    const parsed = requestClarificationSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { eventId, message } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organiserId: true,
        coordinatorId: true,
        status: true,
        name: true,
      },
    });
    const related =
      event &&
      can(user!, "clarification:request", {
        kind: "event",
        organiserId: event.organiserId,
        coordinatorId: event.coordinatorId,
        status: event.status,
      });
    // Same not-found parity as transitionEventStatus (SCRUM-68): an event
    // this coordinator has no relationship to looks exactly like a missing
    // one, so this action can't be used to probe which event ids exist.
    if (!event || !related) return err("Event not found.");

    if (event.status !== "SUBMITTED" && event.status !== "UNDER_REVIEW") {
      return err(
        "Clarification can only be requested on a submitted or under-review request.",
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      // AC: "no second open clarification is created for the same event".
      // The check has to run under a lock on the Event row: with nothing
      // backing it, two requests could both see no OPEN row and both insert
      // one. Concurrent requests on the same event queue here, and the loser
      // sees the winner's row.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const openExisting = await tx.clarificationRequest.findFirst({
        where: { eventId, status: "OPEN" },
        select: { id: true },
      });
      if (openExisting) return null;

      const clarification = await tx.clarificationRequest.create({
        data: { eventId, requestedById: user!.id, message },
        select: { id: true },
      });

      await tx.notification.create({
        data: {
          userId: event.organiserId,
          type: "CLARIFICATION_REQUESTED",
          title: "Clarification requested",
          message: `Your coordinator has asked a question about "${event.name}".`,
          eventId,
        },
      });

      return clarification;
    });

    if (!created) {
      return err("There is already an open clarification request on this event.");
    }

    revalidatePath("/events");
    return ok({ id: created.id });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-18/17 — the current clarification thread for an event: the most
 * recent request, whether still OPEN or already ANSWERED. Read-gated the
 * same way as the write actions above, so an unrelated user sees nothing.
 */
export async function getClarificationForEvent(eventId: string): Promise<
  ActionResult<{
    clarification: {
      id: string;
      message: string;
      status: string;
      response: string | null;
      createdAt: Date;
      respondedAt: Date | null;
    } | null;
  }>
> {
  const session = await auth();
  const user = session?.user;
  if (!user) return err("Not signed in.");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organiserId: true, coordinatorId: true, status: true },
  });
  const related =
    event &&
    (can(user, "clarification:request", {
      kind: "event",
      organiserId: event.organiserId,
      coordinatorId: event.coordinatorId,
      status: event.status,
    }) ||
      can(user, "clarification:respond", {
        kind: "event",
        organiserId: event.organiserId,
        coordinatorId: event.coordinatorId,
        status: event.status,
      }));
  if (!event || !related) return err("Event not found.");

  const clarification = await prisma.clarificationRequest.findFirst({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      message: true,
      status: true,
      response: true,
      createdAt: true,
      respondedAt: true,
    },
  });

  return ok({ clarification });
}

/**
 * SCRUM-18 — Organiser answers an open clarification request. Marks it
 * ANSWERED so the Coordinator can see the reply and re-review; does not
 * change the event's own status.
 */
export async function respondToClarification(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "clarification:respond");

    const parsed = respondClarificationSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { clarificationId, response } = parsed.data;

    const clarification = await prisma.clarificationRequest.findUnique({
      where: { id: clarificationId },
      select: {
        id: true,
        status: true,
        event: {
          select: {
            id: true,
            name: true,
            organiserId: true,
            coordinatorId: true,
            status: true,
          },
        },
      },
    });

    const related =
      clarification &&
      can(user!, "clarification:respond", {
        kind: "event",
        organiserId: clarification.event.organiserId,
        coordinatorId: clarification.event.coordinatorId,
        status: clarification.event.status,
      });
    if (!clarification || !related) return err("Clarification request not found.");

    if (clarification.status !== "OPEN") {
      return err("This clarification request has already been answered.");
    }

    const answered = await prisma.$transaction(async (tx) => {
      // Claim the OPEN row atomically. The status check above ran before this
      // transaction, so two simultaneous replies could both pass it; only one
      // update can still match `status: "OPEN"`, and the other must not
      // overwrite the first reply or send a second notification.
      const claimed = await tx.clarificationRequest.updateMany({
        where: { id: clarificationId, status: "OPEN" },
        data: { status: "ANSWERED", response, respondedAt: new Date() },
      });
      if (claimed.count === 0) return false;

      if (clarification.event.coordinatorId) {
        await tx.notification.create({
          data: {
            userId: clarification.event.coordinatorId,
            type: "CLARIFICATION_REQUESTED",
            title: "Clarification answered",
            message: `The organiser replied about "${clarification.event.name}".`,
            eventId: clarification.event.id,
          },
        });
      }

      return true;
    });

    if (!answered) {
      return err("This clarification request has already been answered.");
    }

    revalidatePath("/events");
    return ok({ id: clarificationId });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}