"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleCheck, CircleX, Loader2, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  assessSuitability,
  suitabilityThatCounts,
  type SuitabilityJudgement,
  type SuitabilityNeeds,
  type SuitabilityVenue,
} from "@/lib/venue-suitability";
import { recordSuitabilityJudgement } from "../../venues/suitability-actions";

/**
 * SCRUM-40 — whether the chosen venue appears suitable for what this request
 * asks for, with every reason (AC1–AC6), and the assigned Coordinator's own
 * judgement beside it (AC8). Advisory: nothing here blocks submitting (AC9).
 */
export function SuitabilityPanel({
  eventId,
  venueId,
  venue,
  needs,
  judgement,
  canJudge,
}: {
  eventId: string;
  venueId: string;
  venue: SuitabilityVenue;
  needs: SuitabilityNeeds;
  judgement: SuitabilityJudgement | null;
  canJudge: boolean;
}) {
  const automatic = assessSuitability(venue, needs);
  const counts = suitabilityThatCounts(automatic, judgement);

  return (
    <div
      className="space-y-3 rounded-lg border p-4 text-sm sm:col-span-2"
      data-testid="suitability"
      data-suitable={automatic.suitable}
      data-counts={counts}
    >
      <div className="flex items-start gap-2">
        {automatic.suitable ? (
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        ) : (
          <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        )}
        <div className="space-y-1">
          <p className="font-medium" data-testid="suitability-result">
            {automatic.suitable ? "Suitable" : "Not suitable"}
          </p>
          {automatic.reasons.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-destructive">
              {automatic.reasons.map((reason) => (
                <li key={reason} data-testid="suitability-reason">
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {judgement && (
        <div
          className="flex items-start gap-2 border-t pt-3"
          data-testid="suitability-judgement"
        >
          <Scale className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="space-y-0.5">
            <p className="font-medium">
              Coordinator&apos;s judgement:{" "}
              {judgement.suitable ? "Suitable" : "Not suitable"}
            </p>
            <p>{judgement.note}</p>
            <p className="text-xs text-muted-foreground">
              {judgement.recordedByName}, {formatDateTime(judgement.recordedAt)}.
              This is the result that counts for this event.
            </p>
          </div>
        </div>
      )}

      {canJudge && (
        <JudgementForm
          key={`${eventId}|${venueId}`}
          eventId={eventId}
          venueId={venueId}
          current={judgement}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Advisory only: it doesn&apos;t stop you requesting this venue.
      </p>
    </div>
  );
}

function JudgementForm({
  eventId,
  venueId,
  current,
}: {
  eventId: string;
  venueId: string;
  current: SuitabilityJudgement | null;
}) {
  const [open, setOpen] = useState(false);
  const [suitable, setSuitable] = useState<boolean | null>(
    current?.suitable ?? null,
  );
  const [note, setNote] = useState(current?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Scale className="h-4 w-4" />
        {current ? "Change your judgement" : "Record your judgement"}
      </Button>
    );
  }

  function save() {
    startTransition(async () => {
      const result = await recordSuitabilityJudgement({
        eventId,
        venueId,
        suitable,
        note,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Your suitability judgement was recorded.");
      setOpen(false);
      setError(null);
      router.refresh();
    });
  }

  return (
    <fieldset className="space-y-3 border-t pt-3" data-testid="judgement-form">
      <legend className="sr-only">Your suitability judgement</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Judgement">
        {[
          { value: true, label: "Suitable" },
          { value: false, label: "Not suitable" },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={suitable === option.value}
            onClick={() => setSuitable(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              suitable === option.value
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="judgement-note">Note</Label>
        <Textarea
          id="judgement-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Ramp access is fine for our two wheelchair users"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save judgement
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </fieldset>
  );
}
