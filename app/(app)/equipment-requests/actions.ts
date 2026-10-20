"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type EventStatus } from "@prisma/client";

import { auth } from "@/auth";
import { err, ok, type ActionResult } from "@/lib/action-result";
import {
  can,
  requirePermission,
  PermissionError,
  type SessionUser,
} from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { getPoolAvailability } from "@/lib/equipment/request-queries";
import {
  CHANGEABLE_REQUEST_STATUSES,
  EQUIPMENT_REQUEST_STATUS_LABEL,
  LIVE_LINE,
  OPEN_REQUEST_STATUSES,
  REQUESTABLE_EVENT_STATUSES,
  canMoveRequest,
  lineChanges,
} from "@/lib/equipment/requests";
import { outdateSafetyChecks } from "@/lib/safety-checks";
import { notifyRole } from "@/lib/staff-notifications";
import {
  changeEquipmentRequestSchema,
  createEquipmentRequestSchema,
  fieldErrorsByPath,
  reviewEquipmentRequestSchema,
  suggestAlternativeSchema,
  withdrawEquipmentRequestSchema,
} from "@/lib/schemas/equipment-request";

const NOT_REQUESTABLE = "Choose one of your approved events.";
const NOT_FOUND = "Equipment request not found.";
const UPDATED_ELSEWHERE =
  "Someone else updated this request first. Refresh to see its current status.";

/**
 * SCRUM-28 AC 5 — every saved update tells the coordinator who raised the
 * request, inside the same transaction as the update itself.
 */
function notifyCoordinator(
  tx: Prisma.TransactionClient,
  request: { requestedById: string; event: { id: string } },
  message: string,
) {
  return tx.notification.create({
    data: {
      userId: request.requestedById,
      type: "EQUIPMENT_REQUEST_UPDATED",
      title: "Equipment request updated",
      message,
      link: "/equipment-requests",
      eventId: request.event.id,
    },
  });
}

/**
 * SCRUM-27 AC 2 — only types on the predefined list, and only active ones.
 * Returns each type's name, or the lines to fix.
 */
async function knownTypes(
  lines: { equipmentId: string }[],
): Promise<
  { types: Map<string, string> } | { fieldErrors: Record<string, string[]> }
> {
  const known = await prisma.equipment.findMany({
    where: {
      id: { in: lines.map((line) => line.equipmentId) },
      isActive: true,
    },
    select: { id: true, type: true },
  });
  const types = new Map(known.map((item) => [item.id, item.type]));
  const fieldErrors: Record<string, string[]> = {};
  lines.forEach((line, index) => {
    if (!types.has(line.equipmentId)) {
      fieldErrors[`lines.${index}.equipmentId`] = [
        "Select an equipment type from the list.",
      ];
    }
  });
  return Object.keys(fieldErrors).length ? { fieldErrors } : { types };
}

function findOpenRequest(eventId: string) {
  return prisma.equipmentRequest.findFirst({
    where: { eventId, status: { in: [...OPEN_REQUEST_STATUSES] } },
    select: { id: true },
  });
}

/**
 * SCRUM-27 — an Event Coordinator requests equipment for one of their events.
 *
 * - An event the coordinator has no relationship to, one that doesn't exist and
 *   one that isn't going ahead all get the same answer, so the action can't be
 *   used to probe which event ids exist (SCRUM-68).
 * - AC 7: an event keeps at most one open request. A second submission returns
 *   the existing request with `existing: true` so the page can show it. The
 *   partial unique index "EquipmentRequest_one_open_per_event" is what makes
 *   that hold when two submissions race: the loser's insert fails, and it is
 *   answered with the winner's request instead of an error.
 */
export async function createEquipmentRequest(
  input: unknown,
): Promise<ActionResult<{ id: string; existing: boolean }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "equipment-request:create");

    const parsed = createEquipmentRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        fieldErrorsByPath(parsed.error),
      );
    }
    const { eventId, notes, lines } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { name: true, organiserId: true, coordinatorId: true, status: true },
    });
    const requestable =
      event &&
      can(user!, "equipment-request:create", { kind: "event", ...event }) &&
      (REQUESTABLE_EVENT_STATUSES as readonly string[]).includes(event.status);
    if (!requestable) {
      return err(NOT_REQUESTABLE, { eventId: [NOT_REQUESTABLE] });
    }

    const known = await knownTypes(lines);
    if ("fieldErrors" in known) {
      return err("Please fix the highlighted fields.", known.fieldErrors);
    }

    // The open request may have been raised after the coordinator's page
    // loaded, so the list is refreshed for it to be there to highlight.
    const showExisting = (id: string) => {
      revalidatePath("/equipment-requests");
      return ok({ id, existing: true });
    };

    const open = await findOpenRequest(eventId);
    if (open) return showExisting(open.id);

    try {
      const created = await prisma.$transaction(async (tx) => {
        // SCRUM-170 AC4: a request replaces a No equipment needed decision.
        // The event row is locked first, so recordNoEquipmentNeeded, which
        // locks it too, can't record the decision beside this request. The
        // event read above can be stale: a confirmation, rejection,
        // cancellation or reassignment that committed since must not get a
        // new request, so who may ask and when is decided again here.
        const [locked] = await tx.$queryRaw<
          { status: EventStatus; organiserId: string; coordinatorId: string | null }[]
        >`
          SELECT "status", "organiserId", "coordinatorId" FROM "Event"
           WHERE "id" = ${eventId} FOR UPDATE
        `;
        if (
          !locked ||
          !(REQUESTABLE_EVENT_STATUSES as readonly string[]).includes(locked.status) ||
          !can(user!, "equipment-request:create", { kind: "event", ...locked })
        ) {
          return null;
        }
        await tx.event.updateMany({
          where: { id: eventId, noEquipmentNeededAt: { not: null } },
          data: { noEquipmentNeededAt: null, noEquipmentNeededById: null },
        });
        const request = await tx.equipmentRequest.create({
          data: {
            eventId,
            requestedById: user!.id,
            status: "PENDING_REVIEW",
            notes,
            lines: {
              create: lines.map((line) => ({
                equipmentId: line.equipmentId,
                quantity: line.quantity,
                technicalRequirements: line.technicalRequirements,
              })),
            },
          },
          select: { id: true },
        });
        // The history log (SCRUM-28 AC 6) starts with the submission itself.
        await tx.equipmentRequestUpdate.create({
          data: {
            requestId: request.id,
            actorId: user!.id,
            fromStatus: null,
            toStatus: "PENDING_REVIEW",
            note: "Request submitted.",
          },
        });
        // SCRUM-124 AC2, AC14: every Technical Support member is told, in the
        // same transaction, so a submission that loses a race tells nobody.
        await notifyRole(tx, "TECH_SUPPORT", { id: eventId }, {
          type: "EQUIPMENT_REQUEST_SUBMITTED",
          title: "An equipment request was submitted",
          message: `The Coordinator requested equipment for "${event!.name}": ${lines
            .map((line) => `${known.types.get(line.equipmentId)} × ${line.quantity}`)
            .join(", ")}.`,
          link: "/equipment-requests",
        });
        return request;
      });

      if (!created) return err(NOT_REQUESTABLE, { eventId: [NOT_REQUESTABLE] });
      revalidatePath("/equipment-requests");
      return ok({ id: created.id, existing: false });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const winner = await findOpenRequest(eventId);
        if (winner) return showExisting(winner.id);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-28 AC 2, AC 3 — Technical Support moves a request on: Pending Review → In
 * Review, then In Review → Approved or Rejected (`canMoveRequest`).
 *
 * The write is conditional on the status this reviewer saw, so of two
 * reviewers acting at once only one moves the request; the other is told, and
 * neither the history (AC 6) nor the notification (AC 5) is written twice.
 */
export async function updateEquipmentRequestStatus(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "equipment-request:review");

    const parsed = reviewEquipmentRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { requestId, toStatus, note } = parsed.data;

    const request = await prisma.equipmentRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        requestedById: true,
        event: { select: { id: true, name: true, organiserId: true, coordinatorId: true } },
      },
    });
    if (!request) return err(NOT_FOUND);
    // SCRUM-121 AC5: nobody reviews equipment for an event they organise or
    // coordinate, whatever roles they hold.
    requirePermission(user, "equipment-request:review", { kind: "arrangement", ...request.event });

    const from = request.status;
    if (!canMoveRequest(from, toStatus)) {
      return err(
        `This request is ${EQUIPMENT_REQUEST_STATUS_LABEL[from]}, so it can't be marked ${EQUIPMENT_REQUEST_STATUS_LABEL[toStatus]}.`,
      );
    }

    const moved = await prisma.$transaction(async (tx) => {
      const result = await tx.equipmentRequest.updateMany({
        where: { id: request.id, status: from },
        data: {
          status: toStatus,
          decidedAt: toStatus === "IN_REVIEW" ? null : new Date(),
        },
      });
      if (result.count !== 1) return false;

      await tx.equipmentRequestUpdate.create({
        data: {
          requestId: request.id,
          actorId: user!.id,
          fromStatus: from,
          toStatus,
          note,
        },
      });
      await notifyCoordinator(
        tx,
        request,
        `Your equipment request for "${request.event.name}" is now ${EQUIPMENT_REQUEST_STATUS_LABEL[toStatus]}.` +
          (note ? ` Note: ${note}` : ""),
      );
      return true;
    });
    if (!moved) return err(UPDATED_ELSEWHERE);

    revalidatePath("/equipment-requests");
    return ok({ status: toStatus });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-28 AC 4 — when a requested type is unavailable for the event, Technical
 * Support picks another type from the inventory to suggest to the coordinator.
 *
 * Both halves are checked against what is free for the event's period: the
 * requested type must be short, and the alternative must cover the whole
 * quantity. A suggestion is advice, not a reservation (that is SCRUM-31), so
 * nothing is held; the coordinator is told and the history records it.
 */
export async function suggestAlternativeEquipment(
  input: unknown,
): Promise<ActionResult<{ alternativeId: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "equipment-request:review");

    const parsed = suggestAlternativeSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { requestId, lineId, alternativeId } = parsed.data;

    const request = await prisma.equipmentRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        requestedById: true,
        event: {
          select: { id: true, name: true, startAt: true, endAt: true, organiserId: true, coordinatorId: true },
        },
        lines: {
          where: { id: lineId, ...LIVE_LINE },
          select: {
            id: true,
            quantity: true,
            equipment: { select: { id: true, type: true } },
          },
        },
      },
    });
    const line = request?.lines[0];
    if (!request || !line) return err(NOT_FOUND);
    // SCRUM-121 AC5: nobody reviews equipment for an event they organise or
    // coordinate, whatever roles they hold.
    requirePermission(user, "equipment-request:review", { kind: "arrangement", ...request.event });
    if (request.status !== "IN_REVIEW") {
      return err("Start the review before suggesting alternatives.");
    }

    const invalid = (message: string) =>
      err<{ alternativeId: string }>("Please fix the highlighted fields.", {
        alternativeId: [message],
      });
    if (alternativeId === line.equipment.id) {
      return invalid("Choose a different equipment type.");
    }
    const alternative = await prisma.equipment.findFirst({
      where: { id: alternativeId, isActive: true },
      select: { id: true, type: true },
    });
    if (!alternative) return invalid("Select an equipment type from the list.");

    const { startAt, endAt } = request.event;
    if (!startAt || !endAt) {
      return err(
        "This event has no dates yet, so availability can't be checked.",
      );
    }
    const pool = await getPoolAvailability(startAt, endAt);
    // A type missing from the pool (deactivated since it was looked up) has
    // nothing free, so it is refused rather than read as undefined.
    const none = { available: 0, total: 0 };
    const requested = pool[line.equipment.id] ?? none;
    if (requested.available >= line.quantity) {
      return err(
        `${line.equipment.type} has enough free for this event, so there is nothing to replace.`,
      );
    }
    const offered = pool[alternative.id] ?? none;
    if (offered.available < line.quantity) {
      return invalid(
        `Only ${offered.available} of ${offered.total} ${alternative.type} are free for this event: ${line.quantity - offered.available} short.`,
      );
    }

    const shortage = `only ${requested.available} of ${requested.total}`;
    const saved = await prisma.$transaction(async (tx) => {
      // Touching the request, conditional on it still being in review, stops
      // a suggestion landing on a request someone has just decided.
      const result = await tx.equipmentRequest.updateMany({
        where: { id: request.id, status: "IN_REVIEW" },
        data: { updatedAt: new Date() },
      });
      if (result.count !== 1) return false;

      await tx.equipmentRequestLine.update({
        where: { id: line.id },
        data: { suggestedAlternativeId: alternative.id },
      });
      await tx.equipmentRequestUpdate.create({
        data: {
          requestId: request.id,
          actorId: user!.id,
          fromStatus: null,
          toStatus: null,
          note: `Suggested ${alternative.type} instead of ${line.equipment.type} (${shortage} free).`,
        },
      });
      await notifyCoordinator(
        tx,
        request,
        `Technical Support suggested ${alternative.type} instead of ${line.equipment.type} for "${request.event.name}": ${shortage} ${line.equipment.type} are free.`,
      );
      return true;
    });
    if (!saved) return err(UPDATED_ELSEWHERE);

    revalidatePath("/equipment-requests");
    return ok({ alternativeId: alternative.id });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

const CONFIRMED_EVENT =
  "This event is confirmed, so its arrangements change through a change request.";
const NOT_PLANNING =
  "This event isn't being planned, so its requests can't be changed.";
const ANOTHER_OPEN =
  "This event already has another equipment request waiting for review. Change that one instead.";

type ChangeableRequest = {
  id: string;
  status: (typeof CHANGEABLE_REQUEST_STATUSES)[number];
  event: { id: string; name: string };
  lines: {
    id: string;
    equipmentId: string;
    quantity: number;
    technicalRequirements: string | null;
    equipment: { type: string };
  }[];
};

/**
 * SCRUM-142 — the request, if the signed-in Coordinator may change or
 * withdraw it: they are its event's assigned Coordinator (AC7), the event is
 * still being planned (AC5), and the request isn't Rejected or Cancelled
 * (AC3). Someone else's request reads as not found (SCRUM-68).
 */
async function changeableRequest(
  user: SessionUser,
  requestId: string,
): Promise<ChangeableRequest | { error: string }> {
  const request = await prisma.equipmentRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      event: {
        select: {
          id: true,
          name: true,
          organiserId: true,
          coordinatorId: true,
          status: true,
        },
      },
      lines: {
        where: LIVE_LINE,
        select: {
          id: true,
          equipmentId: true,
          quantity: true,
          technicalRequirements: true,
          equipment: { select: { type: true } },
        },
      },
    },
  });
  if (
    !request ||
    !can(user, "equipment-request:change", { kind: "event", ...request.event })
  ) {
    return { error: NOT_FOUND };
  }
  const refusal = eventRefusal(request.event.status);
  if (refusal) return { error: refusal };
  if (request.status === "REJECTED") {
    return {
      error: "This request was rejected. Raise a new request instead.",
    };
  }
  if (request.status === "CANCELLED") {
    return { error: "This request has already been withdrawn." };
  }
  return { ...request, status: request.status };
}

/**
 * SCRUM-142 AC2, AC3 — cancels what is reserved for the event against these
 * types, for this request or for none (the same rule `outstandingLines`
 * counts by), so the stock returns to the pool. Conditional on the
 * reservation still being Confirmed, so stock returns exactly once.
 */
function releaseReservations(
  tx: Prisma.TransactionClient,
  request: { id: string; event: { id: string } },
  equipmentIds: string[],
  now: Date,
) {
  return tx.reservation.updateMany({
    where: {
      eventId: request.event.id,
      equipmentId: { in: equipmentIds },
      status: "CONFIRMED",
      OR: [{ requestId: request.id }, { requestId: null }],
    },
    data: { status: "CANCELLED", cancelledAt: now },
  });
}

type LiveLine = {
  id: string;
  quantity: number;
  technicalRequirements: string | null;
};

/** The same live lines, by id, with the same quantities and requirements. */
function sameLines(now: LiveLine[], read: LiveLine[]): boolean {
  const before = new Map(read.map((line) => [line.id, line]));
  return (
    now.length === read.length &&
    now.every((line) => {
      const was = before.get(line.id);
      return (
        was !== undefined &&
        was.quantity === line.quantity &&
        was.technicalRequirements === line.technicalRequirements
      );
    })
  );
}

/**
 * Lock the event, then the request: the order reserving takes (ADR 0007).
 * Then re-read the event under its lock: a Confirm that committed while this
 * waited (confirmEvent takes the same lock) must stop the change (AC5).
 * Returns why the change can't go ahead, or null.
 */
async function lockRequest(
  tx: Prisma.TransactionClient,
  requestId: string,
): Promise<string | null> {
  await tx.$queryRaw`
    SELECT e."id" FROM "Event" e
    JOIN "EquipmentRequest" r ON r."eventId" = e."id"
    WHERE r."id" = ${requestId}
    FOR UPDATE OF e
  `;
  await tx.$queryRaw`
    SELECT "id" FROM "EquipmentRequest" WHERE "id" = ${requestId} FOR UPDATE
  `;
  const { event } = await tx.equipmentRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { event: { select: { status: true } } },
  });
  return eventRefusal(event.status);
}

/** SCRUM-142 AC5 — why requests for an event in this status can't change. */
function eventRefusal(status: EventStatus): string | null {
  if (status === "CONFIRMED") return CONFIRMED_EVENT;
  return (REQUESTABLE_EVENT_STATUSES as readonly string[]).includes(status)
    ? null
    : NOT_PLANNING;
}

/**
 * SCRUM-142 AC1, AC2 — the event's assigned Coordinator changes the lines of
 * an equipment request that is Pending Review, In Review or Approved.
 *
 * - The new list replaces the lines: types left out are removed (kept with
 *   `removedAt`), new types added (a removed one comes back), and quantities
 *   or technical requirements changed in place. The same list again changes
 *   nothing (AC8).
 * - The request returns to Pending Review for Technical Support to re-check,
 *   conditional on the status read (ADR 0006), and its history records what
 *   changed.
 * - Reservations for a changed or removed line are cancelled in the same
 *   transaction (AC2), Technical Support are told (AC7), and a safety check
 *   that approved or is reviewing the arrangements goes out of date (AC9).
 */
export async function changeEquipmentRequest(
  input: unknown,
): Promise<ActionResult<{ id: string; changed: boolean }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "equipment-request:change");

    const parsed = changeEquipmentRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        fieldErrorsByPath(parsed.error),
      );
    }
    const { requestId, lines } = parsed.data;

    const request = await changeableRequest(user!, requestId);
    if ("error" in request) return err(request.error);

    const known = await knownTypes(lines);
    if ("fieldErrors" in known) {
      return err("Please fix the highlighted fields.", known.fieldErrors);
    }

    const { added, changed, removed } = lineChanges(request.lines, lines);
    if (added.length + changed.length + removed.length === 0) {
      return ok({ id: requestId, changed: false });
    }

    const now = new Date();
    const typeOf = (equipmentId: string) => known.types.get(equipmentId)!;
    const summary = [
      ...added.map((l) => `added ${typeOf(l.equipmentId)} × ${l.quantity}`),
      ...changed.map((l) =>
        l.quantity === l.from.quantity
          ? `changed the requirements for ${l.from.equipment.type}`
          : `${l.from.equipment.type} ${l.from.quantity} → ${l.quantity}`,
      ),
      ...removed.map((l) => `removed ${l.equipment.type}`),
    ].join("; ");

    const refused = await prisma.$transaction(async (tx) => {
      const refusal = await lockRequest(tx, requestId);
      if (refusal) return refusal;
      // The diff above holds only against the lines it was worked out from.
      // A change that committed while this one waited for the lock (the same
      // change twice, say) leaves the status as it was, so check the lines
      // too, and write nothing over them (AC8).
      const live = await tx.equipmentRequestLine.findMany({
        where: { requestId, ...LIVE_LINE },
        select: { id: true, quantity: true, technicalRequirements: true },
      });
      if (!sameLines(live, request.lines)) return UPDATED_ELSEWHERE;
      const result = await tx.equipmentRequest.updateMany({
        where: { id: requestId, status: request.status },
        data: { status: "PENDING_REVIEW", decidedAt: null },
      });
      if (result.count !== 1) return UPDATED_ELSEWHERE;

      const returning = await tx.equipmentRequestLine.findMany({
        where: {
          requestId,
          removedAt: { not: null },
          equipmentId: { in: added.map((l) => l.equipmentId) },
        },
        select: { id: true, equipmentId: true },
      });
      for (const line of added) {
        const data = {
          quantity: line.quantity,
          technicalRequirements: line.technicalRequirements ?? null,
        };
        const back = returning.find((r) => r.equipmentId === line.equipmentId);
        if (back) {
          await tx.equipmentRequestLine.update({
            where: { id: back.id },
            data: { ...data, removedAt: null, suggestedAlternativeId: null },
          });
        } else {
          await tx.equipmentRequestLine.create({
            data: { ...data, requestId, equipmentId: line.equipmentId },
          });
        }
      }
      for (const line of changed) {
        await tx.equipmentRequestLine.update({
          where: { id: line.id },
          data: {
            quantity: line.quantity,
            technicalRequirements: line.technicalRequirements ?? null,
            suggestedAlternativeId: null,
          },
        });
      }
      if (removed.length > 0) {
        await tx.equipmentRequestLine.updateMany({
          where: { id: { in: removed.map((l) => l.id) } },
          data: { removedAt: now },
        });
      }

      const released = await releaseReservations(
        tx,
        request,
        [...changed, ...removed].map((l) => l.equipmentId),
        now,
      );
      await tx.equipmentRequestUpdate.create({
        data: {
          requestId,
          actorId: user!.id,
          fromStatus: request.status,
          toStatus: "PENDING_REVIEW",
          note:
            `Changed by the Coordinator: ${summary}.` +
            (released.count > 0
              ? ` ${released.count} reservation(s) cancelled.`
              : ""),
        },
      });
      await notifyRole(tx, "TECH_SUPPORT", request.event, {
        type: "EQUIPMENT_REQUEST_CHANGED",
        title: "An equipment request changed",
        message: `The equipment request for "${request.event.name}" changed (${summary}) and is back in Pending Review.`,
        link: "/equipment-requests",
      });
      await outdateSafetyChecks(tx, request.event.id, now);
      return null;
    });
    if (refused) return err(refused);

    revalidatePath("/equipment-requests");
    revalidatePath("/equipment");
    return ok({ id: requestId, changed: true });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    // An Approved request going back to review while the event already has
    // another one waiting (EquipmentRequest_one_open_per_event).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return err(ANOTHER_OPEN);
    }
    throw error;
  }
}

/**
 * SCRUM-142 AC3 — the event's assigned Coordinator withdraws a whole
 * equipment request that is Pending Review, In Review or Approved. It becomes
 * Cancelled, conditional on the status read, and what is reserved for it
 * returns to the pool in the same transaction. Technical Support are told
 * (AC7), and the safety check goes out of date (AC9). A new request can be
 * raised later (SCRUM-27).
 */
export async function withdrawEquipmentRequest(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "equipment-request:change");

    const parsed = withdrawEquipmentRequestSchema.safeParse(input);
    if (!parsed.success) return err(NOT_FOUND);
    const { requestId } = parsed.data;

    const request = await changeableRequest(user!, requestId);
    if ("error" in request) return err(request.error);

    const now = new Date();
    const refused = await prisma.$transaction(async (tx) => {
      const refusal = await lockRequest(tx, requestId);
      if (refusal) return refusal;
      const result = await tx.equipmentRequest.updateMany({
        where: { id: requestId, status: request.status },
        data: { status: "CANCELLED", decidedAt: now },
      });
      if (result.count !== 1) return UPDATED_ELSEWHERE;

      const released = await releaseReservations(
        tx,
        request,
        request.lines.map((l) => l.equipmentId),
        now,
      );
      await tx.equipmentRequestUpdate.create({
        data: {
          requestId,
          actorId: user!.id,
          fromStatus: request.status,
          toStatus: "CANCELLED",
          note:
            "Withdrawn by the Coordinator." +
            (released.count > 0
              ? ` ${released.count} reservation(s) cancelled.`
              : ""),
        },
      });
      await notifyRole(tx, "TECH_SUPPORT", request.event, {
        type: "EQUIPMENT_REQUEST_WITHDRAWN",
        title: "An equipment request was withdrawn",
        message: `The Coordinator withdrew the equipment request for "${request.event.name}".`,
        link: "/equipment-requests",
      });
      await outdateSafetyChecks(tx, request.event.id, now);
      return null;
    });
    if (refused) return err(refused);

    revalidatePath("/equipment-requests");
    revalidatePath("/equipment");
    return ok({ id: requestId });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
