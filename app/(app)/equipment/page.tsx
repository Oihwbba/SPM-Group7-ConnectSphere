import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { prisma } from "@/lib/db";
import { getReservableRequests } from "@/lib/equipment/request-queries";
import { RESERVABLE_EVENT_STATUSES } from "@/lib/schemas/reservation";
import { EquipmentClient } from "./equipment-client";
import { ReserveRequestCard } from "./reserve-request-card";

// Access is decided by lib/auth/can.ts (the single gate), not a role list here
// (SCRUM-66 / SCRUM-67).
export default async function EquipmentPage() {
  const session = await requireSession();
  if (!can(session.user, "equipment:read")) {
    return <Forbidden />;
  }
  const canReserve = can(session.user, "equipment:reserve");

  const [equipment, events, requests] = await Promise.all([
    prisma.equipment.findMany({
      where: { isActive: true },
      select: { id: true, type: true, totalQuantity: true },
      orderBy: { type: "asc" },
    }),
    prisma.event.findMany({
      where: { status: { in: RESERVABLE_EVENT_STATUSES } },
      select: { id: true, name: true },
      orderBy: { startAt: "asc" },
    }),
    canReserve ? getReservableRequests() : [],
  ]);

  return (
    <div className="space-y-6">
      {canReserve && (
        <ReserveRequestCard requests={requests} equipment={equipment} />
      )}
      <EquipmentClient equipment={equipment} events={events} />
    </div>
  );
}
