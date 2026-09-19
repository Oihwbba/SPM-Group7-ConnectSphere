import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { prisma } from "@/lib/db";
import { EquipmentClient } from "./equipment-client";

// Access is decided by lib/auth/can.ts (the single gate), not a role list here
// (SCRUM-66 / SCRUM-67).
export default async function EquipmentPage() {
  const session = await requireSession();
  if (!can(session.user, "equipment:read")) {
    return <Forbidden />;
  }

  const [equipment, events] = await Promise.all([
    prisma.equipment.findMany({
      where: { isActive: true },
      select: { id: true, type: true, totalQuantity: true },
      orderBy: { type: "asc" },
    }),
    prisma.event.findMany({
      where: { status: "APPROVED" },
      select: { id: true, name: true },
      orderBy: { startAt: "asc" },
    }),
  ]);

  return <EquipmentClient equipment={equipment} events={events} />;
}
