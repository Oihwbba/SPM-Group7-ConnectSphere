import type { Role } from "@prisma/client";

import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import { prisma } from "@/lib/db";
import { EquipmentClient } from "./equipment-client";

const ALLOWED_ROLES: Role[] = ["TECH_SUPPORT"];

export default async function EquipmentPage() {
  const session = await requireSession();
  if (!ALLOWED_ROLES.includes(session.user.role)) {
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
