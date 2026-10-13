"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  decideChangeRequest,
  getChangeDecision,
  type ChangeDecisionView,
} from "@/app/(app)/events/change-decision-actions";
import { changeFieldLabel } from "@/lib/schemas/change-request";
import { formatDateTime } from "@/lib/datetime";

function shown(fieldName: string, value: string | null): string {
  if (value === null) return "—";
  return fieldName === "startAt" || fieldName === "endAt"
    ? formatDateTime(new Date(value))
    : value;
}

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
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, startSave] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let stale = false;
    getChangeDecision(eventId)
      .then((result) => {
        if (!stale) setView(result.ok ? result.data : null);
      })
      .catch(() => {
        if (!stale) setView(null);
      });
    return () => {
      stale = true;
    };
  }, [eventId]);

  if (!view) return null;

  function decide(decision: "APPROVED" | "REJECTED") {
    startSave(async () => {
      const result = await decideChangeRequest({
        changeRequestId: view!.changeRequestId,
        decision,
        reason,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
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
    });
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
                <td className="pr-2">{shown(field.fieldName, field.current)}</td>
                <td>{shown(field.fieldName, field.requested)}</td>
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

      {rejecting ? (
        <div className="space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why can't this change be made?"
            aria-label="Reason for rejecting the change request"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setRejecting(false)}>
              Back
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={saving || !reason.trim()}
              onClick={() => decide("REJECTED")}
            >
              Reject change request
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" disabled={saving} onClick={() => decide("APPROVED")}>
            {saving ? "Saving…" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              setReason("");
              setRejecting(true);
            }}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
