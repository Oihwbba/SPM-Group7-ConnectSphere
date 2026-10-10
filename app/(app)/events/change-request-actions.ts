"use server";

import { revalidatePath } from "next/cache";
import type { ChangeRequestStatus, EventStatus } from "@prisma/client";
import type { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import {
  CHANGEABLE_FIELDS,
  IMPACTFUL_FIELDS,
  NO_CHANGE_MESSAGE,
  changeableFieldOf,
  raiseChangeRequestSchema,
  type ChangeRequestChanges,
} from "@/lib/schemas/change-request";
import { ok, err, type ActionResult } from "@/lib/action-result";

/** The event's current values, which a change request records as the old ones. */
const CURRENT_VALUES = {
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
  programme: true,
  specialRequests: true,
} as const;

type CurrentValues = {
  [K in keyof typeof CURRENT_VALUES]: string | number | Date | null;
};

type Relationship = {
  organiserId: string;
  coordinatorId: string | null;
  status: EventStatus;
};

const resourceOf = (event: Relationship) => ({
  kind: "event" as const,
  organiserId: event.organiserId,
  coordinatorId: event.coordinatorId,
  status: event.status,
});

/**
 * SCRUM-41 AC1, AC2 — a change request can be raised on an event Under
 * Review, in Planning or Confirmed; anything else gets the reason it can't.
 */
function refusalFor(event: Relationship): string | null {
  switch (event.status) {
    case "DRAFT":
      return "A draft isn't submitted yet. Edit it directly instead.";
    case "REJECTED":
      return "This request was rejected. Follow the next step under the rejection reason to amend it.";
    case "CANCELLED":
    case "COMPLETED":
      return "A cancelled or completed event can't be changed.";
    case "UNDER_REVIEW":
    case "PLANNING":
    case "CONFIRMED":
      if (event.coordinatorId) return null;
  }
  return "This request is waiting for a coordinator to be assigned. It can't be changed until then.";
}

/** Only the requested values that differ from the event's, as they are recorded. */
function changedFields(current: CurrentValues, changes: ChangeRequestChanges) {
  const fields: {
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    isMajor: boolean;
  }[] = [];
  for (const key of Object.keys(changes) as (keyof ChangeRequestChanges)[]) {
    const requested = changes[key]!;
    const next =
      key === "startAt" || key === "endAt"
        ? new Date(requested)
        : requested === ""
          ? null
          : requested;
    const oldValue = asText(current[key]);
    const newValue = asText(next);
    if (oldValue === newValue) continue;
    fields.push({
      fieldName: key,
      oldValue,
      newValue,
      isMajor: IMPACTFUL_FIELDS.includes(changeableFieldOf(key)),
    });
  }
  return fields;
}

/** The fields a list of changes touches, as the Organiser reads them. */
function labelsOf(fieldNames: string[]): string[] {
  const labels = new Set(
    fieldNames.map(
      (name) =>
        CHANGEABLE_FIELDS[
          changeableFieldOf(name as keyof ChangeRequestChanges)
        ],
    ),
  );
  return [...labels];
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
    if (!event || event.discardedAt || !can(user!, "event:read", resourceOf(event))) {
      return err("Event not found.");
    }
    // AC10: of those who can see it, only its Organiser and its assigned Coordinator.
    if (!can(user!, "change-request:raise", resourceOf(event))) {
      return err(
        "Only the event's organiser or its assigned coordinator can raise a change request.",
      );
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
      if (!can(user!, "change-request:raise", resourceOf(current))) {
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

      // AC3: what an open clarification names is changed in its answer.
      if (current.status === "UNDER_REVIEW" && fields.length > 0) {
        const clarification = await tx.clarificationRequest.findFirst({
          where: { eventId, status: "OPEN" },
          select: { editableFields: true },
        });
        const covered = fields
          .map((field) => field.fieldName)
          .filter((name) =>
            clarification?.editableFields.includes(
              changeableFieldOf(name as keyof ChangeRequestChanges),
            ),
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
      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: eventId,
          action: "CHANGE_REQUESTED",
          actorId: user!.id,
          summary: requestsCancellation
            ? `Cancellation requested: ${reason}`
            : `Change requested: ${labelsOf(fields.map((f) => f.fieldName)).join(", ")}`,
        },
      });
      // SCRUM-124 AC7: the assigned Coordinator hears of the Organiser's
      // request. One they raised themselves needs no notice.
      if (current.coordinatorId !== user!.id) {
        await tx.notification.create({
          data: {
            userId: current.coordinatorId!,
            type: "CHANGE_REQUEST_SUBMITTED",
            title: requestsCancellation
              ? "Cancellation requested"
              : "Change request raised",
            message: requestsCancellation
              ? `The organiser asked to cancel "${current.name}". Their reason: ${reason}`
              : `The organiser asked to change "${current.name}": ${labelsOf(fields.map((f) => f.fieldName)).join(", ")}.`,
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
  fields: {
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    isMajor: boolean;
  }[];
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

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organiserId: true,
      coordinatorId: true,
      status: true,
      discardedAt: true,
      organiser: { select: { name: true } },
    },
  });
  if (!event || event.discardedAt || !can(user, "event:read", resourceOf(event))) {
    return err("Event not found.");
  }

  const rows = await prisma.eventChangeRequest.findMany({
    where: { eventId },
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
  });

  const requests = rows.map(({ requestedById, ...request }) => ({
    ...request,
    raisedFor: requestedById === event.organiserId ? null : event.organiser.name,
  }));
  const canRaise =
    can(user, "change-request:raise", resourceOf(event)) &&
    !refusalFor(event) &&
    !rows.some((request) => request.status === "PENDING_REVIEW");

  return ok({ requests, canRaise });
}

/**
 * Validation errors keyed by the field they belong to, so the form can show
 * each next to its input: a requested value under its own name (e.g.
 * "expectedAttendance", "endAt"), anything else under its top-level name.
 */
function errorsByField(error: z.ZodError): Record<string, string[]> {
  const byField: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const [top, nested] = issue.path;
    const key = String(top === "changes" && nested !== undefined ? nested : top);
    (byField[key] ??= []).push(issue.message);
  }
  return byField;
}

/** A field's value as the change request records it. */
function asText(value: string | number | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}
