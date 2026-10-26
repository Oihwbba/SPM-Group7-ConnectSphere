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
        {/* Change 12: how many are pending or held, beside the title. */}
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          Pending booking requests
          <span
            data-testid="queue-count"
            aria-label={`${queue.length} pending or held`}
            className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary"
          >
            {queue.length}
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Soonest first, with held requests until they are confirmed, released
          or expire. Each request is shown beside the venue it asks for, so
          you can check capacity, facilities, layout and availability before you
          decide. Times are Singapore time.
        </p>
      </div>
      <BookingQueue
        queue={queue}
        canDecide={can(session.user, "booking:decide")}
        canHold={can(session.user, "booking:hold")}
      />
      <TimeClashFlags flags={timeClashFlags} />
    </div>
  );
}
