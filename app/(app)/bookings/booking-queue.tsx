"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCircle2, Inbox, X, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/datetime";
import { describeBlocker } from "@/lib/venue-availability";
import { decideBookingRequest } from "./actions";
import type { PendingBookingRow } from "./queries";

/**
 * SCRUM-52 — the pending queue. Each card carries what the request asks for
 * beside what the venue offers, so staff can cross-check it on the spot. The
 * marks are a side-by-side comparison, not a suitability verdict — that is
 * SCRUM-40's job.
 */
export function BookingQueue({
  queue,
  canDecide,
}: {
  queue: PendingBookingRow[];
  canDecide: boolean;
}) {
  const [rejecting, setRejecting] = useState<PendingBookingRow | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // SCRUM-53 — the server action decides; a conflict or an already-decided
  // request comes back as an error and the queue is refreshed either way.
  function decide(
    booking: PendingBookingRow,
    decision: "APPROVED" | "REJECTED",
    decisionReason?: string,
  ) {
    startTransition(async () => {
      const result = await decideBookingRequest({
        bookingId: booking.id,
        decision,
        reason: decisionReason,
      });
      if (result.ok) {
        toast.success(
          decision === "APPROVED"
            ? `Approved: ${booking.venue.name} is now booked for ${booking.event.name}.`
            : `Rejected the request for ${booking.event.name}.`,
        );
        setRejecting(null);
        setReason("");
      } else {
        toast.error(result.error);
      }
      router.refresh();
    });
  }

  if (queue.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Inbox className="h-6 w-6" />
          </span>
          <p className="text-base font-medium">No pending requests</p>
          <p className="text-sm text-muted-foreground">
            New venue booking requests from Coordinators will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {queue.map((booking) => (
          <li key={booking.id}>
            <RequestCard booking={booking}>
              {canDecide && (
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      setRejecting(booking);
                      setReason("");
                    }}
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                  <Button
                    disabled={isPending}
                    onClick={() => decide(booking, "APPROVED")}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                </div>
              )}
            </RequestCard>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!rejecting}
        onOpenChange={(open) => !open && setRejecting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject booking request</DialogTitle>
            <DialogDescription>
              A reason is required. Give the coordinator enough to continue
              planning, such as what would make the request acceptable.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection"
            aria-label="Rejection reason"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !reason.trim()}
              onClick={() => rejecting && decide(rejecting, "REJECTED", reason)}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RequestCard({
  booking,
  children,
}: {
  booking: PendingBookingRow;
  children?: React.ReactNode;
}) {
  const { venue } = booking;
  const free = booking.blockers.length === 0;
  const fits =
    booking.requestedAttendance === null ||
    booking.requestedAttendance <= venue.capacity;

  return (
    <Card data-testid={`booking-${booking.id}`}>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-base font-semibold">{booking.event.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(booking.startAt)} to{" "}
              {formatDateTime(booking.endAt)}
            </p>
            <p className="text-sm text-muted-foreground">
              Requested by {booking.requestedBy.name} (
              {booking.requestedBy.email}) on{" "}
              {formatDateTime(booking.createdAt)}
            </p>
          </div>
          <Badge variant="warning">Pending</Badge>
        </div>

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Fact label="Venue">
            {venue.name} · {venue.location}
          </Fact>
          <Fact label="Availability">
            {free ? (
              <Mark ok>Free for this period</Mark>
            ) : (
              booking.blockers.map((blocker) => (
                <Mark key={blocker.id} ok={false}>
                  {describeBlocker(blocker)}
                </Mark>
              ))
            )}
          </Fact>
          <Fact label="Attendance">
            <Mark ok={fits}>
              {booking.requestedAttendance ?? "Not stated"} expected · venue
              holds {venue.capacity}
            </Mark>
          </Fact>
          <Fact label="Layout">
            {booking.requestedLayout ? (
              <Mark
                ok={venue.supportedLayouts.includes(booking.requestedLayout)}
              >
                {booking.requestedLayout} · venue supports{" "}
                {venue.supportedLayouts.join(", ") || "no listed layouts"}
              </Mark>
            ) : (
              "No preference"
            )}
          </Fact>
          <Fact label="Facilities needed">
            {booking.requiredFacilities.length === 0
              ? "None stated"
              : booking.requiredFacilities.map((facility) => (
                  <Mark key={facility} ok={venue.facilities.includes(facility)}>
                    {facility}
                  </Mark>
                ))}
          </Fact>
          {booking.requestNotes && (
            <Fact label="Other details">{booking.requestNotes}</Fact>
          )}
        </dl>
        {children}
      </CardContent>
    </Card>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="space-y-0.5">{children}</dd>
    </div>
  );
}

/** One compared fact: a tick when the venue meets it, a cross when it does not. */
function Mark({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? Check : X;
  return (
    <span
      className={
        ok
          ? "flex items-center gap-1.5 text-foreground"
          : "flex items-center gap-1.5 text-destructive"
      }
    >
      <Icon
        className="h-4 w-4 shrink-0"
        aria-label={ok ? "meets" : "does not meet"}
      />
      {children}
    </span>
  );
}
