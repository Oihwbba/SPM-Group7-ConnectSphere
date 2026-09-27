"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatDate,
  formatMonth,
  parseSingaporeDateTime,
  utcToSgWallTime,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Noon on a "YYYY-MM-DD" day in Singapore, so formatting never slips a day. */
const noon = (day: string) => parseSingaporeDateTime(`${day}T12:00`)!;

/**
 * One month as calendar cells, weeks starting on Monday: "YYYY-MM-DD" for each
 * day, and null for the blanks before the 1st and after the last day.
 * `month` is 0-based, like Date's.
 */
export function monthGrid(year: number, month: number): (string | null)[] {
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * A date field that opens an in-app calendar instead of the browser's own.
 * Built on the dropdown menu the app already uses, so every day is a menu
 * item: arrow keys move between days, Enter picks one, Escape closes. Days
 * before today (Singapore time) cannot be picked.
 */
export function DatePicker({
  id,
  label,
  value,
  onChange,
  openOn,
  className,
}: {
  id: string;
  label: string;
  /** "YYYY-MM-DD", or "" for none chosen. */
  value: string;
  onChange: (day: string) => void;
  /** The day to open on when none is chosen yet; today if not given. */
  openOn?: string;
  className?: string;
}) {
  const [view, setView] = useState({ year: 0, month: 0 });

  function open(isOpen: boolean) {
    if (!isOpen) return;
    const [y, m] = (value || openOn || utcToSgWallTime(new Date())).split("-");
    setView({ year: Number(y), month: Number(m) - 1 });
  }

  function shift(months: number) {
    setView(({ year, month }) => {
      const total = year * 12 + month + months;
      return { year: Math.floor(total / 12), month: total % 12 };
    });
  }

  const today = utcToSgWallTime(new Date()).slice(0, 10);
  const monthKey = `${view.year}-${pad(view.month + 1)}`;
  const nav = (name: string, months: number, Icon: typeof ChevronLeft) => (
    <DropdownMenuItem
      aria-label={name}
      title={name}
      onSelect={(e) => {
        e.preventDefault();
        shift(months);
      }}
      className="h-8 w-8 justify-center rounded-md p-0"
    >
      <Icon />
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu onOpenChange={open}>
      <DropdownMenuTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={`${label} date`}
          className={cn(
            "shadow-2xs flex h-10 items-center gap-2 rounded-lg border bg-background px-3 text-left text-sm transition-colors hover:border-primary/50 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary",
            className,
          )}
        >
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              "truncate",
              value ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {value ? formatDate(noon(value)) : "Select date"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-3">
        <div className="mb-2 flex items-center gap-1">
          {nav("Previous year", -12, ChevronsLeft)}
          {nav("Previous month", -1, ChevronLeft)}
          <p
            data-month={monthKey}
            className="flex-1 text-center text-sm font-semibold"
          >
            {view.year > 0 && formatMonth(noon(`${monthKey}-15`))}
          </p>
          {nav("Next month", 1, ChevronRight)}
          {nav("Next year", 12, ChevronsRight)}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d) => (
            <span
              key={d}
              className="py-1 text-xs font-medium text-muted-foreground"
            >
              {d}
            </span>
          ))}
          {monthGrid(view.year, view.month).map((day, i) =>
            day === null ? (
              <span key={`blank-${i}`} />
            ) : (
              <DropdownMenuItem
                key={day}
                data-date={day}
                aria-label={formatDate(noon(day))}
                disabled={day < today}
                onSelect={() => onChange(day)}
                className={cn(
                  "h-8 justify-center rounded-md p-0 text-sm",
                  day === value &&
                    "bg-foreground text-background focus:bg-foreground focus:text-background",
                  day === today && day !== value && "font-bold text-primary",
                )}
              >
                {Number(day.slice(8))}
              </DropdownMenuItem>
            ),
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
