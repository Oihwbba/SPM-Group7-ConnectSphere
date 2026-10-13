import type { Prisma, SafetyCheckStatus } from "@prisma/client";

import type { ChecklistItem, ReadinessChecklist } from "@/lib/event-readiness";

/**
 * SCRUM-166 — the operational safety check, a step within Planning (AC15):
 * the Coordinator requests one once the venue and equipment are arranged, a
 * Safety Officer records an outcome, and Confirm waits for Approved (AC9).
 *
 * Test cases: docs/testing/SCRUM-166.md. Why it works this way:
 * docs/adr/0018-operational-safety-check.md.
 */

/** AC9, SCRUM-131 AC7: the names every screen uses. */
export const SAFETY_CHECK_LABEL: Record<SafetyCheckStatus, string> = {
  AWAITING_REVIEW: "Awaiting review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
  OUTDATED: "Outdated",
};

export const NOT_REQUESTED = "Not requested";

/**
 * AC9 — the checklist's Safety check item, from the event's latest check.
 * Only Approved completes it. The Safety Officer's note is an internal reason,
 * so the Organiser sees the state without it (AC4).
 */
export function safetyCheckItem(
  latest: { status: SafetyCheckStatus; note: string | null } | undefined,
): ChecklistItem {
  return {
    name: "Safety check",
    complete: latest?.status === "APPROVED",
    state: latest ? SAFETY_CHECK_LABEL[latest.status] : NOT_REQUESTED,
    reason: latest?.note ?? null,
  };
}

/**
 * AC1, AC7, AC12 — a check can be requested once every other checklist item
 * is complete, and while there isn't one awaiting review or approved. After
 * Changes requested, Rejected or Outdated, the Coordinator resolves the flags
 * and requests a new one.
 */
export function safetyCheckRequestable(checklist: ReadinessChecklist): boolean {
  const safety = checklist.items.find((item) => item.name === "Safety check");
  return (
    checklist.items
      .filter((item) => item.name !== "Safety check")
      .every((item) => item.complete) &&
    safety !== undefined &&
    safety.state !== SAFETY_CHECK_LABEL.AWAITING_REVIEW &&
    safety.state !== SAFETY_CHECK_LABEL.APPROVED
  );
}

/**
 * AC13 — what a check reviewed has changed, so a check that is Approved or
 * awaiting review becomes Outdated and a new one is needed before the event is
 * confirmed. Called in the same transaction as the change.
 */
export async function outdateSafetyChecks(
  tx: Prisma.TransactionClient,
  eventId: string,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await tx.safetyCheck.updateMany({
    where: { eventId, status: { in: ["AWAITING_REVIEW", "APPROVED"] } },
    data: { status: "OUTDATED", outdatedAt: now },
  });
  return count;
}
