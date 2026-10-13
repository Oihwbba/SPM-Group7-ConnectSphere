"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Check, ClipboardCheck, Loader2, PlayCircle, X } from "lucide-react";
import { toast } from "sonner";

import { RequestHistory } from "@/components/equipment/request-history";
import { RequestLines } from "@/components/equipment/request-lines";
import { RequestStatusBadge } from "@/components/equipment/request-status-badge";
import { OrganiserEquipmentAnswer } from "@/components/events/organiser-answers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QueuedEquipmentRequest } from "@/lib/equipment/request-queries";
import {
  OPEN_REQUEST_STATUSES,
  formatEventPeriod,
} from "@/lib/equipment/requests";
import { formatDateTime } from "@/lib/datetime";
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

/**
 * SCRUM-28 — Technical Support's queue. Requests waiting for review come
 * first, oldest first, so nothing is left behind; decided ones are one tab
 * away, newest decision first, for their history.
 */
function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash;

export function ReviewQueue({
  requests,
}: {
  requests: QueuedEquipmentRequest[];
}) {
  // A link to one request (the reserve card's "View request", SCRUM-155)
  // opens the tab it is on, until the user picks a tab, and brings it into
  // view.
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => "");
  const linkedId = hash.match(/^#request-(.+)$/)?.[1];
  const linked = requests.find((request) => request.id === linkedId);
  const [picked, setTab] = useState<"open" | "decided" | null>(null);
  const tab = picked ?? (linked && !isOpen(linked) ? "decided" : "open");

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
  const shown = tab === "open" ? open : decided;

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
          onClick={() => setTab("open")}
        >
          Waiting for review ({open.length})
        </Button>
        <Button
          size="sm"
          variant={tab === "decided" ? "secondary" : "ghost"}
          aria-pressed={tab === "decided"}
          onClick={() => setTab("decided")}
        >
          Decided ({decided.length})
        </Button>
      </div>

      {shown.length === 0 ? (
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
        <ul className="space-y-4" aria-label="Equipment requests">
          {shown.map((request) => (
            <li key={request.id}>
              <ReviewCard request={request} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({ request }: { request: QueuedEquipmentRequest }) {
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
    <Card
      id={`request-${request.id}`}
      className="scroll-mt-24"
      data-testid="review-request"
      data-status={request.status}
    >
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{request.event.name}</CardTitle>
          <CardDescription>{formatEventPeriod(request.event)}</CardDescription>
          <p className="text-xs text-muted-foreground">
            Requested by {request.requestedBy.name ?? "a coordinator"} on{" "}
            {formatDateTime(request.createdAt)}
          </p>
        </div>
        <RequestStatusBadge status={request.status} />
      </CardHeader>

      <CardContent className="space-y-4">
        <RequestLines
          lines={request.lines}
          detail={(line) => (
            <LineAvailability
              line={line}
              requestId={request.id}
              inReview={inReview}
            />
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

        <RequestHistory entries={request.updates} />
      </CardContent>
    </Card>
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
            <select
              id={selectId}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={alternativeId}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${selectId}-error` : undefined}
              onChange={(e) => {
                setAlternativeId(e.target.value);
                setError(null);
              }}
            >
              <option value="">Choose equipment</option>
              {alternatives.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.type} ({item.available} free)
                </option>
              ))}
            </select>
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
