"use client";

import { DateTimePicker } from "@/components/app/date-time-picker";
import { Label } from "@/components/ui/label";
import { utcToSgWallTime } from "@/lib/datetime";

/** Every `step` minutes of the day as "HH:mm", the times a picker offers. */
export function timesEvery(step: 15 | 30): string[] {
  return Array.from({ length: (24 * 60) / step }, (_, i) => {
    const minutes = i * step;
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  });
}

/** The half-hour steps booking requests and holds use (SCRUM-50, SCRUM-163). */
export const HALF_HOUR_TIMES = timesEvery(30);

/**
 * Has this half-hour slot already begun, in Singapore time? `now` is a
 * "YYYY-MM-DDTHH:mm" wall time. The slot that starts at this very minute is
 * still open; the server allows the same (lib/schemas/booking.ts).
 */
export function isPastSlot(date: string, time: string, now: string): boolean {
  return `${date}T${time}` < now.slice(0, 16);
}

/**
 * One end of a period as the app's date and time picker, holding a single
 * "YYYY-MM-DDTHH:mm" Singapore wall time. Times are offered every half hour
 * unless `stepMinutes` says 15, as for recorded unavailability, which needn't
 * fall on a half hour (SCRUM-161). Nothing that has already begun can be
 * picked (isPastSlot).
 */
export function DateTimeField({
  name,
  value,
  onChange,
  openOn,
  error,
  stepMinutes = 30,
}: {
  /** Also the label; "Expiry" is a hold's deadline (SCRUM-163). */
  name: "Start" | "End" | "Expiry";
  value: string;
  onChange: (value: string) => void;
  /** Where the calendar opens when no date is chosen yet. */
  openOn?: string;
  error: React.ReactNode;
  stepMinutes?: 15 | 30;
}) {
  const id = name.toLowerCase();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{name}</Label>
      <DateTimePicker
        id={id}
        value={value}
        onChange={onChange}
        openOn={openOn}
        min={utcToSgWallTime(new Date())}
        minuteStep={stepMinutes}
        clearable={false}
      />
      {error}
    </div>
  );
}
