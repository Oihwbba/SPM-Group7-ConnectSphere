"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/textarea";
import {
  ConfirmDialog,
  type ConfirmOutcome,
} from "@/components/app/confirm-dialog";
import { cancelEvent } from "@/app/(app)/events/cancel-actions";

/**
 * SCRUM-82 AC1, AC3 — the assigned Coordinator cancels an event with a
 * reason, in the shared confirmation dialog (SCRUM-207 AC5). The server
 * decides whether this Coordinator may; the dialog only stops a send without
 * a reason, and shows a refusal inside itself.
 */
export function CancelEvent({ eventId }: { eventId: string }) {
  const [reason, setReason] = useState("");
  // SCRUM-264: a reason refused for length is said at the box.
  const [reasonErrors, setReasonErrors] = useState<string[]>();
  const router = useRouter();

  async function cancel(): Promise<ConfirmOutcome> {
    const result = await cancelEvent({ eventId, reason });
    if (!result.ok) {
      if (result.fieldErrors?.reason) setReasonErrors(result.fieldErrors.reason);
      return result;
    }
    toast.success("Event cancelled. Its arrangements and registrations were released.");
    router.refresh();
  }

  return (
    <ConfirmDialog
      // A cross alone, beside the pencil; the dialog it opens still spells
      // out what cancelling does.
      trigger={
        <Button
          size="sm"
          variant="outline"
          aria-label="Cancel event"
          title="Cancel event"
          className="h-9 w-9 p-0 text-destructive"
          onClick={() => setReason("")}
        >
          <X className="h-4 w-4" />
        </Button>
      }
      title="Cancel this event"
      message="Use this when the event won't go ahead. Its venue bookings, holds and requests, equipment reservations and requests, and registrations are released, and everyone involved is told why. A cancelled event can't be reopened."
      confirmLabel="Cancel event"
      pendingLabel="Cancelling…"
      cancelLabel="Keep event"
      destructive
      ready={reason.trim() !== ""}
      onConfirm={cancel}
    >
      <Textarea
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setReasonErrors(undefined);
        }}
        placeholder="Why is it cancelled?"
        aria-label="Cancellation reason"
        aria-invalid={Boolean(reasonErrors)}
        aria-describedby={reasonErrors ? "cancellation-reason-error" : undefined}
      />
      <FieldError id="cancellation-reason-error" messages={reasonErrors} />
    </ConfirmDialog>
  );
}
