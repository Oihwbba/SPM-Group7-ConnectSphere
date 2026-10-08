"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Loader2, Wrench } from "lucide-react";

import { DateTimeField } from "@/components/app/date-time-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { sgWallTimeToUtcIso } from "@/lib/datetime";
import {
  UNAVAILABILITY_REASONS,
  UNAVAILABILITY_REASON_LABEL as REASON_LABEL,
} from "@/lib/schemas/unavailability";
import { recordUnavailability } from "./actions";

const emptyForm = { start: "", end: "", reason: "", note: "" };

/**
 * SCRUM-37 AC2 — Venue Staff record that the venue shown is unavailable for a
 * reason other than a booking. A clash with an approved booking is shown
 * here and nothing is saved (AC4); the calendar redraws on success.
 */
export function RecordUnavailabilityForm({
  venueId,
  venueName,
}: {
  venueId: string;
  venueName: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const update = (key: keyof typeof emptyForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fieldError = (key: string) =>
    fieldErrors[key]?.[0] && (
      <p className="text-xs text-destructive">{fieldErrors[key][0]}</p>
    );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await recordUnavailability({
        venueId,
        startAt: sgWallTimeToUtcIso(form.start) ?? "",
        endAt: sgWallTimeToUtcIso(form.end) ?? "",
        reason: form.reason,
        note: form.note,
      });
      if (result.ok) {
        toast.success(`Recorded: ${venueName} is unavailable for that period.`);
        setForm(emptyForm);
        setFieldErrors({});
        setRefusal(null);
        setOpen(false);
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setRefusal(result.error);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Wrench className="h-4 w-4" /> Record unavailability
      </Button>
    );
  }

  return (
    // Opened, the form takes a full row below the week navigation.
    <Card className="w-full basis-full">
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="text-base font-semibold">
            Record unavailability for {venueName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Maintenance, a closure, or anything else that isn&apos;t a booking.
            A period that clashes with an approved booking is not saved.
          </p>
        </div>

        {refusal && (
          <div
            role="alert"
            data-testid="unavailability-outcome"
            className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{refusal}</p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateTimeField
              name="Start"
              value={form.start}
              onChange={(value) => update("start", value)}
              error={fieldError("startAt")}
            />
            <DateTimeField
              name="End"
              value={form.end}
              openOn={form.start.split("T")[0]}
              onChange={(value) => update("end", value)}
              error={fieldError("endAt")}
            />
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Select
                value={form.reason}
                onValueChange={(value) => update("reason", value)}
              >
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {UNAVAILABILITY_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {REASON_LABEL[reason]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("reason")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                value={form.note}
                onChange={(e) => update("note", e.target.value)}
                placeholder="e.g. Annual air-conditioning service"
                className="min-h-10"
              />
              {fieldError("note")}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setRefusal(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Record unavailability
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
