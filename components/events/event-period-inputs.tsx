"use client";

import { DateTimePicker } from "@/components/app/date-time-picker";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import type { EventPeriodFields } from "@/lib/datetime";

/**
 * SCRUM-190 AC1, AC3 — an event's one date with a start and an end time,
 * Singapore time, wherever its schedule is changed after the request form.
 * The actions check the joined start and end, so their errors come back
 * against `startAt` and `endAt`.
 */
export function EventPeriodInputs({
  idPrefix,
  value,
  onChange,
  errors,
}: {
  idPrefix: string;
  value: EventPeriodFields;
  onChange: (field: keyof EventPeriodFields, value: string) => void;
  errors: { startAt?: string[]; endAt?: string[] };
}) {
  const startError = errors.startAt?.[0] ? `${idPrefix}-startAt-error` : undefined;
  const endError = errors.endAt?.[0] ? `${idPrefix}-endAt-error` : undefined;
  const inputs = [
    { field: "date", label: "Date", mode: "date", error: startError },
    { field: "startTime", label: "Start time", mode: "time", error: startError },
    { field: "endTime", label: "End time", mode: "time", error: endError },
  ] as const;

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {inputs.map(({ field, label, mode, error }) => (
          <div key={field} className="space-y-1">
            <Label htmlFor={`${idPrefix}-${field}`}>{label}</Label>
            <DateTimePicker
              id={`${idPrefix}-${field}`}
              mode={mode}
              value={value[field]}
              onChange={(next) => onChange(field, next)}
              aria-invalid={Boolean(error)}
              aria-describedby={error}
            />
          </div>
        ))}
      </div>
      <FieldError id={`${idPrefix}-startAt-error`} messages={errors.startAt} />
      <FieldError id={`${idPrefix}-endAt-error`} messages={errors.endAt} />
    </div>
  );
}
