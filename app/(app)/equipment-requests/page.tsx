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
// permission again on the server.
export default async function EquipmentRequestsPage() {
  const session = await requireSession();
  const { user } = session;

  if (!can(user, "equipment-request:list")) {
    return <Forbidden />;
  }

  if (can(user, "equipment-request:review")) {
    return <ReviewQueue requests={await getEquipmentRequestQueue()} />;
  }

  const canCreate = can(user, "equipment-request:create");
  const [requests, events, equipment] = await Promise.all([
    getCoordinatorEquipmentRequests(user.id),
    canCreate ? getRequestableEvents(user.id) : [],
    canCreate ? getEquipmentCatalogue() : [],
  ]);
  return (
    <CoordinatorRequests
      requests={requests}
      canCreate={canCreate}
      canChange={can(user, "equipment-request:change")}
      events={events}
      equipment={equipment}
    />
  );
}
