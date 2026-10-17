import type { EventStatus, Role } from "@prisma/client";

/**
 * Authorisation lives HERE and only here. An inline role check in a feature
 * (`if (session.user.role === "COORDINATOR")`) is a code-review rejection —
 * see CONTRIBUTING.md. The customer requires two things to line up before an
 * action is allowed, and this module is where both are checked:
 *
 *   1. ROLE      — does this role have this capability at all?
 *                  (A Venue Staff member cannot approve an event request.)
 *   2. RELATIONSHIP — is this specific user related to this specific resource?
 *                  (A Coordinator sees only events assigned to them; an
 *                   Organiser only their own; an Attendee only their own
 *                   registrations.)
 */

/** The minimal shape of the signed-in user that authorisation needs. */
export type SessionUser = {
  id: string;
  role: Role;
};

/**
 * Every capability in the system, named `entity:verb`. Feature developers add
 * new actions here as they build, and grant them to roles in ROLE_ACTIONS
 * below. This union is the vocabulary the whole app shares.
 */
export type Action =
  | "event:create"
  | "event:discard" // SCRUM-130: the organiser discards their own Draft
  | "event:list" // list the events scoped to me (own / assigned)
  | "event:read" // read one event (relationship-gated)
  | "event:review"
  | "event:confirm" // SCRUM-81: the assigned coordinator confirms a ready Planning event
  | "event:reject" // SCRUM-117: the assigned coordinator rejects a Planning event that can't be fulfilled
  | "event:no-equipment" // SCRUM-170 AC4: the assigned coordinator records No equipment needed
  | "event:edit" // SCRUM-25: the assigned coordinator edits an event's details directly
  | "event-note:add" // SCRUM-25 AC6: add an operational note to an event
  | "event-note:read" // SCRUM-25 AC6: read an event's operational notes
  | "arrangement:reconsider" // SCRUM-26: the assigned coordinator resolves a Needs Reconsideration flag
  | "safety-check:request" // SCRUM-166: the assigned coordinator asks for an operational safety check
  | "safety-check:review" // SCRUM-166: a Safety Officer reviews a check and records its outcome
  | "clarification:request" // SCRUM-18: coordinator asks the organiser a question
  | "clarification:respond" // SCRUM-18: organiser answers an open question
  | "change-request:raise" // SCRUM-41: the organiser, or the assigned coordinator on their behalf
  | "venue:read" // SCRUM-34 AC2: any internal user views the venue catalogue and a venue's details
  | "venue:manage" // SCRUM-34 AC3, AC6, AC8, AC9: Venue Staff add, edit and retire venues
  | "venue:availability" // SCRUM-36: view a venue's availability calendar
  | "booking:request" // SCRUM-50: coordinator asks for a venue for their event
  | "booking:review" // SCRUM-52: read the pending-request queue
  | "booking:decide" // SCRUM-53: approve or reject a pending request
  | "booking:hold" // SCRUM-163: hold a pending request until a deadline
  | "booking:settle-hold" // SCRUM-163: the assigned coordinator confirms or releases a hold
  | "booking:withdraw" // SCRUM-142: the assigned coordinator withdraws a pending venue request
  | "unavailability:record" // SCRUM-37: record maintenance, closure, etc.
  | "equipment:read"
  | "equipment:reserve"
  | "equipment-request:list" // SCRUM-27: see the equipment requests scoped to me
  | "equipment-request:create" // SCRUM-27: coordinator raises one for their event
  | "equipment-request:change" // SCRUM-142: the assigned coordinator changes or withdraws it
  | "equipment-request:review" // SCRUM-28: Technical Support updates a request
  | "event:browse" // attendees browsing events open for registration
  | "registration:create" // SCRUM-73: an attendee registers for an event
  | "registration:withdraw" // SCRUM-74/77: an attendee withdraws their own registration
  | "registration:control" // SCRUM-75 AC6: the organiser, or the assigned coordinator on their behalf, closes or reopens registration
  | "registration:read"
  | "registration:list" // SCRUM-70: an event's Organiser or assigned Coordinator sees its registrations
  | "notification:read";

/**
 * A resource the action targets, carrying just enough ownership information to
 * check the relationship. Pass one to `can()` for actions that operate on a
 * specific row; omit it for create/list actions that are role-gated only.
 */
export type Resource =
  // `status` is required: the coordinator check treats "unassigned and not a
  // draft" as visible, so an omitted status must not silently count as non-draft.
  | {
      kind: "event";
      organiserId: string;
      coordinatorId: string | null;
      status: EventStatus;
    }
  // SCRUM-25 AC6 — who may add or read an event's operational notes depends
  // on what the event has, as no Venue Staff or Technical Support member is
  // assigned to an event: a venue booking (Pending, Held or Approved) for
  // Venue Staff, an equipment request for Technical Support.
  | {
      kind: "event-notes";
      organiserId: string;
      coordinatorId: string | null;
      hasVenueBooking: boolean;
      hasEquipmentRequest: boolean;
    }
  | { kind: "registration"; userId: string }
  | { kind: "notification"; userId: string };

/**
 * THE authorisation table — one source of truth mapping each role to the
 * actions it may perform. Read this top-to-bottom in the oral exam to explain
 * the whole permission model.
 */
const ROLE_ACTIONS: Record<Role, Action[]> = {
  ORGANISER: [
    "event:create",
    "event:discard",
    "event:list",
    "event:read",
    "clarification:respond",
    "change-request:raise",
    "registration:control",
    "event-note:read",
    "registration:list",
    "notification:read",
  ],
  COORDINATOR: [
    "event:list",
    "event:read",
    "event:review",
    "event:confirm",
    "event:reject",
    "event:no-equipment",
    "event:edit",
    "event-note:add",
    "event-note:read",
    "arrangement:reconsider",
    "safety-check:request",
    "clarification:request",
    "change-request:raise",
    "registration:control",
    "venue:read",
    "equipment-request:list",
    "equipment-request:create",
    "equipment-request:change",
    "venue:availability",
    "booking:request",
    "booking:settle-hold",
    "booking:withdraw",
    "registration:list",
    "notification:read",
  ],
  VENUE_STAFF: [
    "venue:read",
    "venue:manage",
    "booking:review",
    "booking:decide",
    "booking:hold",
    "venue:availability",
    "unavailability:record",
    "event-note:add",
    "event-note:read",
    "notification:read",
  ],
  TECH_SUPPORT: [
    "equipment:read",
    "venue:read",
    "equipment:reserve",
    "equipment-request:list",
    "equipment-request:review",
    "event-note:add",
    "event-note:read",
    "notification:read",
  ],
  ATTENDEE: [
    "event:browse",
    "registration:create",
    "registration:withdraw",
    "registration:read",
    "notification:read",
  ],
  // SCRUM-164 — the Week 7 roles. Like every user they read their own
  // notifications (SCRUM-48) and, as internal users, the venue catalogue
  // (SCRUM-34 AC2); SCRUM-165 and SCRUM-166 grant the rest.
  COORDINATOR_LEAD: ["venue:read", "notification:read"],
  SAFETY_OFFICER: ["venue:read", "safety-check:review", "notification:read"],
};

/**
 * The relationship gate. Given a user and a resource, is the user related to
 * it in a way that grants access? Role has already been checked by `can()`.
 */
function hasRelationship(
  user: SessionUser,
  action: Action,
  resource: Resource,
): boolean {
  switch (resource.kind) {
    case "event":
      // Organisers own events; coordinators are assigned to them or review unassigned submitted requests.
      if (user.role === "ORGANISER") {
        return resource.organiserId === user.id;
      }
      if (user.role === "COORDINATOR") {
        if (resource.coordinatorId === user.id) return true;
        // Any coordinator may review a request nobody has picked up yet, but
        // only the event's assigned coordinator may confirm it (SCRUM-81 AC 7),
        // reject it from Planning (SCRUM-117 AC 5), confirm or release its
        // venue holds (SCRUM-163 AC3), change or withdraw its requests
        // (SCRUM-142 AC7), raise a change request on the organiser's behalf
        // (SCRUM-41 AC10), record No equipment needed (SCRUM-170 AC4), edit
        // its details (SCRUM-25 AC1, AC7), resolve a flag on its arrangements
        // (SCRUM-26 AC7), request its safety check (SCRUM-166 AC1), close
        // or reopen its registration (SCRUM-75 AC6) or see its registrations
        // (SCRUM-70 AC1).
        return (
          action !== "event:confirm" &&
          action !== "event:reject" &&
          action !== "event:no-equipment" &&
          action !== "booking:settle-hold" &&
          action !== "booking:withdraw" &&
          action !== "equipment-request:change" &&
          action !== "change-request:raise" &&
          action !== "event:edit" &&
          action !== "arrangement:reconsider" &&
          action !== "registration:list" &&
          action !== "registration:control" &&
          action !== "safety-check:request" &&
          resource.coordinatorId === null &&
          resource.status !== "DRAFT"
        );
      }
      // SCRUM-166 AC6, SCRUM-121 AC5: a Safety Officer reviews any event's
      // check, but never one for an event they organise or coordinate.
      if (user.role === "SAFETY_OFFICER") {
        return (
          resource.organiserId !== user.id && resource.coordinatorId !== user.id
        );
      }
      return false;
    case "event-notes":
      // SCRUM-25 AC6, AC7: only the event's own Coordinator, not a previous
      // one; Venue Staff and Technical Support through the event's
      // arrangements; the Organiser reads their own event's notes.
      return (
        (user.role === "COORDINATOR" && resource.coordinatorId === user.id) ||
        (user.role === "VENUE_STAFF" && resource.hasVenueBooking) ||
        (user.role === "TECH_SUPPORT" && resource.hasEquipmentRequest) ||
        (user.role === "ORGANISER" && resource.organiserId === user.id)
      );
    case "registration":
      return resource.userId === user.id;
    case "notification":
      return resource.userId === user.id;
  }
}

/**
 * Does this role hold this capability at all, before any relationship to a
 * specific row is considered? `can()` is the gate features use; this is for the
 * places that only know a role and never see a resource — the navigation map
 * (SCRUM-66) is the one caller today. It reads the same ROLE_ACTIONS table, so
 * granting a role an action updates the menu with no second edit.
 */
export function roleAllows(role: Role, action: Action): boolean {
  return ROLE_ACTIONS[role].includes(action);
}

/**
 * The one function features call to ask "is this allowed?".
 *
 * @param user     the signed-in user (id + role)
 * @param action   the capability being attempted
 * @param resource the specific row it targets, if any
 */
export function can(
  user: SessionUser,
  action: Action,
  resource?: Resource,
): boolean {
  // 1. Role gate.
  if (!roleAllows(user.role, action)) {
    return false;
  }

  // 2. Relationship gate — only when the action targets a specific resource.
  if (resource) {
    return hasRelationship(user, action, resource);
  }

  return true;
}

/**
 * Thrown by `requirePermission`. Server actions catch this and convert it into
 * an `ActionResult` error rather than letting it bubble to the client.
 */
export class PermissionError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "PermissionError";
  }
}

/**
 * The FIRST statement of every Server Action. Throws PermissionError when the
 * action is not allowed, so the happy path below it can assume authorisation
 * has passed.
 */
export function requirePermission(
  user: SessionUser | undefined,
  action: Action,
  resource?: Resource,
): void {
  if (!user || !can(user, action, resource)) {
    throw new PermissionError();
  }
}
