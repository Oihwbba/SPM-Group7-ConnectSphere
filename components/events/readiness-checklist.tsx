"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Plus,
  Search,
  ShieldCheck,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { RejectionOutcome } from "@prisma/client";

import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { confirmEvent, rejectPlanningEvent } from "@/app/(app)/events/actions";
import {
  confirmHold,
  releaseHold,
  withdrawBookingRequest,
} from "@/app/(app)/bookings/actions";
import {
  getEventBookings,
  getEventEquipment,
  getEventReadiness,
} from "@/app/(app)/events/readiness-actions";
import { withdrawEquipmentRequest } from "@/app/(app)/equipment-requests/actions";
import { NewRequestDialog } from "@/app/(app)/equipment-requests/new-request-dialog";
import { AuditTrail } from "@/components/app/audit-trail";
import { trailOf } from "@/components/equipment/request-history";
import { RequestLines } from "@/components/equipment/request-lines";
import { RequestStatusBadge } from "@/components/equipment/request-status-badge";
import { formatDate, formatEventTime } from "@/lib/datetime";
import {
  CHANGEABLE_REQUEST_STATUSES,
  REQUESTABLE_EVENT_STATUSES,
} from "@/lib/equipment/requests";
import { recordNoEquipmentNeeded } from "@/app/(app)/events/equipment-decision-actions";
import { requestSafetyCheck } from "@/app/(app)/events/safety-check-actions";
import type {
  ReadinessChecklist as Checklist,
  EventVenueBooking,
} from "@/lib/event-readiness";
import { REJECTION_OUTCOME_LABEL } from "@/lib/schemas/event";
import {
  BOOKING_STATUS_LABEL,
  NEEDS_RECONSIDERATION,
} from "@/lib/status-labels";
import { cn } from "@/lib/utils";

/**
 * SCRUM-110 — the readiness checklist on a Planning event's page, as the
 * Arrangements tab's three sections in the order they are made (SCRUM-209):
 * Venues, with Find a venue and every booking; Equipment, whose request is
 * raised, changed or withdrawn here; and the Safety check. Beneath them,
 * SCRUM-81's Confirm for the event's assigned Coordinator, with SCRUM-117's
 * Reject for when the arrangements can't be secured.
 * The server decides how much each viewer sees (the Organiser gets no internal
 * reasons) and who may confirm, so this component only renders what it is
 * given.
 */

/**
 * SCRUM-131 AC3 — the arrangement's status, with Needs Reconsideration as a
 * warning badge beside it, never in its place, then the flag's reason.
 */
function StateWithFlag({
  state,
  needsReconsideration,
  reason,
}: {
  state: string;
  needsReconsideration?: boolean;
  reason: string | null;
}) {
  return (
    <>
      {state}
      {needsReconsideration && (
        <>
          {" "}
          <span
            data-testid="needs-reconsideration"
            className={cn(
              badgeVariants({ variant: "warning" }),
              "gap-1 px-2 py-0 align-middle",
            )}
          >
            <AlertTriangle aria-hidden="true" className="h-3 w-3" />
            {NEEDS_RECONSIDERATION}
          </span>
        </>
      )}
      {reason && ` – ${reason}`}
    </>
  );
}

export function ReadinessChecklist({
  eventId,
  onBookingsChanged,
}: {
  eventId: string;
  /** SCRUM-162 AC7: told after a hold is settled or a request withdrawn. */
  onBookingsChanged?: () => void;
}) {
  const [checklist, setChecklist] = useState<
    | (Checklist & {
        canConfirm: boolean;
        canReject: boolean;
        canSettleHold: boolean;
        canWithdrawBooking: boolean;
        canRecordNoEquipment: boolean;
        canRequestSafetyCheck: boolean;
        canRequestVenue: boolean;
      })
    | null
  >(null);
  // SCRUM-162 AC7: every venue booking, whatever its status.
  const [bookings, setBookings] = useState<EventVenueBooking[]>([]);
  // SCRUM-209 AC2: the event's equipment requests and what may be done.
  const [equipment, setEquipment] = useState<
    | Extract<
        Awaited<ReturnType<typeof getEventEquipment>>,
        { ok: true }
      >["data"]
    | null
  >(null);
  const [requestingEquipment, setRequestingEquipment] = useState(false);
  const [changingRequest, setChangingRequest] = useState(false);
  const [withdrawingRequest, setWithdrawingRequest] = useState<string | null>(
    null,
  );
  const [withdrawingEquipment, startWithdrawEquipment] = useTransition();
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumped after a hold is settled or a safety check requested, so the
  // checklist is read again.
  const [loads, setLoads] = useState(0);
  const [settling, startSettle] = useTransition();
  // Which hold action is in flight, so its button says so.
  const [settlingHow, setSettlingHow] = useState<string | null>(null);
  const [requesting, startRequest] = useTransition();
  const [confirming, startConfirm] = useTransition();
  const [rejecting, startReject] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deciding, startDecide] = useTransition();
  // SCRUM-142 AC4: the pending venue request waiting to be confirmed withdrawn.
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<RejectionOutcome | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getEventReadiness(eventId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setChecklist(result.data);
        else setLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    // Read beside the checklist; a failure leaves its part empty.
    getEventBookings(eventId)
      .then((result) => !cancelled && result.ok && setBookings(result.data))
      .catch(() => {});
    getEventEquipment(eventId)
      .then((result) => !cancelled && result.ok && setEquipment(result.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId, loads]);

  // SCRUM-166 AC1: offered only once the venue and equipment are complete.
  function requestCheck() {
    startRequest(async () => {
      const result = await requestSafetyCheck({ eventId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.existing
          ? "A safety check is already awaiting review."
          : "Safety check requested. The Safety Officers have been notified.",
      );
      setLoads((n) => n + 1);
    });
  }

  // SCRUM-163 AC3: the assigned Coordinator confirms or releases a hold, and
  // SCRUM-142 AC4: withdraws a pending venue request.
  const SETTLE = {
    confirm: [confirmHold, "Hold confirmed: the venue is booked."],
    release: [releaseHold, "Hold released: the venue is free again."],
    withdraw: [withdrawBookingRequest, "Venue request withdrawn."],
  } as const;
  function settleHold(bookingId: string, how: keyof typeof SETTLE) {
    const [action, done] = SETTLE[how];
    setSettlingHow(how);
    startSettle(async () => {
      const result = await action({ bookingId });
      if (!result.ok) toast.error(result.error);
      else toast.success(done);
      setLoads((n) => n + 1);
      onBookingsChanged?.();
      router.refresh();
    });
  }

  // SCRUM-170 AC4: the assigned Coordinator records that no equipment is needed.
  function recordNoEquipment() {
    startDecide(async () => {
      const result = await recordNoEquipmentNeeded({ eventId });
      if (!result.ok) toast.error(result.error);
      else toast.success("Recorded: no equipment needed.");
      setLoads((n) => n + 1);
      router.refresh();
    });
  }

  function confirm() {
    startConfirm(async () => {
      const result = await confirmEvent({ eventId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Event confirmed.");
      router.refresh();
    });
  }

  function reject() {
    if (!outcome) return;
    startReject(async () => {
      const result = await rejectPlanningEvent({
        eventId,
        decisionReason: reason,
        rejectionOutcome: outcome,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Event rejected. Its arrangements were released.");
      setRejectOpen(false);
      router.refresh();
    });
  }

  // SCRUM-209 AC2: the event's equipment request, changed or withdrawn here.
  const requests = equipment?.requests ?? [];
  const liveRequest = requests.find((request) =>
    (CHANGEABLE_REQUEST_STATUSES as readonly string[]).includes(request.status),
  );
  const shownRequest = liveRequest ?? requests[0] ?? null;
  // SCRUM-142 AC5: only while the event is still being planned.
  const changeable =
    Boolean(liveRequest) &&
    (REQUESTABLE_EVENT_STATUSES as readonly string[]).includes(
      liveRequest!.event.status,
    );

  function withdrawRequest(requestId: string) {
    startWithdrawEquipment(async () => {
      const result = await withdrawEquipmentRequest({ requestId });
      if (result.ok) {
        toast.success("Request withdrawn. Its reserved equipment is released.");
      } else {
        toast.error(result.error);
      }
      setWithdrawingRequest(null);
      setLoads((n) => n + 1);
      router.refresh();
    });
  }

  function equipmentDone() {
    setRequestingEquipment(false);
    setChangingRequest(false);
    setLoads((n) => n + 1);
    router.refresh();
  }

  if (loadFailed) {
    return (
      <Card data-testid="readiness-checklist">
        <CardContent className="p-4 text-xs">
          <p role="alert" className="text-muted-foreground">
            Couldn&apos;t load the readiness checklist. Try reopening this
            event.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!checklist) {
    return (
      <Card data-testid="readiness-checklist">
        <CardContent className="p-4 text-xs">
          <p role="status" className="text-muted-foreground">
            Checking arrangements…
          </p>
        </CardContent>
      </Card>
    );
  }

  const item = (name: Checklist["items"][number]["name"]) =>
    checklist.items.find((each) => each.name === name)!;
  const venue = item("Venue booking");
  const equipmentItem = item("Equipment");
  const safety = item("Safety check");
  // Every booking, each live one with its checklist line; a live one not
  // yet in the list (read a moment apart) still shows, with its actions.
  const venueRows = [
    ...bookings.map((booking) => ({
      booking,
      line: venue.bookings?.find((each) => each.id === booking.id),
    })),
    ...(venue.bookings ?? [])
      .filter((line) => !bookings.some((booking) => booking.id === line.id))
      .map((line) => ({
        booking: {
          id: line.id,
          venueName: line.venueName,
          attendance: line.attendance,
          status: (line.held
            ? "HELD"
            : line.pending
              ? "PENDING"
              : "APPROVED") as EventVenueBooking["status"],
          startAt: null as Date | null,
          endAt: null as Date | null,
        },
        line,
      })),
  ];
  // The assigned Coordinator: the one who may confirm (SCRUM-81).
  const coordinates = checklist.canConfirm;

  return (
    <div className="space-y-4" data-testid="readiness-checklist">
      {/* SCRUM-132 AC3: whether it is ready, and Confirm, before the
          sections' detail, so they show without scrolling. */}
      <Card>
        <CardContent className="p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* How many of the three items are complete; Confirm opens at all. */}
            <p
              className="text-base font-bold text-primary"
              data-testid="readiness-summary"
            >
              {
                [venue, equipmentItem, safety].filter((item) => item.complete)
                  .length
              }
              /3 items completed
              {/* SCRUM-110 AC5: every item complete reads Ready to confirm. */}
              {checklist.ready && (
                <span className="text-success"> · Ready to confirm</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {/* SCRUM-117: for the assigned Coordinator, unless the event was
                  ever Confirmed (then it is cancelled instead). */}
              {checklist.canReject && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                  onClick={() => {
                    setReason("");
                    setOutcome(null);
                    setRejectOpen(true);
                  }}
                  disabled={rejecting}
                >
                  Reject event
                </Button>
              )}
              {/* SCRUM-81: only usable once every item is complete. */}
              {checklist.canConfirm && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-success/40 bg-success/10 text-success hover:bg-success/20 hover:text-success"
                  onClick={confirm}
                  disabled={!checklist.ready || confirming}
                >
                  {confirming ? "Confirming…" : "Confirm event"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SCRUM-209: the arrangements in the order they are made; side by side
          on a wide screen, so each one's state shows without scrolling
          (SCRUM-132 AC3). */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section
          id="arrangements-venues"
          icon={Building2}
          title="Venues"
          testId="readiness-item-venue"
          marked={coordinates}
          item={venue}
          action={
            // SCRUM-209 AC1: search for this event, and come back here after.
            checklist.canRequestVenue && (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={{
                    pathname: "/venues/search",
                    query: { event: eventId, return: "event" },
                  }}
                >
                  <Search className="h-4 w-4" aria-hidden /> Find a venue
                </Link>
              </Button>
            )
          }
        >
          {venueRows.length === 0 ? (
            <p className="text-muted-foreground">No venues requested yet.</p>
          ) : (
            // SCRUM-162 AC7: every booking with its status; SCRUM-162 AC8: the
            // live ones with their own state and actions.
            <ul className="space-y-2" data-testid="venue-bookings-panel">
              {venueRows.map(({ booking, line }) => (
                <li
                  key={booking.id}
                  className="rounded-md border px-3 py-2"
                  data-testid="event-venue-booking"
                  data-status={booking.status}
                >
                  <div
                    className="space-y-1.5"
                    data-testid={line ? "venue-booking" : undefined}
                    data-complete={line?.complete}
                  >
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span>
                        <span className="font-medium">{booking.venueName}</span>
                        {booking.attendance !== null &&
                          ` · ${booking.attendance} people`}
                        {booking.startAt && booking.endAt && (
                          <span className="text-muted-foreground">
                            {" · "}
                            {formatEventTime(booking.startAt, booking.endAt)}
                          </span>
                        )}
                      </span>
                      <span
                        className={
                          booking.status === "APPROVED"
                            ? "inline-flex items-center gap-1 font-semibold text-success"
                            : "font-semibold"
                        }
                      >
                        {booking.status === "APPROVED" && (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {line ? (
                          <StateWithFlag {...line} />
                        ) : (
                          BOOKING_STATUS_LABEL[booking.status]
                        )}
                      </span>
                    </p>
                    {/* SCRUM-163 AC3, AC7: Venue Staff approve the hold first;
                        only then can the Coordinator confirm it. */}
                    {line?.held && (
                      <p
                        className="text-muted-foreground"
                        data-testid="hold-approval"
                      >
                        {line.holdApproved
                          ? "Approved by Venue Staff – awaiting confirmation."
                          : "Waiting for Venue Staff to approve the hold before it can be confirmed."}
                      </p>
                    )}
                    {line?.held && checklist.canSettleHold && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => settleHold(line.id, "confirm")}
                          disabled={settling || !line.holdApproved}
                        >
                          {settling && settlingHow === "confirm"
                            ? "Confirming…"
                            : "Confirm hold"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => settleHold(line.id, "release")}
                          disabled={settling}
                        >
                          {settling && settlingHow === "release"
                            ? "Releasing…"
                            : "Release hold"}
                        </Button>
                      </div>
                    )}
                    {line?.pending && checklist.canWithdrawBooking && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setWithdrawing(line.id)}
                        disabled={settling}
                      >
                        Withdraw request
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="arrangements-equipment"
          icon={Wrench}
          title="Equipment"
          testId="readiness-item-equipment"
          marked={coordinates}
          item={equipmentItem}
          action={
            ((equipment?.canCreate && !liveRequest) ||
              (equipmentItem.noEquipmentOffered &&
                checklist.canRecordNoEquipment)) && (
              <div className="flex flex-wrap gap-2">
                {/* SCRUM-209 AC2: raised in place, for this event only. Raising
                  one also replaces No equipment needed (SCRUM-170 AC4). */}
                {equipment?.canCreate && !liveRequest && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRequestingEquipment(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Request equipment
                  </Button>
                )}
                {equipmentItem.noEquipmentOffered &&
                  checklist.canRecordNoEquipment && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={recordNoEquipment}
                      disabled={deciding}
                    >
                      {deciding ? "Recording…" : "No equipment needed"}
                    </Button>
                  )}
              </div>
            )
          }
        >
          {equipmentItem.state === "No equipment needed" &&
            equipment?.canCreate && (
              <p className="text-muted-foreground">
                To change this, request equipment: the request replaces it.
              </p>
            )}
          {shownRequest ? (
            <div
              className="space-y-3 rounded-md border px-3 py-2"
              data-testid="event-equipment-request"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  Equipment request · submitted{" "}
                  {formatDate(shownRequest.createdAt)}
                </p>
                <RequestStatusBadge status={shownRequest.status} />
              </div>
              <RequestLines lines={shownRequest.lines} />
              {shownRequest.notes && (
                <p className="whitespace-pre-line">
                  <span className="font-medium">Notes: </span>
                  {shownRequest.notes}
                </p>
              )}
              {shownRequest.updates.length > 0 && (
                <details className="rounded-md border bg-muted/20">
                  <summary className="cursor-pointer select-none px-3 py-2 font-medium">
                    History ({shownRequest.updates.length})
                  </summary>
                  <div className="border-t px-3 py-3">
                    <AuditTrail
                      entries={trailOf(shownRequest.updates)}
                      entryTestId="history-entry"
                    />
                  </div>
                </details>
              )}
              {/* SCRUM-142: the same rules as on Equipment Requests. */}
              {equipment?.canChange && changeable && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setWithdrawingRequest(liveRequest!.id)}
                  >
                    Withdraw
                  </Button>
                  <Button size="sm" onClick={() => setChangingRequest(true)}>
                    Change lines
                  </Button>
                </div>
              )}
            </div>
          ) : (
            equipmentItem.state !== "No equipment needed" && (
              <p className="text-muted-foreground">
                No equipment requested yet.
              </p>
            )
          )}
        </Section>

        <Section
          id="arrangements-safety"
          icon={ShieldCheck}
          title="Safety check"
          testId="readiness-item-safety"
          marked={coordinates}
          item={safety}
          action={
            checklist.canRequestSafetyCheck && (
              <Button
                size="sm"
                variant="outline"
                onClick={requestCheck}
                disabled={requesting}
              >
                {requesting ? "Requesting…" : "Request safety check"}
              </Button>
            )
          }
        >
          {/* SCRUM-209 AC3: what the request is waiting for, in one line, rather
              than a button that can't be used. */}
          {coordinates &&
            !checklist.canRequestSafetyCheck &&
            !safety.complete &&
            safety.state !== "Awaiting review" && (
              <p
                className="text-muted-foreground"
                data-testid="safety-check-waiting"
              >
                Request once a venue is approved and equipment is settled.
              </p>
            )}
          {safety.state === "Awaiting review" && (
            <p className="text-muted-foreground">
              Waiting for a Safety Officer to review it.
            </p>
          )}
        </Section>
      </div>

      {equipment && requestingEquipment && (
        <NewRequestDialog
          open
          onOpenChange={(open) => !open && setRequestingEquipment(false)}
          events={[equipment.event]}
          equipment={equipment.equipment}
          fixedEventId={eventId}
          onDone={equipmentDone}
        />
      )}
      {equipment && changingRequest && liveRequest && (
        <NewRequestDialog
          key={liveRequest.id}
          open
          onOpenChange={(open) => !open && setChangingRequest(false)}
          events={[equipment.event]}
          equipment={equipment.equipment}
          editing={{
            requestId: liveRequest.id,
            eventName: liveRequest.event.name,
            lines: liveRequest.lines.map((line) => ({
              equipmentId: line.equipment.id,
              quantity: line.quantity,
              technicalRequirements: line.technicalRequirements,
            })),
          }}
          onDone={equipmentDone}
        />
      )}

      <Dialog
        open={withdrawingRequest !== null}
        onOpenChange={(open) => !open && setWithdrawingRequest(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw this equipment request?</DialogTitle>
            <DialogDescription>
              It becomes Cancelled and any equipment reserved for it is
              released. You can raise a new request later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setWithdrawingRequest(null)}
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={withdrawingEquipment}
              onClick={() =>
                withdrawingRequest && withdrawRequest(withdrawingRequest)
              }
            >
              Withdraw request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={withdrawing !== null}
        onOpenChange={(open) => !open && setWithdrawing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw this venue request?</DialogTitle>
            <DialogDescription>
              It leaves the Venue Staff queue and Venue Staff are told. You can
              request a venue again afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setWithdrawing(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={settling}
              onClick={() => {
                if (withdrawing) settleHold(withdrawing, "withdraw");
                setWithdrawing(null);
              }}
            >
              Withdraw request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this event</DialogTitle>
            <DialogDescription>
              Use this when the event&apos;s arrangements can&apos;t be secured.
              Its venue bookings, equipment reservations and open requests are
              released, and the organiser is told why.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why can't it go ahead?"
            aria-label="Rejection reason"
          />
          {/* SCRUM-117 AC2: an outcome is chosen as for any rejection (SCRUM-126). */}
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-medium">
              What can the organiser do next?
            </legend>
            {(Object.keys(REJECTION_OUTCOME_LABEL) as RejectionOutcome[]).map(
              (option) => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="planning-rejection-outcome"
                    value={option}
                    checked={outcome === option}
                    onChange={() => setOutcome(option)}
                    className="accent-primary"
                  />
                  {REJECTION_OUTCOME_LABEL[option]}
                </label>
              ),
            )}
          </fieldset>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejecting || !reason.trim() || !outcome}
              onClick={reject}
            >
              {rejecting ? "Rejecting…" : "Reject event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * One arrangement: its title with the checklist item's state beside it (for
 * the assigned Coordinator, ticked when complete and crossed when not), its
 * details, then its actions.
 */
function Section({
  id,
  icon: Icon,
  title,
  testId,
  item,
  marked,
  action,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  testId: string;
  item: Checklist["items"][number];
  /** SCRUM-209: the Coordinator sees a tick or a cross beside the state. */
  marked: boolean;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className="flex scroll-mt-24 flex-col overflow-hidden [&_button]:h-7 [&_button]:px-2.5 [&_button]:text-xs"
      id={id}
      data-testid={testId}
      data-complete={item.complete}
    >
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 bg-muted/30 px-4 py-3">
        <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Icon aria-hidden="true" className="h-4 w-4 text-primary" /> {title}
          </span>
          <span
            data-testid="item-status"
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              marked && (item.complete ? "text-success" : "text-destructive"),
              !marked && "text-muted-foreground",
            )}
          >
            {marked &&
              (item.complete ? (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              ))}
            <span className="sr-only">
              {item.name}, {item.complete ? "complete" : "incomplete"}:{" "}
            </span>
            <StateWithFlag {...item} reason={null} />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 p-4 text-xs empty:hidden">
        {item.reason && (
          <p className="text-muted-foreground" data-testid="item-reason">
            {item.reason}
          </p>
        )}
        {children}
      </CardContent>
      {/* SCRUM-209: the section's actions, small, at its bottom right. */}
      {action && (
        <div className="mt-auto flex flex-wrap justify-end gap-2 px-4 pb-4 [&_a]:h-7 [&_a]:px-2.5 [&_a]:text-xs">
          {action}
        </div>
      )}
    </Card>
  );
}
