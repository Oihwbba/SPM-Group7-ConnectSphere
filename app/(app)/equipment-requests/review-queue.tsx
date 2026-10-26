"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  Check,
  ClipboardCheck,
  Eye,
  Loader2,
  PlayCircle,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { trailOf } from "@/components/equipment/request-history";
import { OperationalNotes } from "@/components/events/operational-notes";
import { RequestLines } from "@/components/equipment/request-lines";
import { RequestStatusBadge } from "@/components/equipment/request-status-badge";
import { OrganiserEquipmentAnswer } from "@/components/events/organiser-answers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppSelect } from "@/components/app/app-select";
import { AuditTrail } from "@/components/app/audit-trail";
import { Tabs } from "@/components/app/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QueuedEquipmentRequest } from "@/lib/equipment/request-queries";
import {
  EQUIPMENT_REQUEST_STATUS_LABEL,
  OPEN_REQUEST_STATUSES,
  formatEventPeriod,
} from "@/lib/equipment/requests";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  suggestAlternativeEquipment,
  updateEquipmentRequestStatus,
} from "./actions";

type QueuedLine = QueuedEquipmentRequest["lines"][number];

const OFFLINE =
  "Couldn't reach the server. Check your connection and try again.";

const DONE_MESSAGE = {
  IN_REVIEW: "Review started. The coordinator has been notified.",
  APPROVED: "Request approved. The coordinator has been notified.",
  REJECTED: "Request rejected. The coordinator has been notified.",
} as const;

const isOpen = (request: QueuedEquipmentRequest) =>
  (OPEN_REQUEST_STATUSES as readonly string[]).includes(request.status);

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash;

/**
 * SCRUM-28 — Technical Support's queue. Requests waiting for review come
 * first, oldest first, so nothing is left behind; decided ones are one tab
 * away, newest decision first, for their history. Shared page conventions:
 * a table searched by event and filtered by status, whose eye opens the
 * request's details and history.
 */
export function ReviewQueue({
  requests,
}: {
  requests: QueuedEquipmentRequest[];
}) {
  // A link to one request (the reserve card's "View request", SCRUM-155)
  // opens the tab it is on, until the user picks a tab, brings it into view
  // and opens it.
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => "");
  const linkedId = hash.match(/^#request-(.+)$/)?.[1];
  const linked = requests.find((request) => request.id === linkedId);
  const [picked, setTab] = useState<"open" | "decided" | null>(null);
  const tab = picked ?? (linked && !isOpen(linked) ? "decided" : "open");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewingId, setViewingId] = useState<string | null>(null);
  // The linked request opens until its pop-up is closed.
  const [closedLink, setClosedLink] = useState<string | null>(null);
  const openId =
    viewingId ?? (linked && linked.id !== closedLink ? linked.id : null);
  // Read from the list, so the pop-up follows a decision.
  const viewing = requests.find((request) => request.id === openId) ?? null;

  useEffect(() => {
    if (!linked) return;
    document
      .getElementById(`request-${linked.id}`)
      ?.scrollIntoView({ block: "start" });
  }, [linked, tab]);

  const open = requests.filter(isOpen);
  const decided = requests
    .filter((request) => !isOpen(request))
    .sort(
      (a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0),
    );
  const inTab = tab === "open" ? open : decided;
  const q = query.trim().toLowerCase();
  const shown = inTab.filter(
    (request) =>
      (statusFilter === "ALL" || request.status === statusFilter) &&
      (!q || request.event.name.toLowerCase().includes(q)),
  );
  // The statuses this tab can hold.
  const statuses = Object.entries(EQUIPMENT_REQUEST_STATUS_LABEL).filter(
    ([value]) =>
      (OPEN_REQUEST_STATUSES as readonly string[]).includes(value) ===
      (tab === "open"),
  );

  function pickTab(next: "open" | "decided") {
    setTab(next);
    setStatusFilter("ALL");
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Equipment requests
        </h1>
        <p className="text-sm text-muted-foreground">
          Review what coordinators need, suggest alternatives, and keep them
          updated.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b pb-3"
        role="group"
        aria-label="Show requests"
      >
        <Button
          size="sm"
          variant={tab === "open" ? "secondary" : "ghost"}
          aria-pressed={tab === "open"}
          onClick={() => pickTab("open")}
        >
          Waiting for review ({open.length})
        </Button>
        <Button
          size="sm"
          variant={tab === "decided" ? "secondary" : "ghost"}
          aria-pressed={tab === "decided"}
          onClick={() => pickTab("decided")}
        >
          Decided ({decided.length})
        </Button>
      </div>

      {inTab.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardCheck className="h-6 w-6" />
            </span>
            <p className="text-base font-medium">
              {tab === "open"
                ? "No requests waiting for review"
                : "No decided requests yet"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {tab === "open"
                ? "New equipment requests from coordinators appear here."
                : "Requests you approve or reject move here, with their history."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
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
                ...statuses.map(([value, label]) => ({ value, label })),
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
                <Table aria-label="Equipment requests">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Requested by</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        {tab === "open" ? "Submitted" : "Decided"}
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((request) => (
                      <TableRow
                        key={request.id}
                        id={`request-${request.id}`}
                        data-testid="review-row"
                        data-status={request.status}
                        className={cn(
                          "scroll-mt-24",
                          request.id === linkedId && "bg-primary/5",
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
                          {request.requestedBy.name ?? "A coordinator"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {request.lines.length}{" "}
                          {request.lines.length === 1 ? "item" : "items"}
                        </TableCell>
                        <TableCell>
                          <RequestStatusBadge status={request.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(
                            tab === "open"
                              ? request.createdAt
                              : (request.decidedAt ?? request.createdAt),
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={`View details of ${request.event.name}`}
                            title="View details"
                            data-testid="view-review-button"
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
        onOpenChange={(open) => {
          if (open) return;
          setViewingId(null);
          setClosedLink(linked?.id ?? null);
        }}
      >
        {viewing && (
          <DialogContent
            className="max-h-[90vh] max-w-2xl overflow-y-auto"
            data-testid="review-request"
            data-status={viewing.status}
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
                  content: <ReviewDetails request={viewing} />,
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
    </div>
  );
}

/** A request's lines, what the Organiser asked for, and the review itself. */
function ReviewDetails({ request }: { request: QueuedEquipmentRequest }) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inReview = request.status === "IN_REVIEW";
  const noteId = `note-${request.id}`;

  const move = (toStatus: keyof typeof DONE_MESSAGE) =>
    startTransition(async () => {
      try {
        const result = await updateEquipmentRequestStatus({
          requestId: request.id,
          toStatus,
          note,
        });
        if (!result.ok) {
          setNoteError(result.fieldErrors?.note?.[0] ?? null);
          toast.error(result.error);
          return;
        }
        setNote("");
        setNoteError(null);
        toast.success(DONE_MESSAGE[toStatus]);
      } catch {
        toast.error(OFFLINE);
      }
    });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Requested by {request.requestedBy.name ?? "a coordinator"} on{" "}
        {formatDateTime(request.createdAt)}
      </p>
      <RequestLines
        lines={request.lines}
        detail={(line) => (
          <>
            <LineAvailability
              line={line}
              requestId={request.id}
              inReview={inReview}
            />
            <CompetingRequests line={line} />
          </>
        )}
      />
      {request.notes && (
        <p className="whitespace-pre-line text-sm">
          <span className="font-medium">Notes: </span>
          {request.notes}
        </p>
      )}
      {/* SCRUM-170 AC3: what the Organiser asked for, beside the lines. */}
      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <p className="text-xs font-medium">What the Organiser asked for</p>
        <OrganiserEquipmentAnswer
          equipmentRequirements={request.event.equipmentRequirements}
        />
      </div>

      {request.status === "PENDING_REVIEW" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => move("IN_REVIEW")}
            disabled={pending}
            className="gap-2"
          >
            {pending ? <Loader2 className="animate-spin" /> : <PlayCircle />}
            Start review
          </Button>
          <p className="text-xs text-muted-foreground">
            The coordinator sees the request is In Review.
          </p>
        </div>
      )}

      {inReview && (
        <div className="space-y-2 rounded-md border p-3">
          <Label htmlFor={noteId}>Note for the coordinator</Label>
          <Textarea
            id={noteId}
            rows={2}
            value={note}
            placeholder="Required when rejecting: say why, so they can adjust the request."
            aria-invalid={Boolean(noteError)}
            aria-describedby={noteError ? `${noteId}-error` : undefined}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteError(null);
            }}
          />
          {noteError && (
            <p id={`${noteId}-error`} className="text-xs text-destructive">
              {noteError}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={() => move("APPROVED")}
              disabled={pending}
              className="gap-2"
            >
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => move("REJECTED")}
              disabled={pending}
              className="gap-2"
            >
              <X />
              Reject
            </Button>
          </div>
        </div>
      )}

      {request.decidedAt && !isOpen(request) && (
        <p className="text-xs text-muted-foreground">
          Decided {formatDateTime(request.decidedAt)}
        </p>
      )}

      {/* SCRUM-25 AC6: Technical Support add notes once there is a request. */}
      <OperationalNotes eventId={request.event.id} />
    </div>
  );
}

/**
 * SCRUM-134 AC4 — the other open requests for the line's type whose events
 * overlap, earliest submitted first, with what is reserved for each. Stock is
 * reserved for them in that order (AC5).
 */
function CompetingRequests({ line }: { line: QueuedLine }) {
  if (line.competing.length === 0) return null;
  return (
    <div className="mt-1 space-y-1 text-xs" data-testid="competing-requests">
      <p className="font-medium text-muted-foreground">
        Also wanted for overlapping events, earliest first:
      </p>
      <ul className="space-y-0.5">
        {line.competing.map((other) => (
          <li key={other.requestId}>
            &ldquo;{other.eventName}&rdquo;, submitted {formatDateTime(other.submittedAt)}:{" "}
            {other.quantity} requested, {other.reserved} reserved
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * SCRUM-28 AC 1 & 4 — how a line stands against what is free for the event,
 * and, when it is short and the request is in review, the alternatives that
 * could cover the whole quantity.
 */
function LineAvailability({
  line,
  requestId,
  inReview,
}: {
  line: QueuedLine;
  requestId: string;
  inReview: boolean;
}) {
  const [alternativeId, setAlternativeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!line.review) return null;
  const { available, total, shortfall, alternatives } = line.review;

  if (!shortfall) {
    return (
      <p
        className="text-xs text-success"
        data-testid="line-availability"
        data-short="false"
      >
        Available: {available} of {total} free for this event.
      </p>
    );
  }

  const selectId = `alternative-${line.id}`;
  const suggest = () =>
    startTransition(async () => {
      try {
        const result = await suggestAlternativeEquipment({
          requestId,
          lineId: line.id,
          alternativeId,
        });
        if (!result.ok) {
          setError(result.fieldErrors?.alternativeId?.[0] ?? null);
          toast.error(result.error);
          return;
        }
        const type = alternatives.find(
          (item) => item.id === alternativeId,
        )?.type;
        toast.success(`${type} suggested to the coordinator.`);
        setAlternativeId("");
        setError(null);
      } catch {
        toast.error(OFFLINE);
      }
    });

  return (
    <div
      className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3"
      data-testid="line-availability"
      data-short="true"
    >
      <p className="text-xs font-medium text-destructive">
        Unavailable: only {available} of {total} free for this event,{" "}
        {shortfall} short.
      </p>
      {!inReview ? (
        <p className="text-xs text-muted-foreground">
          Start the review to suggest an alternative.
        </p>
      ) : alternatives.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No other equipment type has {line.quantity} free for this event.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor={selectId} className="text-xs">
              {line.suggestedAlternative
                ? `Change the suggestion for ${line.equipment.type}`
                : `Suggest instead of ${line.equipment.type}`}
            </Label>
            <AppSelect
              id={selectId}
              className="h-9"
              value={alternativeId}
              placeholder="Choose equipment"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${selectId}-error` : undefined}
              onValueChange={(value) => {
                setAlternativeId(value);
                setError(null);
              }}
              options={alternatives.map((item) => ({
                value: item.id,
                label: `${item.type} (${item.available} free)`,
              }))}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={suggest}
            disabled={pending || !alternativeId}
            className="gap-2"
          >
            {pending && <Loader2 className="animate-spin" />}
            Suggest
          </Button>
          {error && (
            <p
              id={`${selectId}-error`}
              className="w-full text-xs text-destructive"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
