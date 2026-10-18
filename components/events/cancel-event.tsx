"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { cancelEvent } from "@/app/(app)/events/cancel-actions";

/**
 * SCRUM-82 AC1, AC3 — the assigned Coordinator cancels an event with a
 * reason. The server decides whether this Coordinator may; the dialog only
 * stops a send without a reason.
 */
export function CancelEvent({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, startCancel] = useTransition();
  const router = useRouter();

  function cancel() {
    startCancel(async () => {
      const result = await cancelEvent({ eventId, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Event cancelled. Its arrangements and registrations were released.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive"
        onClick={() => {
          setReason("");
          setOpen(true);
        }}
      >
        Cancel event
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this event</DialogTitle>
            <DialogDescription>
              Use this when the event won&apos;t go ahead. Its venue bookings,
              holds and requests, equipment reservations and requests, and
              registrations are released, and everyone involved is told why. A
              cancelled event can&apos;t be reopened.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is it cancelled?"
            aria-label="Cancellation reason"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep event
            </Button>
            <Button
              variant="destructive"
              disabled={cancelling || !reason.trim()}
              onClick={cancel}
            >
              {cancelling ? "Cancelling…" : "Cancel event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
