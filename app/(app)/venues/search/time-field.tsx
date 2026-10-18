"use client";

import { useEffect, useRef, useState } from "react";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

export type TimeParts = { hour: string; minute: string; half: "AM" | "PM" };

/** "17:05" as the picker shows it: 5, 05, PM. No time is no hour. */
export function toParts(value: string | undefined): TimeParts {
  if (!value) return { hour: "", minute: "00", half: "AM" };
  const [h, m] = value.split(":").map(Number);
  return {
    hour: String(h % 12 || 12),
    minute: String(m).padStart(2, "0"),
    half: h >= 12 ? "PM" : "AM",
  };
}

/** The picker's choice as the "HH:mm" the search reads, or "" for no time. */
export function fromParts({ hour, minute, half }: TimeParts): string {
  if (!hour) return "";
  const h = (Number(hour) % 12) + (half === "PM" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${minute}`;
}

/**
 * SCRUM-38 AC2 — a start or end time, picked as hour, minute and AM or PM.
 * A browser's time input sends nothing until every part is filled in, so
 * "5 PM" without minutes was searched as no time at all. Here the minutes
 * start at 00, so choosing an hour is enough. The form's Reset puts back the
 * time the page opened with, as it does for every other field.
 */
export function TimeField({
  name,
  label,
  value,
  messages,
  className,
}: {
  name: string;
  label: string;
  value?: string;
  messages?: string[];
  className: string;
}) {
  const [parts, setParts] = useState(() => toParts(value));
  const hidden = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const reset = () => setParts(toParts(value));
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [value]);

  const errorId = `${name}-error`;
  const described = messages ? errorId : undefined;
  const change = (part: Partial<TimeParts>) =>
    setParts((prev) => ({ ...prev, ...part }));

  return (
    <fieldset className="space-y-2" aria-describedby={described}>
      <legend className="text-sm font-medium leading-none">{label}</legend>
      <input ref={hidden} type="hidden" name={name} value={fromParts(parts)} />
      <div className="flex gap-1">
        <select
          aria-label={`${label} hour`}
          value={parts.hour}
          onChange={(e) => change({ hour: e.target.value })}
          aria-invalid={messages ? true : undefined}
          className={className}
        >
          <option value="">--</option>
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} minute`}
          value={parts.minute}
          onChange={(e) => change({ minute: e.target.value })}
          disabled={!parts.hour}
          className={className}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} AM or PM`}
          value={parts.half}
          onChange={(e) => change({ half: e.target.value as "AM" | "PM" })}
          disabled={!parts.hour}
          className={className}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {messages?.[0] && (
        <p id={errorId} className="text-xs text-destructive">
          {messages[0]}
        </p>
      )}
    </fieldset>
  );
}
