import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import {
  DecidedNote,
  DecisionCard,
  QueueFact,
  WorkQueue,
} from "@/components/queues/work-queue";
import { formatDateTime, formatEventTime } from "@/lib/datetime";
import { queueState, type QueueDefaults, type QueueItem } from "@/lib/queues";
import {
  getAssignedFromQueue,
  getQueueRequest,
  getUnassignedQueue,
} from "../queries";
import { AssignForm } from "../assign-form";

// SCRUM-165: oldest submission first.
const DEFAULTS: QueueDefaults = { sort: "requested", dir: "asc" };
const ASKED = "Needs a Coordinator";

/**
 * SCRUM-165 — the Lead's Unassigned queue, in the layout every queue shares
 * (SCRUM-211). Access is decided by `can()` (SCRUM-66 / SCRUM-67), not a role
 * list here; an opened request is read through `getQueueRequest`, the gate
 * the request's own page used.
 */
export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  if (!can(session.user, "event:assign")) {
    return <Forbidden />;
  }

  const [waiting, assigned, params] = await Promise.all([
    getUnassignedQueue(),
    getAssignedFromQueue(),
    searchParams,
  ]);
  const items: QueueItem[] = [
    ...waiting.map((request) => ({
      id: request.id,
      event: request.name,
      eventStart: request.startAt,
      asked: ASKED,
      requestedAt: request.submittedAt ?? new Date(0),
      waiting: true,
      badges: request.overdue
        ? [{ label: "Overdue", tone: "danger" as const }]
        : [],
    })),
    ...assigned.map((request) => ({
      id: request.id,
      event: request.name,
      eventStart: request.startAt,
      asked: ASKED,
      requestedAt: request.submittedAt ?? new Date(0),
      waiting: false,
      badges: [],
    })),
  ];
  const state = queueState("/queue", items, params, DEFAULTS);

  let detail: React.ReactNode = null;
  let decision: React.ReactNode = null;
  if (state.open?.waiting) {
    const found = await getQueueRequest(state.open.id);
    if (found) {
      detail = <RequestDetails request={found.request} />;
      decision = (
        <DecisionCard title="Assign a Coordinator">
          <AssignForm
            eventId={found.request.id}
            coordinators={found.coordinators}
            suggestedId={found.suggestedId}
            nextHref={state.nextHref}
          />
        </DecisionCard>
      );
    }
  } else if (state.open) {
    const request = assigned.find((entry) => entry.id === state.open!.id)!;
    detail = <RequestDetails request={request} />;
    decision = (
      <DecidedNote>
        Assigned to {request.coordinator?.name ?? "a Coordinator"}.
      </DecidedNote>
    );
  }

  return (
    <WorkQueue
      title="Unassigned Queue"
      description="New requests wait here, oldest first, until you assign a Coordinator."
      base="/queue"
      state={state}
      defaults={DEFAULTS}
      testId="queue-item"
      detail={detail}
      decision={decision}
    />
  );
}

/** SCRUM-165 AC3 — the request's basic information, read-only. */
function RequestDetails({
  request,
}: {
  request: {
    purpose: string | null;
    description: string | null;
    startAt: Date | null;
    endAt: Date | null;
    expectedAttendance: number | null;
    venueRequirements: string | null;
    accessibilityNeeds: string | null;
    preferredLayout: string | null;
    equipmentRequirements: string | null;
    submittedAt: Date | null;
    organiser: { name: string };
  };
}) {
  const details: [string, string | null][] = [
    ["Purpose", request.purpose],
    ["Description", request.description],
    ["Date & time", formatEventTime(request.startAt, request.endAt)],
    [
      "Expected attendance",
      request.expectedAttendance === null
        ? null
        : String(request.expectedAttendance),
    ],
    ["Venue requirements", request.venueRequirements],
    ["Accessibility needs", request.accessibilityNeeds],
    ["Preferred layout", request.preferredLayout],
    ["Equipment requirements", request.equipmentRequirements],
    ["Organiser", request.organiser.name],
    [
      "Submitted",
      request.submittedAt ? formatDateTime(request.submittedAt) : null,
    ],
  ];
  return (
    <dl className="grid gap-4 sm:grid-cols-2" data-testid="request-details">
      {details.map(([label, value]) => (
        <QueueFact key={label} label={label}>
          <span className="whitespace-pre-wrap">{value || "—"}</span>
        </QueueFact>
      ))}
    </dl>
  );
}
