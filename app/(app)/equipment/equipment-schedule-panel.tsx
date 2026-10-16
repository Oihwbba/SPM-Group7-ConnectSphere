"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { formatDateTime } from "@/lib/datetime";
import {
  requestedPeriodTone,
  splitByPeriod,
  type AvailabilityVerdict,
  type ScheduleEntry,
} from "@/lib/equipment/availability";

import {
  getEquipmentSchedule,
  reportUnprovidableReservation,
  type EquipmentSchedule,
} from "./actions";

/**
 * SCRUM-30 — what an equipment item is already committed to, in two places on
 * the page: the commitments during the requested period, straight under the
 * selected item's availability, and every other commitment below the rest of
 * the equipment. One fetch feeds both, through `useEquipmentSchedule`.
 */

type Period = { startAt: Date; endAt: Date };

export interface ScheduleState {
  schedule: EquipmentSchedule | null;
  error: string | null;
  loading: boolean;
}

/**
 * Fetches the selected item's schedule, and again whenever `refresh` changes
 * — the page bumps it after a reservation, so the new commitment appears
 * without a reload. A response for an item or refresh that is no longer
 * current is ignored rather than shown.
 */
export function useEquipmentSchedule(
  equipmentId: string | null,
  refresh: number,
): ScheduleState {
  const key = equipmentId ? `${equipmentId}:${refresh}` : null;
  const [loaded, setLoaded] = useState<{
    key: string;
    schedule: EquipmentSchedule | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!equipmentId) return;
    const thisKey = `${equipmentId}:${refresh}`;
    let current = true;

    // getEquipmentSchedule rethrows anything that is not a permission
    // failure. Caught here so a transient database failure shows as the
    // panel's own error line, not as an error boundary over the whole page.
    (async () => {
      try {
        const result = await getEquipmentSchedule({
          equipmentId,
          from: new Date().toISOString(),
        });
        if (!current) return;
        setLoaded(
          result.ok
            ? { key: thisKey, schedule: result.data, error: null }
            : { key: thisKey, schedule: null, error: result.error },
        );
      } catch {
        if (current) {
          setLoaded({
            key: thisKey,
            schedule: null,
            error: "Couldn't load the schedule — try again.",
          });
        }
      }
    })();

    return () => {
      current = false;
    };
  }, [equipmentId, refresh]);

  const fresh = loaded && loaded.key === key ? loaded : null;
  return {
    schedule: fresh?.schedule ?? null,
    error: fresh?.error ?? null,
    loading: key !== null && fresh === null,
  };
}

const REASON_LABEL: Record<string, string> = {
  MAINTENANCE: "Under maintenance",
  DAMAGED: "Damaged",
  CLOSURE: "Unavailable (closure)",
  OTHER: "Unavailable",
};

type Tone = "amber" | "red" | "neutral";

const ROW_TONE: Record<Tone, string> = {
  amber: "border-warning/30 bg-warning/15",
  red: "border-destructive/50 bg-destructive/5",
  neutral: "bg-muted/20",
};

/**
 * SCRUM-32 — Technical Support report that a reservation can no longer be
 * provided, with the reason (AC1, AC2). It stays reserved until the event's
 * Coordinator decides (AC4); this only flags it.
 */
function ReportReservation({
  reservationId,
  onReported,
}: {
  reservationId: string;
  onReported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fieldId = `report-reason-${reservationId}`;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => setOpen(true)}
      >
        Can&apos;t provide this
      </Button>
    );
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result = await reportUnprovidableReservation({ reservationId, reason });
      if (!result.ok) {
        setError(result.fieldErrors?.reason?.[0] ?? result.error);
        return;
      }
      toast.success("Reported. The event's Coordinator has been told.");
      setOpen(false);
      setReason("");
      onReported();
    } catch {
      setError("The report couldn't be sent. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 space-y-2" data-testid="report-reservation">
      <Label htmlFor={fieldId} className="text-xs">
        Why can&apos;t it be provided?
      </Label>
      <Textarea
        id={fieldId}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        rows={2}
        maxLength={500}
      />
      <FieldError id={`${fieldId}-error`} messages={error ? [error] : undefined} />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={pending || reason.trim() === ""}
        >
          {pending ? "Reporting…" : "Report"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function CommitmentRow({
  entry,
  tone,
  onReported,
}: {
  entry: ScheduleEntry;
  tone: Tone;
  onReported?: () => void;
}) {
  return (
    <li
      data-testid="schedule-entry"
      data-tone={tone}
      className={`rounded-xl border p-3 text-xs ${ROW_TONE[tone]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-foreground">
          {entry.kind === "reservation" ? (
            entry.eventName
          ) : (
            <span className="flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              {REASON_LABEL[entry.reason ?? "OTHER"]}
            </span>
          )}
        </span>
        <span className="text-muted-foreground">{entry.quantity} unit(s)</span>
      </div>
      <p className="mt-1 text-muted-foreground">
        {formatDateTime(entry.startAt)} → {formatDateTime(entry.endAt)}
      </p>
      {entry.note && <p className="mt-1 text-muted-foreground italic">{entry.note}</p>}
      {entry.kind === "reservation" &&
        (entry.needsReconsideration ? (
          <p
            className="mt-2 flex items-center gap-1.5 font-medium text-warning-foreground"
            data-testid="reported-reservation"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Reported as not providable — waiting for the event&apos;s Coordinator to decide.
          </p>
        ) : (
          onReported && <ReportReservation reservationId={entry.id} onReported={onReported} />
        ))}
    </li>
  );
}

function SectionHeading({ title, equipmentType }: { title: string; equipmentType: string }) {
  return (
    <div className="space-y-0.5">
      <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {title}
      </h4>
      <p className="text-[11px] text-muted-foreground">{equipmentType}</p>
    </div>
  );
}

/**
 * SCRUM-30 — commitments that share time with the requested period, which are
 * exactly the ones the period's availability is computed from. Amber while the
 * requested quantity still fits; red, with the shortfall, once it does not.
 */
export function RequestedPeriodCommitments({
  state,
  equipmentType,
  totalQuantity,
  period,
  verdict,
  onReported,
}: {
  state: ScheduleState;
  equipmentType: string;
  totalQuantity: number;
  period: Period | null;
  verdict: AvailabilityVerdict | null;
  /** SCRUM-32: given only to those who may report a reservation. */
  onReported?: () => void;
}) {
  // `aria-live` rather than `role="status"`: the reservation panel above owns
  // the page's status role, and a second one would make "the status message"
  // ambiguous to a screen reader and to a test.
  if (state.loading) {
    return (
      <p
        className="text-xs text-muted-foreground"
        aria-live="polite"
        data-testid="schedule-loading"
      >
        Loading the schedule for {equipmentType}…
      </p>
    );
  }

  if (state.error) {
    return (
      <p className="text-xs text-destructive" role="alert" data-testid="schedule-error">
        {state.error}
      </p>
    );
  }

  if (!state.schedule) return null;

  const { during } = splitByPeriod(state.schedule.entries, period);
  const tone = requestedPeriodTone(verdict);

  return (
    <section className="space-y-3" data-testid="commitments-during">
      <SectionHeading title="Commitments during requested period" equipmentType={equipmentType} />

      {!period ? (
        <p
          className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground"
          data-testid="during-no-period"
        >
          Choose a start and end above to see what is committed during that period.
        </p>
      ) : during.length === 0 ? (
        <p
          className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-xs text-muted-foreground"
          data-testid="during-fully-available"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          Nothing is committed during this period — all {totalQuantity} unit(s) are free.
        </p>
      ) : (
        <>
          <p
            data-testid="during-summary"
            data-tone={tone}
            className={`flex items-center gap-1.5 text-xs font-medium ${
              tone === "red" ? "text-destructive" : "text-warning-foreground"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {!verdict
              ? "These commitments reduce what is free during this period."
              : verdict.sufficient
                ? `These commitments leave ${verdict.available} of ${totalQuantity} unit(s) free — your request for ${verdict.requested} fits.`
                : `Hard conflict — ${verdict.requested} requested but only ${verdict.available} of ${totalQuantity} unit(s) are free for this period: ${verdict.shortfall} short.`}
          </p>
          <ul className="space-y-2">
            {during.map((entry) => (
              <CommitmentRow key={entry.id} entry={entry} tone={tone} onReported={onReported} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * SCRUM-30 — every commitment that does not share time with the requested
 * period, including ones that only touch it at an endpoint. They do not reduce
 * what is free for that period, so they are shown neutrally, even when they
 * overlap one another.
 */
export function OtherCommitments({
  state,
  equipmentType,
  period,
  onReported,
}: {
  state: ScheduleState;
  equipmentType: string;
  period: Period | null;
  /** SCRUM-32: given only to those who may report a reservation. */
  onReported?: () => void;
}) {
  // Loading and errors are shown once, in the requested-period section.
  if (!state.schedule) return null;

  const { other } = splitByPeriod(state.schedule.entries, period);

  return (
    <section className="space-y-3" data-testid="commitments-other">
      <SectionHeading title="Other commitments" equipmentType={equipmentType} />

      {state.schedule.fullyAvailable ? (
        <p
          className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-xs text-muted-foreground"
          data-testid="schedule-fully-available"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          All {state.schedule.totalQuantity} unit(s) are free — nothing is reserved
          or out of service from now on.
        </p>
      ) : other.length === 0 ? (
        <p
          className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground"
          data-testid="other-empty"
        >
          Every current commitment falls within the requested period.
        </p>
      ) : (
        <ul className="space-y-2">
          {other.map((entry) => (
            <CommitmentRow key={entry.id} entry={entry} tone="neutral" onReported={onReported} />
          ))}
        </ul>
      )}
    </section>
  );
}
