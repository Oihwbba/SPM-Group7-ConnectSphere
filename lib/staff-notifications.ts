import type { NotificationType, Prisma, Role } from "@prisma/client";

/**
 * SCRUM-124 — a notice for everyone who holds a staff role, such as every
 * Technical Support member when a Coordinator changes an equipment request
 * (SCRUM-142 AC7). `link` is the role's own page, since staff can't open the
 * event (SCRUM-48 AC5).
 */
export async function notifyRole(
  tx: Prisma.TransactionClient,
  role: Role,
  event: { id: string },
  notice: {
    type: NotificationType;
    title: string;
    message: string;
    link: string;
  },
) {
  const staff = await tx.user.findMany({
    where: { role },
    select: { id: true },
  });
  return tx.notification.createMany({
    data: staff.map(({ id }) => ({ userId: id, eventId: event.id, ...notice })),
  });
}
