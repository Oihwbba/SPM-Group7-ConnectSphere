"use server";

import { revalidatePath } from "next/cache";
import type { ChangeRequestStatus, EventStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { auditValue } from "@/lib/audit-value";
import { fieldOfChange } from "@/lib/schemas/clarification";
import {
  CHANGEABLE_FIELDS,
  CHANGE_KEYS,
  IMPACTFUL_FIELDS,
  NO_CHANGE_MESSAGE,
  raiseChangeRequestSchema,
  type ChangeKey,
  type ChangeRequestChanges,
  type FieldChange,
} from "@/lib/schemas/change-request";
import { ok, err, errorsByField, type ActionResult } from "@/lib/action-result";

/** The event's current values, which a change request records as the old ones. */
const CURRENT_VALUES = Object.fromEntries(
  CHANGE_KEYS.map((key) => [key, true]),
) as { [K in ChangeKey]: true };

type CurrentValues = Record<ChangeKey, string | number | Date | null>;

type Relationship = { coordinatorId: string | null; status: EventStatus };

const CHANGEABLE_STATUSES: EventStatus[] = ["UNDER_REVIEW", "PLANNING", "CONFIRMED"];

const REFUSAL: Partial<Record<EventStatus, string>> = {
  DRAFT: "A draft isn't submitted yet. Edit it directly instead.",
  REJECTED:
    "This request was rejected. Follow the next step under the rejection reason to amend it.",
  CANCELLED: "A cancelled or completed event can't be changed.",
  COMPLETED: "A cancelled or completed event can't be changed.",
};

/**
 * SCRUM-41 AC1, AC2 — a change request can be raised on an event Under
 * Review, in Planning or Confirmed, once it has a Coordinator; anything else
 * gets the reason it can't.
 */
function refusalFor(event: Relationship): string | null {
  if (CHANGEABLE_STATUSES.includes(event.status) && event.coordinatorId) return null;
  return (
    REFUSAL[event.status] ??
    "This request is waiting for a coordinator to be assigned. It can't be changed until then."
  );
}

/** Only the requested values that differ from the event's, as they are recorded. */
function changedFields(current: CurrentValues, changes: ChangeRequestChanges) {
  const fields: FieldChange[] = [];
  for (const key of Object.keys(changes) as ChangeKey[]) {
    const requested = changes[key]!;
    const next = key === "startAt" || key === "endAt" ? new Date(requested) : requested;
    const oldValue = auditValue(current[key]);
    const newValue = auditValue(next);
    if (oldValue === newValue) continue;
    fields.push({
      fieldName: key,
      oldValue,
      newValue,
      isMajor: IMPACTFUL_FIELDS.includes(fieldOfChange(key)),
    });
  }
  return fields;
}

/** The fields a list of changes touches, as the Organiser reads them. */
function labelsOf(fieldNames: string[]): string[] {
  return [
    ...new Set(
      fieldNames.map((name) => CHANGEABLE_FIELDS[fieldOfChange(name as ChangeKey)]),
    ),
  ];
}

/**
 * SCRUM-41 — the Organiser, or the assigned Coordinator on their behalf
 * (AC9), asks for changes to a submitted event, or for its cancellation. The
 * event's values don't change (AC6): deciding and applying is SCRUM-128.
 *
 * Everything that decides whether the request may be raised is re-read under
 * a lock on the event row (ADR 0007's order: the event first), so two requests
 * at once can't both be created (AC7), and a decision or a clarification that
 * commits in between is seen.
 */
export async function raiseChangeRequest(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "change-request:raise");

    const parsed = raiseChangeRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err("Please fix the highlighted fields.", errorsByField(parsed.error));
    }
    const { eventId, changes, requestsCancellation, reason } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organiserId: true,
        coordinatorId: true,
        status: true,
        discardedAt: true,
      },
    });
    // SCRUM-68: an event the caller can't see looks exactly like a missing one.
    // AC10: only its Organiser and its assigned Coordinator may raise one;
    // since SCRUM-165 AC8 they are also exactly the people who can see it.
    if (
      !event ||
      event.discardedAt ||
      !can(user!, "change-request:raise", { kind: "event", ...event })
    ) {
      return err("Event not found.");
    }
    const refusal = refusalFor(event);
    if (refusal) return err(refusal);

    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const current = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          ...CURRENT_VALUES,
          organiserId: true,
          coordinatorId: true,
          status: true,
        },
      });
      const lateRefusal = refusalFor(current);
      if (lateRefusal) return { kind: "refused", message: lateRefusal } as const;
      if (!can(user!, "change-request:raise", { kind: "event", ...current })) {
        return { kind: "reassigned" } as const;
      }

      const open = await tx.eventChangeRequest.findFirst({
        where: { eventId, status: "PENDING_REVIEW" },
        select: { id: true },
      });
      if (open) return { kind: "duplicate" } as const;

      const fields = requestsCancellation ? [] : changedFields(current, changes);
      if (!requestsCancellation && fields.length === 0) {
        return { kind: "unchanged" } as const;
      }
      const changed = fields.map((field) => field.fieldName);

      // AC3: what an open clarification names is changed in its answer.
      if (current.status === "UNDER_REVIEW" && fields.length > 0) {
        const clarification = await tx.clarificationRequest.findFirst({
          where: { eventId, status: "OPEN" },
          select: { editableFields: true },
        });
        const covered = changed.filter((name) =>
          clarification?.editableFields.includes(fieldOfChange(name)),
        );
        if (covered.length > 0) {
          return { kind: "clarification", labels: labelsOf(covered) } as const;
        }
      }

      const created = await tx.eventChangeRequest.create({
        data: {
          eventId,
          requestedById: user!.id,
          reason,
          requestsCancellation,
          fields: { create: fields },
        },
        select: { id: true },
      });

      const labels = labelsOf(changed).join(", ");
      const notice = requestsCancellation
        ? {
            summary: `Cancellation requested: ${reason}`,
            title: "Cancellation requested",
            message: `The organiser asked to cancel "${current.name}". Their reason: ${reason}`,
          }
        : {
            summary: `Change requested: ${labels}`,
            title: "Change request raised",
            message: `The organiser asked to change "${current.name}": ${labels}.`,
          };
      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: eventId,
          action: "CHANGE_REQUESTED",
          actorId: user!.id,
          summary: notice.summary,
        },
      });
      // SCRUM-124 AC7: the assigned Coordinator hears of the Organiser's
      // request. One they raised themselves needs no notice.
      if (current.coordinatorId !== user!.id) {
        await tx.notification.create({
          data: {
            userId: current.coordinatorId!,
            type: "CHANGE_REQUEST_SUBMITTED",
            title: notice.title,
            message: notice.message,
            link: "/events",
            eventId,
          },
        });
      }
      return { kind: "created", id: created.id } as const;
    });

    switch (outcome.kind) {
      case "refused":
        return err(outcome.message);
      case "reassigned":
        return err("This event was updated by another user. Refresh and try again.");
      case "duplicate":
        return err(
          "This event already has a change request waiting for a decision. It's shown below.",
        );
      case "unchanged":
        return err(NO_CHANGE_MESSAGE, { changes: [NO_CHANGE_MESSAGE] });
      case "clarification":
        return err(
          `The open clarification request covers ${outcome.labels.join(", ")}, so change ${outcome.labels.length === 1 ? "it" : "them"} in the answer to it instead.`,
        );
    }

    revalidatePath("/events");
    return ok({ id: outcome.id });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

export type ChangeRequestView = {
  id: string;
  status: ChangeRequestStatus;
  reason: string | null;
  requestsCancellation: boolean;
  decisionReason: string | null;
  createdAt: Date;
  /** AC9 — the Organiser's name when the Coordinator raised it for them. */
  raisedFor: string | null;
  fields: FieldChange[];
};

/**
 * SCRUM-41 AC6 — an event's change requests, newest first, with whether the
 * viewer may raise another. Read-gated like the event itself, so an
 * unrelated user sees "not found".
 */
export async function getChangeRequestsForEvent(
  eventId: string,
): Promise<ActionResult<{ requests: ChangeRequestView[]; canRaise: boolean }>> {
  const session = await auth();
  const user = session?.user;
  if (!user || !can(user, "event:read")) return err("Event not found.");

  // One read: the event's gate and its requests together.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organiserId: true,
      coordinatorId: true,
      status: true,
      discardedAt: true,
      organiser: { select: { name: true } },
      changeRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          reason: true,
          requestsCancellation: true,
          decisionReason: true,
          createdAt: true,
          requestedById: true,
          fields: {
            select: { fieldName: true, oldValue: true, newValue: true, isMajor: true },
          },
        },
      },
    },
  });
  if (!event || event.discardedAt || !can(user, "event:read", { kind: "event", ...event })) {
    return err("Event not found.");
  }

  const requests = event.changeRequests.map(({ requestedById, ...request }) => ({
    ...request,
    raisedFor: requestedById === event.organiserId ? null : event.organiser.name,
  }));
  const canRaise =
    can(user, "change-request:raise", { kind: "event", ...event }) &&
    !refusalFor(event) &&
    !requests.some((request) => request.status === "PENDING_REVIEW");

  return ok({ requests, canRaise });
}
