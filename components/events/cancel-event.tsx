"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  const router = useRouter();

  async function cancel(): Promise<ConfirmOutcome> {
    const result = await cancelEvent({ eventId, reason });
    if (!result.ok) return result;
    toast.success("Event cancelled. Its arrangements and registrations were released.");
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={() => setReason("")}
        >
          Cancel event
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
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is it cancelled?"
        aria-label="Cancellation reason"
      />
    </ConfirmDialog>
  );
}
