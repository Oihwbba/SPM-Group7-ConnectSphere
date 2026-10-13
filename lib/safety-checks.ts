import type { Prisma } from "@prisma/client";

/**
 * SCRUM-166 AC13, SCRUM-142 AC9 — a safety check that approved the event's
 * arrangements, or is still reviewing them, is out of date once they change:
 * it can't be approved, and the event needs a new check before it is
 * confirmed.
 */
export function outdateSafetyChecks(
  tx: Prisma.TransactionClient,
  eventId: string,
  now: Date,
) {
  return tx.safetyCheck.updateMany({
    where: { eventId, status: { in: ["AWAITING_REVIEW", "APPROVED"] } },
    data: { status: "OUTDATED", outdatedAt: now },
  });
}
