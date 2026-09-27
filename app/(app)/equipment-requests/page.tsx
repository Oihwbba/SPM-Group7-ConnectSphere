import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import {
  getCoordinatorEquipmentRequests,
  getEquipmentCatalogue,
  getRequestableEvents,
} from "@/lib/equipment/request-queries";
import { CoordinatorRequests } from "./coordinator-requests";

// SCRUM-27. Access follows lib/auth/can.ts, not a role list here (SCRUM-66 /
// SCRUM-67), and uses the same action the nav binds this route to
// (equipment-request:list), so the link and the page can never disagree.
// Raising a request is a separate action; createEquipmentRequest checks it
// again on the server.
export default async function EquipmentRequestsPage() {
  const session = await requireSession();
  const { user } = session;

  if (!can(user, "equipment-request:list")) {
    return <Forbidden />;
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
