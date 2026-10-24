"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import {
  fieldOfChange,
  requestClarificationSchema,
  respondClarificationSchema,
  type ClarificationChanges,
} from "@/lib/schemas/clarification";
import { ok, err, errorsByField, type ActionResult } from "@/lib/action-result";

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
    const { eventId, message, editableFields } = parsed.data;

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

    const outcome = await prisma.$transaction(async (tx) => {
      // AC: "no second open clarification is created for the same event".
      // The check has to run under a lock on the Event row: with nothing
      // backing it, two requests could both see no OPEN row and both insert
      // one. Concurrent requests on the same event queue here, and the loser
      // sees the winner's row.
      const [locked] = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE
      `;
      // The status read above the transaction can be stale: a decision that
      // committed in between has already closed the event's clarifications, so
      // inserting here would leave a fresh OPEN one on a decided event.
      if (
        !locked ||
        (locked.status !== "SUBMITTED" && locked.status !== "UNDER_REVIEW")
      ) {
        return { kind: "not-reviewable" } as const;
      }
      const openExisting = await tx.clarificationRequest.findFirst({
        where: { eventId, status: "OPEN" },
        select: { id: true },
      });
      if (openExisting) return { kind: "duplicate" } as const;

      const clarification = await tx.clarificationRequest.create({
        data: { eventId, requestedById: user!.id, message, editableFields },
        select: { id: true },
      });

      await tx.notification.create({
        data: {
          userId: event.organiserId,
          type: "CLARIFICATION_REQUESTED",
          title: "Clarification requested",
          // SCRUM-45 AC8: with what is needed.
          message: `Your coordinator has asked a question about "${event.name}": ${message}`,
          eventId,
        },
      });

      return { kind: "created", id: clarification.id } as const;
    });

    if (outcome.kind === "not-reviewable") {
      return err(
        "Clarification can only be requested on a submitted or under-review request.",
      );
    }
    if (outcome.kind === "duplicate") {
      return err("There is already an open clarification request on this event.");
    }

    revalidatePath("/events");
    return ok({ id: outcome.id });
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
type ClarificationRow = {
  id: string;
  message: string;
  editableFields: string[];
  status: string;
  response: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  /** SCRUM-208 AC3: who asked; the Organiser answers. */
  requestedBy: { name: string | null };
};

/**
 * The event's clarification thread for a related user: the latest question,
 * which may still be open, and the earlier ones, oldest first, so the thread
 * reads as one log of questions and answers (shared page conventions).
 */
export async function getClarificationForEvent(eventId: string): Promise<
  ActionResult<{
    clarification: ClarificationRow | null;
    earlier: ClarificationRow[];
    organiserName: string | null;
  }>
> {
  const session = await auth();
  const user = session?.user;
  if (!user) return err("Not signed in.");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organiserId: true,
      coordinatorId: true,
      status: true,
      organiser: { select: { name: true } },
    },
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
      editableFields: true,
      status: true,
      response: true,
      createdAt: true,
      respondedAt: true,
      requestedBy: { select: { name: true } },
    },
  });
  const earlier = clarification
    ? await prisma.clarificationRequest.findMany({
        where: { eventId, id: { not: clarification.id } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          message: true,
          editableFields: true,
          status: true,
          response: true,
          createdAt: true,
          respondedAt: true,
          requestedBy: { select: { name: true } },
        },
      })
    : [];

  return ok({ clarification, earlier, organiserName: event.organiser.name });
}

/**
 * SCRUM-18 — Organiser answers an open clarification request. Marks it
 * ANSWERED so the Coordinator can see the reply and re-review; does not
 * change the event's own status. SCRUM-108: the answer may also change the
 * fields the Coordinator named (AC2), and no others (AC5); saving the same
 * answer again changes nothing (AC4); the answer and each change are recorded
 * with who and when (AC14).
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
      return err("Please fix the highlighted fields.", errorsByField(parsed.error));
    }
    const { clarificationId, response, changes } = parsed.data;

    const clarification = await prisma.clarificationRequest.findUnique({
      where: { id: clarificationId },
      select: {
        id: true,
        status: true,
        response: true,
        editableFields: true,
        requestedById: true,
        event: {
          select: {
            id: true,
            organiserId: true,
            coordinatorId: true,
            status: true,
            name: true,
            purpose: true,
            description: true,
            startAt: true,
            endAt: true,
            expectedAttendance: true,
            venueRequirements: true,
            accessibilityNeeds: true,
            preferredLayout: true,
            equipmentRequirements: true,
            registrationNotes: true,
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

    // AC4: the same answer saved again (a double-click, a retry) is a no-op.
    if (
      clarification.status === "ANSWERED" &&
      clarification.response === response
    ) {
      return ok({ id: clarificationId });
    }
    if (clarification.status !== "OPEN") {
      return err(CLOSED_MESSAGE[clarification.status]);
    }
    if (!REVIEWABLE.includes(clarification.event.status)) {
      return err(NOT_REVIEWABLE);
    }

    // AC5: anything the Coordinator didn't name goes through a change request.
    const keys = Object.keys(changes) as (keyof ClarificationChanges)[];
    if (
      keys.some(
        (key) => !clarification.editableFields.includes(fieldOfChange(key)),
      )
    ) {
      return err(
        "Only the fields your coordinator named can be changed here. Use a change request for anything else.",
      );
    }

    // Only values that actually differ are written and recorded.
    const event = clarification.event;
    const update: Prisma.EventUpdateInput = {};
    const changed: { fieldName: string; oldValue: string | null; newValue: string }[] = [];
    for (const key of keys) {
      const next =
        key === "startAt" || key === "endAt"
          ? new Date(changes[key]!)
          : changes[key]!;
      const current = event[key];
      const same =
        next instanceof Date
          ? current instanceof Date && current.getTime() === next.getTime()
          : current === next;
      if (same) continue;
      Object.assign(update, { [key]: next });
      changed.push({
        fieldName: key,
        oldValue: asText(current),
        newValue: asText(next)!,
      });
    }

    const answered = await prisma.$transaction(async (tx) => {
      // The event's status read above can be stale: a cancellation or decision
      // that committed in between has closed the question, and answering it
      // would rewrite an event that is no longer under review (SCRUM-82).
      const [locked] = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status" FROM "Event" WHERE "id" = ${event.id} FOR UPDATE
      `;
      if (!locked || !REVIEWABLE.includes(locked.status)) return "not-reviewable" as const;

      // Claim the OPEN row atomically. The status check above ran before this
      // transaction, so two simultaneous replies could both pass it; only one
      // update can still match `status: "OPEN"`, and the other must not
      // overwrite the first reply or send a second notification.
      const claimed = await tx.clarificationRequest.updateMany({
        where: { id: clarificationId, status: "OPEN" },
        data: { status: "ANSWERED", response, respondedAt: new Date() },
      });
      if (claimed.count === 0) return "taken" as const;

      if (changed.length > 0) {
        await tx.event.update({ where: { id: event.id }, data: update });
      }
      await tx.auditLog.createMany({
        data: [
          {
            entityType: "Event",
            entityId: event.id,
            action: "CLARIFICATION_ANSWERED",
            actorId: user!.id,
            summary: response,
          },
          ...changed.map((change) => ({
            entityType: "Event",
            entityId: event.id,
            action: "UPDATED",
            actorId: user!.id,
            ...change,
            summary: "Changed in a clarification answer (SCRUM-108)",
          })),
        ],
      });

      // Tell whoever asked: on an unclaimed event there is no coordinatorId
      // yet, and after a reassignment the current coordinator is interested
      // too, so notify both when they differ.
      const recipients = new Set(
        [clarification.requestedById, clarification.event.coordinatorId].filter(
          (id): id is string => !!id,
        ),
      );
      await tx.notification.createMany({
        data: [...recipients].map((userId) => ({
          userId,
          type: "CLARIFICATION_REQUESTED" as const,
          title: "Clarification answered",
          message: `The organiser replied about "${clarification.event.name}".`,
          eventId: clarification.event.id,
        })),
      });

      return "answered" as const;
    });

    if (answered === "not-reviewable") return err(NOT_REVIEWABLE);
    if (answered === "taken") {
      return err("This clarification request has already been answered.");
    }

    revalidatePath("/events");
    return ok({ id: clarificationId });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/** A question can be answered only while its event is being reviewed. */
const REVIEWABLE: string[] = ["SUBMITTED", "UNDER_REVIEW"];

const NOT_REVIEWABLE =
  "This event is no longer under review, so the question can't be answered.";

const CLOSED_MESSAGE = {
  ANSWERED: "This clarification request has already been answered.",
  CLOSED: "This clarification request was closed when the event was decided or cancelled.",
} as const;

/** A field's value as the history records it. */
function asText(value: string | number | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}
