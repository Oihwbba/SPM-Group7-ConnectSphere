import { prisma } from "@/lib/db";

/**
 * PLANNING events assigned to usr_coordinator, each with nothing booked yet.
 * Since SCRUM-50 AC8 an event holds at most one Pending or Approved booking,
 * and the seeded events already hold theirs, so a suite that writes bookings
 * makes its own events. Remove them with `removeEvents` when done.
 */
export async function createPlanningEvents(
  label: string,
  events: { startAt: Date; endAt: Date; expectedAttendance?: number }[],
): Promise<string[]> {
  const stamp = Date.now();
  const ids: string[] = [];
  for (const [index, event] of events.entries()) {
    const row = await prisma.event.create({
      data: {
        name: `${label} ${index + 1} ${stamp}`,
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        expectedAttendance: 40,
        ...event,
      },
      select: { id: true },
    });
    ids.push(row.id);
  }
  return ids;
}

/** Events made by `createPlanningEvents`, with their bookings. */
export async function removeEvents(ids: string[]) {
  const bookings = await prisma.booking.findMany({
    where: { eventId: { in: ids } },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...ids, ...bookings.map((b) => b.id)] } },
  });
  await prisma.booking.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
}
