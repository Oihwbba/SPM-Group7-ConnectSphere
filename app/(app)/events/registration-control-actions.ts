"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  can,
  requirePermission,
  PermissionError,
  type Resource,
} from "@/lib/auth/can";
import { registrationControlSchema } from "@/lib/schemas/registration";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { auditValue } from "@/lib/audit-value";
import { formatDateTime } from "@/lib/datetime";
import { notifyAboutEvent } from "@/lib/event-notifications";
import {
  REGISTRATION_STATE_LABEL,
  canCloseRegistration,
  canReopenRegistration,
  computeRegistrationState,
  registrationPeriodText,
  takesRegistration,
  totalCapacity,
  type RegistrationState,
} from "@/lib/registration-state";

/** SCRUM-75 AC6 — where a Confirmed event's registration stands, for its
 * Organiser and its Coordinator, and which of close and reopen applies. */
export type RegistrationControl = {
  state: RegistrationState;
  label: string;
  period: string;
  registered: number;
  capacity: number;
  canClose: boolean;
  canReopen: boolean;
};

const CONTROL_SELECT = {
  name: true,
  status: true,
  organiserId: true,
  coordinatorId: true,
  registrationRequired: true,
  registrationEnabled: true,
  registrationOpensAt: true,
  registrationClosesAt: true,
  startAt: true,
  expectedAttendance: true,
} satisfies Prisma.EventSelect;

type ControlEvent = Prisma.EventGetPayload<{ select: typeof CONTROL_SELECT }>;

const NOT_FOUND = "Event not found.";

function resourceOf(event: ControlEvent): Resource {
  return {
    kind: "event",
    organiserId: event.organiserId,
    coordinatorId: event.coordinatorId,
    status: event.status,
  };
}

function controlOf(
  event: ControlEvent,
  registered: number,
  now: Date,
): RegistrationControl {
  const state = computeRegistrationState(event, registered, now);
  return {
    state,
    label: REGISTRATION_STATE_LABEL[state],
    period: registrationPeriodText(event),
    registered,
    capacity: totalCapacity(event),
    canClose: canCloseRegistration(state),
    canReopen: canReopenRegistration(event, state, now),
  };
}

/**
 * SCRUM-75 AC6 — the registration panel on a Confirmed event that needs
 * registration (SCRUM-171). Any other event has no panel (null). Anyone but
 * its Organiser and assigned Coordinator gets the same "not found" as a
 * missing event (SCRUM-68).
 */
export async function getRegistrationControl(
  eventId: string,
): Promise<ActionResult<RegistrationControl | null>> {
  const session = await auth();
  const user = session?.user;
  if (!user) return err(NOT_FOUND);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: CONTROL_SELECT,
  });
  if (!event || !can(user, "registration:control", resourceOf(event))) {
    return err(NOT_FOUND);
  }
  if (event.status !== "CONFIRMED" || !takesRegistration(event)) {
    return ok(null);
  }

  const registered = await prisma.registration.count({
    where: { eventId, status: "REGISTERED" },
  });
  return ok(controlOf(event, registered, new Date()));
}

type Change = "close" | "reopen";

/**
 * Closing stores the moment as the closing time rather than turning
 * registration off. Confirming turns it back on (SCRUM-81), so a close kept
 * as a flag would be undone when an event returns to Planning and is
 * confirmed again; a closing time that has passed stays closed until it is
 * reopened (AC9). Reopening clears the window, which leaves registration
 * open from now until the event's start (AC4, AC6).
 */
async function changeRegistration(
  input: unknown,
  change: Change,
): Promise<ActionResult<RegistrationControl>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "registration:control");

    const parsed = registrationControlSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please try again from the event page.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { eventId } = parsed.data;

    const outcome = await prisma.$transaction(
      async (tx): Promise<{ error: string } | { control: RegistrationControl }> => {
        // The same lock a registration takes (SCRUM-73), so a close and a
        // registration take turns: none is accepted after the close commits.
        await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
        const event = await tx.event.findUnique({
          where: { id: eventId },
          select: CONTROL_SELECT,
        });
        if (!event || !can(user!, "registration:control", resourceOf(event))) {
          return { error: NOT_FOUND };
        }
        if (event.status !== "CONFIRMED") {
          return {
            error:
              "Registration can only be closed or reopened while the event is Confirmed.",
          };
        }
        if (!takesRegistration(event)) {
          return { error: "This event doesn't need registration." };
        }

        const now = new Date();
        const registered = await tx.registration.count({
          where: { eventId, status: "REGISTERED" },
        });
        const state = computeRegistrationState(event, registered, now);

        if (change === "close" && !canCloseRegistration(state)) {
          return {
            error:
              state === "NOT_YET_OPEN"
                ? "Registration hasn't opened yet, so it can't be closed."
                : "Registration is already closed.",
          };
        }
        // AC8: never reopened at or after the start.
        if (change === "reopen" && !canReopenRegistration(event, state, now)) {
          return {
            error:
              event.startAt && event.startAt <= now
                ? "The event has started, so registration can't be reopened."
                : "Registration isn't closed, so it can't be reopened.",
          };
        }

        const data =
          change === "close"
            ? { registrationClosesAt: now }
            : {
                registrationEnabled: true,
                registrationOpensAt: null,
                registrationClosesAt: null,
              };
        await tx.event.update({ where: { id: eventId }, data });
        await tx.auditLog.create({
          data: {
            entityType: "Event",
            entityId: eventId,
            action: "UPDATED",
            actorId: user!.id,
            fieldName: "registrationClosesAt",
            oldValue: auditValue(event.registrationClosesAt),
            newValue: auditValue(data.registrationClosesAt),
            summary:
              change === "close"
                ? "Registration closed (SCRUM-75)"
                : "Registration reopened until the event's start (SCRUM-75)",
          },
        });

        // Confirming scheduled a "Registration closed" notice for the old
        // closing time (SCRUM-45 AC11); it no longer says when registration
        // closes. Reopening schedules one for the event's start instead.
        await tx.notification.updateMany({
          where: {
            eventId,
            title: "Registration closed",
            withdrawnAt: null,
            showFromAt: { gt: now },
          },
          data: { withdrawnAt: now },
        });
        if (change === "reopen") {
          await notifyAboutEvent(
            tx,
            [event.organiserId, event.coordinatorId],
            { id: eventId, name: event.name },
            {
              title: "Registration closed",
              message: `Registration for "${event.name}" closed at ${formatDateTime(event.startAt!)}.`,
              showFromAt: event.startAt!,
            },
          );
        }

        return { control: controlOf({ ...event, ...data }, registered, now) };
      },
    );

    if ("error" in outcome) return err(outcome.error);

    revalidatePath("/events");
    revalidatePath(`/events/${eventId}`);
    return ok(outcome.control);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/** SCRUM-75 AC6 — close registration now; the event stays listed as closed. */
export async function closeRegistration(
  input: unknown,
): Promise<ActionResult<RegistrationControl>> {
  return changeRegistration(input, "close");
}

/** SCRUM-75 AC6, AC9 — reopen closed registration until the event's start. */
export async function reopenRegistration(
  input: unknown,
): Promise<ActionResult<RegistrationControl>> {
  return changeRegistration(input, "reopen");
}
