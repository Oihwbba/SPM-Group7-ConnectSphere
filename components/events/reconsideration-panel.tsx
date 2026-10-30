"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getEventFlags,
  getFlaggedArrangements,
  resolveReconsiderationFlag,
  type FlaggedArrangement,
} from "@/app/(app)/events/reconsideration-actions";

type Flag = Omit<FlaggedArrangement, "reason"> & { reason: string | null };
import { formatDateTime } from "@/lib/datetime";
import { NEEDS_RECONSIDERATION } from "@/lib/status-labels";
import { ActionError } from "@/components/app/action-error";
import {
  ConfirmDialog,
  type ConfirmOutcome,
} from "@/components/app/confirm-dialog";

/**
 * SCRUM-26 AC9 — what happens after an arrangement is cancelled, so the
 * Coordinator doesn't make a second request by mistake. A cancelled
 * reservation leaves its equipment request Approved, and Technical Support
 * sees it as partly reserved (SCRUM-156) and is told (SCRUM-124 AC9).
 */
export function afterCancelling(kind: FlaggedArrangement["kind"]): string {
  return kind === "booking"
    ? "Request a venue again when you're ready."
    : "Technical Support will reserve it again.";
}

/**
 * SCRUM-26 AC7 — the event's arrangements flagged Needs Reconsideration, for
 * its assigned Coordinator to resolve with Still stands or Cancel
 * arrangement. The server returns nothing to anyone else, so for them this
 * renders nothing, as it does when nothing is flagged.
 *
 * SCRUM-208: `readOnly` lists the same flags with nothing to do, for the
 * Organiser (without the internal reason, SCRUM-131 AC3) and for an event
 * that can't take a decision any more; `closed` says the event is closed.
 */
export function ReconsiderationPanel({
  eventId,
  onResolved,
  readOnly = false,
  closed = false,
}: {
  eventId: string;
  onResolved: () => void;
  readOnly?: boolean;
  closed?: boolean;
}) {
  const [flagged, setFlagged] = useState<Flag[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [cancelling, setCancelling] = useState<Flag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let stale = false;
    (readOnly ? getEventFlags(eventId) : getFlaggedArrangements(eventId))
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
  }, [eventId, reload, readOnly]);

  // Cancelling is awaited by the shared dialog (SCRUM-207 AC5), which shows
  // a refusal inside itself; Still stands shows one in the panel (AC4).
  async function resolveNow(
    arrangement: Flag,
    decision: "STILL_STANDS" | "CANCEL",
  ): Promise<ConfirmOutcome> {
    let result: Awaited<ReturnType<typeof resolveReconsiderationFlag>>;
    try {
      result = await resolveReconsiderationFlag({
        kind: arrangement.kind,
        id: arrangement.id,
        decision,
      });
    } catch {
      // An unexpected error or a lost connection: the decision may or may
      // not have been saved, so the flags are read again.
      setReload((n) => n + 1);
      return {
        ok: false,
        error: "Couldn't save your decision. Check the list and try again.",
      };
    }
    if (!result.ok) {
      // A refusal can mean the flag was resolved elsewhere meanwhile, so
      // the list is read again rather than left stale.
      setReload((n) => n + 1);
      return result;
    }
    toast.success(
      decision === "STILL_STANDS"
        ? `${arrangement.label} still stands.`
        : [
            `${arrangement.label} was cancelled.`,
            afterCancelling(arrangement.kind),
            result.data.returnedToPlanning && "The event is back in Planning.",
          ]
            .filter(Boolean)
            .join(" "),
    );
    setError(null);
    setReload((n) => n + 1);
    onResolved();
    router.refresh();
  }

  function stillStands(arrangement: Flag) {
    startTransition(async () => {
      const result = await resolveNow(arrangement, "STILL_STANDS");
      setError(result && !result.ok ? result.error : null);
    });
  }

  // A refusal (not this event's Coordinator) shows nothing; a failed request
  // says so, since the checklist may still show the Needs Reconsideration badge.
  if (loadFailed) {
    return (
      <p role="alert" className="text-xs text-muted-foreground">
        Couldn&apos;t load the flagged arrangements — try reopening this event.
      </p>
    );
  }
  if (flagged.length === 0) return null;

  return (
    <Card
      className="overflow-hidden border-warning/40"
      data-testid="reconsideration-panel"
      data-read-only={readOnly}
    >
      <CardHeader className="bg-warning/10 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Flag aria-hidden="true" className="h-4 w-4 text-warning" />{" "}
          {NEEDS_RECONSIDERATION}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-xs">
        <p className="text-muted-foreground" data-testid="flags-note">
          {closed
            ? "This event is closed, so these flags can no longer be resolved."
            : readOnly
              ? "These arrangements were flagged because something they depend on changed. The Coordinator decides what happens to each."
              : "These arrangements were flagged because something they depend on changed. Each keeps its venue or equipment until you decide."}
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
                {arrangement.reason && <p>{arrangement.reason}</p>}
                <p className="text-muted-foreground">
                  Flagged {formatDateTime(arrangement.flaggedAt)}
                </p>
              </div>
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  {/* SCRUM-38 AC1: search from this booking request. */}
                  {arrangement.kind === "booking" && (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={{
                          pathname: "/venues/search",
                          query: {
                            event: eventId,
                            replace: arrangement.id,
                            return: "event",
                          },
                        }}
                      >
                        Find a replacement venue
                      </Link>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => stillStands(arrangement)}
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
              )}
            </li>
          ))}
        </ul>
        <ActionError message={error} />
      </CardContent>

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={`Cancel ${cancelling?.label ?? "this arrangement"}?`}
        message={
          <>
            Its {cancelling?.kind === "booking" ? "venue period" : "equipment"}{" "}
            is released for others.{" "}
            {cancelling && afterCancelling(cancelling.kind)} A Confirmed event
            goes back to Planning.
          </>
        }
        confirmLabel="Cancel arrangement"
        pendingLabel="Cancelling…"
        cancelLabel="Keep it for now"
        destructive
        onConfirm={async () =>
          cancelling ? resolveNow(cancelling, "CANCEL") : undefined
        }
      />
    </Card>
  );
}
