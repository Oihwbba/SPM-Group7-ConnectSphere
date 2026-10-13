"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Plus } from "lucide-react";
import { toast } from "sonner";

import { RequestStatusBadge } from "@/components/equipment/request-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RequestHistory } from "@/components/equipment/request-history";
import { RequestLines } from "@/components/equipment/request-lines";
import type { CoordinatorEquipmentRequest } from "@/lib/equipment/request-queries";
import {
  CHANGEABLE_REQUEST_STATUSES,
  REQUESTABLE_EVENT_STATUSES,
  formatEventPeriod,
} from "@/lib/equipment/requests";
import { withdrawEquipmentRequest } from "./actions";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  NewRequestDialog,
  type EquipmentOption,
  type EventOption,
} from "./new-request-dialog";

/**
 * SCRUM-27 — the coordinator's equipment requests and the form to raise one.
 * A request the page has just created or been sent back to (AC 7) is
 * highlighted and scrolled into view, so the coordinator sees which one it is.
 */
export function CoordinatorRequests({
  requests,
  canCreate,
  canChange = false,
  events,
  equipment,
}: {
  requests: CoordinatorEquipmentRequest[];
  /** Whether this user may raise requests (equipment-request:create). */
  canCreate: boolean;
  /** SCRUM-142: whether this user may change or withdraw requests. */
  canChange?: boolean;
  events: EventOption[];
  equipment: EquipmentOption[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // SCRUM-142: the request whose lines are being changed, or withdrawn.
  const [changing, setChanging] = useState<CoordinatorEquipmentRequest | null>(
    null,
  );
  const [withdrawing, setWithdrawing] =
    useState<CoordinatorEquipmentRequest | null>(null);
  const [isWithdrawing, startWithdraw] = useTransition();
  const router = useRouter();

  function withdraw(request: CoordinatorEquipmentRequest) {
    startWithdraw(async () => {
      const result = await withdrawEquipmentRequest({ requestId: request.id });
      if (result.ok) {
        toast.success("Request withdrawn. Its reserved equipment is released.");
        setWithdrawing(null);
      } else {
        toast.error(result.error);
      }
      router.refresh();
    });
  }

  useEffect(() => {
    if (!highlightedId) return;
    document
      .getElementById(`request-${highlightedId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedId, requests]);

  const hasEvents = events.length > 0;
  const newRequestButton = canCreate && (
    <Button
      className="gap-2"
      onClick={() => setDialogOpen(true)}
      disabled={!hasEvents}
    >
      <Plus className="h-4 w-4" />
      New request
    </Button>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Equipment requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell Technical Support what your events need, and follow each
            request&apos;s status.
          </p>
        </div>
        {newRequestButton}
      </div>

      {canCreate && !hasEvents && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="no-requestable-events"
        >
          None of your events can take an equipment request yet. Requests open
          once an event is approved.
        </p>
      )}

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PackagePlus className="h-6 w-6" />
            </span>
            <p className="text-base font-medium">No equipment requests yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Ask for projectors, microphones and anything else from the
              equipment list for one of your approved events.
            </p>
            {hasEvents && newRequestButton && (
              <div className="pt-2">{newRequestButton}</div>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4" aria-label="Your equipment requests">
          {requests.map((request) => (
            <li key={request.id}>
              <RequestCard
                request={request}
                highlighted={request.id === highlightedId}
              >
                {canChange && isChangeable(request) && (
                  <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWithdrawing(request)}
                    >
                      Withdraw request
                    </Button>
                    <Button size="sm" onClick={() => setChanging(request)}>
                      Change lines
                    </Button>
                  </div>
                )}
              </RequestCard>
            </li>
          ))}
        </ul>
      )}

      {changing && (
        <NewRequestDialog
          key={changing.id}
          open
          onOpenChange={(open) => !open && setChanging(null)}
          events={events}
          equipment={equipment}
          editing={{
            requestId: changing.id,
            eventName: changing.event.name,
            lines: changing.lines.map((line) => ({
              equipmentId: line.equipment.id,
              quantity: line.quantity,
              technicalRequirements: line.technicalRequirements,
            })),
          }}
          onDone={(id) => {
            setChanging(null);
            setHighlightedId(id);
            router.refresh();
          }}
        />
      )}

      <Dialog
        open={!!withdrawing}
        onOpenChange={(open) => !open && setWithdrawing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw this equipment request?</DialogTitle>
            <DialogDescription>
              It becomes Cancelled and any equipment reserved for it is
              released. You can raise a new request later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setWithdrawing(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={isWithdrawing}
              onClick={() => withdrawing && withdraw(withdrawing)}
            >
              Withdraw request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canCreate && (
        <NewRequestDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          events={events}
          equipment={equipment}
          onDone={(id) => {
            setDialogOpen(false);
            setHighlightedId(id);
          }}
        />
      )}
    </div>
  );
}

/**
 * SCRUM-142 AC1, AC3, AC5 — still being planned, and not Rejected or
 * Cancelled. The server checks the same, and that this is the event's
 * assigned Coordinator.
 */
function isChangeable(request: CoordinatorEquipmentRequest): boolean {
  return (
    (CHANGEABLE_REQUEST_STATUSES as readonly string[]).includes(
      request.status,
    ) &&
    (REQUESTABLE_EVENT_STATUSES as readonly string[]).includes(
      request.event.status,
    )
  );
}

function RequestCard({
  request,
  highlighted,
  children,
}: {
  request: CoordinatorEquipmentRequest;
  highlighted: boolean;
  children?: React.ReactNode;
}) {
  // SCRUM-27 AC8 — the status, "Rejected with the reason". A rejection needs a
  // reason (SCRUM-28 AC3), and it is the last history entry's note, so it is
  // read from the history already fetched rather than asked for again. Shown
  // on the card rather than only in the collapsed log, because it is what the
  // coordinator acts on.
  const rejectionReason =
    request.status === "REJECTED"
      ? [...request.updates]
          .reverse()
          .find((update) => update.toStatus === "REJECTED")?.note
      : undefined;

  return (
    <Card
      id={`request-${request.id}`}
      data-testid="equipment-request"
      data-highlighted={highlighted}
      className={cn(
        "scroll-mt-24 transition-shadow",
        highlighted &&
          "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{request.event.name}</CardTitle>
          <CardDescription>{formatEventPeriod(request.event)}</CardDescription>
        </div>
        <RequestStatusBadge status={request.status} />
      </CardHeader>
      <CardContent className="space-y-3">
        <RequestLines lines={request.lines} />
        {rejectionReason && (
          <p
            className="whitespace-pre-line rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm"
            data-testid="rejection-reason"
          >
            <span className="font-medium">Reason: </span>
            {rejectionReason}
          </p>
        )}
        {request.notes && (
          <p className="whitespace-pre-line text-sm">
            <span className="font-medium">Notes: </span>
            {request.notes}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Submitted {formatDateTime(request.createdAt)}
        </p>
        <RequestHistory entries={request.updates} />
        {children}
      </CardContent>
    </Card>
  );
}
