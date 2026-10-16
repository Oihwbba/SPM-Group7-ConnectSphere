"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Hourglass,
  Inbox,
  LayoutGrid,
  Mail,
  Search,
  MapPin,
  MessageSquareText,
  Accessibility,
  Scale,
  UserRound,
  Users,
  Wrench,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeField } from "@/components/app/date-time-field";
import { Label } from "@/components/ui/label";
import {
  formatDate,
  formatDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
} from "@/lib/datetime";
import { describeBlocker } from "@/lib/venue-availability";
import { OrganiserVenueAnswers } from "@/components/events/organiser-answers";
import { decideBookingRequest, holdBookingRequest } from "./actions";
import { OperationalNotes } from "@/components/events/operational-notes";
import type { PendingBookingRow } from "./queries";

/**
 * SCRUM-52 — does a queued request match what staff typed? Every word must
 * appear somewhere on the card: event, venue, location, coordinator, email,
 * facility, layout, notes or date. Case does not matter; an empty search
 * matches everything.
 */
export function matchesSearch(booking: PendingBookingRow, query: string) {
  const text = [
    booking.event.name,
    booking.venue.name,
    booking.venue.location,
    booking.requestedBy.name,
    booking.requestedBy.email,
    booking.requestedLayout,
    booking.requestNotes,
    formatDate(booking.startAt),
    formatDate(booking.endAt),
    ...booking.requiredFacilities,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

/**
 * SCRUM-52 — the pending queue. Each card carries what the request asks for
 * beside what the venue offers, so staff can cross-check it on the spot. The
 * marks are a side-by-side comparison, not a suitability verdict — that is
 * SCRUM-40's job.
 */
export function BookingQueue({
  queue,
  canDecide,
  canHold = false,
}: {
  queue: PendingBookingRow[];
  canDecide: boolean;
  canHold?: boolean;
}) {
  const [rejecting, setRejecting] = useState<PendingBookingRow | null>(null);
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  // SCRUM-163 AC1: the request being held, and the hold's expiry and note.
  const [holding, setHolding] = useState<PendingBookingRow | null>(null);
  const [holdExpiry, setHoldExpiry] = useState("");
  const [holdNote, setHoldNote] = useState("");
  const [holdErrors, setHoldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function hold(booking: PendingBookingRow) {
    startTransition(async () => {
      const result = await holdBookingRequest({
        bookingId: booking.id,
        holdExpiresAt: sgWallTimeToUtcIso(holdExpiry) ?? "",
        holdNote,
      });
      if (result.ok) {
        toast.success(
          `Held ${booking.venue.name} for ${booking.event.name} until ${formatDateTime(result.data.holdExpiresAt)}.`,
        );
        setHolding(null);
      } else {
        setHoldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
      router.refresh();
    });
  }

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
          decision === "REJECTED"
            ? `Rejected the request for ${booking.event.name}.`
            : booking.status === "HELD"
              ? `Approved the hold: ${booking.event.name}'s Coordinator can now confirm it.`
              : `Approved: ${booking.venue.name} is now booked for ${booking.event.name}.`,
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

  const shown = queue.filter((booking) => matchesSearch(booking, query));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search pending requests"
            placeholder="Search by event, venue, coordinator, facility or date"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {query
            ? `Showing ${shown.length} of ${queue.length} requests`
            : `${queue.length} ${queue.length === 1 ? "request" : "requests"} pending or held`}
        </p>
      </div>

      {shown.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-base font-medium">No requests match “{query}”</p>
            <Button variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-4">
        {shown.map((booking) => (
          <li key={booking.id}>
            <RequestCard booking={booking}>
              {canDecide && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    disabled={isPending}
                    className="border-destructive/60 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setRejecting(booking);
                      setReason("");
                    }}
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                  {/* SCRUM-163 AC7: a held request is approved here once,
                      then confirmed by its Coordinator (AC3); it isn't held
                      again. */}
                  {booking.status === "PENDING" && canHold && (
                    <Button
                      variant="outline"
                      disabled={isPending}
                      onClick={() => {
                        setHolding(booking);
                        setHoldExpiry("");
                        setHoldNote("");
                        setHoldErrors({});
                      }}
                    >
                      <Hourglass className="h-4 w-4" /> Hold
                    </Button>
                  )}
                  {(booking.status === "PENDING" || !booking.holdApprovedAt) && (
                    <Button
                      disabled={isPending}
                      onClick={() => decide(booking, "APPROVED")}
                      variant="outline"
                      className="border-success/60 bg-transparent text-success hover:bg-success/10 hover:text-success"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                  )}
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

      <Dialog
        open={!!holding}
        onOpenChange={(open) => !open && setHolding(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold this venue</DialogTitle>
            <DialogDescription>
              The venue is reserved for the Coordinator until the expiry, then
              released if they haven&apos;t confirmed it. The expiry must be
              before the booking starts
              {holding ? ` (${formatDateTime(holding.startAt)})` : ""}.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (holding) hold(holding);
            }}
          >
            <DateTimeField
              name="Expiry"
              value={holdExpiry}
              onChange={setHoldExpiry}
              openOn={utcToSgWallTime(new Date()).slice(0, 10)}
              error={
                holdErrors.holdExpiresAt?.[0] && (
                  <p className="text-xs text-destructive">
                    {holdErrors.holdExpiresAt[0]}
                  </p>
                )
              }
            />
            <div className="space-y-2">
              <Label htmlFor="holdNote">What the Coordinator must finalise</Label>
              <Textarea
                id="holdNote"
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
                placeholder="e.g. Confirm the final headcount and catering"
              />
              {holdErrors.holdNote?.[0] && (
                <p className="text-xs text-destructive">
                  {holdErrors.holdNote[0]}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setHolding(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !holdExpiry || !holdNote.trim()}
              >
                Hold venue
              </Button>
            </DialogFooter>
          </form>
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
          <div className="space-y-1.5">
            <p className="text-base font-semibold">{booking.event.name}</p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
              {formatDateTime(booking.startAt)} to{" "}
              {formatDateTime(booking.endAt)}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <UserRound className="h-4 w-4 shrink-0" aria-hidden />
              Requested by {booking.requestedBy.name}
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {booking.requestedBy.email}
              </span>
              on {formatDateTime(booking.createdAt)}
            </p>
          </div>
          {booking.status === "HELD" ? (
            <div className="flex flex-col items-end gap-1">
              <Badge variant="info">
                Held until {formatDateTime(booking.holdExpiresAt!)}
              </Badge>
              {booking.holdApprovedAt && (
                <Badge variant="success">
                  Approved by Venue Staff – awaiting confirmation
                </Badge>
              )}
            </div>
          ) : (
            <Badge variant="warning">Pending</Badge>
          )}
        </div>

        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Fact icon={Building2} label="Venue">
            <span className="font-medium">{venue.name}</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {venue.location}
            </span>
          </Fact>
          <Fact icon={CalendarCheck} label="Availability">
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
          <Fact icon={Users} label="Attendance">
            <Mark ok={fits}>
              {booking.requestedAttendance ?? "Not stated"} expected · venue
              holds {venue.capacity}
            </Mark>
          </Fact>
          <Fact icon={LayoutGrid} label="Layout">
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
          <Fact icon={Wrench} label="Facilities needed">
            {booking.requiredFacilities.length === 0 ? (
              "None stated"
            ) : (
              <span className="flex flex-wrap gap-1.5">
                {booking.requiredFacilities.map((facility) => (
                  <FacilityPill
                    key={facility}
                    facility={facility}
                    ok={venue.facilities.includes(facility)}
                  />
                ))}
              </span>
            )}
          </Fact>
          {booking.requiredAccessibilityFeatures.length > 0 && (
            <Fact icon={Accessibility} label="Accessibility needed">
              <span className="flex flex-wrap gap-1.5">
                {booking.requiredAccessibilityFeatures.map((feature) => (
                  <FacilityPill
                    key={feature}
                    facility={feature}
                    ok={venue.accessibilityFeatures.includes(feature)}
                  />
                ))}
              </span>
            </Fact>
          )}
          {/* SCRUM-40 AC10 — the Coordinator's judgement and its note. */}
          <Fact icon={Scale} label="Coordinator's suitability judgement">
            {booking.judgement ? (
              <span data-testid="queue-judgement" className="space-y-0.5">
                <span className="block font-medium">
                  {booking.judgement.suitable ? "Suitable" : "Not suitable"}
                </span>
                <span className="block">{booking.judgement.note}</span>
                <span className="block text-xs text-muted-foreground">
                  {booking.judgement.recordedByName},{" "}
                  {formatDateTime(booking.judgement.recordedAt)}
                </span>
              </span>
            ) : (
              "None recorded"
            )}
          </Fact>
          {booking.requestNotes && (
            <Fact icon={MessageSquareText} label="Other details">
              {booking.requestNotes}
            </Fact>
          )}
          {booking.holdNote && (
            <Fact icon={Hourglass} label="Held for the Coordinator to finalise">
              {booking.holdNote}
            </Fact>
          )}
        </dl>
        {/* SCRUM-170 AC2: what the Organiser asked for, beside what the
            Coordinator requested. */}
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium">What the Organiser asked for</p>
          <OrganiserVenueAnswers answers={booking.event} />
        </div>
        {/* SCRUM-25 AC6: Venue Staff add notes once the event has a booking. */}
        <OperationalNotes eventId={booking.eventId} />
        {children}
      </CardContent>
    </Card>
  );
}

/** One fact about the request, led by an icon so it can be found at a glance. */
function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="space-y-0.5">{children}</dd>
      </div>
    </div>
  );
}

/** One compared fact: a green tick when the venue meets it, a red cross when it does not. */
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
        className={ok ? "h-4 w-4 shrink-0 text-success" : "h-4 w-4 shrink-0"}
        aria-label={ok ? "meets" : "does not meet"}
      />
      {children}
    </span>
  );
}

/** A required facility as a pill: green when the venue has it, red when not. */
function FacilityPill({ facility, ok }: { facility: string; ok: boolean }) {
  const Icon = ok ? Check : X;
  return (
    <span
      className={
        ok
          ? "inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
          : "inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
      }
    >
      <Icon className="h-3 w-3" aria-label={ok ? "meets" : "does not meet"} />
      {facility}
    </span>
  );
}
