"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Hourglass,
  LayoutGrid,
  ListOrdered,
  Mail,
  MapPin,
  MessageSquareText,
  Accessibility,
  Scale,
  Timer,
  UserRound,
  Users,
  Wrench,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { SubmittedDialog } from "@/components/app/submitted-dialog";
import {
  DECISION_BUTTON,
  DECISION_PANEL,
  DECISION_ROW,
} from "@/components/queues/decision-button";
import { Label } from "@/components/ui/label";
import {
  formatDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
} from "@/lib/datetime";
import { describeBlocker } from "@/lib/venue-availability";
import { OrganiserVenueAnswers } from "@/components/events/organiser-answers";
import { decideBookingRequest, holdBookingRequest } from "./actions";
import type { PendingBookingRow } from "./queries";
import { ActionError } from "@/components/app/action-error";

/**
 * SCRUM-52, SCRUM-211 AC3 — a request's details, on the left of the opened
 * item: what it asks for beside what the venue offers, so Venue Staff can
 * cross-check it on the spot. The marks are a side-by-side comparison, not a
 * suitability verdict — that is SCRUM-40's job. Only what deciding the
 * booking needs (SCRUM-17): nothing about the event beyond it.
 */
export function BookingDetails({ booking }: { booking: PendingBookingRow }) {
  return <RequestOverview booking={booking} />;
}

/** What the decision needs to know about a request, pending or decided. */
type DecisionBooking = Pick<PendingBookingRow, "id" | "status" | "startAt"> & {
  holdApprovedAt?: Date | null;
  hoursWarning?: string | null;
  event: { name: string };
  venue: { name: string };
};

/**
 * SCRUM-53, SCRUM-163, SCRUM-211 AC3 — the decision, on the right of the
 * opened item, in the order every queue uses: Approve, then Hold, then
 * Reject, side by side. Reject asks first, with its required reason. An
 * approval or a rejection ends in a pop-up that leads back to the list
 * (`listHref`) or stays on this request, which now shows its status with the
 * buttons disabled (`decided`). A hold opens the next waiting request
 * (`nextHref`). A refusal (an earlier competing request, a clash) is shown
 * here and the request stays open, unchanged.
 */
export function BookingDecision({
  booking,
  canDecide,
  canHold = false,
  decided,
  nextHref,
  listHref,
}: {
  booking: DecisionBooking;
  canDecide: boolean;
  canHold?: boolean;
  /** How the request was decided, once it has been; its buttons are then disabled. */
  decided?: React.ReactNode;
  nextHref: string;
  listHref: string;
}) {
  // The pop-up after an approval or a rejection. It outlives the refresh that
  // turns this request into a decided one, since the same panel shows both.
  const [outcome, setOutcome] = useState<{
    decision: "APPROVED" | "REJECTED";
    message: string;
  } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  // SCRUM-163 AC1: the hold's expiry and note.
  const [holding, setHolding] = useState(false);
  const [holdExpiry, setHoldExpiry] = useState("");
  const [holdNote, setHoldNote] = useState("");
  const [holdErrors, setHoldErrors] = useState<Record<string, string[]>>({});
  const [holdError, setHoldError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!canDecide) return null;

  function hold() {
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
        setHolding(false);
        router.push(nextHref);
      } else {
        setHoldErrors(result.fieldErrors ?? {});
        // Shown in the hold dialog, beside its fields.
        setHoldError(result.fieldErrors ? null : result.error);
        router.refresh();
      }
    });
  }

  // SCRUM-53 — the server action decides; a conflict or an already-decided
  // request comes back as an error, shown here, and nothing changes. The
  // reject dialog (SCRUM-207 AC5) awaits it, and closes on a refusal.
  async function decideNow(
    decision: "APPROVED" | "REJECTED",
    decisionReason?: string,
  ) {
    const result = await decideBookingRequest({
      bookingId: booking.id,
      decision,
      reason: decisionReason,
    });
    if (!result.ok) {
      setRejecting(false);
      setRefusal(result.error);
      router.refresh();
      return;
    }
    setOutcome({
      decision,
      message:
        decision === "REJECTED"
          ? `Rejected the request for ${booking.event.name}.`
          : booking.status === "HELD"
            ? `Approved the hold: ${booking.event.name}'s Coordinator can now confirm it.`
            : `Approved: ${booking.venue.name} is now booked for ${booking.event.name}.`,
    });
    // This request, now decided: its status, with the buttons disabled.
    router.refresh();
  }

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(() => decideNow(decision));
  }

  // SCRUM-163 AC7: a held request is approved here once, then confirmed by
  // its Coordinator (AC3); it isn't held again.
  // Once decided, every button stays, disabled.
  const canApprove =
    Boolean(decided) || booking.status === "PENDING" || !booking.holdApprovedAt;
  const canHoldIt =
    canHold && (Boolean(decided) || booking.status === "PENDING");
  const off = isPending || Boolean(decided);

  return (
    <div className={DECISION_PANEL} data-testid="booking-decision">
      <h2 className="text-sm font-semibold">
        {decided ? "Decided" : "Decision"}
      </h2>
      {decided && (
        <p className="text-sm text-muted-foreground" data-testid="decided-note">
          {decided}
        </p>
      )}
      <ActionError message={refusal} testId="decision-refused" />
      <div className={DECISION_ROW}>
        {canApprove && (
          <Button
            variant="outline"
            disabled={off}
            className={DECISION_BUTTON.positive}
            onClick={() => decide("APPROVED")}
          >
            <CheckCircle2 className="h-4 w-4" /> Approve
          </Button>
        )}
        {canHoldIt && (
          <Button
            variant="outline"
            disabled={off}
            className={DECISION_BUTTON.middle}
            onClick={() => {
              setHolding(true);
              setHoldError(null);
              setHoldExpiry("");
              setHoldNote("");
              setHoldErrors({});
            }}
          >
            <Hourglass className="h-4 w-4" /> Hold
          </Button>
        )}
        <Button
          variant="outline"
          disabled={off}
          className={DECISION_BUTTON.negative}
          onClick={() => {
            setRejecting(true);
            setReason("");
          }}
        >
          <XCircle className="h-4 w-4" /> Reject
        </Button>
      </div>

      <ConfirmDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Reject booking request"
        message="A reason is required. Give the coordinator enough to continue planning, such as what would make the request acceptable."
        confirmLabel="Reject request"
        pendingLabel="Rejecting…"
        destructive
        ready={reason.trim() !== ""}
        onConfirm={() => decideNow("REJECTED", reason)}
      >
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection"
          aria-label="Rejection reason"
        />
      </ConfirmDialog>

      <SubmittedDialog
        open={outcome !== null}
        title={
          outcome?.decision === "REJECTED"
            ? "Request rejected"
            : "Request approved"
        }
        onClose={() => setOutcome(null)}
        closeLabel="View this booking"
        action={{
          label: "Back to booking requests",
          onClick: () => router.push(listHref),
          prominent: true,
        }}
        testId="decision-done"
      >
        {outcome?.message}
      </SubmittedDialog>

      <Dialog open={holding} onOpenChange={setHolding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold this venue</DialogTitle>
            <DialogDescription>
              The venue is reserved for the Coordinator until the expiry, then
              released if they haven&apos;t confirmed it. The expiry must be
              before the booking starts ({formatDateTime(booking.startAt)}).
            </DialogDescription>
          </DialogHeader>
          {booking.hoursWarning && (
            <HoursWarning>{booking.hoursWarning}</HoursWarning>
          )}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              hold();
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
              <Label htmlFor="holdNote">
                What the Coordinator must finalise
              </Label>
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
            <ActionError message={holdError} testId="hold-error" />
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setHolding(false)}
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
    </div>
  );
}

/** Pending, or Held until when (and approved, if it has been). */
function StatusBadges({ booking }: { booking: PendingBookingRow }) {
  return booking.status === "HELD" ? (
    <span className="flex flex-wrap items-center gap-1">
      <Badge variant="info">
        Held until {formatDateTime(booking.holdExpiresAt!)}
      </Badge>
      {booking.holdApprovedAt && (
        <Badge variant="success">
          Approved by Venue Staff – awaiting confirmation
        </Badge>
      )}
    </span>
  ) : (
    <Badge variant="warning">Pending</Badge>
  );
}

function RequestOverview({ booking }: { booking: PendingBookingRow }) {
  const { venue } = booking;
  const free = booking.blockers.length === 0 && !booking.outsideHours;
  const fits =
    booking.requestedAttendance === null ||
    booking.requestedAttendance <= venue.capacity;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <StatusBadges booking={booking} />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            {formatDateTime(booking.startAt)} to {formatDateTime(booking.endAt)}
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
            <>
              {booking.outsideHours && (
                <Mark ok={false}>{booking.outsideHours}</Mark>
              )}
              {booking.blockers.map((blocker) => (
                <Mark key={blocker.id} ok={false}>
                  {describeBlocker(blocker)}
                </Mark>
              ))}
            </>
          )}
          {booking.hoursWarning && (
            <HoursWarning>{booking.hoursWarning}</HoursWarning>
          )}
        </Fact>
        {/* SCRUM-159: the period the venue is taken for, setup and
              turnaround included (a held request's own minutes, AC8). */}
        <Fact icon={Timer} label="Setup and turnaround">
          {(booking.status === "HELD" ? booking : venue).setupMinutes} min
          before ·{" "}
          {(booking.status === "HELD" ? booking : venue).turnaroundMinutes} min
          after
        </Fact>
        {booking.competing.length > 0 && (
          <Fact icon={ListOrdered} label="Competing requests">
            {/* SCRUM-134 AC1, AC2: an earlier one is decided first. */}
            <ul className="space-y-1" data-testid="competing-requests">
              {booking.competing.map((other) => (
                <li key={other.id}>
                  <Mark ok={!other.earlier}>
                    &ldquo;{other.eventName}&rdquo;, submitted{" "}
                    {formatDateTime(other.createdAt)}
                    {other.earlier
                      ? " — earlier, so decide it first"
                      : " — later"}
                  </Mark>
                </li>
              ))}
            </ul>
          </Fact>
        )}
        <Fact icon={Users} label="Attendance">
          <Mark ok={fits}>
            {booking.requestedAttendance ?? "Not stated"} expected · venue holds{" "}
            {venue.capacity}
          </Mark>
        </Fact>
        <Fact icon={LayoutGrid} label="Layout">
          {booking.requestedLayout ? (
            <Mark ok={venue.supportedLayouts.includes(booking.requestedLayout)}>
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
    </div>
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
    <div className="relative min-w-0 space-y-1 pl-11">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {label}
      </dt>
      <dd className="space-y-0.5">{children}</dd>
    </div>
  );
}

/** SCRUM-159 AC9: worth knowing before deciding, but nothing stops it. */
function HoursWarning({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="note"
      data-testid="hours-warning"
      className="flex items-start gap-1.5 text-warning-foreground"
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-warning"
        aria-label="warning"
      />
      {children}
    </span>
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
