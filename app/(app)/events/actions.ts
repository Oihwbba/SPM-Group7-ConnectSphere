"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import {
  createDraftEventSchema,
  submitEventRequestSchema,
} from "@/lib/schemas/event";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { pickCoordinator } from "@/lib/coordinator-assignment";

/** Thrown inside submitEventRequest's transaction for an expected failure
 * (not found / wrong state), caught below and converted to an ActionResult —
 * same convention as PermissionError, kept local since it's specific to this
 * one action. */
class SubmitEventError extends Error {}

// Coordinators decide; they do not claim. `submitted → under review` now
// happens automatically inside submitEventRequest via SCRUM-20's
// pickCoordinator, so it is deliberately not accepted here.
const statusTransitionSchema = z.object({
  eventId: z.string().min(1),
  nextStatus: z.enum(["APPROVED", "REJECTED"]),
  decisionReason: z.string().trim().max(2000).optional(),
});

/**
 * Server action to create or save/update a DRAFT event request.
 * Allows partial fields, but validates range constraints if provided.
 * Supports updating an existing draft if `id` is passed (User Story 15).
 */
export async function createDraftEvent(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event:create");

    const parsed = createDraftEventSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors,
      );
    }

    const {
      id,
      name,
      purpose,
      description,
      startAt,
      endAt,
      expectedAttendance,
      venueRequirements,
      requiredFacilities,
      accessibilityNeeds,
      preferredLayout,
      equipmentRequirements,
      registrationNotes,
      programme,
      specialRequests,
    } = parsed.data;

    let eventId = id;

    if (id) {
      // User Story 15 AC 2/3: Resume and update an existing saved draft
      const existing = await prisma.event.findFirst({
        where: {
          id,
          organiserId: user!.id,
          status: "DRAFT",
        },
      });

      if (!existing) {
        return err("Draft event not found or cannot be modified.");
      }

      await prisma.event.update({
        where: { id },
        data: {
          name,
          purpose: purpose ?? null,
          description: description ?? null,
          startAt: startAt ? new Date(startAt) : null,
          endAt: endAt ? new Date(endAt) : null,
          expectedAttendance: expectedAttendance ?? null,
          venueRequirements: venueRequirements ?? null,
          requiredFacilities: requiredFacilities ?? [],
          accessibilityNeeds: accessibilityNeeds ?? null,
          preferredLayout: preferredLayout ?? null,
          equipmentRequirements: equipmentRequirements ?? null,
          registrationNotes: registrationNotes ?? null,
          programme: programme ?? null,
          specialRequests: specialRequests ?? null,
        },
      });
    } else {
      // User Story 15 AC 1: Save a new incomplete request as draft at any point
      const created = await prisma.event.create({
        data: {
          name,
          purpose: purpose ?? null,
          description: description ?? null,
          status: "DRAFT",
          startAt: startAt ? new Date(startAt) : null,
          endAt: endAt ? new Date(endAt) : null,
          expectedAttendance: expectedAttendance ?? null,
          venueRequirements: venueRequirements ?? null,
          requiredFacilities: requiredFacilities ?? [],
          accessibilityNeeds: accessibilityNeeds ?? null,
          preferredLayout: preferredLayout ?? null,
          equipmentRequirements: equipmentRequirements ?? null,
          registrationNotes: registrationNotes ?? null,
          programme: programme ?? null,
          specialRequests: specialRequests ?? null,
          organiserId: user!.id,
        },
        select: { id: true },
      });
      eventId = created.id;
    }

    revalidatePath("/events");

    return ok({ id: eventId! });
  } catch (error) {
    if (error instanceof PermissionError) {
      return err(error.message);
    }
    throw error;
  }
}

/**
 * Server action to SUBMIT an event request for review.
 * Strictly enforces all mandatory fields required by W4-33 & User Story 13 AC.
 * Supports submitting an existing saved draft by `id` (User Story 14 / User Story 15).
 */
export async function submitEventRequest(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event:create");

    const parsed = submitEventRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields before submitting.",
        parsed.error.flatten().fieldErrors,
      );
    }

    const {
      id,
      name,
      purpose,
      description,
      startAt,
      endAt,
      expectedAttendance,
      venueRequirements,
      requiredFacilities,
      accessibilityNeeds,
      preferredLayout,
      equipmentRequirements,
      registrationNotes,
      programme,
      specialRequests,
    } = parsed.data;

    let eventId = id;
    // A resubmitted (previously rejected) event already has a coordinator;
    // the ASSIGNED audit row below records who held it before.
    let previousCoordinatorId: string | null = null;

    // SCRUM-14's write plus SCRUM-20's auto-assignment happen in ONE
    // transaction: pickCoordinator takes an advisory lock that is held until
    // this transaction commits, so a concurrent submission waits and then
    // counts this event's assignment when it computes coordinator load.
    await prisma.$transaction(async (tx) => {
      if (id) {
        // Submit an existing draft event (US14/US15 transition from DRAFT -> SUBMITTED)
        const existing = await tx.event.findFirst({
          where: {
            id,
            organiserId: user!.id,
            status: { in: ["DRAFT", "REJECTED"] },
          },
        });

        if (!existing) {
          throw new SubmitEventError(
            "Draft or rejected event not found or cannot be submitted.",
          );
        }
        previousCoordinatorId = existing.coordinatorId;

        await tx.event.update({
          where: { id },
          data: {
            name,
            purpose,
            description,
            status: "SUBMITTED",
            submittedAt: new Date(),
            decidedAt: null,
            decidedById: null,
            decisionReason: null,
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            expectedAttendance,
            venueRequirements,
            requiredFacilities: requiredFacilities ?? [],
            accessibilityNeeds,
            preferredLayout,
            equipmentRequirements,
            registrationNotes,
            programme: programme ?? null,
            specialRequests: specialRequests ?? null,
          },
        });
      } else {
        // Create and directly submit a new event request
        const created = await tx.event.create({
          data: {
            name,
            purpose,
            description,
            status: "SUBMITTED",
            submittedAt: new Date(),
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            expectedAttendance,
            venueRequirements,
            requiredFacilities: requiredFacilities ?? [],
            accessibilityNeeds,
            preferredLayout,
            equipmentRequirements,
            registrationNotes,
            programme: programme ?? null,
            specialRequests: specialRequests ?? null,
            organiserId: user!.id,
          },
          select: { id: true },
        });
        eventId = created.id;
      }

      // SCRUM-20: assign exactly one coordinator, fairly, no accept/decline.
      const coordinatorId = await pickCoordinator(tx);

      if (coordinatorId) {
        await tx.event.update({
          where: { id: eventId! },
          data: { coordinatorId, status: "UNDER_REVIEW" },
        });

        await tx.notification.createMany({
          data: [
            {
              userId: user!.id,
              type: "COORDINATOR_ASSIGNED",
              title: "A coordinator was assigned",
              message: `Your event "${name}" is now under review.`,
              eventId: eventId!,
            },
            {
              userId: coordinatorId,
              type: "COORDINATOR_ASSIGNED",
              title: "You were assigned an event",
              message: `"${name}" was assigned to you for review.`,
              eventId: eventId!,
            },
          ],
        });

        await tx.auditLog.create({
          data: {
            entityType: "Event",
            entityId: eventId!,
            action: "ASSIGNED",
            actorId: null, // system-performed, not a specific user's action
            fieldName: "coordinatorId",
            oldValue: previousCoordinatorId,
            newValue: coordinatorId,
            summary: "Auto-assigned on submission (SCRUM-20)",
          },
        });
      }
      // No coordinator available: the event still reaches SUBMITTED (set
      // above) and stays visible to coordinators — it must not fail
      // silently, so we deliberately do nothing further here rather than
      // throwing.
    });

    revalidatePath("/events");

    return ok({ id: eventId! });
  } catch (error) {
        if (error instanceof PermissionError || error instanceof SubmitEventError) {
      return err(error.message);
    }
    throw error;
  }
}

/**
 * Fetch available venue list and equipment catalogue for form recommendations.
 * Gated like the create actions: a "use server" export is a public endpoint,
 * so only a user who can create an event request may read the catalogue.
 */
export async function getFormCatalogues(): Promise<
  ActionResult<{
    venues: {
      id: string;
      name: string;
      capacity: number;
      facilities: string[];
    }[];
    equipment: { id: string; type: string; totalQuantity: number }[];
  }>
> {
  const session = await auth();

  try {
    requirePermission(session?.user, "event:create");
  } catch (error) {
    if (error instanceof PermissionError) {
      return err(error.message);
    }
    throw error;
  }

  const venues = await prisma.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true, capacity: true, facilities: true },
  });

  const equipment = await prisma.equipment.findMany({
    where: { isActive: true },
    select: { id: true, type: true, totalQuantity: true },
  });

  return ok({ venues, equipment });
}

/**
 * SCRUM-24's single guarded gate for a coordinator's decision on an event
 * request (the approve / reject transitions themselves are SCRUM-19's).
 *
 * - Role is checked BEFORE the event is looked up, and an event the coordinator
 *   has no relationship to returns exactly the same "not found" as a missing
 *   one — so the action cannot be used to probe which event ids exist (SCRUM-68).
 * - The update is conditional on the status and coordinator this caller
 *   observed, so of two simultaneous decisions only one can win (SCRUM-24).
 */
export async function transitionEventStatus(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event:review");

    const parsed = statusTransitionSchema.safeParse(input);
    if (!parsed.success) {
      return err("Please provide a valid event status action.");
    }

    const { eventId, nextStatus, decisionReason } = parsed.data;
    if (nextStatus === "REJECTED" && !decisionReason) {
      return err("A rejection reason is required.", {
        decisionReason: ["A rejection reason is required."],
      });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        organiserId: true,
        coordinatorId: true,
      },
    });
    const related =
      event &&
      can(user!, "event:review", {
        kind: "event",
        organiserId: event.organiserId,
        coordinatorId: event.coordinatorId,
        status: event.status,
      });
    if (!event || !related) return err("Event not found.");

    // SCRUM-19: a submitted (or under-review) request can be decided.
    if (event.status !== "SUBMITTED" && event.status !== "UNDER_REVIEW") {
      return err(
        "That status change is not allowed from the event's current status.",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.event.updateMany({
        where: {
          id: event.id,
          status: event.status,
          coordinatorId: event.coordinatorId,
        },
        data: {
          status: nextStatus,
          decidedAt: new Date(),
          decidedById: user!.id,
          decisionReason: nextStatus === "REJECTED" ? decisionReason : null,
        },
      });
      if (result.count !== 1) return false;

      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: event.id,
          action: "STATUS_CHANGED",
          actorId: user!.id,
          fieldName: "status",
          oldValue: event.status,
          newValue: nextStatus,
          summary: decisionReason ?? undefined,
        },
      });
      return true;
    });
    if (!updated) {
      return err(
        "This event was updated by another user. Refresh and try again.",
      );
    }
    revalidatePath("/events");
    if (nextStatus === "APPROVED") revalidatePath("/equipment");
    return ok({ status: nextStatus });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
