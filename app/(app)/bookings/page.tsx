import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { listTimeClashFlags } from "@/lib/venue-time-clashes";
import { Forbidden } from "@/components/app/forbidden";
import { OperationalNotes } from "@/components/events/operational-notes";
import {
  DecidedNote,
  QueueFact,
  WorkQueue,
} from "@/components/queues/work-queue";
import { formatDateTime } from "@/lib/datetime";
import { queueState, type QueueDefaults, type QueueItem } from "@/lib/queues";
import { BOOKING_STATUS_LABEL } from "@/lib/status-labels";
import { getDecidedBookings, getPendingBookingQueue } from "./queries";
import { BookingDecision, BookingDetails } from "./booking-queue";
import { TimeClashFlags } from "./time-clash-flags";

// SCRUM-52 AC1: soonest event first.
const DEFAULTS: QueueDefaults = { sort: "event", dir: "asc" };

const asked = (venue: string, attendance: number | null) =>
  attendance === null ? venue : `${venue} for ${attendance}`;

// SCRUM-52 — Venue Staff's queue of pending booking requests, in the layout
// every queue shares (SCRUM-211). Access is decided by lib/auth/can.ts (the
// single gate), not a role list here, so a Coordinator typing /bookings gets
// the server-rendered refusal (SCRUM-67).
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  if (!can(session.user, "booking:review")) {
    return <Forbidden />;
  }

  const [queue, decided, timeClashFlags, params] = await Promise.all([
    getPendingBookingQueue(),
    getDecidedBookings(),
    listTimeClashFlags(prisma),
    searchParams,
  ]);
  const items: QueueItem[] = [
    ...queue.map((booking) => ({
      id: booking.id,
      event: booking.event.name,
      eventStart: booking.startAt,
      asked: asked(booking.venue.name, booking.requestedAttendance),
      requestedAt: booking.createdAt,
      waiting: true,
      badges: [
        ...(booking.status === "HELD"
          ? [{ label: "Held", tone: "info" as const }]
          : []),
        // SCRUM-134 AC2: an earlier competing request is decided first.
        ...(booking.competing.some((other) => other.earlier)
          ? [{ label: "Earlier request first", tone: "warning" as const }]
          : []),
      ],
    })),
    ...decided.map((booking) => ({
      id: booking.id,
      event: booking.event.name,
      eventStart: booking.startAt,
      asked: asked(booking.venue.name, booking.requestedAttendance),
      requestedAt: booking.createdAt,
      waiting: false,
      badges: booking.needsReconsideration
        ? [{ label: "Needs Reconsideration", tone: "warning" as const }]
        : [],
    })),
  ];
  const state = queueState("/bookings", items, params, DEFAULTS);

  const pending = queue.find((booking) => booking.id === state.open?.id);
  const done = decided.find((booking) => booking.id === state.open?.id);

  return (
    <WorkQueue
      title="Booking requests"
      description="Soonest event first, with held requests until they are confirmed, released or expire. Open one to see it beside the venue it asks for and decide. Times are Singapore time."
      base="/bookings"
      state={state}
      defaults={DEFAULTS}
      testId={state.open ? `booking-${state.open.id}` : undefined}
      detail={
        pending ? (
          <>
            <BookingDetails booking={pending} />
            {/* SCRUM-25 AC6: Venue Staff add notes once the event has a booking. */}
            <OperationalNotes eventId={pending.eventId} />
          </>
        ) : done ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <QueueFact label="Venue">{done.venue.name}</QueueFact>
            <QueueFact label="When">
              {formatDateTime(done.startAt)} to {formatDateTime(done.endAt)}
            </QueueFact>
            <QueueFact label="Attendance">
              {done.requestedAttendance ?? "Not stated"} expected · venue holds{" "}
              {done.venue.capacity}
            </QueueFact>
            <QueueFact label="Layout">
              {done.requestedLayout ?? "No preference"}
            </QueueFact>
            <QueueFact label="Facilities needed">
              {done.requiredFacilities.join(", ") || "None stated"}
            </QueueFact>
            <QueueFact label="Requested by">
              {done.requestedBy.name}, {formatDateTime(done.createdAt)}
            </QueueFact>
          </dl>
        ) : null
      }
      decision={
        pending ? (
          <BookingDecision
            booking={pending}
            canDecide={can(session.user, "booking:decide")}
            canHold={can(session.user, "booking:hold")}
            nextHref={state.nextHref}
          />
        ) : done ? (
          <DecidedNote>
            {BOOKING_STATUS_LABEL[done.status]}
            {done.decidedBy && ` by ${done.decidedBy.name}`}
            {done.decidedAt && ` on ${formatDateTime(done.decidedAt)}`}.
            {!done.decidedAt &&
              done.heldAt &&
              ` Held on ${formatDateTime(done.heldAt)}.`}
            {!done.decidedAt &&
              !done.heldAt &&
              ` Cancelled before a decision, on ${formatDateTime(done.updatedAt)}.`}
            {done.decisionReason && ` Reason: ${done.decisionReason}`}
          </DecidedNote>
        ) : null
      }
      after={<TimeClashFlags flags={timeClashFlags} />}
    />
  );
}
