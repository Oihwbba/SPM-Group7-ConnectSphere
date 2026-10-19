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
import { CoordinatorRequests } from "./coordinator-requests";
import { ReviewQueue } from "./review-queue";

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
  const { view } = await searchParams;
  const switcher = canReview && canCreate && (
    <ViewSwitch current={view === "mine" ? "mine" : "queue"} />
  );

  if (canReview && !(switcher && view === "mine")) {
    return (
      <>
        {switcher}
        <ReviewQueue requests={await getEquipmentRequestQueue()} />
      </>
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
    <nav aria-label="Equipment requests view" className="mb-4 flex flex-wrap gap-2 text-sm">
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
