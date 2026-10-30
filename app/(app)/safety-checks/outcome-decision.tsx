"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ListChecks, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  DECISION_BUTTON,
  DECISION_PANEL,
  DECISION_ROW,
} from "@/components/queues/decision-button";
import { recordSafetyCheckOutcome } from "./actions";
import { ActionError } from "@/components/app/action-error";

type Outcome = "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
type Arrangement = {
  kind: "booking" | "reservation";
  id: string;
  label: string;
};

/**
 * SCRUM-166 AC3, SCRUM-211 AC3, AC4 — record the outcome, in the order every
 * queue uses: Approve, Request changes, Reject. Approve records at once, with
 * the optional note. Request changes asks for a note and at least one picked
 * arrangement; Reject asks for a note: both confirm first, since neither can
 * be undone. The server enforces the same rules; once recorded, the next
 * waiting check opens, and a refusal is shown here with nothing changed.
 */
export function OutcomeDecision({
  checkId,
  arrangements,
  nextHref,
}: {
  checkId: string;
  arrangements: Arrangement[];
  nextHref: string;
}) {
  // SCRUM-207 AC5: every outcome is asked about first, Approve included.
  const [asking, setAsking] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const router = useRouter();

  function toggle(id: string) {
    setPicked((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  // The confirmation dialogs (SCRUM-207 AC5) await this. A refusal stays in
  // the dialog until it is closed; then the page is read again.
  async function saveNow(outcome: Outcome) {
    const chosen = outcome === "CHANGES_REQUESTED" ? picked : [];
    const result = await recordSafetyCheckOutcome({
      checkId,
      outcome,
      note,
      bookingIds: arrangements
        .filter((a) => a.kind === "booking" && chosen.includes(a.id))
        .map((a) => a.id),
      reservationIds: arrangements
        .filter((a) => a.kind === "reservation" && chosen.includes(a.id))
        .map((a) => a.id),
    });
    if (!result.ok) {
      // Shown in the dialog, and beside the decision once it is closed,
      // when the page is read again.
      setRefusal(result.error);
      return result;
    }
    setAsking(null);
    toast.success("Outcome recorded. The Coordinator has been notified.");
    router.push(nextHref);
  }

  function closeUnlessOpen(open: boolean) {
    if (open) return;
    setAsking(null);
    if (refusal) router.refresh();
  }

  const noteField = (id: string, required: boolean) => (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        Note{required ? " (required)" : " (optional)"}
      </label>
      <Textarea
        id={id}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What needs to change, or anything the Coordinator should know"
      />
    </div>
  );

  return (
    <div className={DECISION_PANEL} data-testid="safety-check-outcome">
      <h2 className="text-sm font-semibold">Record the outcome</h2>
      <ActionError message={refusal} testId="decision-refused" />
      {noteField("safety-note", false)}
      <div className={DECISION_ROW}>
        <Button
          variant="outline"
          className={DECISION_BUTTON.positive}
          onClick={() => setAsking("APPROVED")}
        >
          <CheckCircle2 className="h-4 w-4" /> Approve
        </Button>
        <Button
          variant="outline"
          className={DECISION_BUTTON.middle}
          onClick={() => setAsking("CHANGES_REQUESTED")}
        >
          <ListChecks className="h-4 w-4" /> Request changes
        </Button>
        <Button
          variant="outline"
          className={DECISION_BUTTON.negative}
          onClick={() => setAsking("REJECTED")}
        >
          <XCircle className="h-4 w-4" /> Reject
        </Button>
      </div>

      <ConfirmDialog
        open={asking === "APPROVED"}
        onOpenChange={closeUnlessOpen}
        title="Approve this safety check?"
        message="The Coordinator is told, and can confirm the event once everything else is ready. The note above, if any, goes with it."
        confirmLabel="Approve"
        pendingLabel="Approving…"
        onConfirm={() => saveNow("APPROVED")}
      />

      <ConfirmDialog
        open={asking === "CHANGES_REQUESTED"}
        onOpenChange={closeUnlessOpen}
        title="Request changes"
        message="The arrangements you pick are flagged for the Coordinator to revisit."
        confirmLabel="Request changes"
        pendingLabel="Requesting changes…"
        ready={note.trim() !== "" && picked.length > 0}
        onConfirm={() => saveNow("CHANGES_REQUESTED")}
      >
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium">
            Which arrangements need changes?
          </legend>
          {arrangements.map((a) => (
            <label key={a.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={picked.includes(a.id)}
                onChange={() => toggle(a.id)}
                className="accent-primary"
              />
              {a.label}
            </label>
          ))}
        </fieldset>
        {noteField("safety-changes-note", true)}
      </ConfirmDialog>

      <ConfirmDialog
        open={asking === "REJECTED"}
        onOpenChange={closeUnlessOpen}
        title="Reject this safety check?"
        message="Every arrangement is flagged; the event stays in Planning."
        confirmLabel="Reject"
        pendingLabel="Rejecting…"
        destructive
        ready={note.trim() !== ""}
        onConfirm={() => saveNow("REJECTED")}
      >
        {noteField("safety-reject-note", true)}
      </ConfirmDialog>
    </div>
  );
}
