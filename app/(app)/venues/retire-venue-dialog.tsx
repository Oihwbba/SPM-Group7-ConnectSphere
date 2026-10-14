"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
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
import { AffectedBookings } from "./affected-bookings";
import { retireVenue } from "./actions";

/**
 * SCRUM-34 AC8, AC11 — Venue Staff retire a venue, after confirming. A venue
 * with future bookings isn't retired, and those bookings are listed.
 */
export function RetireVenueDialog({ venue }: { venue: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [affected, setAffected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeOpen(next: boolean) {
    setOpen(next);
    setAffected([]);
    setError(null);
  }

  function retire() {
    startTransition(async () => {
      try {
        const result = await retireVenue({ venueId: venue.id });
        if (!result.ok) {
          setError(result.error);
          setAffected(result.fieldErrors?.affectedBookings ?? []);
          return;
        }
        toast.success(`${venue.name} is retired.`);
        setOpen(false);
        router.refresh();
      } catch {
        setError("Couldn't retire the venue. Check your connection and try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Button type="button" variant="outline" className="gap-2" onClick={() => changeOpen(true)}>
        <Archive className="h-4 w-4" />
        Retire venue
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Retire {venue.name}?</DialogTitle>
          <DialogDescription>
            It will no longer be offered for new venue requests. Bookings that name it stay
            readable.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" data-testid="retire-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AffectedBookings bookings={affected} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={retire}
            disabled={pending}
            className="gap-2"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Retiring…" : "Retire venue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
