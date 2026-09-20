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
  | "event:list" // list the events scoped to me (own / assigned)
  | "event:read" // read one event (relationship-gated)
  | "event:review"
  | "clarification:request" // SCRUM-18: coordinator asks the organiser a question
  | "clarification:respond" // SCRUM-18: organiser answers an open question
  | "venue:read"
  | "booking:review"
  | "equipment:read"
  | "equipment:reserve"
  | "event:browse" // attendees browsing events open for registration
  | "registration:read"
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
    "event:list",
    "event:read",
    "clarification:respond",
    "notification:read",
  ],
  COORDINATOR: [
    "event:list",
    "event:read",
    "event:review",
    "clarification:request",
    "venue:read",
    "notification:read",
  ],
  // `venue:read` gates the Venue Catalogue page, which is Coordinator-only, so
  // it is deliberately NOT granted here — Venue Staff act on bookings, not the
  // catalogue. Grant it here the day Venue Staff need the catalogue; that is the
  // one-line change SCRUM-66 is about, with no page edits.
  VENUE_STAFF: ["booking:review", "notification:read"],
  TECH_SUPPORT: ["equipment:read", "equipment:reserve", "notification:read"],
  ATTENDEE: ["event:browse", "registration:read", "notification:read"],
};

/**
 * The relationship gate. Given a user and a resource, is the user related to
 * it in a way that grants access? Role has already been checked by `can()`.
 */
function hasRelationship(user: SessionUser, resource: Resource): boolean {
  switch (resource.kind) {
    case "event":
      // Organisers own events; coordinators are assigned to them or review unassigned submitted requests.
      if (user.role === "ORGANISER") {
        return resource.organiserId === user.id;
      }
      if (user.role === "COORDINATOR") {
        if (resource.coordinatorId === user.id) return true;
        return resource.coordinatorId === null && resource.status !== "DRAFT";
      }
      return false;
    case "registration":
      return resource.userId === user.id;
    case "notification":
      return resource.userId === user.id;
  }
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
  if (!ROLE_ACTIONS[user.role].includes(action)) {
    return false;
  }

  // 2. Relationship gate — only when the action targets a specific resource.
  if (resource) {
    return hasRelationship(user, resource);
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
