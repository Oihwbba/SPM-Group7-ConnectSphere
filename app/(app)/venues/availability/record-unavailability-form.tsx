"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Loader2, Wrench } from "lucide-react";

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
import { formatDateTime, sgWallTimeToUtcIso } from "@/lib/datetime";
import {
  UNAVAILABILITY_REASONS,
  UNAVAILABILITY_REASON_LABEL as REASON_LABEL,
} from "@/lib/schemas/unavailability";
import { recordUnavailability, type AffectedBookingView } from "./actions";

const emptyForm = { start: "", end: "", reason: "", note: "" };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * SCRUM-37 AC1, SCRUM-161 — Venue Staff record that the venue shown is
 * unavailable for a reason other than a booking. If the period overlaps
 * bookings, each one is listed for Venue Staff to confirm before anything is
 * saved (SCRUM-161 AC2); confirming saves the period and flags them. A clash
 * with unavailability already recorded is shown and nothing is saved. The
 * calendar redraws on success.
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
  const [affected, setAffected] = useState<AffectedBookingView[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const update = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // A changed period or reason affects other bookings; ask again.
    setAffected(null);
  };

  const fieldError = (key: string) =>
    fieldErrors[key]?.[0] && (
      <p className="text-xs text-destructive">{fieldErrors[key][0]}</p>
    );

  function save(confirmedBookingIds: string[]) {
    startTransition(async () => {
      const result = await recordUnavailability({
        venueId,
        startAt: sgWallTimeToUtcIso(form.start) ?? "",
        endAt: sgWallTimeToUtcIso(form.end) ?? "",
        reason: form.reason,
        note: form.note,
        confirmedBookingIds,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setRefusal(result.error);
        setAffected(null);
        return;
      }
      setFieldErrors({});
      setRefusal(null);
      const outcome = result.data;
      if (!outcome.recorded) {
        setAffected(outcome.affected);
        return;
      }
      toast.success(
        !outcome.created
          ? `Already recorded: ${venueName} is unavailable for that period.`
          : outcome.flagged > 0
            ? `Recorded: ${venueName} is unavailable for that period. ${plural(outcome.flagged, "booking")} flagged for their Coordinators.`
            : `Recorded: ${venueName} is unavailable for that period.`,
      );
      setForm(emptyForm);
      setAffected(null);
      setOpen(false);
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save([]);
  }

  function close() {
    setOpen(false);
    setRefusal(null);
    setAffected(null);
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
            Maintenance, equipment failure, renovation, a safety concern, or
            anything else that isn&apos;t a booking. Bookings it overlaps are
            shown before it is saved, and are then flagged for their
            Coordinators to arrange another venue; they are not cancelled.
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

        {affected && (
          <div
            role="alert"
            data-testid="affected-bookings"
            className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground"
          >
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                This period overlaps {plural(affected.length, "booking")}.
                Recording it flags each one Needs Reconsideration and tells its
                Coordinator to arrange another venue. Nothing is cancelled.
              </p>
            </div>
            <ul className="space-y-2">
              {affected.map((b) => (
                <li
                  key={b.bookingId}
                  data-testid="affected-booking"
                  className="rounded-md border border-warning/30 bg-card p-3 text-foreground"
                >
                  <p className="font-medium">{b.eventName}</p>
                  <p className="text-muted-foreground">
                    Coordinator: {b.coordinatorName ?? "Not assigned"} ·{" "}
                    {b.status} · {formatDateTime(b.startAt)} to{" "}
                    {formatDateTime(b.endAt)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAffected(null)}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={() => save(affected.map((b) => b.bookingId))}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Record and flag {plural(affected.length, "booking")}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateTimeField
              name="Start"
              value={form.start}
              onChange={(value) => update("start", value)}
              stepMinutes={15}
              error={fieldError("startAt")}
            />
            <DateTimeField
              name="End"
              value={form.end}
              openOn={form.start.split("T")[0]}
              onChange={(value) => update("end", value)}
              stepMinutes={15}
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
          {!affected && (
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Record unavailability
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
