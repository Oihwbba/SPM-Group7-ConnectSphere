"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ListChecks, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DECISION_BUTTON } from "@/components/queues/decision-button";
import { recordSafetyCheckOutcome } from "./actions";

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
  const [asking, setAsking] = useState<Exclude<Outcome, "APPROVED"> | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const router = useRouter();

  function toggle(id: string) {
    setPicked((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  // The confirmation dialogs (SCRUM-207 AC5) await this. A refusal is shown
  // here, beside the decision, so the dialog closes either way.
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
    setAsking(null);
    if (!result.ok) {
      setRefusal(result.error);
      toast.error(result.error);
      router.refresh();
      return;
    }
    toast.success("Outcome recorded. The Coordinator has been notified.");
    router.push(nextHref);
  }

  function save(outcome: Outcome) {
    startSave(() => saveNow(outcome));
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
    <div
      className="space-y-3 rounded-xl border bg-card p-4"
      data-testid="safety-check-outcome"
    >
      <h2 className="text-sm font-semibold">Record the outcome</h2>
      {refusal && (
        <p
          role="alert"
          className="text-sm text-destructive"
          data-testid="decision-refused"
        >
          {refusal}
        </p>
      )}
      {noteField("safety-note", false)}
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          disabled={saving}
          className={DECISION_BUTTON.positive}
          onClick={() => save("APPROVED")}
        >
          <CheckCircle2 className="h-4 w-4" /> Approve
        </Button>
        <Button
          variant="outline"
          disabled={saving}
          className={DECISION_BUTTON.middle}
          onClick={() => setAsking("CHANGES_REQUESTED")}
        >
          <ListChecks className="h-4 w-4" /> Request changes
        </Button>
        <Button
          variant="outline"
          disabled={saving}
          className={DECISION_BUTTON.negative}
          onClick={() => setAsking("REJECTED")}
        >
          <XCircle className="h-4 w-4" /> Reject
        </Button>
      </div>

      <ConfirmDialog
        open={asking === "CHANGES_REQUESTED"}
        onOpenChange={(open) => !open && setAsking(null)}
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
        onOpenChange={(open) => !open && setAsking(null)}
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
