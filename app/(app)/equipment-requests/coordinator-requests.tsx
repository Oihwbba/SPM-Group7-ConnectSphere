"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, PackagePlus, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { RequestStatusBadge } from "@/components/equipment/request-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { trailOf } from "@/components/equipment/request-history";
import { AppSelect } from "@/components/app/app-select";
import { AuditTrail } from "@/components/app/audit-trail";
import { Tabs } from "@/components/app/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequestLines } from "@/components/equipment/request-lines";
import type { CoordinatorEquipmentRequest } from "@/lib/equipment/request-queries";
import {
  CHANGEABLE_REQUEST_STATUSES,
  EQUIPMENT_REQUEST_STATUS_LABEL,
  REQUESTABLE_EVENT_STATUSES,
  formatEventPeriod,
} from "@/lib/equipment/requests";
import { withdrawEquipmentRequest } from "./actions";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  NewRequestDialog,
  type EquipmentOption,
  type EventOption,
} from "./new-request-dialog";
import { PageHeader } from "@/components/app/page-header";
import {
  ConfirmDialog,
  type ConfirmOutcome,
} from "@/components/app/confirm-dialog";

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewingId, setViewingId] = useState<string | null>(null);
  // Read from the list, so the pop-up follows a refresh.
  const viewing = requests.find((request) => request.id === viewingId) ?? null;
  const q = query.trim().toLowerCase();
  const shown = requests.filter(
    (request) =>
      (statusFilter === "ALL" || request.status === statusFilter) &&
      (!q || request.event.name.toLowerCase().includes(q)),
  );

  // SCRUM-207 AC5: awaited by the shared dialog, which shows a refusal.
  async function withdraw(
    request: CoordinatorEquipmentRequest,
  ): Promise<ConfirmOutcome> {
    const result = await withdrawEquipmentRequest({ requestId: request.id });
    router.refresh();
    if (!result.ok) return result;
    toast.success("Request withdrawn. Its reserved equipment is released.");
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
      <PageHeader
        title="Equipment requests"
        description="Tell Technical Support what your events need, and follow each request's status."
        actions={newRequestButton}
      />

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
        <>
          {/* Change 11: the requests as a table, searched by event and
              filtered by status; the eye opens the details and history. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Search by event name"
                placeholder="Search by event name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <AppSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              aria-label="Filter by status"
              className="w-44"
              options={[
                { value: "ALL", label: "All statuses" },
                ...Object.entries(EQUIPMENT_REQUEST_STATUS_LABEL).map(
                  ([value, label]) => ({ value, label }),
                ),
              ]}
            />
          </div>
          {shown.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  No requests match the search or filter.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("ALL");
                  }}
                >
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table aria-label="Your equipment requests">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((request) => (
                      <TableRow
                        key={request.id}
                        id={`request-${request.id}`}
                        data-testid="equipment-request"
                        data-highlighted={request.id === highlightedId}
                        className={cn(
                          "scroll-mt-24",
                          request.id === highlightedId && "bg-primary/5",
                        )}
                      >
                        <TableCell className="md:w-full md:max-w-0">
                          <p
                            className="truncate font-medium"
                            title={request.event.name}
                          >
                            {request.event.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatEventPeriod(request.event)}
                          </p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {request.lines.length}{" "}
                          {request.lines.length === 1 ? "item" : "items"}
                        </TableCell>
                        <TableCell>
                          <RequestStatusBadge status={request.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(request.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={`View details of ${request.event.name}`}
                            title="View details"
                            data-testid="view-request-button"
                            onClick={() => setViewingId(request.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewingId(null)}
      >
        {viewing && (
          <DialogContent
            className="max-h-[90vh] max-w-2xl overflow-y-auto"
            data-testid="equipment-request-details"
          >
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <DialogTitle>{viewing.event.name}</DialogTitle>
                <RequestStatusBadge status={viewing.status} />
              </div>
              <DialogDescription>
                {formatEventPeriod(viewing.event)}
              </DialogDescription>
            </DialogHeader>
            <Tabs
              label="Equipment request"
              tabs={[
                {
                  id: "details",
                  label: "Details",
                  content: (
                    <RequestDetails request={viewing}>
                      {canChange && isChangeable(viewing) && (
                        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setViewingId(null);
                              setWithdrawing(viewing);
                            }}
                          >
                            Withdraw request
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setViewingId(null);
                              setChanging(viewing);
                            }}
                          >
                            Change lines
                          </Button>
                        </div>
                      )}
                    </RequestDetails>
                  ),
                },
                {
                  id: "history",
                  label: `History (${viewing.updates.length})`,
                  content: (
                    <AuditTrail
                      entries={trailOf(viewing.updates)}
                      entryTestId="history-entry"
                    />
                  ),
                },
              ]}
            />
          </DialogContent>
        )}
      </Dialog>

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

      <ConfirmDialog
        open={!!withdrawing}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        title="Withdraw this equipment request?"
        message="It becomes Cancelled and any equipment reserved for it is released. You can raise a new request later."
        confirmLabel="Withdraw request"
        pendingLabel="Withdrawing…"
        cancelLabel="Keep it"
        destructive
        onConfirm={async () => (withdrawing ? withdraw(withdrawing) : undefined)}
      />

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

/** The request's lines, and why it was rejected or what was noted. */
function RequestDetails({
  request,
  children,
}: {
  request: CoordinatorEquipmentRequest;
  children?: React.ReactNode;
}) {
  // SCRUM-27 AC8 — the status, "Rejected with the reason". A rejection needs a
  // reason (SCRUM-28 AC3), and it is the last history entry's note, so it is
  // read from the history already fetched rather than asked for again. Shown
  // with the details rather than only in the history, because it is what the
  // coordinator acts on.
  const rejectionReason =
    request.status === "REJECTED"
      ? [...request.updates]
          .reverse()
          .find((update) => update.toStatus === "REJECTED")?.note
      : undefined;

  return (
    <div className="space-y-3">
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
      {children}
    </div>
  );
}
