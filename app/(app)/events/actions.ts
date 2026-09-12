"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import {
  createDraftEventSchema,
  submitEventRequestSchema,
} from "@/lib/schemas/event";
import { ok, err, type ActionResult } from "@/lib/action-result";

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
        where: { id, organiserId: user!.id, status: "DRAFT" },
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
        where: { id, organiserId: user!.id, status: "DRAFT" },
      });

      if (!existing) {
        return err("Draft event not found or cannot be submitted.");
      }

      await prisma.event.update({
        where: { id },
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
 */
export async function getFormCatalogues(): Promise<{
  venues: { id: string; name: string; capacity: number; facilities: string[] }[];
  equipment: { id: string; type: string; totalQuantity: number }[];
}> {
  const venues = await prisma.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true, capacity: true, facilities: true },
  });

  const equipment = await prisma.equipment.findMany({
    where: { isActive: true },
    select: { id: true, type: true, totalQuantity: true },
  });

  return { venues, equipment };
}
