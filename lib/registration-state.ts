import type { Event } from "@prisma/client";

import { formatDateTime } from "@/lib/datetime";

/**
 * SCRUM-72/73/74 — the registration state of one event, from an Attendee's
 * point of view. This is the ONE place the rule is defined; the browse list,
 * the detail page and the register action (SCRUM-73) all call it instead of
 * re-deriving it, so "why can't I register" always means the same thing
 * everywhere.
 *
 * Precedence, most specific first: a manual close or an expired window is
 * checked before capacity, because if registration was never open there is
 * nothing meaningful to say about it being full.
 */
export type RegistrationState =
  | "OPEN"
  | "FULL"
  | "NOT_YET_OPEN"
  | "CLOSED" // registrationEnabled is false — an explicit organiser action
  | "EXPIRED"; // the closing time or the event start has passed

export const REGISTRATION_STATE_LABEL: Record<RegistrationState, string> = {
  OPEN: "Open",
  FULL: "Full",
  NOT_YET_OPEN: "Registration not yet open",
  CLOSED: "Registration closed",
  EXPIRED: "Registration closed",
};

/**
 * SCRUM-171 AC4 — does the event take registrations? Its Organiser answered
 * Yes, or it was requested before Registration needed existed (unanswered),
 * which keeps working as it always has. Only an explicit No leaves it out.
 */
export function takesRegistration(
  event: Pick<Event, "registrationRequired">,
): boolean {
  return event.registrationRequired !== false;
}

/**
 * The same rule as a Prisma `where` fragment. In SQL `<> false` is never true
 * for NULL, so an unanswered event must be asked for explicitly.
 */
export const TAKES_REGISTRATION = {
  OR: [{ registrationRequired: true }, { registrationRequired: null }],
};

type CapacityInput = Pick<Event, "expectedAttendance">;

/**
 * SCRUM-73/74: "the event's expected attendance IS the registration
 * capacity; there is no separate attendee-capacity value."
 */
export function totalCapacity(event: CapacityInput): number {
  return event.expectedAttendance ?? 0;
}

export function remainingCapacity(
  event: CapacityInput,
  activeRegistrationCount: number,
): number {
  return Math.max(0, totalCapacity(event) - activeRegistrationCount);
}

type StateInput = Pick<
  Event,
  | "expectedAttendance"
  | "registrationEnabled"
  | "registrationOpensAt"
  | "registrationClosesAt"
  | "startAt"
>;

/**
 * SCRUM-75 AC4/AC8: with no window, registration closes at the event's start,
 * and it is never accepted at or after the start whatever the window says —
 * so the effective close is whichever of the two comes first.
 */
export function effectiveClosesAt(
  event: Pick<Event, "registrationClosesAt" | "startAt">,
): Date | null {
  const { registrationClosesAt: closesAt, startAt } = event;
  if (closesAt && startAt) return closesAt < startAt ? closesAt : startAt;
  return closesAt ?? startAt;
}

/**
 * SCRUM-72 AC3: the registration period as an Attendee reads it. With no
 * window set this shows the SCRUM-75 AC4 default, e.g.
 * "Opens on confirmation · Closes 15 Jan 2026, 10:00 am SGT".
 */
export function registrationPeriodText(
  event: Pick<
    Event,
    "registrationOpensAt" | "registrationClosesAt" | "startAt"
  >,
): string {
  const opens = event.registrationOpensAt
    ? `Opens ${formatDateTime(event.registrationOpensAt)}`
    : "Opens on confirmation";
  const closesAt = effectiveClosesAt(event);
  return closesAt ? `${opens} · Closes ${formatDateTime(closesAt)}` : opens;
}

/**
 * Does not check `status` (CONFIRMED vs anything else) — callers filter that
 * separately (SCRUM-72's "browse Confirmed events" gate), since an event that
 * isn't even visible has no registration state to compute.
 */
export function computeRegistrationState(
  event: StateInput,
  activeRegistrationCount: number,
  now: Date = new Date(),
): RegistrationState {
  if (!event.registrationEnabled) return "CLOSED";
  // SCRUM-75 AC2/AC7: the closing instant itself is already closed.
  const closesAt = effectiveClosesAt(event);
  if (closesAt && closesAt <= now) return "EXPIRED";
  if (event.registrationOpensAt && event.registrationOpensAt > now) {
    return "NOT_YET_OPEN";
  }
  if (remainingCapacity(event, activeRegistrationCount) <= 0) return "FULL";
  return "OPEN";
}

/**
 * SCRUM-77 AC3: withdrawal is allowed up to, but not including, the event's
 * start. The server and the Withdraw button both ask this, so the button is
 * never offered when the server would refuse it.
 */
export function canWithdrawNow(
  event: Pick<Event, "startAt">,
  now: Date = new Date(),
): boolean {
  return !event.startAt || event.startAt > now;
}

export function canRegisterNow(state: RegistrationState): boolean {
  return state === "OPEN";
}

/**
 * SCRUM-75 AC6 — registration that is open can be closed. A full event is
 * still open (a withdrawal frees a place), so it can be closed too.
 */
export function canCloseRegistration(state: RegistrationState): boolean {
  return state === "OPEN" || state === "FULL";
}

/**
 * SCRUM-75 AC6, AC8, AC9 — closed registration can be reopened, whether it
 * was closed by hand or its closing time passed, but never at or after the
 * event's start.
 */
export function canReopenRegistration(
  event: Pick<Event, "startAt">,
  state: RegistrationState,
  now: Date = new Date(),
): boolean {
  return (
    (state === "CLOSED" || state === "EXPIRED") &&
    event.startAt !== null &&
    event.startAt > now
  );
}
