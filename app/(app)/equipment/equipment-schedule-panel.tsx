"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";

import { getEquipmentSchedule, type EquipmentSchedule } from "./actions";

/**
 * SCRUM-30 — what an equipment item is already committed to.
 *
 * Shows every current and future reservation and every period the item is out
 * of the pool, marks the ones that share time, and says so plainly when
 * nothing is committed rather than rendering an empty table.
 */
export function EquipmentSchedulePanel({
  equipmentId,
  equipmentType,
}: {
  equipmentId: string;
  equipmentType: string;
}) {
  const [schedule, setSchedule] = useState<EquipmentSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The caller keys this component by equipment id, so selecting another type
  // remounts it with empty state. That keeps the effect to fetching only.
  useEffect(() => {
    let current = true;

    startTransition(async () => {
      const result = await getEquipmentSchedule({
        equipmentId,
        from: new Date().toISOString(),
      });
      if (!current) return;
      if (result.ok) setSchedule(result.data);
      else setError(result.error);
    });

    return () => {
      current = false;
    };
  }, [equipmentId]);

  if (isPending && !schedule) {
    return (
      <p className="text-xs text-muted-foreground" role="status">
        Loading the schedule for {equipmentType}…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (!schedule) return null;

  const conflicts = schedule.entries.filter((entry) => entry.hasConflict).length;

  return (
    <section className="space-y-3" data-testid="equipment-schedule">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          Commitments for {schedule.type}
        </h4>
        {conflicts > 0 && (
          <Badge variant="destructive" data-testid="schedule-conflict-count">
            {conflicts} overlapping
          </Badge>
        )}
      </div>

      {schedule.fullyAvailable ? (
        <p
          className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-xs text-muted-foreground"
          data-testid="schedule-fully-available"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          All {schedule.totalQuantity} unit(s) are free — nothing is reserved or
          out of service from now on.
        </p>
      ) : (
        <ul className="space-y-2">
          {schedule.entries.map((entry) => (
            <li
              key={entry.id}
              data-testid="schedule-entry"
              data-conflict={entry.hasConflict ? "true" : "false"}
              className={`rounded-xl border p-3 text-xs ${
                entry.hasConflict
                  ? "border-destructive/50 bg-destructive/5"
                  : "bg-muted/20"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-foreground">
                  {entry.kind === "reservation" ? (
                    (entry.eventName ?? "Reserved")
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5" />
                      {REASON_LABEL[entry.reason ?? "OTHER"] ?? entry.reason}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {entry.quantity} unit(s)
                </span>
              </div>

              <p className="mt-1 text-muted-foreground">
                {formatDateTime(entry.startAt.toISOString())} →{" "}
                {formatDateTime(entry.endAt.toISOString())}
              </p>

              {entry.note && (
                <p className="mt-1 text-muted-foreground italic">{entry.note}</p>
              )}

              {entry.hasConflict && (
                <p className="mt-1.5 flex items-center gap-1.5 font-medium text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {entry.overCommitted
                    ? `Hard conflict — ${entry.committedDuringEntry} unit(s) committed of ${schedule.totalQuantity}.`
                    : `Overlaps ${entry.conflictsWith.length} other commitment(s); ${entry.committedDuringEntry} of ${schedule.totalQuantity} unit(s) in use.`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const REASON_LABEL: Record<string, string> = {
  MAINTENANCE: "Under maintenance",
  DAMAGED: "Damaged",
  CLOSURE: "Unavailable (closure)",
  OTHER: "Unavailable",
};
