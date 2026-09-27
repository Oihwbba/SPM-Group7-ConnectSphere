import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import {
  getCoordinatorEquipmentRequests,
  getEquipmentCatalogue,
  getRequestableEvents,
} from "@/lib/equipment/request-queries";
import { CoordinatorRequests } from "./coordinator-requests";

// SCRUM-27. Which view a user gets follows from what lib/auth/can.ts lets them
// do, not from a role list here (SCRUM-66 / SCRUM-67): whoever can raise a
// request sees their own requests and the form to raise one.
export default async function EquipmentRequestsPage() {
  const session = await requireSession();
  const { user } = session;

  if (can(user, "equipment-request:create")) {
    const [requests, events, equipment] = await Promise.all([
      getCoordinatorEquipmentRequests(user.id),
      getRequestableEvents(user.id),
      getEquipmentCatalogue(),
    ]);
    return (
      <CoordinatorRequests
        requests={requests}
        events={events}
        equipment={equipment}
      />
    );
  }

  return <Forbidden />;
}
