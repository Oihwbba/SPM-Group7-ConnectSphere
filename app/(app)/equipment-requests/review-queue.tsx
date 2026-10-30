"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PlayCircle, Repeat, X } from "lucide-react";
import { toast } from "sonner";

import { trailOf } from "@/components/equipment/request-history";
import { OperationalNotes } from "@/components/events/operational-notes";
import { RequestLines } from "@/components/equipment/request-lines";
import { RequestStatusBadge } from "@/components/equipment/request-status-badge";
import { OrganiserEquipmentAnswer } from "@/components/events/organiser-answers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppSelect } from "@/components/app/app-select";
import { AuditTrail } from "@/components/app/audit-trail";
import {
  ConfirmDialog,
  type ConfirmOutcome,
} from "@/components/app/confirm-dialog";
import { SubmittedDialog } from "@/components/app/submitted-dialog";
import {
  DECISION_BUTTON,
  DECISION_PANEL,
  DECISION_ROW,
} from "@/components/queues/decision-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QueuedEquipmentRequest } from "@/lib/equipment/request-queries";
import {
  EQUIPMENT_REQUEST_STATUS_LABEL,
  isOpenRequest,
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

/**
 * SCRUM-28, SCRUM-211 AC3 — a request's details, on the left of the opened
 * item: each line's type, quantity and technical requirements, how many are
 * free for the event, the requests competing for them (SCRUM-134 AC4), what
 * the Organiser asked for, the history, and the event's operational notes.
 */
export function ReviewDetails({
  request,
}: {
  request: QueuedEquipmentRequest;
}) {
  return (
    <div
      className="space-y-4"
      data-testid="review-request"
      data-status={request.status}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <RequestStatusBadge status={request.status} />
        Requested by {request.requestedBy.name ?? "a coordinator"} on{" "}
        {formatDateTime(request.createdAt)}
      </div>
      <RequestLines
        lines={request.lines}
        detail={(line) => (
          <>
            <LineAvailability line={line} />
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
      {/* SCRUM-28 AC5: the request's history. */}
      <section className="space-y-2" aria-label="History">
        <h3 className="text-sm font-semibold">
          History ({request.updates.length})
        </h3>
        <AuditTrail
          entries={trailOf(request.updates)}
          entryTestId="history-entry"
        />
      </section>
      {/* SCRUM-25 AC6: Technical Support add notes once there is a request. */}
      <OperationalNotes eventId={request.event.id} />
    </div>
  );
}

/**
 * SCRUM-28, SCRUM-211 AC3, AC4 — the decision, on the right of the opened
 * item. A request waiting for review is started first, as before (the
 * coordinator sees it is In Review). In review, the buttons come in the order
 * every queue uses: Approve, Suggest alternative, Reject. Reject asks first;
 * its note stays required. Approving or rejecting ends in a pop-up that leads
 * back to the list (`listHref`) or stays on this request, which then shows
 * its status with the buttons disabled; a refusal is shown here and the
 * request stays open.
 */
export function ReviewDecision({
  request,
  listHref,
}: {
  request: QueuedEquipmentRequest;
  listHref: string;
}) {
  // The pop-up after an approval or a rejection. The same component shows the
  // request once decided, so it outlives the refresh.
  const [outcome, setOutcome] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const noteId = `note-${request.id}`;
  const shortLines = request.lines.filter((line) => line.review?.shortfall);

  const decided = !isOpenRequest(request);

  // The reject dialog (SCRUM-207 AC5) awaits this. A refusal is shown on the
  // page, next to the note it concerns, so the dialog closes; only a request
  // that never reached the server keeps it open to try again.
  async function moveNow(
    toStatus: keyof typeof DONE_MESSAGE,
  ): Promise<ConfirmOutcome> {
    try {
      const result = await updateEquipmentRequestStatus({
        requestId: request.id,
        toStatus,
        note,
      });
      if (!result.ok) {
        setRejecting(false);
        setNoteError(result.fieldErrors?.note?.[0] ?? null);
        setRefusal(result.fieldErrors?.note ? null : result.error);
        toast.error(result.error);
        router.refresh();
        return;
      }
      setNote("");
      setNoteError(null);
      setRefusal(null);
      if (toStatus === "IN_REVIEW") toast.success(DONE_MESSAGE[toStatus]);
      else setOutcome(toStatus);
      // This request, as it now stands.
      router.refresh();
    } catch {
      toast.error(OFFLINE);
      return { ok: false, error: OFFLINE };
    }
  }

  const move = (toStatus: keyof typeof DONE_MESSAGE) =>
    startTransition(async () => {
      await moveNow(toStatus);
    });

  return (
    <div className={DECISION_PANEL} data-testid="review-decision">
      <h2 className="text-sm font-semibold">
        {decided ? "Decided" : "Decision"}
      </h2>
      {decided && (
        <p className="text-sm text-muted-foreground" data-testid="decided-note">
          {EQUIPMENT_REQUEST_STATUS_LABEL[request.status]}
          {request.decidedAt && ` on ${formatDateTime(request.decidedAt)}`}.
        </p>
      )}
      {refusal && (
        <p
          role="alert"
          className="text-sm text-destructive"
          data-testid="decision-refused"
        >
          {refusal}
        </p>
      )}
      {!decided && request.status === "PENDING_REVIEW" ? (
        <>
          <Button
            onClick={() => move("IN_REVIEW")}
            disabled={pending}
            className="w-full gap-2"
          >
            {pending ? <Loader2 className="animate-spin" /> : <PlayCircle />}
            Start review
          </Button>
          <p className="text-xs text-muted-foreground">
            The coordinator sees the request is In Review.
          </p>
        </>
      ) : (
        <>
          {!decided && (
            <div className="space-y-1">
              <Label htmlFor={noteId}>Note for the coordinator</Label>
              <Textarea
                id={noteId}
                rows={3}
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
            </div>
          )}
          <div className={DECISION_ROW}>
            <Button
              variant="outline"
              onClick={() => move("APPROVED")}
              disabled={pending || decided}
              className={DECISION_BUTTON.positive}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => setSuggesting(true)}
              disabled={pending || decided || shortLines.length === 0}
              title={
                shortLines.length === 0 ? "Every line is available." : undefined
              }
              className={DECISION_BUTTON.middle}
            >
              <Repeat />
              Suggest alternative
            </Button>
            <Button
              variant="outline"
              onClick={() => setRejecting(true)}
              disabled={pending || decided}
              className={DECISION_BUTTON.negative}
            >
              <X />
              Reject
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Reject this equipment request?"
        message={
          note.trim()
            ? `The coordinator is told why: “${note.trim()}”`
            : "A note for the coordinator is required: say why, so they can adjust the request."
        }
        confirmLabel="Reject request"
        pendingLabel="Rejecting…"
        destructive
        onConfirm={() => moveNow("REJECTED")}
      />

      <SubmittedDialog
        open={outcome !== null}
        title={outcome === "REJECTED" ? "Request rejected" : "Request approved"}
        onClose={() => setOutcome(null)}
        closeLabel="View this request"
        action={{
          label: "Back to equipment requests",
          onClick: () => router.push(listHref),
          prominent: true,
        }}
        testId="decision-done"
      >
        {outcome && DONE_MESSAGE[outcome]}
      </SubmittedDialog>

      <Dialog open={suggesting} onOpenChange={setSuggesting}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggest an alternative</DialogTitle>
            <DialogDescription>
              For each line that is short, choose equipment that could cover the
              whole quantity. The coordinator sees the suggestion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {shortLines.map((line) => (
              <LineSuggestion
                key={line.id}
                line={line}
                requestId={request.id}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
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
            &ldquo;{other.eventName}&rdquo;, submitted{" "}
            {formatDateTime(other.submittedAt)}: {other.quantity} requested,{" "}
            {other.reserved} reserved
          </li>
        ))}
      </ul>
    </div>
  );
}

/** SCRUM-28 AC 1 — how a line stands against what is free for the event. */
function LineAvailability({ line }: { line: QueuedLine }) {
  if (!line.review) return null;
  const { available, total, shortfall } = line.review;
  return shortfall ? (
    <p
      className="text-xs font-medium text-destructive"
      data-testid="line-availability"
      data-short="true"
    >
      Unavailable: only {available} of {total} free for this event, {shortfall}{" "}
      short.
    </p>
  ) : (
    <p
      className="text-xs text-success"
      data-testid="line-availability"
      data-short="false"
    >
      Available: {available} of {total} free for this event.
    </p>
  );
}

/**
 * SCRUM-28 AC 4 — for a short line, the alternatives that could cover the
 * whole quantity, and the suggestion sent to the coordinator.
 */
function LineSuggestion({
  line,
  requestId,
}: {
  line: QueuedLine;
  requestId: string;
}) {
  const [alternativeId, setAlternativeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const alternatives = line.review?.alternatives ?? [];
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
        router.refresh();
      } catch {
        toast.error(OFFLINE);
      }
    });

  if (alternatives.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No other equipment type has {line.quantity} free for this event, to
        replace {line.equipment.type}.
      </p>
    );
  }
  return (
    <div
      className="flex flex-wrap items-end gap-2"
      data-testid="line-suggestion"
    >
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
        <p id={`${selectId}-error`} className="w-full text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
