"use client";

import { Clock } from "lucide-react";

import { DatePicker } from "@/components/app/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatTime,
  parseSingaporeDateTime,
  utcToSgWallTime,
} from "@/lib/datetime";

/** Every half hour of the day as "HH:mm", the steps the time pickers offer. */
export const HALF_HOUR_TIMES = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, "0");
  return `${hours}:${i % 2 === 0 ? "00" : "30"}`;
});

/**
 * Has this half-hour slot already begun, in Singapore time? `now` is a
 * "YYYY-MM-DDTHH:mm" wall time. The slot that starts at this very minute is
 * still open; the server allows the same (lib/schemas/booking.ts).
 */
export function isPastSlot(date: string, time: string, now: string): boolean {
  return `${date}T${time}` < now.slice(0, 16);
}

/**
 * A date box and a half-hour time picker for one end of the period, holding
 * a single "YYYY-MM-DDTHH:mm" Singapore wall time between them.
 */
export function DateTimeField({
  name,
  value,
  onChange,
  openOn,
  error,
}: {
  name: "Start" | "End";
  value: string;
  onChange: (value: string) => void;
  /** Where the calendar opens when no date is chosen yet. */
  openOn?: string;
  error: React.ReactNode;
}) {
  const [date = "", time = ""] = value.split("T");
  const id = name.toLowerCase();
  const join = (d: string, t: string) => (d || t ? `${d}T${t}` : "");

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}Date`}>{name}</Label>
      <div className="flex gap-2">
        <DatePicker
          id={`${id}Date`}
          label={name}
          value={date}
          openOn={openOn}
          onChange={(day) => onChange(join(day, time))}
          className="flex-1"
        />
        <Select value={time} onValueChange={(t) => onChange(join(date, t))}>
          <SelectTrigger
            aria-label={`${name} time`}
            className="shadow-2xs w-36 justify-start gap-2 rounded-lg bg-background hover:border-primary/50 [&>svg:last-of-type]:ml-auto"
          >
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {HALF_HOUR_TIMES.map((t) => (
              <SelectItem
                key={t}
                value={t}
                disabled={isPastSlot(date, t, utcToSgWallTime(new Date()))}
              >
                {formatTime(parseSingaporeDateTime(`2000-01-01T${t}`)!)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error}
    </div>
  );
}
