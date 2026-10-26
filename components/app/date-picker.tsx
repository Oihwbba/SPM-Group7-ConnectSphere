"use client";

import { DateTimePicker } from "@/components/app/date-time-picker";
import { utcToSgWallTime } from "@/lib/datetime";

export { monthGrid } from "@/components/app/date-time-picker";

/**
 * A date field that opens the app's calendar instead of the browser's own
 * (components/app/date-time-picker.tsx). Days before today (Singapore time)
 * cannot be picked unless `allowPast`.
 */
export function DatePicker({
  id,
  label,
  value,
  onChange,
  openOn,
  placeholder = "Select date",
  display,
  allowPast = false,
  className,
}: {
  id: string;
  label: string;
  /** "YYYY-MM-DD", or "" for none chosen. */
  value: string;
  onChange: (day: string) => void;
  /** The day to open on when none is chosen yet; today if not given. */
  openOn?: string;
  /** What the field says before a day is chosen. */
  placeholder?: string;
  /** Text to show on the field instead of the chosen day. */
  display?: string;
  /** Let days before today be picked, for looking back rather than booking. */
  allowPast?: boolean;
  className?: string;
}) {
  return (
    <DateTimePicker
      id={id}
      mode="date"
      aria-label={`${label} date`}
      value={value}
      onChange={onChange}
      openOn={openOn}
      placeholder={placeholder}
      display={display}
      min={allowPast ? undefined : utcToSgWallTime(new Date()).slice(0, 10)}
      clearable={false}
      className={className}
    />
  );
}
