"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import {
  createDraftEventSchema,
  submitEventRequestSchema,
} from "@/lib/schemas/event";
import { ok, err, type ActionResult } from "@/lib/action-result";

const statusTransitionSchema = z.object({
  eventId: z.string().min(1),
  nextStatus: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
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

    if (id) {
      // Submit an existing draft event (US14/US15 transition from DRAFT -> SUBMITTED)
      const existing = await prisma.event.findFirst({
        where: {
          id,
          organiserId: user!.id,
          status: { in: ["DRAFT", "REJECTED"] },
        },
      });

      if (!existing) {
        return err("Draft or rejected event not found or cannot be submitted.");
      }

      await prisma.event.update({
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
      const created = await prisma.event.create({
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
 * SCRUM-24's single status-changing gate for the coordinator-owned lifecycle
 * actions. The conditional update makes competing review actions safe: only
 * the caller that still observes the expected current state can change it.
 */
export async function transitionEventStatus(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  const session = await auth();

  try {
    const parsed = statusTransitionSchema.safeParse(input);
    if (!parsed.success) {
      return err("Please provide a valid event status action.");
    }

    const { eventId, nextStatus, decisionReason } = parsed.data;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        organiserId: true,
        coordinatorId: true,
      },
    });
    if (!event) return err("Event not found.");

    requirePermission(session?.user, "event:review", {
      kind: "event",
      organiserId: event.organiserId,
      coordinatorId: event.coordinatorId,
      status: event.status,
    });

    const allowed =
      (event.status === "SUBMITTED" && nextStatus === "UNDER_REVIEW") ||
      (event.status === "UNDER_REVIEW" &&
        (nextStatus === "APPROVED" || nextStatus === "REJECTED"));
    if (!allowed)
      return err(
        "That status change is not allowed from the event's current status.",
      );
    if (nextStatus === "REJECTED" && !decisionReason) {
      return err("A rejection reason is required.");
    }

    const data =
      nextStatus === "UNDER_REVIEW"
        ? { status: nextStatus, coordinatorId: session!.user.id }
        : {
            status: nextStatus,
            decidedAt: new Date(),
            decidedById: session!.user.id,
            decisionReason: nextStatus === "REJECTED" ? decisionReason : null,
          };
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.event.updateMany({
        where: {
          id: event.id,
          status: event.status,
          ...(event.status === "UNDER_REVIEW"
            ? { coordinatorId: session!.user.id }
            : {}),
        },
        data,
      });
      if (result.count !== 1) return false;

      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: event.id,
          action: "STATUS_CHANGED",
          actorId: session!.user.id,
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
