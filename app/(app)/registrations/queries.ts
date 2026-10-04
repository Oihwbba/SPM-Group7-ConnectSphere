import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/can";

/**
 * SCRUM-76 — the signed-in Attendee's own registrations, soonest event first.
 *
 * Filtered by the caller's id from the session, never by an id passed in, so
 * the list can only ever contain the caller's registrations (AC5). The event,
 * its status and its venue are joined live rather than copied at registration
 * time, so a changed date, time or venue shows its current value (AC4).
 */
export async function getMyRegistrations() {
  const session = await auth();
  if (!session?.user || !can(session.user, "registration:read")) {
    return [];
  }

  return prisma.registration.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      status: true,
      event: {
        select: {
          id: true,
          name: true,
          status: true,
          startAt: true,
          endAt: true,
          bookings: {
            where: { status: "APPROVED" },
            // An event can hold approved bookings on two venues at different
            // times; show the one in use when the event starts.
            orderBy: { startAt: "asc" },
            take: 1,
            select: { venue: { select: { name: true, location: true } } },
          },
        },
      },
    },
    orderBy: { event: { startAt: "asc" } },
  });
}

export type MyRegistration = Awaited<
  ReturnType<typeof getMyRegistrations>
>[number];
