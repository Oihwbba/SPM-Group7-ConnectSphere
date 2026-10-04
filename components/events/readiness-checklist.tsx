"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, ListChecks } from "lucide-react";
import type { RejectionOutcome } from "@prisma/client";

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
import { getEventReadiness } from "@/app/(app)/events/readiness-actions";
import type { ReadinessChecklist as Checklist } from "@/lib/event-readiness";
import { REJECTION_OUTCOME_LABEL } from "@/lib/schemas/event";

/**
 * SCRUM-110 — the readiness checklist on a Planning event's details, and
 * SCRUM-81's Confirm action beneath it for the event's assigned Coordinator,
 * with SCRUM-117's Reject for when the arrangements can't be secured.
 * The server decides how much each viewer sees (the Organiser gets no internal
 * reasons) and who may confirm, so this component only renders what it is
 * given.
 */
export function ReadinessChecklist({ eventId }: { eventId: string }) {
  const [checklist, setChecklist] = useState<
    (Checklist & { canConfirm: boolean; canReject: boolean }) | null
  >(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirming, startConfirm] = useTransition();
  const [rejecting, startReject] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
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
  }, [eventId]);

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
                  data-testid={`readiness-item-${item.name === "Equipment" ? "equipment" : "venue"}`}
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
                  <p>
                    <span className="font-semibold">{item.name}</span>
                    <span className="sr-only">
                      {item.complete ? ", complete" : ", incomplete"}
                    </span>
                    {" — "}
                    {item.reason
                      ? `${item.state} – ${item.reason}`
                      : item.state}
                  </p>
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
