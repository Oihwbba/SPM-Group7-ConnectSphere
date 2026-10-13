import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { listTimeClashFlags } from "@/lib/venue-time-clashes";
import { Forbidden } from "@/components/app/forbidden";
import { getPendingBookingQueue } from "./queries";
import { BookingQueue } from "./booking-queue";
import { TimeClashFlags } from "./time-clash-flags";

// SCRUM-52 — Venue Staff's queue of pending booking requests. Access is
// decided by lib/auth/can.ts (the single gate), not a role list here, so a
// Coordinator typing /bookings gets the server-rendered refusal (SCRUM-67).
export default async function BookingsPage() {
  const session = await requireSession();
  if (!can(session.user, "booking:review")) {
    return <Forbidden />;
  }

  const [queue, timeClashFlags] = await Promise.all([
    getPendingBookingQueue(),
    listTimeClashFlags(prisma),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pending booking requests
        </h1>
        <p className="text-sm text-muted-foreground">
          Soonest first. Each request is shown beside the venue it asks for, so
          you can check capacity, facilities, layout and availability before you
          decide. Times are Singapore time.
        </p>
      </div>
      <BookingQueue
        queue={queue}
        canDecide={can(session.user, "booking:decide")}
      />
      <TimeClashFlags flags={timeClashFlags} />
    </div>
  );
}
