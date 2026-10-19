import type { EventStatus, RejectionOutcome } from "@prisma/client";

/**
 * SCRUM-135 — the event lifecycle: the one list of status changes the system
 * allows. Submit, decide, confirm, reject from Planning and cancel each ask
 * `canTransition` for their own step and refuse anything else with
 * `transitionRefusal`, which names the event's current status (AC11). Each
 * then writes under a lock on the event row or with a write conditional on
 * the status it read, so a status changed meanwhile isn't overwritten. The
 * Lead's assignment (SCRUM-165) and the two returns to Planning (SCRUM-128,
 * SCRUM-26) make one fixed move the table allows, guarded the same way by
 * their conditional writes.
 *
 * Test cases: docs/testing/SCRUM-135.md. Why: docs/adr/0006 (2026-10-14
 * addendum).
 */

/** The names every screen uses (SCRUM-131 AC1). */
export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  PLANNING: "Planning",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

/**
 * From each status, the statuses it may move to.
 *
 * - Draft → Submitted when the Organiser submits (AC1).
 * - Submitted → Under Review when a Coordinator is assigned (AC2). Nothing
 *   decides a Submitted request: it has no Coordinator yet (AC3, AC4).
 * - Under Review → Planning on approval, which records Approved on the way
 *   (AC3, AC12); → Rejected (AC4); → Cancelled (AC9).
 * - Planning → Confirmed (AC7); → Rejected if never Confirmed (AC5, checked by
 *   the action); → Cancelled (AC9).
 * - Confirmed → Planning after an approved impactful change or a cancelled
 *   flagged arrangement (AC8); → Cancelled (AC9); → Completed after its end
 *   (AC10).
 * - Rejected → Submitted only when the outcome was Amend and resubmit (AC6,
 *   AC13).
 * - Completed and Cancelled are final (AC13).
 * - Approved is never a resting status (AC12). A row left Approved from before
 *   approval moved straight to Planning can still be cancelled, so it isn't
 *   stuck holding its arrangements; no action moves it on to Planning.
 */
const NEXT: Record<EventStatus, readonly EventStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["PLANNING", "REJECTED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
  PLANNING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["PLANNING", "CANCELLED", "COMPLETED"],
  REJECTED: ["SUBMITTED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Is moving an event from `from` to `to` one of the lifecycle's steps? */
export function canTransition(
  from: EventStatus,
  to: EventStatus,
  context: { rejectionOutcome?: RejectionOutcome | null } = {},
): boolean {
  if (from === "REJECTED" && to === "SUBMITTED") {
    return context.rejectionOutcome === "AMEND_AND_RESUBMIT";
  }
  return NEXT[from].includes(to);
}

/** The statuses an event may be cancelled from (SCRUM-82 AC1, AC9). */
export const CANCELLABLE = (Object.keys(NEXT) as EventStatus[]).filter((status) =>
  NEXT[status].includes("CANCELLED"),
);

/**
 * AC11 — a refused status change names the event's current status, e.g.
 * "This event is Draft, so it can't be confirmed."
 */
export function transitionRefusal(current: EventStatus, attempted: string): string {
  return `This event is ${EVENT_STATUS_LABEL[current]}, so it can't be ${attempted}.`;
}
