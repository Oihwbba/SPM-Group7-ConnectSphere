"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  type ConfirmOutcome,
} from "@/components/app/confirm-dialog";
import {
  AffectedBookings,
  bookingsCount,
  flaggedNote,
  NONE_AFFECTED,
  type Affected,
} from "./affected-bookings";
import { retireVenue } from "./actions";

/**
 * SCRUM-34 AC8, AC11 — Venue Staff retire a venue, after confirming in the
 * shared dialog (SCRUM-207 AC5). A venue with future bookings lists them
 * first, inside the dialog; retiring it then flags them.
 */
export function RetireVenueDialog({ venue }: { venue: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [affected, setAffected] = useState<Affected>(NONE_AFFECTED);

  function changeOpen(next: boolean) {
    setOpen(next);
    setAffected(NONE_AFFECTED);
  }

  async function retire(): Promise<ConfirmOutcome> {
    try {
      const result = await retireVenue({
        venueId: venue.id,
        confirmedBookingIds: affected.ids,
      });
      if (!result.ok) {
        setAffected({
          lines: result.fieldErrors?.affectedBookings ?? [],
          ids: result.fieldErrors?.affectedBookingIds ?? [],
        });
        return result;
      }
      toast.success(`${venue.name} is retired.${flaggedNote(result.data.flagged)}`);
      router.refresh();
    } catch {
      return {
        ok: false,
        error: "Couldn't retire the venue. Check your connection and try again.",
      };
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={changeOpen}
      trigger={
        <Button type="button" variant="outline" className="gap-2">
          <Archive className="h-4 w-4" />
          Retire venue
        </Button>
      }
      title={`Retire ${venue.name}?`}
      message="It will no longer be offered for new venue requests. Bookings that name it stay readable."
      confirmLabel={
        affected.ids.length > 0
          ? `Retire and flag ${bookingsCount(affected.ids.length)}`
          : "Retire venue"
      }
      pendingLabel="Retiring…"
      destructive
      onConfirm={retire}
    >
      <AffectedBookings bookings={affected.lines} />
    </ConfirmDialog>
  );
}
