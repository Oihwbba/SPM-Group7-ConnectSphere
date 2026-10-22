"use client";

import { DateTimePicker } from "@/components/app/date-time-picker";
import { Label } from "@/components/ui/label";

/**
 * SCRUM-38 AC2 — a start or end time, picked as hour, minute and AM or PM
 * with the app's time picker. A browser's time input sends nothing until
 * every part is filled in, so "5 PM" without minutes was searched as no time
 * at all. Here choosing an hour is enough: the minutes start at 00. Clear
 * leaves no time, and the form's Reset puts back the time the page opened
 * with, as it does for every other field.
 */
export function TimeField({
  name,
  label,
  value,
  messages,
}: {
  name: string;
  label: string;
  value?: string;
  messages?: string[];
}) {
  const errorId = `${name}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <DateTimePicker
        id={name}
        mode="time"
        name={name}
        defaultValue={value ?? ""}
        placeholder="Any time"
        aria-invalid={messages ? true : undefined}
        aria-describedby={messages ? errorId : undefined}
      />
      {messages?.[0] && (
        <p id={errorId} className="text-xs text-destructive">
          {messages[0]}
        </p>
      )}
    </div>
  );
}
