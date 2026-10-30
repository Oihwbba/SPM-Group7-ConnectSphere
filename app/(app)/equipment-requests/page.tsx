import Link from "next/link";

import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import {
  getCoordinatorEquipmentRequests,
  getEquipmentCatalogue,
  getEquipmentRequestQueue,
  getRequestableEvents,
} from "@/lib/equipment/request-queries";
import { WorkQueue } from "@/components/queues/work-queue";
import { queueState, type QueueDefaults, type QueueItem } from "@/lib/queues";
import { CoordinatorRequests } from "./coordinator-requests";
import { isOpenRequest } from "@/lib/equipment/requests";
import { ReviewDecision, ReviewDetails } from "./review-queue";

// SCRUM-28: oldest request first.
const DEFAULTS: QueueDefaults = { sort: "requested", dir: "asc" };

// SCRUM-27/28. Access follows lib/auth/can.ts, not a role list here (SCRUM-66
// / SCRUM-67), and uses the same action the nav binds this route to
// (equipment-request:list), so the link and the page can never disagree.
// Whoever reviews requests gets the review queue; everyone else sees their own
// requests, and the form to raise one if they may. Each action checks its own
// permission again on the server. Someone whose roles do both (SCRUM-121 AC2)
// switches between the two, starting with the queue.
export default async function EquipmentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const { user } = session;

  if (!can(user, "equipment-request:list")) {
    return <Forbidden />;
  }

  const canReview = can(user, "equipment-request:review");
  const canCreate = can(user, "equipment-request:create");
  const params = await searchParams;
  const { view } = params;
  const switcher = canReview && canCreate && (
    <ViewSwitch current={view === "mine" ? "mine" : "queue"} />
  );

  if (canReview && !(switcher && view === "mine")) {
    // SCRUM-211: Technical Support's queue, in the layout every queue shares.
    const requests = await getEquipmentRequestQueue();
    const items: QueueItem[] = requests.map((request) => ({
      id: request.id,
      event: request.event.name,
      eventStart: request.event.startAt,
      asked: request.lines
        .map((line) => `${line.equipment.type} ×${line.quantity}`)
        .join(", "),
      requestedAt: request.createdAt,
      waiting: isOpenRequest(request),
      badges: [
        ...(request.status === "IN_REVIEW"
          ? [{ label: "In Review", tone: "info" as const }]
          : []),
        // SCRUM-134 AC4: other open requests want the same stock.
        ...(isOpenRequest(request) &&
        request.lines.some((line) => line.competing.length > 0)
          ? [{ label: "Competing requests", tone: "warning" as const }]
          : []),
      ],
    }));
    const state = queueState("/equipment-requests", items, params, DEFAULTS);
    const open = requests.find((request) => request.id === state.open?.id);
    return (
      <WorkQueue
        title="Equipment requests"
        description="Oldest request first. Open one to check each line against what is free, suggest alternatives and decide."
        base="/equipment-requests"
        state={state}
        defaults={DEFAULTS}
        testId="review-item"
        before={switcher}
        detail={open && <ReviewDetails request={open} />}
        decision={
          open && <ReviewDecision request={open} listHref={state.listHref} />
        }
      />
    );
  }

  const [requests, events, equipment] = await Promise.all([
    getCoordinatorEquipmentRequests(user.id),
    canCreate ? getRequestableEvents(user.id) : [],
    canCreate ? getEquipmentCatalogue() : [],
  ]);
  return (
    <>
      {switcher}
      <CoordinatorRequests
        requests={requests}
        canCreate={canCreate}
        canChange={can(user, "equipment-request:change")}
        events={events}
        equipment={equipment}
      />
    </>
  );
}

const VIEWS = [
  { view: "queue", href: "/equipment-requests", label: "Review queue" },
  { view: "mine", href: "/equipment-requests?view=mine", label: "My requests" },
] as const;

function ViewSwitch({ current }: { current: (typeof VIEWS)[number]["view"] }) {
  return (
    <nav
      aria-label="Equipment requests view"
      className="mb-4 flex flex-wrap gap-2 text-sm"
    >
      {VIEWS.map(({ view, href, label }) => (
        <Link
          key={view}
          href={href}
          aria-current={view === current ? "page" : undefined}
          className={
            view === current
              ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
              : "rounded-full border px-3 py-1 text-muted-foreground hover:bg-muted"
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
