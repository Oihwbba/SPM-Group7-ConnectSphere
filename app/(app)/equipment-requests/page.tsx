import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import {
  getCoordinatorEquipmentRequests,
  getEquipmentCatalogue,
  getEquipmentRequestQueue,
  getRequestableEvents,
} from "@/lib/equipment/request-queries";
import { CoordinatorRequests } from "./coordinator-requests";
import { ReviewQueue } from "./review-queue";

// SCRUM-27/28. Which view a user gets follows from what lib/auth/can.ts lets
// them do, not from a role list here (SCRUM-66 / SCRUM-67): whoever reviews
// requests gets the review queue; whoever raises them sees their own requests
// and the form to raise one.
export default async function EquipmentRequestsPage() {
  const session = await requireSession();
  const { user } = session;

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
      events={events}
      equipment={equipment}
    />
  );
}
