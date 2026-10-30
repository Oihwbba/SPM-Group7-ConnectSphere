"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  decideChangeRequest,
  getChangeDecision,
  type ChangeDecisionView,
} from "@/app/(app)/events/change-decision-actions";
import { changeFieldLabel, changeValueLabel } from "@/lib/schemas/change-request";
import {
  ConfirmDialog,
  type ConfirmOutcome,
} from "@/components/app/confirm-dialog";

const DECIDE_FAILED_MESSAGE =
  "The decision couldn't be sent. If the request above isn't decided, try again.";


/**
 * SCRUM-128 — under a Submitted change request, for its event's assigned
 * Coordinator: each changed field's current and requested value, what the
 * change could affect (AC1), and Approve or Reject with a reason (AC2, AC3).
 * The server returns nothing to anyone else, so for them this renders nothing.
 */
export function ChangeRequestDecision({
  eventId,
  onDecided,
}: {
  eventId: string;
  onDecided: () => void;
}) {
  const [view, setView] = useState<ChangeDecisionView | null>(null);
  // A read that throws (a dropped connection, a server error) is shown, so the
  // Coordinator isn't left without the controls and no idea why. "Not found"
  // is the answer for anyone who may not decide, so it still renders nothing.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reason, setReason] = useState("");
  // A refusal left the list possibly out of date: read it again once the
  // dialog that shows why is closed (SCRUM-207 AC4, AC5).
  const [stale, setStale] = useState(false);
  const readAgainOnClose = (open: boolean) => {
    if (open || !stale) return;
    setStale(false);
    onDecided();
  };
  const router = useRouter();

  useEffect(() => {
    let stale = false;
    getChangeDecision(eventId)
      .then((result) => {
        if (!stale) setView(result.ok ? result.data : null);
      })
      .catch(() => {
        if (!stale) setFailed(true);
      });
    return () => {
      stale = true;
    };
  }, [eventId, attempt]);

  if (failed) {
    return (
      <p role="alert" className="border-t pt-3 text-xs text-muted-foreground">
        Couldn&apos;t load the decision for this change request.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </p>
    );
  }
  if (!view) return null;

  // SCRUM-207 AC5: both decisions ask first, in the shared dialog, which
  // shows a refusal inside itself.
  async function decide(
    decision: "APPROVED" | "REJECTED",
  ): Promise<ConfirmOutcome> {
    let result: Awaited<ReturnType<typeof decideChangeRequest>>;
    try {
      result = await decideChangeRequest({
        changeRequestId: view!.changeRequestId,
        decision,
        reason,
      });
    } catch {
      // A lost connection or an unexpected server error: the decision may
      // or may not have been saved, so the list is read again, as the raise
      // form does, once the dialog showing why is closed.
      setStale(true);
      return { ok: false, error: DECIDE_FAILED_MESSAGE };
    }
    if (!result.ok) {
      // A blank reason changed nothing on the server. Anything else (decided
      // in another tab, the event reassigned or closed) may mean the list is
      // out of date, so it is read again once the dialog is closed.
      if (!result.fieldErrors) setStale(true);
      return result;
    }
    toast.success(
      decision === "REJECTED"
        ? "Change request rejected. The organiser has been told why."
        : view!.requestsCancellation
          ? "Change request approved. The event is cancelled."
          : result.data.returnedToPlanning
            ? "Change request approved. The event is back in Planning and its arrangements are flagged."
            : "Change request approved and applied.",
    );
    onDecided();
    router.refresh();
  }

  return (
    <div className="space-y-3 border-t pt-3" data-testid="change-request-decision">
      {!view.requestsCancellation && (
        <table className="w-full text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th className="font-medium">Field</th>
              <th className="font-medium">Now</th>
              <th className="font-medium">Requested</th>
            </tr>
          </thead>
          <tbody>
            {view.fields.map((field) => (
              <tr key={field.fieldName}>
                <td className="pr-2 font-medium">{changeFieldLabel(field.fieldName)}</td>
                <td className="pr-2">{changeValueLabel(field.fieldName, field.current)}</td>
                <td>{changeValueLabel(field.fieldName, field.requested)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view.affected.length > 0 && (
        <div data-testid="potentially-affected">
          <p className="font-medium">
            {view.requestsCancellation
              ? "Cancelling releases:"
              : "Potentially affected (they'll be flagged for you to reconsider):"}
          </p>
          <ul className="list-disc pl-5">
            {view.affected.map((label, index) => (
              <li key={`${label}-${index}`}>{label}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        {/* Shared page conventions: the decisions in green and red. */}
        <ConfirmDialog
          trigger={
            <Button
              size="sm"
              variant="ghost"
              className="border border-success/40 bg-success/10 text-success hover:bg-success/20 hover:text-success"
            >
              Approve
            </Button>
          }
          title={
            view.requestsCancellation
              ? "Approve the cancellation?"
              : "Approve this change request?"
          }
          message={
            view.requestsCancellation
              ? "The event is cancelled, and everything listed above is released. A cancelled event can't be reopened."
              : "The change is applied to the event now, and anything listed above is flagged for you to reconsider."
          }
          confirmLabel="Approve"
          pendingLabel="Saving…"
          onOpenChange={readAgainOnClose}
          destructive={view.requestsCancellation}
          onConfirm={() => decide("APPROVED")}
        />
        <ConfirmDialog
          trigger={
            <Button
              size="sm"
              variant="ghost"
              className="border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
              onClick={() => setReason("")}
            >
              Reject
            </Button>
          }
          title="Reject this change request?"
          message="The organiser is told why, and the event stays as it is."
          confirmLabel="Reject change request"
          pendingLabel="Rejecting…"
          onOpenChange={readAgainOnClose}
          destructive
          ready={reason.trim() !== ""}
          onConfirm={() => decide("REJECTED")}
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why can't this change be made?"
            aria-label="Reason for rejecting the change request"
          />
        </ConfirmDialog>
      </div>
    </div>
  );
}
