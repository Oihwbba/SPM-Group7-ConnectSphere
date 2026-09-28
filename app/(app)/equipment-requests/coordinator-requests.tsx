"use client";

import { useEffect, useState } from "react";
import { PackagePlus, Plus } from "lucide-react";

import { RequestStatusBadge } from "@/components/equipment/request-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RequestLines } from "@/components/equipment/request-lines";
import type { CoordinatorEquipmentRequest } from "@/lib/equipment/request-queries";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  NewRequestDialog,
  type EquipmentOption,
  type EventOption,
} from "./new-request-dialog";

/** An event's period, or a plain note when its dates aren't set. */
function eventPeriod(event: { startAt: Date | null; endAt: Date | null }) {
  if (!event.startAt || !event.endAt) return "Dates to be confirmed";
  return `${formatDateTime(event.startAt)} – ${formatDateTime(event.endAt)}`;
}

/**
 * SCRUM-27 — the coordinator's equipment requests and the form to raise one.
 * A request the page has just created or been sent back to (AC 7) is
 * highlighted and scrolled into view, so the coordinator sees which one it is.
 */
export function CoordinatorRequests({
  requests,
  canCreate,
  events,
  equipment,
}: {
  requests: CoordinatorEquipmentRequest[];
  /** Whether this user may raise requests (equipment-request:create). */
  canCreate: boolean;
  events: EventOption[];
  equipment: EquipmentOption[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

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
              />
            </li>
          ))}
        </ul>
      )}

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

function RequestCard({
  request,
  highlighted,
}: {
  request: CoordinatorEquipmentRequest;
  highlighted: boolean;
}) {
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
          <CardDescription>{eventPeriod(request.event)}</CardDescription>
        </div>
        <RequestStatusBadge status={request.status} />
      </CardHeader>
      <CardContent className="space-y-3">
        <RequestLines lines={request.lines} />
        {request.notes && (
          <p className="whitespace-pre-line text-sm">
            <span className="font-medium">Notes: </span>
            {request.notes}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Submitted {formatDateTime(request.createdAt)}
        </p>
      </CardContent>
    </Card>
  );
}
