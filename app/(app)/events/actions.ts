"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import {
  createDraftEventSchema,
  rejectionOutcomeSchema,
  submitEventRequestSchema,
} from "@/lib/schemas/event";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { pickCoordinator } from "@/lib/coordinator-assignment";
import { getReadinessChecklist } from "@/lib/event-readiness";
import { TIME_ZONE } from "@/lib/datetime";

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
  rejectionOutcome: rejectionOutcomeSchema.optional(),
});

const confirmEventSchema = z.object({ eventId: z.string().min(1) });

const rejectPlanningEventSchema = z.object({
  eventId: z.string().min(1),
  decisionReason: z.string().trim().max(2000).optional(),
  rejectionOutcome: rejectionOutcomeSchema.optional(),
});

const startRequestFromRejectedSchema = z.object({
  eventId: z.string().min(1),
});

const discardDraftSchema = z.object({ eventId: z.string().min(1) });

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
      // User Story 15 AC 2/3: Resume and update an existing saved draft.
      // One conditional write, not a read then an update: a discard
      // (SCRUM-130 AC1) or a submit committing in between must not be
      // overwritten by this save.
      const res = await prisma.event.updateMany({
        where: {
          id,
          organiserId: user!.id,
          status: "DRAFT",
          discardedAt: null,
        },
        data: {
          name,
          purpose: purpose ?? null,
          description: description ?? null,
          startAt: startAt ? new Date(startAt) : null,
          endAt: endAt ? new Date(endAt) : null,
          expectedAttendance: expectedAttendance ?? null,
          venueRequirements: venueRequirements ?? null,
          requiredFacilities,
          accessibilityNeeds: accessibilityNeeds ?? null,
          preferredLayout: preferredLayout ?? null,
          equipmentRequirements: equipmentRequirements ?? null,
          registrationNotes: registrationNotes ?? null,
          programme: programme ?? null,
          specialRequests: specialRequests ?? null,
          // SCRUM-129 AC1/AC2: a draft saved with another timezone was
          // re-entered in Singapore time, so it is now a Singapore event.
          timezone: TIME_ZONE,
        },
      });
      if (res.count !== 1) {
        return err("Draft event not found or cannot be modified.");
      }
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
          requiredFacilities,
          accessibilityNeeds: accessibilityNeeds ?? null,
          preferredLayout: preferredLayout ?? null,
          equipmentRequirements: equipmentRequirements ?? null,
          registrationNotes: registrationNotes ?? null,
          programme: programme ?? null,
          specialRequests: specialRequests ?? null,
          timezone: TIME_ZONE,
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
    // SCRUM-108: set when this submission is an amended rejected request.
    let resubmitted = false;

    // SCRUM-14's write plus SCRUM-20's auto-assignment happen in ONE
    // transaction: pickCoordinator takes an advisory lock that is held until
    // this transaction commits, so a concurrent submission waits and then
    // counts this event's assignment when it computes coordinator load.
    await prisma.$transaction(async (tx) => {
      if (id) {
        // Submit an existing draft event (US14/US15 transition from DRAFT -> SUBMITTED)
        // Lock the row before checking its status: the check alone is not
        // conditional on what the write then sees, so two simultaneous
        // submissions of one draft would both pass it and both notify. The
        // second waits here, then finds the event already submitted.
        await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE`;
        const existing = await tx.event.findFirst({
          where: {
            id,
            organiserId: user!.id,
            // SCRUM-126 AC2/AC3: a rejection marked "Submit as a new request"
            // stays Rejected and read-only.
            OR: [
              // SCRUM-130 AC1: a discarded draft cannot be submitted.
              { status: "DRAFT", discardedAt: null },
              { status: "REJECTED", rejectionOutcome: "AMEND_AND_RESUBMIT" },
            ],
          },
        });

        if (!existing) {
          throw new SubmitEventError(
            "Draft or rejected event not found or cannot be submitted.",
          );
        }
        previousCoordinatorId = existing.coordinatorId;
        resubmitted = existing.status === "REJECTED";

        const request = {
          name,
          purpose,
          description,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          expectedAttendance,
          venueRequirements,
          requiredFacilities,
          accessibilityNeeds,
          preferredLayout,
          equipmentRequirements,
          registrationNotes,
          programme: programme ?? null,
          specialRequests: specialRequests ?? null,
          timezone: TIME_ZONE,
        };

        await tx.event.update({
          where: { id },
          data: {
            ...request,
            status: "SUBMITTED",
            submittedAt: new Date(),
            decidedAt: null,
            decidedById: null,
            decisionReason: null,
            rejectionOutcome: null,
          },
        });

        // SCRUM-108 AC9, AC14: keep the values the amendment replaced, one
        // row per changed field, as a clarification answer does.
        if (resubmitted) {
          const changed = (
            Object.keys(request) as (keyof typeof request)[]
          ).flatMap((fieldName) => {
            const oldValue = asText(existing[fieldName]);
            const newValue = asText(request[fieldName]);
            return oldValue === newValue
              ? []
              : [{ fieldName, oldValue, newValue }];
          });
          // Resubmitting unchanged is allowed, and createMany refuses an
          // empty list.
          if (changed.length > 0) {
            await tx.auditLog.createMany({
              data: changed.map((change) => ({
                entityType: "Event",
                entityId: id,
                action: "UPDATED",
                actorId: user!.id,
                ...change,
                summary: "Amended before resubmitting (SCRUM-108)",
              })),
            });
          }
        }
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
            requiredFacilities,
            accessibilityNeeds,
            preferredLayout,
            equipmentRequirements,
            registrationNotes,
            programme: programme ?? null,
            specialRequests: specialRequests ?? null,
            timezone: TIME_ZONE,
            organiserId: user!.id,
          },
          select: { id: true },
        });
        eventId = created.id;
      }

      // SCRUM-20: assign exactly one coordinator, fairly, no accept/decline.
      if (resubmitted) {
        // SCRUM-108 AC9, AC14: the same event, amended and resubmitted by
        // its Organiser, kept in its history.
        await tx.auditLog.create({
          data: {
            entityType: "Event",
            entityId: eventId!,
            action: "STATUS_CHANGED",
            actorId: user!.id,
            fieldName: "status",
            oldValue: "REJECTED",
            newValue: "SUBMITTED",
            summary: "Amended and resubmitted (SCRUM-108)",
          },
        });
      }

      // SCRUM-108 AC11: a resubmitted request goes back to the Coordinator
      // who reviewed it, without running automatic assignment again, as long
      // as they still hold the role.
      const keepsCoordinator =
        resubmitted &&
        previousCoordinatorId !== null &&
        Boolean(
          await tx.user.findFirst({
            where: { id: previousCoordinatorId, role: "COORDINATOR" },
            select: { id: true },
          }),
        );
      if (keepsCoordinator) {
        await tx.event.update({
          where: { id: eventId! },
          data: { status: "UNDER_REVIEW" },
        });
        await tx.notification.create({
          data: {
            userId: previousCoordinatorId!,
            type: "EVENT_STATUS_CHANGED",
            title: "A request was resubmitted",
            message: `"${name}" was amended and is back for your review.`,
            eventId: eventId!,
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: "Event",
            entityId: eventId!,
            action: "STATUS_CHANGED",
            actorId: null, // system-performed, not a specific user's action
            fieldName: "status",
            oldValue: "SUBMITTED",
            newValue: "UNDER_REVIEW",
            summary: "Back under review with the same coordinator (SCRUM-108)",
          },
        });
        return;
      }

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
      } else if (previousCoordinatorId) {
        // SCRUM-108 AC11: a resubmission whose Coordinator lost the role,
        // with nobody to assign, is left unassigned like a first submission,
        // so it shows in every Coordinator's queue rather than in no one's.
        await tx.event.update({
          where: { id: eventId! },
          data: { coordinatorId: null },
        });
        await tx.auditLog.create({
          data: {
            entityType: "Event",
            entityId: eventId!,
            action: "ASSIGNED",
            actorId: null, // system-performed, not a specific user's action
            fieldName: "coordinatorId",
            oldValue: previousCoordinatorId,
            newValue: null,
            summary:
              "Unassigned on resubmission: the coordinator no longer holds the role (SCRUM-108)",
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

/** An event field as stored in an audit row's oldValue/newValue. An empty
 * optional field is the same as a missing one, so it isn't a change. */
function asText(
  value: string | number | Date | string[] | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return Array.isArray(value) ? value.join(", ") : String(value);
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

    const { eventId, nextStatus, decisionReason, rejectionOutcome } =
      parsed.data;
    if (nextStatus === "REJECTED" && !decisionReason) {
      return err("A rejection reason is required.", {
        decisionReason: ["A rejection reason is required."],
      });
    }
    // SCRUM-126 AC1: the Coordinator also decides what the Organiser does next.
    if (nextStatus === "REJECTED" && !rejectionOutcome) {
      return err("Choose what the organiser can do next.", {
        rejectionOutcome: ["Choose what the organiser can do next."],
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

    // SCRUM-81: approval moves the event straight to Planning. Whoever
    // decides a request nobody was assigned to becomes its coordinator: on
    // approval because only the assigned coordinator may confirm it (SCRUM-81
    // AC2), on rejection so it leaves other coordinators' lists and comes back
    // to them if it is resubmitted (SCRUM-108 AC11).
    const approved = nextStatus === "APPROVED";
    const coordinatorId = event.coordinatorId ?? user!.id;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.event.updateMany({
        where: {
          id: event.id,
          status: event.status,
          coordinatorId: event.coordinatorId,
        },
        data: {
          status: approved ? "PLANNING" : "REJECTED",
          coordinatorId,
          decidedAt: new Date(),
          decidedById: user!.id,
          decisionReason: approved ? null : decisionReason,
          rejectionOutcome: approved ? null : rejectionOutcome,
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
      if (!approved) {
        await tx.auditLog.create({
          data: {
            entityType: "Event",
            entityId: event.id,
            action: "UPDATED",
            actorId: user!.id,
            fieldName: "rejectionOutcome",
            oldValue: null,
            newValue: rejectionOutcome,
            summary: "Outcome chosen on rejection (SCRUM-126)",
          },
        });
      }
      if (coordinatorId !== event.coordinatorId) {
        await tx.auditLog.create({
          data: {
            entityType: "Event",
            entityId: event.id,
            action: "ASSIGNED",
            actorId: user!.id,
            fieldName: "coordinatorId",
            oldValue: event.coordinatorId,
            newValue: coordinatorId,
            summary: approved
              ? "Assigned to the approving coordinator (SCRUM-81)"
              : "Assigned to the rejecting coordinator (SCRUM-108)",
          },
        });
      }
      if (approved) {
        await tx.auditLog.create({
          data: {
            entityType: "Event",
            entityId: event.id,
            action: "STATUS_CHANGED",
            actorId: null, // system-performed, not a specific user's action
            fieldName: "status",
            oldValue: "APPROVED",
            newValue: "PLANNING",
            summary: "Moved to Planning on approval (SCRUM-81)",
          },
        });
      }

      // SCRUM-18: a decision ends any question still waiting on the organiser.
      // Left OPEN, it would survive a reject-and-resubmit and block the
      // coordinator from asking about the amended request.
      await tx.clarificationRequest.updateMany({
        where: { eventId: event.id, status: "OPEN" },
        data: { status: "CLOSED" },
      });
      return true;
    });
    if (!updated) {
      return err(
        "This event was updated by another user. Refresh and try again.",
      );
    }
    revalidatePath("/events");
    if (approved) revalidatePath("/equipment");
    return ok({ status: approved ? "PLANNING" : "REJECTED" });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-81 — the assigned Coordinator confirms a Planning event whose
 * readiness checklist (SCRUM-110) is complete, which opens its registration
 * (AC 5). Confirming an event that is already Confirmed changes nothing
 * (AC 8), so a double-click or an older tab records one confirmation. See
 * ADR 0012.
 */
export async function confirmEvent(
  input: unknown,
): Promise<ActionResult<{ status: "CONFIRMED" }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event:confirm");

    const parsed = confirmEventSchema.safeParse(input);
    if (!parsed.success) return err("Please provide a valid event to confirm.");
    const { eventId } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organiserId: true, coordinatorId: true, status: true },
    });
    if (!event || !can(user!, "event:confirm", { kind: "event", ...event })) {
      return err("Event not found.");
    }

    const outcome = await prisma.$transaction(async (tx) => {
      // Lock the event row first: two confirms then take turns, and the
      // second sees the first's result. Readiness is re-checked under the
      // lock, against the arrangements as they stand now (ADR 0011).
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const current = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          status: true,
          coordinatorId: true,
          registrationRequired: true,
        },
      });
      if (current.status === "CONFIRMED") return "already-confirmed" as const;
      if (current.status !== "PLANNING") return "not-planning" as const;
      if (current.coordinatorId !== user!.id) return "reassigned" as const;

      const checklist = (await getReadinessChecklist(tx, eventId))!;
      if (!checklist.ready) {
        return checklist.items
          .filter((item) => !item.complete)
          .map((item) => `${item.name} (${item.state})`)
          .join(", ");
      }

      // AC 5: registration opens unless the Organiser said it isn't needed
      // (SCRUM-171). Requests made before that choice existed leave it unset.
      await tx.event.update({
        where: { id: eventId },
        data: {
          status: "CONFIRMED",
          registrationEnabled: current.registrationRequired !== false,
        },
      });
      // AC 5: who confirmed it and when (the entry's createdAt).
      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: eventId,
          action: "STATUS_CHANGED",
          actorId: user!.id,
          fieldName: "status",
          oldValue: "PLANNING",
          newValue: "CONFIRMED",
          summary: "Confirmed by the assigned coordinator (SCRUM-81)",
        },
      });
      return "confirmed" as const;
    });

    if (outcome === "not-planning") {
      return err("Only an event in Planning can be confirmed.");
    }
    if (outcome === "reassigned") {
      return err(
        "This event was updated by another user. Refresh and try again.",
      );
    }
    if (outcome !== "confirmed" && outcome !== "already-confirmed") {
      return err(
        `This event isn't ready to confirm yet. Outstanding: ${outcome}.`,
      );
    }
    revalidatePath("/events");
    return ok({ status: "CONFIRMED" });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-126 AC4 — when the Coordinator rejected a request as needing a new
 * submission, its Organiser can start a new Draft from it. Only the request's
 * own details are copied: the Draft has no coordinator, decision, bookings,
 * equipment requests, reservations or history of its own yet. Starting again
 * returns the Draft already started rather than a second copy. See ADR 0013.
 */
export async function startRequestFromRejected(
  input: unknown,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event:create");

    const parsed = startRequestFromRejectedSchema.safeParse(input);
    if (!parsed.success) {
      return err("Please choose a rejected request to start from.");
    }

    const { eventId } = parsed.data;
    const outcome = await prisma.$transaction(async (tx) => {
      // Lock the rejected event first, so two clicks at the same moment take
      // turns and the second finds the Draft the first one started.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;

      // The Organiser's own rejected request, and only one rejected for a new
      // submission; anything else is "not found", as in SCRUM-68.
      const rejected = await tx.event.findFirst({
        where: {
          id: eventId,
          organiserId: user!.id,
          status: "REJECTED",
          rejectionOutcome: "NEW_REQUEST",
        },
        select: {
          name: true,
          purpose: true,
          description: true,
          startAt: true,
          endAt: true,
          expectedAttendance: true,
          venueRequirements: true,
          requiredFacilities: true,
          accessibilityNeeds: true,
          preferredLayout: true,
          equipmentRequirements: true,
          registrationNotes: true,
          programme: true,
          specialRequests: true,
          equipmentTypes: true,
          registrationRequired: true,
        },
      });
      if (!rejected) return null;

      // The rejected event's history says which Draft was started from it.
      // One the Organiser has since discarded (SCRUM-130) no longer counts,
      // so starting again makes a fresh Draft rather than pointing at a
      // request that is no longer in their list.
      const started = await tx.auditLog.findFirst({
        where: { entityType: "Event", entityId: eventId, action: "NEW_REQUEST_STARTED" },
        orderBy: { createdAt: "desc" },
        select: { newValue: true },
      });
      const startedDraft =
        started?.newValue &&
        (await tx.event.findFirst({
          where: { id: started.newValue, discardedAt: null },
          select: { id: true },
        }));
      if (startedDraft) return { id: startedDraft.id, created: false };

      const draft = await tx.event.create({
        data: {
          ...rejected,
          status: "DRAFT",
          timezone: TIME_ZONE,
          organiserId: user!.id,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: eventId,
          action: "NEW_REQUEST_STARTED",
          actorId: user!.id,
          newValue: draft.id,
          summary: "New request started from this rejection (SCRUM-126)",
        },
      });
      return { id: draft.id, created: true };
    });
    if (!outcome) return err("Event not found.");

    revalidatePath("/events");
    return ok(outcome);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-130 — the Organiser discards a Draft they no longer need. The row is
 * kept with `discardedAt` set, which takes it out of My Event Requests and
 * stops it being saved or submitted again (AC1). Only a Draft can be
 * discarded (AC3), and anyone else's draft is "not found", exactly like a
 * missing id (AC4, SCRUM-68). Discarding a draft already discarded changes
 * nothing, so a second tab or a repeated request records one discard.
 */
export async function discardDraftEvent(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event:discard");

    const parsed = discardDraftSchema.safeParse(input);
    if (!parsed.success) return err("Please choose a draft to discard.");
    const { eventId } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organiserId: true,
        coordinatorId: true,
        status: true,
        discardedAt: true,
      },
    });
    if (!event || !can(user!, "event:discard", { kind: "event", ...event })) {
      return err("Event not found.");
    }
    if (event.discardedAt) return ok({ id: eventId });
    if (event.status !== "DRAFT") {
      return err(
        "Only a draft can be discarded. A submitted request is cancelled through a change request.",
      );
    }

    const discarded = await prisma.$transaction(async (tx) => {
      // Conditional on the draft still being an undiscarded Draft: a submit
      // at the same moment locks the row, and whichever commits first wins.
      const now = new Date();
      const result = await tx.event.updateMany({
        where: { id: eventId, status: "DRAFT", discardedAt: null },
        data: { discardedAt: now },
      });
      if (result.count !== 1) return false;

      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: eventId,
          action: "DISCARDED",
          actorId: user!.id,
          fieldName: "discardedAt",
          newValue: now.toISOString(),
          summary: "Draft discarded by its organiser (SCRUM-130)",
        },
      });
      return true;
    });
    if (!discarded) {
      return err(
        "This draft changed while you were discarding it. Refresh and try again.",
      );
    }

    revalidatePath("/events");
    return ok({ id: eventId });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-117 — the assigned Coordinator rejects a Planning event whose
 * essential arrangements can't be secured, so it doesn't sit pending. In one
 * transaction the event becomes Rejected with a reason and an outcome
 * (SCRUM-126), and everything held for it is released: venue bookings and
 * requests, equipment reservations (their stock returns to the pool) and open
 * equipment requests are cancelled, and submitted change requests are
 * rejected with the same reason. An event that was ever Confirmed may have
 * Attendees, so it is cancelled instead (SCRUM-82). See ADR 0015.
 */
export async function rejectPlanningEvent(
  input: unknown,
): Promise<ActionResult<{ status: "REJECTED" }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event:reject");

    const parsed = rejectPlanningEventSchema.safeParse(input);
    if (!parsed.success) return err("Please provide a valid event to reject.");
    const { eventId, decisionReason, rejectionOutcome } = parsed.data;
    // AC2: a reason and an outcome, as for any rejection.
    if (!decisionReason) {
      return err("A rejection reason is required.", {
        decisionReason: ["A rejection reason is required."],
      });
    }
    if (!rejectionOutcome) {
      return err("Choose what the organiser can do next.", {
        rejectionOutcome: ["Choose what the organiser can do next."],
      });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organiserId: true, coordinatorId: true, status: true, name: true },
    });
    if (!event || !can(user!, "event:reject", { kind: "event", ...event })) {
      return err("Event not found.");
    }

    const outcome = await prisma.$transaction(async (tx) => {
      // Lock first, then re-read: a confirm or another reject at the same
      // moment takes turns with this one.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const current = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { status: true, coordinatorId: true },
      });
      if (current.status !== "PLANNING") return "not-planning" as const;
      if (current.coordinatorId !== user!.id) return "reassigned" as const;
      // AC4: confirming writes this history entry (SCRUM-81).
      const confirmedBefore = await tx.auditLog.count({
        where: {
          entityType: "Event",
          entityId: eventId,
          fieldName: "status",
          newValue: "CONFIRMED",
        },
      });
      if (confirmedBefore > 0) return "confirmed-before" as const;

      const now = new Date();
      await tx.event.update({
        where: { id: eventId },
        data: {
          status: "REJECTED",
          decidedAt: now,
          decidedById: user!.id,
          decisionReason,
          rejectionOutcome,
        },
      });
      // AC3: release what was held for the event.
      const bookings = await tx.booking.updateMany({
        where: { eventId, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "CANCELLED" },
      });
      const reservations = await tx.reservation.updateMany({
        where: { eventId, status: "CONFIRMED" },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      const openRequests = await tx.equipmentRequest.findMany({
        where: {
          eventId,
          status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] },
        },
        select: { id: true, status: true },
      });
      const requests = await tx.equipmentRequest.updateMany({
        where: { id: { in: openRequests.map((r) => r.id) } },
        data: { status: "CANCELLED" },
      });
      // Each request's own history (SCRUM-28 AC 6) says who cancelled it and why.
      await tx.equipmentRequestUpdate.createMany({
        data: openRequests.map((r) => ({
          requestId: r.id,
          actorId: user!.id,
          fromStatus: r.status,
          toStatus: "CANCELLED" as const,
          note: `Cancelled because the event was rejected: ${decisionReason}`,
        })),
      });
      const changes = await tx.eventChangeRequest.updateMany({
        where: { eventId, status: "PENDING_REVIEW" },
        data: {
          status: "REJECTED",
          decidedById: user!.id,
          decidedAt: now,
          decisionReason,
        },
      });

      // AC6: who rejected it and when (the entries' createdAt).
      await tx.auditLog.createMany({
        data: [
          {
            entityType: "Event",
            entityId: eventId,
            action: "STATUS_CHANGED",
            actorId: user!.id,
            fieldName: "status",
            oldValue: "PLANNING",
            newValue: "REJECTED",
            summary: decisionReason,
          },
          {
            entityType: "Event",
            entityId: eventId,
            action: "UPDATED",
            actorId: user!.id,
            fieldName: "rejectionOutcome",
            oldValue: null,
            newValue: rejectionOutcome,
            summary: "Outcome chosen on rejection (SCRUM-126)",
          },
          {
            entityType: "Event",
            entityId: eventId,
            action: "ARRANGEMENTS_RELEASED",
            actorId: user!.id,
            summary: `Rejected from Planning (SCRUM-117): ${bookings.count} venue booking(s), ${reservations.count} equipment reservation(s) and ${requests.count} equipment request(s) cancelled; ${changes.count} change request(s) rejected.`,
          },
        ],
      });
      await tx.notification.create({
        data: {
          userId: event.organiserId,
          type: "EVENT_STATUS_CHANGED",
          title: "Your event was rejected",
          message: `"${event.name}" couldn't be arranged and was rejected: ${decisionReason}`,
          eventId,
        },
      });
      return "rejected" as const;
    });

    if (outcome === "not-planning") {
      return err("Only an event in Planning can be rejected here.");
    }
    if (outcome === "reassigned") {
      return err(
        "This event was updated by another user. Refresh and try again.",
      );
    }
    if (outcome === "confirmed-before") {
      return err(
        "This event has been confirmed before, so it can't be rejected. Cancel it instead.",
      );
    }
    revalidatePath("/events");
    revalidatePath("/equipment");
    return ok({ status: "REJECTED" });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
