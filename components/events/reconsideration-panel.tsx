"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag } from "lucide-react";

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
import {
  getFlaggedArrangements,
  resolveReconsiderationFlag,
  type FlaggedArrangement,
} from "@/app/(app)/events/reconsideration-actions";
import { formatDateTime } from "@/lib/datetime";

/**
 * SCRUM-26 AC7 — the event's arrangements flagged Needs Reconsideration, for
 * its assigned Coordinator to resolve with Still stands or Cancel
 * arrangement. The server returns nothing to anyone else, so for them this
 * renders nothing, as it does when nothing is flagged.
 */
export function ReconsiderationPanel({
  eventId,
  onResolved,
}: {
  eventId: string;
  onResolved: () => void;
}) {
  const [flagged, setFlagged] = useState<FlaggedArrangement[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [cancelling, setCancelling] = useState<FlaggedArrangement | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let stale = false;
    getFlaggedArrangements(eventId)
      .then((result) => {
        if (stale) return;
        setFlagged(result.ok ? result.data : []);
        setLoadFailed(false);
      })
      .catch(() => {
        if (!stale) setLoadFailed(true);
      });
    return () => {
      stale = true;
    };
  }, [eventId, reload]);

  function resolve(
    arrangement: FlaggedArrangement,
    decision: "STILL_STANDS" | "CANCEL",
  ) {
    startTransition(async () => {
      const result = await resolveReconsiderationFlag({
        kind: arrangement.kind,
        id: arrangement.id,
        decision,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        decision === "STILL_STANDS"
          ? `${arrangement.label} still stands.`
          : result.data.returnedToPlanning
            ? `${arrangement.label} was cancelled. The event is back in Planning.`
            : `${arrangement.label} was cancelled.`,
      );
      setCancelling(null);
      setReload((n) => n + 1);
      onResolved();
      router.refresh();
    });
  }

  // A refusal (not this event's Coordinator) shows nothing; a failed request
  // says so, since the checklist may still read "Needs reconsideration".
  if (loadFailed) {
    return (
      <p role="alert" className="text-xs text-muted-foreground">
        Couldn&apos;t load the flagged arrangements — try reopening this event.
      </p>
    );
  }
  if (flagged.length === 0) return null;

  return (
    <Card className="overflow-hidden border-warning/40" data-testid="reconsideration-panel">
      <CardHeader className="bg-warning/10 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Flag aria-hidden="true" className="h-4 w-4 text-warning" /> Needs
          reconsideration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-xs">
        <p className="text-muted-foreground">
          These arrangements were flagged because something they depend on
          changed. Each keeps its venue or equipment until you decide.
        </p>
        <ul className="space-y-3">
          {flagged.map((arrangement) => (
            <li
              key={arrangement.id}
              className="flex flex-wrap items-start justify-between gap-2 border-t pt-3 first:border-t-0 first:pt-0"
              data-testid={`flagged-${arrangement.kind}`}
            >
              <div>
                <p className="font-semibold">{arrangement.label}</p>
                <p>{arrangement.reason}</p>
                <p className="text-muted-foreground">
                  Flagged {formatDateTime(arrangement.flaggedAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => resolve(arrangement, "STILL_STANDS")}
                >
                  Still stands
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => setCancelling(arrangement)}
                >
                  Cancel arrangement
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {cancelling?.label}?</DialogTitle>
            <DialogDescription>
              Its {cancelling?.kind === "booking" ? "venue period" : "equipment"}{" "}
              is released for others, and you&apos;ll need to request again. A
              Confirmed event goes back to Planning.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Keep it for now
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => cancelling && resolve(cancelling, "CANCEL")}
            >
              {pending ? "Cancelling…" : "Cancel arrangement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
