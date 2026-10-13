"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, SafetyCheckStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  can,
  requirePermission,
  PermissionError,
  type Resource,
} from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { liveHoldWhere } from "@/lib/booking-holds";
import {
  ARRANGEMENT_FIELDS,
  ARRANGEMENT_LOCKED_MESSAGE,
  arrangementsAffectedMessage,
  CHANGED_WHILE_EDITING_MESSAGE,
  CONFIRMED_NOT_EDITABLE_MESSAGE,
  EDITABLE_STATUSES,
  eventDetailsEditSchema,
  INVALID_PERIOD_MESSAGE,
  operationalNoteSchema,
  PAST_START_MESSAGE,
  ROUTINE_FIELDS,
  SAFETY_RELEVANT_FIELDS,
  type EditableField,
} from "@/lib/schemas/event-edit";

/**
 * SCRUM-26 AC2 — the bookings that hold, or may still get, their venue,
 * counted as the booking flow counts them: a hold only until it expires
 * (SCRUM-163 AC4), even before anything has marked it Expired.
 */
function liveBookingWhere(now: Date): Prisma.BookingWhereInput {
  return { OR: [{ status: { in: ["PENDING", "APPROVED"] } }, liveHoldWhere(now)] };
}

/** SCRUM-166 — a check not yet out of date; a routine change makes it Outdated. */
const CURRENT_SAFETY_CHECK_STATUSES: SafetyCheckStatus[] = [
  "AWAITING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
];

/** Thrown inside the edit transaction for an expected refusal. */
class EditError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

/** A field's value as compared and audited: text, an ISO instant or a number. */
function stored(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * SCRUM-25 — the event's assigned Coordinator edits its details directly
 * while it is Under Review or in Planning (AC1).
 *
 * - A routine edit keeps the status and flags nothing (AC2). A routine change
 *   to the layout or accessibility needs makes a requested safety check
 *   Outdated (AC2, SCRUM-166).
 * - Date, time, expected attendance, venue and equipment are SCRUM-26's
 *   (AC3): with nothing booked or reserved there is nothing to warn about or
 *   flag, so they save like any other field (SCRUM-26 AC1); once the event
 *   has a venue booking or an equipment reservation they are refused, as the
 *   warning and flagging they need aren't built yet.
 * - The Organiser, a previous Coordinator and every other user are refused
 *   with nothing changed (AC4, AC7); a Confirmed event can't be edited
 *   directly by anyone (AC5).
 *
 * The event row is locked first, so a venue booking or equipment
 * reservation being made at the same moment (both reference the row) either
 * lands before the check sees it, or waits until the edit is saved.
 */
export async function updateEventDetails(
  input: unknown,
): Promise<ActionResult<{ changed: EditableField[]; safetyCheckOutdated: boolean }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event:edit");

    const parsed = eventDetailsEditSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return err(
        fieldErrors.endAt?.includes(INVALID_PERIOD_MESSAGE)
          ? INVALID_PERIOD_MESSAGE
          : "Please fix the highlighted fields.",
        fieldErrors,
      );
    }
    const { eventId, ...data } = parsed.data;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    const resource: Resource | null = event && {
      kind: "event",
      organiserId: event.organiserId,
      coordinatorId: event.coordinatorId,
      status: event.status,
    };
    // Someone else's event reads exactly like one that doesn't exist
    // (SCRUM-68 not-found parity), whoever they are (AC7).
    if (!event || !resource || !can(user!, "event:edit", resource)) {
      return err("Event not found.");
    }
    if (event.status === "CONFIRMED") return err(CONFIRMED_NOT_EDITABLE_MESSAGE);
    if (!EDITABLE_STATUSES.includes(event.status)) {
      return err(
        "An event's details can only be edited while it is Under Review or in Planning.",
      );
    }

    const next = {
      ...Object.fromEntries(
        ROUTINE_FIELDS.map((field) => [field, data[field] || null]),
      ),
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      expectedAttendance: data.expectedAttendance,
      venueRequirements: data.venueRequirements || null,
      equipmentRequirements: data.equipmentRequirements || null,
    } as Record<EditableField, string | number | Date | null>;

    const changes = (Object.keys(next) as EditableField[])
      .map((field) => ({
        field,
        from: stored(event[field]),
        to: stored(next[field]),
      }))
      .filter((change) => change.from !== change.to);
    if (changes.length === 0) {
      return ok({ changed: [], safetyCheckOutdated: false });
    }

    const arrangementChanges = changes
      .map((change) => change.field)
      .filter((field) =>
        (ARRANGEMENT_FIELDS as readonly string[]).includes(field),
      );
    if (
      arrangementChanges.includes("startAt") &&
      next.startAt instanceof Date &&
      next.startAt.getTime() < Date.now()
    ) {
      return err(PAST_START_MESSAGE, { startAt: [PAST_START_MESSAGE] });
    }

    const now = new Date();
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;

      if (arrangementChanges.length > 0) {
        const [bookings, reservations] = await Promise.all([
          tx.booking.count({ where: { eventId, ...liveBookingWhere(now) } }),
          tx.reservation.count({ where: { eventId, status: "CONFIRMED" } }),
        ]);
        if (bookings + reservations > 0) {
          throw new EditError(
            arrangementsAffectedMessage(arrangementChanges),
            Object.fromEntries(
              arrangementChanges.map((field) => [field, [ARRANGEMENT_LOCKED_MESSAGE]]),
            ),
          );
        }
      }

      // AC2: the status is not part of the edit; the update applies only if
      // it is still the one read, and the event is still this Coordinator's.
      // SCRUM-170 AC4: changed equipment requirements put Equipment back to
      // Not decided. Both columns clear together (event_no_equipment_decision_complete).
      const equipmentChanged = changes.some(
        ({ field }) => field === "equipmentRequirements",
      );
      const updated = await tx.event.updateMany({
        where: { id: eventId, status: event.status, coordinatorId: user!.id },
        data: {
          ...Object.fromEntries(changes.map(({ field }) => [field, next[field]])),
          ...(equipmentChanged && {
            noEquipmentNeededAt: null,
            noEquipmentNeededById: null,
          }),
        },
      });
      if (updated.count !== 1) throw new EditError(CHANGED_WHILE_EDITING_MESSAGE);

      // SCRUM-71: who changed what, from what, and when.
      await tx.auditLog.createMany({
        data: changes.map(({ field, from, to }) => ({
          entityType: "Event",
          entityId: eventId,
          action: "UPDATED",
          actorId: user!.id,
          fieldName: field,
          oldValue: from,
          newValue: to,
        })),
      });

      const touchesSafety = changes.some(({ field }) =>
        SAFETY_RELEVANT_FIELDS.includes(field),
      );
      if (!touchesSafety) return { safetyCheckOutdated: false };
      const outdated = await tx.safetyCheck.updateMany({
        where: { eventId, status: { in: CURRENT_SAFETY_CHECK_STATUSES } },
        data: { status: "OUTDATED", outdatedAt: now },
      });
      return { safetyCheckOutdated: outdated.count > 0 };
    });

    revalidatePath("/events");
    return ok({ changed: changes.map((c) => c.field), ...outcome });
  } catch (error) {
    if (error instanceof EditError) return err(error.message, error.fieldErrors);
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * The event's notes resource for `can()`: who it belongs to and which
 * arrangements it has (SCRUM-25 AC6). Null when the event doesn't exist.
 */
async function notesResource(eventId: string) {
  const now = new Date();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organiserId: true,
      coordinatorId: true,
      status: true,
      _count: {
        select: {
          bookings: { where: liveBookingWhere(now) },
          equipmentRequests: true,
        },
      },
    },
  });
  if (!event) return null;
  return {
    status: event.status,
    resource: {
      kind: "event-notes" as const,
      organiserId: event.organiserId,
      coordinatorId: event.coordinatorId,
      hasVenueBooking: event._count.bookings > 0,
      hasEquipmentRequest: event._count.equipmentRequests > 0,
    },
  };
}

export type OperationalNoteView = {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
};

/**
 * SCRUM-25 AC6 — an event's operational notes, oldest first, with author and
 * time, for the internal users who can view the event and its Organiser.
 * `canAdd` tells the page whether to offer adding one.
 */
export async function getOperationalNotes(
  eventId: string,
): Promise<ActionResult<{ notes: OperationalNoteView[]; canAdd: boolean }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event-note:read");

    const found = await notesResource(eventId);
    if (!found || !can(user!, "event-note:read", found.resource)) {
      return err("Event not found.");
    }

    const rows = await prisma.eventOperationalNote.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });
    return ok({
      notes: rows.map(({ author, ...note }) => ({
        ...note,
        authorName: author.name,
      })),
      canAdd:
        found.status !== "CANCELLED" &&
        can(user!, "event-note:add", found.resource),
    });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-25 AC6 — add an operational note. The assigned Coordinator can at any
 * status except Cancelled; Venue Staff once the event has a Pending, Held or
 * Approved venue booking; Technical Support once it has an equipment
 * request. A note is never edited or deleted: there is no action for either,
 * and the database refuses both (event_operational_note_permanent).
 */
export async function addOperationalNote(
  input: unknown,
): Promise<ActionResult<OperationalNoteView>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event-note:add");

    const parsed = operationalNoteSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return err(fieldErrors.body?.[0] ?? "Choose an event.", fieldErrors);
    }
    const { eventId, body } = parsed.data;

    const found = await notesResource(eventId);
    if (!found || !can(user!, "event-note:add", found.resource)) {
      return err("Event not found.");
    }
    if (found.status === "CANCELLED") {
      return err("Notes can't be added to a cancelled event.");
    }

    const note = await prisma.eventOperationalNote.create({
      data: { eventId, authorId: user!.id, body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });

    revalidatePath("/events");
    revalidatePath("/bookings");
    revalidatePath("/equipment-requests");
    const { author, ...rest } = note;
    return ok({ ...rest, authorName: author.name });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-25 AC1 — whether the event page should offer this user the edit.
 * The edit itself checks again; this only decides whether to show it.
 */
export async function canEditEventDetails(eventId: string): Promise<boolean> {
  const session = await auth();
  const user = session?.user;
  if (!user) return false;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organiserId: true, coordinatorId: true, status: true },
  });
  return Boolean(
    event &&
      EDITABLE_STATUSES.includes(event.status) &&
      can(user, "event:edit", { kind: "event", ...event }),
  );
}
