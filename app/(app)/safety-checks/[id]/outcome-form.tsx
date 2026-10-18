"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { recordSafetyCheckOutcome } from "../actions";

type Outcome = "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
type Arrangement = { kind: "booking" | "reservation"; id: string; label: string };

const OUTCOMES: { value: Outcome; label: string; hint: string }[] = [
  { value: "APPROVED", label: "Approve", hint: "The arrangements are safe as they are." },
  {
    value: "CHANGES_REQUESTED",
    label: "Request changes",
    hint: "The arrangements you pick are flagged for the Coordinator to revisit.",
  },
  {
    value: "REJECTED",
    label: "Reject",
    hint: "Every arrangement is flagged; the event stays in Planning.",
  },
];

/**
 * SCRUM-166 AC3 — record the outcome. Changes requested and Rejected need a
 * note, and Changes requested needs at least one picked arrangement. The
 * server enforces the same rules; the form only stops an incomplete send.
 */
export function OutcomeForm({
  checkId,
  arrangements,
}: {
  checkId: string;
  arrangements: Arrangement[];
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, startSave] = useTransition();
  const router = useRouter();

  const needsNote = outcome !== null && outcome !== "APPROVED";
  const ready =
    outcome !== null &&
    (!needsNote || note.trim() !== "") &&
    (outcome !== "CHANGES_REQUESTED" || picked.length > 0);

  function toggle(id: string) {
    setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function save() {
    if (!outcome) return;
    startSave(async () => {
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
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success("Outcome recorded. The Coordinator has been notified.");
      router.refresh();
    });
  }

  return (
    <Card data-testid="safety-check-outcome">
      <CardHeader className="bg-muted/30 px-4 py-3">
        <CardTitle className="text-sm font-semibold">Record the outcome</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 text-sm">
        <fieldset className="space-y-2">
          <legend className="mb-1 font-medium">Outcome</legend>
          {OUTCOMES.map((option) => (
            <label key={option.value} className="flex items-start gap-2">
              <input
                type="radio"
                name="safety-outcome"
                value={option.value}
                checked={outcome === option.value}
                onChange={() => setOutcome(option.value)}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {outcome === "CHANGES_REQUESTED" && (
          <fieldset className="space-y-2">
            <legend className="mb-1 font-medium">Which arrangements need changes?</legend>
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
        )}

        <div className="space-y-1">
          <label htmlFor="safety-note" className="font-medium">
            Note{needsNote ? " (required)" : " (optional)"}
          </label>
          <Textarea
            id="safety-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs to change, or anything the Coordinator should know"
          />
        </div>

        <Button onClick={save} disabled={!ready || saving}>
          {saving ? "Recording…" : "Record outcome"}
        </Button>
      </CardContent>
    </Card>
  );
}
