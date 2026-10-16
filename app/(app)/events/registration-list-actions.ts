"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/can";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  summariseRegistrations,
  type EventRegistrationList,
} from "@/lib/registration-list";

/**
 * SCRUM-70 — an event's registrations, for its Organiser (AC2) or its assigned
 * Coordinator (AC1) only; every other role, and a Coordinator the event isn't
 * assigned to, gets the same "not found" as a missing event (AC5, AC7).
 */
export async function getEventRegistrations(
  eventId: string,
): Promise<ActionResult<EventRegistrationList>> {
  const session = await auth();
  const user = session?.user;
  if (!user || !can(user, "registration:list")) {
    return err("Event not found.");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organiserId: true,
      coordinatorId: true,
      status: true,
      expectedAttendance: true,
    },
  });
  if (
    !event ||
    !can(user, "registration:list", {
      kind: "event",
      organiserId: event.organiserId,
      coordinatorId: event.coordinatorId,
      status: event.status,
    })
  ) {
    return err("Event not found.");
  }

  const rows = await prisma.registration.findMany({
    where: { eventId },
    select: { id: true, status: true, user: { select: { name: true } } },
    orderBy: { registeredAt: "asc" },
  });

  return ok(
    summariseRegistrations(
      rows.map(({ id, status, user: attendee }) => ({
        id,
        status,
        attendeeName: attendee.name,
      })),
      event.expectedAttendance,
    ),
  );
}
