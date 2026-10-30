import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { DecidedNote, WorkQueue } from "@/components/queues/work-queue";
import { formatDateTime } from "@/lib/datetime";
import { queueState, type QueueDefaults, type QueueItem } from "@/lib/queues";
import { SAFETY_CHECK_LABEL } from "@/lib/safety-checks";
import {
  getDecidedSafetyChecks,
  getOutdatedUndecidedSafetyChecks,
  getSafetyCheckQueue,
  getSafetyCheckReview,
} from "./queries";
import { SafetyCheckDetails } from "./check-details";
import { OutcomeDecision } from "./outcome-decision";

// SCRUM-166 AC1: oldest request first.
const DEFAULTS: QueueDefaults = { sort: "requested", dir: "asc" };

const asked = (attendance: number | null) =>
  attendance === null ? "Safety check" : `Safety check, ${attendance} people`;

// SCRUM-166 AC1 — the Safety Officers' queue of checks awaiting review, in the
// layout every queue shares (SCRUM-211). Access is decided by lib/auth/can.ts
// (SCRUM-67); an opened check is read through `getSafetyCheckReview`, which
// returns nothing for an event this officer may not review (AC6).
export default async function SafetyChecksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  if (!can(session.user, "safety-check:review")) {
    return <Forbidden />;
  }

  const [queue, decided, outdated, params] = await Promise.all([
    getSafetyCheckQueue(session.user),
    getDecidedSafetyChecks(session.user),
    getOutdatedUndecidedSafetyChecks(session.user),
    searchParams,
  ]);
  const items: QueueItem[] = [
    ...queue.map((check) => ({
      id: check.id,
      event: check.event.name,
      eventStart: check.event.startAt,
      asked: asked(check.event.expectedAttendance),
      requestedAt: check.requestedAt,
      waiting: true,
      badges: [],
    })),
    ...decided.map((check) => ({
      id: check.id,
      event: check.event.name,
      eventStart: check.event.startAt,
      asked: asked(check.event.expectedAttendance),
      requestedAt: check.requestedAt,
      waiting: false,
      badges: [],
    })),
    // Outdated before anyone reviewed it: nothing decided, so under All only.
    ...outdated.map((check) => ({
      id: check.id,
      event: check.event.name,
      eventStart: check.event.startAt,
      asked: asked(check.event.expectedAttendance),
      requestedAt: check.requestedAt,
      waiting: false,
      onlyInAll: true,
      badges: [{ label: "Outdated", tone: "warning" as const }],
    })),
  ];
  const state = queueState("/safety-checks", items, params, DEFAULTS);
  const check = state.open
    ? await getSafetyCheckReview(session.user, state.open.id)
    : null;

  return (
    <WorkQueue
      title="Safety checks"
      description="Events waiting for an operational safety check, oldest request first. Open one to review its venues and equipment and record the outcome. Times are Singapore time."
      base="/safety-checks"
      state={state}
      defaults={DEFAULTS}
      testId="safety-check-item"
      noun="checks"
      detail={check && <SafetyCheckDetails check={check} />}
      decision={
        check &&
        (check.status === "AWAITING_REVIEW" ? (
          <OutcomeDecision
            checkId={check.id}
            nextHref={state.nextHref}
            arrangements={[
              ...check.venues.map((v) => ({
                kind: "booking" as const,
                id: v.bookingId,
                label: v.name,
              })),
              ...check.equipment.map((e) => ({
                kind: "reservation" as const,
                id: e.reservationId,
                label: `${e.type} × ${e.quantity}`,
              })),
            ]}
          />
        ) : (
          <DecidedNote>
            {SAFETY_CHECK_LABEL[check.status]}
            {check.decidedBy && ` by ${check.decidedBy}`}
            {check.decidedAt && ` on ${formatDateTime(check.decidedAt)}`}.
          </DecidedNote>
        ))
      }
    />
  );
}
