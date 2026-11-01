"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircleQuestion, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { EventStatus, RejectionOutcome } from "@prisma/client";

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
import { isOverdue } from "@/lib/event-closing";
import { EVENT_STATUS_LABEL } from "@/lib/status-labels";
import { REJECTION_OUTCOME_LABEL } from "@/lib/schemas/event";
import {
  CLARIFIABLE_FIELDS,
  type ClarifiableField,
} from "@/lib/schemas/clarification";
import { cn } from "@/lib/utils";
import { transitionEventStatus } from "@/app/(app)/events/actions";
import { requestClarification } from "@/app/(app)/events/clarification-actions";

/**
 * SCRUM-18, SCRUM-19, SCRUM-126 — the assigned Coordinator's decision on a
 * request under review: ask the Organiser a question, approve, or reject with
 * a reason and what the Organiser can do next. Offered on the events list and
 * on the event's page (SCRUM-208), with the same rules: the server checks the
 * Coordinator and the status. Order and colours follow the shared page
 * conventions: Ask, Approve, Reject, the decisions in green and red.
 */
export function ReviewDecision({
  event,
  buttonClassName,
}: {
  event: { id: string; status: EventStatus; startAt: Date | null };
  buttonClassName?: string;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<RejectionOutcome | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<ClarifiableField[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (event.status !== "SUBMITTED" && event.status !== "UNDER_REVIEW") {
    return null;
  }

  function changeStatus(
    nextStatus: "APPROVED" | "REJECTED",
    decisionReason?: string,
    rejectionOutcome?: RejectionOutcome,
  ) {
    startTransition(async () => {
      const result = await transitionEventStatus({
        eventId: event.id,
        nextStatus,
        decisionReason,
        rejectionOutcome,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Event status updated to ${EVENT_STATUS_LABEL[result.data.status]}.`,
      );
      setRejecting(false);
      setReason("");
      setOutcome(null);
      router.refresh();
    });
  }

  // SCRUM-18: ask instead of deciding yet; the status is untouched.
  function submitQuestion() {
    if (!message.trim()) return;
    startTransition(async () => {
      const result = await requestClarification({
        eventId: event.id,
        message,
        editableFields: fields,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Clarification request sent to the organiser.");
      setAsking(false);
      setMessage("");
      setFields([]);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={buttonClassName}
        disabled={isPending}
        onClick={() => {
          setAsking(true);
          setMessage("");
          setFields([]);
        }}
      >
        <MessageCircleQuestion className="h-3.5 w-3.5" /> Ask
      </Button>
      {/* SCRUM-249 AC1: the server refuses this too; it just isn't offered. */}
      {event.status === "UNDER_REVIEW" && !isOverdue(event) && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            buttonClassName,
            "border border-success/40 bg-success/10 text-success hover:bg-success/20 hover:text-success",
          )}
          disabled={isPending}
          onClick={() => changeStatus("APPROVED")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </Button>
      )}
      {event.status === "UNDER_REVIEW" && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            buttonClassName,
            "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive",
          )}
          disabled={isPending}
          onClick={() => {
            setRejecting(true);
            setReason("");
            setOutcome(null);
          }}
        >
          <XCircle className="h-3.5 w-3.5" /> Reject
        </Button>
      )}

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject event request</DialogTitle>
            <DialogDescription>
              Give the organiser a clear reason, and choose whether they amend
              this request or start a new one.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection"
            aria-label="Rejection reason"
          />
          {/* SCRUM-126 AC1: one outcome must be chosen with the reason. */}
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-medium">
              What can the organiser do next?
            </legend>
            {(Object.keys(REJECTION_OUTCOME_LABEL) as RejectionOutcome[]).map(
              (choice) => (
                <label key={choice} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`rejection-outcome-${event.id}`}
                    value={choice}
                    checked={outcome === choice}
                    onChange={() => setOutcome(choice)}
                    className="accent-primary"
                  />
                  {REJECTION_OUTCOME_LABEL[choice]}
                </label>
              ),
            )}
          </fieldset>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !reason.trim() || !outcome}
              onClick={() => outcome && changeStatus("REJECTED", reason, outcome)}
            >
              {isPending ? "Rejecting…" : "Reject request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request clarification</DialogTitle>
            <DialogDescription>
              Ask the organiser what you need before deciding. The event
              stays under review while you wait for their response.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What do you need clarified?"
            aria-label="Clarification message"
          />
          {/* SCRUM-108 AC1: the fields the organiser may change in the
              answer; none ticked means a text answer only. */}
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-medium">
              Fields the organiser may change (optional)
            </legend>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {(Object.keys(CLARIFIABLE_FIELDS) as ClarifiableField[]).map(
                (field) => (
                  <label key={field} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={fields.includes(field)}
                      onChange={(e) =>
                        setFields((current) =>
                          e.target.checked
                            ? [...current, field]
                            : current.filter((f) => f !== field),
                        )
                      }
                      className="accent-primary"
                    />
                    {CLARIFIABLE_FIELDS[field]}
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !message.trim()}
              onClick={submitQuestion}
            >
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
