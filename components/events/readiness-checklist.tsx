"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CircleDashed, ListChecks } from "lucide-react";
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
import { getEventReadiness } from "@/app/(app)/events/readiness-actions";
import { recordNoEquipmentNeeded } from "@/app/(app)/events/equipment-decision-actions";
import { requestSafetyCheck } from "@/app/(app)/events/safety-check-actions";
import type { ReadinessChecklist as Checklist } from "@/lib/event-readiness";
import { REJECTION_OUTCOME_LABEL } from "@/lib/schemas/event";
import { NEEDS_RECONSIDERATION } from "@/lib/status-labels";
import { cn } from "@/lib/utils";

/**
 * SCRUM-110 — the readiness checklist on a Planning event's details, and
 * SCRUM-81's Confirm action beneath it for the event's assigned Coordinator,
 * with SCRUM-117's Reject for when the arrangements can't be secured.
 * The server decides how much each viewer sees (the Organiser gets no internal
 * reasons) and who may confirm, so this component only renders what it is
 * given.
 */
const ITEM_ID: Record<Checklist["items"][number]["name"], string> = {
  "Venue booking": "venue",
  Equipment: "equipment",
  "Safety check": "safety",
};

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
      })
    | null
  >(null);
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

  return (
    <Card className="overflow-hidden" data-testid="readiness-checklist">
      <CardHeader className="bg-muted/30 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks aria-hidden="true" className="h-4 w-4 text-primary" />{" "}
          Readiness checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-xs">
        {loadFailed ? (
          <p role="alert" className="text-muted-foreground">
            Couldn&apos;t load the readiness checklist. Try reopening this
            event.
          </p>
        ) : !checklist ? (
          <p role="status" className="text-muted-foreground">
            Checking arrangements…
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {checklist.items.map((item) => (
                <li
                  key={item.name}
                  className="flex items-start gap-2"
                  data-testid={`readiness-item-${ITEM_ID[item.name]}`}
                  data-complete={item.complete}
                >
                  {item.complete ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-success"
                    />
                  ) : (
                    <CircleDashed
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  <div className="space-y-2">
                    <p>
                      <span className="font-semibold">{item.name}</span>
                      <span className="sr-only">
                        {item.complete ? ", complete" : ", incomplete"}
                      </span>
                      {" — "}
                      <StateWithFlag {...item} />
                    </p>
                    {/* SCRUM-162 AC8: each live booking, with its own
                        actions. */}
                    {item.bookings && item.bookings.length > 0 && (
                      <ul className="space-y-2" data-testid="venue-bookings">
                        {item.bookings.map((booking) => (
                          <li
                            key={booking.id}
                            className="space-y-1.5 rounded-md border px-2 py-1.5"
                            data-testid="venue-booking"
                            data-complete={booking.complete}
                          >
                            <p>
                              <span className="font-medium">
                                {booking.venueName}
                              </span>
                              {booking.attendance !== null &&
                                ` · ${booking.attendance} people`}
                              {" — "}
                              <StateWithFlag {...booking} />
                            </p>
                            {/* SCRUM-163 AC3, AC7: Venue Staff approve the
                                hold first; only then can the Coordinator
                                confirm it. */}
                            {booking.held && (
                              <p
                                className="text-muted-foreground"
                                data-testid="hold-approval"
                              >
                                {booking.holdApproved
                                  ? "Approved by Venue Staff – awaiting confirmation."
                                  : "Waiting for Venue Staff to approve the hold before it can be confirmed."}
                              </p>
                            )}
                            {booking.held && checklist.canSettleHold && (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    settleHold(booking.id, "confirm")
                                  }
                                  disabled={settling || !booking.holdApproved}
                                >
                                  {settling && settlingHow === "confirm"
                                    ? "Confirming…"
                                    : "Confirm hold"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    settleHold(booking.id, "release")
                                  }
                                  disabled={settling}
                                >
                                  {settling && settlingHow === "release"
                                    ? "Releasing…"
                                    : "Release hold"}
                                </Button>
                              </div>
                            )}
                            {booking.pending &&
                              checklist.canWithdrawBooking && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setWithdrawing(booking.id)}
                                  disabled={settling}
                                >
                                  Withdraw request
                                </Button>
                              )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.noEquipmentOffered &&
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
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className={
                  checklist.ready
                    ? "font-semibold text-success"
                    : "text-muted-foreground"
                }
                data-testid="readiness-summary"
              >
                {checklist.ready
                  ? "Ready to confirm"
                  : "Not ready to confirm yet: complete the items above."}
              </p>
              {/* SCRUM-81: offered only to the assigned Coordinator, and only
                  usable once every item is complete. */}
              <div className="flex flex-wrap gap-2">
                {checklist.canRequestSafetyCheck && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={requestCheck}
                    disabled={requesting}
                  >
                    {requesting ? "Requesting…" : "Request safety check"}
                  </Button>
                )}
                {/* SCRUM-117: for the assigned Coordinator, unless the event
                    was ever Confirmed (then it is cancelled instead). */}
                {checklist.canReject && (
                  <Button
                    size="sm"
                    variant="outline"
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
                {checklist.canConfirm && (
                  <Button
                    size="sm"
                    onClick={confirm}
                    disabled={!checklist.ready || confirming}
                  >
                    {confirming ? "Confirming…" : "Confirm event"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>

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
    </Card>
  );
}
