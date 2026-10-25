"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
} from "lucide-react";

import { useFormReset } from "@/components/app/app-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatDate,
  formatDateTime,
  formatMonth,
  formatTime,
  parseSingaporeDateTime,
  utcToSgWallTime,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const HOURS_12 = Array.from({ length: 12 }, (_, i) => pad(i + 1));

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Noon on a "YYYY-MM-DD" day in Singapore, so formatting never slips a day. */
const noon = (day: string) => parseSingaporeDateTime(`${day}T12:00`)!;

/** Now as a Singapore wall time, "YYYY-MM-DDTHH:mm". */
const nowWall = () => utcToSgWallTime(new Date());

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

/** "HH:mm" (24-hour) as the picker's columns show it: 01–12, minute, AM/PM. */
export function toClock(time: string) {
  const [h, m] = time.split(":").map(Number);
  return {
    hour: pad(h % 12 || 12),
    minute: pad(m),
    period: (h >= 12 ? "PM" : "AM") as "AM" | "PM",
  };
}

/** The columns' choice back as "HH:mm" (24-hour). */
export function fromClock(hour: string, minute: string, period: "AM" | "PM") {
  return `${pad((Number(hour) % 12) + (period === "PM" ? 12 : 0))}:${minute}`;
}

/** The first time on the `step` grid at or after `time`, or null past midnight. */
export function roundUpTo(time: string, step: number): string | null {
  const [h, m] = time.split(":").map(Number);
  const minutes = Math.ceil((h * 60 + m) / step) * step;
  return minutes < 24 * 60
    ? `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
    : null;
}

type Mode = "date" | "time" | "datetime";

/** What the field shows for a value, in Singapore time (SCRUM-129). */
function describe(mode: Mode, value: string): string {
  if (!value) return "";
  if (mode === "date") return formatDate(noon(value));
  if (mode === "time") {
    return formatTime(parseSingaporeDateTime(`2000-01-01T${value}`)!);
  }
  const instant = parseSingaporeDateTime(value);
  return instant ? formatDateTime(instant) : "";
}

/**
 * The app's one date and time field (shared page conventions, change 5): a
 * calendar beside hour, minute and AM/PM columns, in place of the browser's
 * own picker, so every form looks and works the same. The value is a
 * Singapore wall time, as the browser's inputs gave: "YYYY-MM-DD" for a
 * date, "HH:mm" for a time, "YYYY-MM-DDTHH:mm" for both.
 *
 * Built on the app's dropdown menu, so it is keyboard-operable: arrow keys
 * move between days and times, Enter picks, Escape closes. Anything before
 * `min` cannot be picked. With a `name` it is sent with its form and follows
 * the form's Reset, like a native input.
 */
export function DateTimePicker({
  id,
  mode = "datetime",
  value,
  defaultValue = "",
  onChange,
  name,
  min,
  minuteStep = 1,
  openOn,
  placeholder,
  display,
  clearable = true,
  disabled,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  mode?: Mode;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  /** The earliest value that can be picked, in the same form as the value. */
  min?: string;
  minuteStep?: number;
  /** The day the calendar opens on when nothing is chosen; today otherwise. */
  openOn?: string;
  placeholder?: string;
  /** Text to show on the field instead of the chosen value. */
  display?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const current = value ?? own;
  const hidden = useRef<HTMLInputElement>(null);
  useFormReset(hidden, () => setOwn(defaultValue));
  const [view, setView] = useState({ year: 0, month: 0 });

  const [date = "", time = ""] =
    mode === "time"
      ? ["", current]
      : mode === "date"
        ? [current, ""]
        : current.split("T");
  const [minDay = "", minTime = ""] = !min
    ? []
    : mode === "time"
      ? ["", min]
      : mode === "date"
        ? [min, ""]
        : min.split("T");
  const today = nowWall().slice(0, 10);

  function emit(next: string) {
    // Picking what is already chosen is not a change.
    if (next === current) return;
    setOwn(next);
    onChange?.(next);
  }

  /** Before `min`? Days compare by day; times by day and time. */
  const tooEarly = (day: string, t: string) =>
    !!min &&
    (mode === "time"
      ? t < minTime
      : mode === "date"
        ? day < minDay
        : `${day}T${t}` < min);

  // A day picked before a time gets 9:00, or the first allowed time after.
  function defaultTime(day: string) {
    if (!tooEarly(day, "09:00")) return "09:00";
    return (day === minDay && roundUpTo(minTime, minuteStep)) || "09:00";
  }
  function defaultDay() {
    if (openOn) return openOn;
    return minDay > today ? minDay : today;
  }

  function pickDay(day: string) {
    if (mode === "date") return emit(day);
    emit(`${day}T${time || defaultTime(day)}`);
  }
  function pickTime(t: string) {
    if (mode === "time") return emit(t);
    emit(`${date || defaultDay()}T${t}`);
  }

  function opened(isOpen: boolean) {
    if (!isOpen) return;
    const [y, m] = (date || openOn || defaultDay()).split("-");
    setView({ year: Number(y), month: Number(m) - 1 });
  }

  const shown = display ?? describe(mode, current);
  const Icon = mode === "time" ? Clock : CalendarIcon;
  const keepOpen = (e: Event) => e.preventDefault();

  return (
    <>
      {name && <input ref={hidden} type="hidden" name={name} value={current} />}
      <DropdownMenu onOpenChange={opened}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            data-invalid={ariaInvalid || undefined}
            data-value={current}
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors hover:border-primary/50 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-[invalid=true]:border-destructive data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-ring/40",
              className,
            )}
          >
            <span
              className={cn(
                "flex-1 truncate",
                shown ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {shown ||
                placeholder ||
                (mode === "date"
                  ? "Select date"
                  : mode === "time"
                    ? "Select time"
                    : "Select date and time")}
            </span>
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-auto overflow-hidden rounded-xl p-0 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row">
            {mode !== "time" && (
              <CalendarPanel
                view={view}
                setView={setView}
                selected={date}
                today={today}
                isDisabled={(day) => !!minDay && day < minDay}
                onPick={pickDay}
                keepOpen={mode === "datetime"}
              />
            )}
            {mode !== "date" && (
              <TimeColumns
                time={time}
                step={minuteStep}
                isDisabled={(t) => tooEarly(date || defaultDay(), t)}
                onPick={pickTime}
                bordered={mode === "datetime"}
              />
            )}
          </div>
          {(clearable || mode !== "time") && (
            <div className="flex items-center justify-between border-t px-3 py-1.5">
              {clearable ? (
                <DropdownMenuItem
                  onSelect={() => emit("")}
                  className="h-7 px-2 text-xs font-medium text-primary"
                >
                  Clear
                </DropdownMenuItem>
              ) : (
                <span />
              )}
              {mode !== "time" && (
                <DropdownMenuItem
                  disabled={!!minDay && today < minDay}
                  onSelect={(e) => {
                    if (mode === "datetime") keepOpen(e);
                    pickDay(today);
                    setView({
                      year: Number(today.slice(0, 4)),
                      month: Number(today.slice(5, 7)) - 1,
                    });
                  }}
                  className="h-7 px-2 text-xs font-medium text-primary"
                >
                  Today
                </DropdownMenuItem>
              )}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function CalendarPanel({
  view,
  setView,
  selected,
  today,
  isDisabled,
  onPick,
  keepOpen,
}: {
  view: { year: number; month: number };
  setView: React.Dispatch<
    React.SetStateAction<{ year: number; month: number }>
  >;
  selected: string;
  today: string;
  isDisabled: (day: string) => boolean;
  onPick: (day: string) => void;
  keepOpen: boolean;
}) {
  // The header's month and year open a year, then a month, to jump to.
  const [choosing, setChoosing] = useState<"days" | "years" | "months">("days");
  const [firstYear, setFirstYear] = useState(0);
  const monthKey = `${view.year}-${pad(view.month + 1)}`;
  const shift = (months: number) =>
    setView(({ year, month }) => {
      const total = year * 12 + month + months;
      return { year: Math.floor(total / 12), month: total % 12 };
    });
  const stay = (act: () => void) => (e: Event) => {
    e.preventDefault();
    act();
  };
  const nav = (label: string, act: () => void, Icon: typeof ChevronLeft) => (
    <DropdownMenuItem
      aria-label={label}
      title={label}
      onSelect={stay(act)}
      className="h-7 w-7 justify-center rounded-md p-0 text-muted-foreground"
    >
      <Icon />
    </DropdownMenuItem>
  );
  const cell = "h-9 justify-center rounded-md p-0 text-sm";
  const chosenCell =
    "bg-primary font-semibold text-primary-foreground focus:bg-primary focus:text-primary-foreground";

  return (
    <div className="w-72 p-3">
      <div className="mb-2 flex items-center gap-0.5">
        <DropdownMenuItem
          data-month={monthKey}
          aria-label="Choose month and year"
          onSelect={stay(() => {
            if (choosing === "days") {
              setFirstYear(view.year - (view.year % 12));
              setChoosing("years");
            } else {
              setChoosing("days");
            }
          })}
          className="flex-1 gap-1 px-1.5 text-sm font-semibold"
        >
          {view.year > 0 &&
            (choosing === "years"
              ? `${firstYear} – ${firstYear + 11}`
              : choosing === "months"
                ? view.year
                : formatMonth(noon(`${monthKey}-15`)))}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 opacity-60 transition-transform",
              choosing !== "days" && "rotate-180",
            )}
          />
        </DropdownMenuItem>
        {choosing === "days" && (
          <>
            {nav("Previous year", () => shift(-12), ChevronsLeft)}
            {nav("Previous month", () => shift(-1), ChevronLeft)}
            {nav("Next month", () => shift(1), ChevronRight)}
            {nav("Next year", () => shift(12), ChevronsRight)}
          </>
        )}
        {choosing === "years" && (
          <>
            {nav(
              "Earlier years",
              () => setFirstYear((y) => y - 12),
              ChevronLeft,
            )}
            {nav(
              "Later years",
              () => setFirstYear((y) => y + 12),
              ChevronRight,
            )}
          </>
        )}
      </div>
      {choosing === "years" && (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 12 }, (_, i) => firstYear + i).map((year) => (
            <DropdownMenuItem
              key={year}
              data-year={year}
              onSelect={stay(() => {
                setView(({ month }) => ({ year, month }));
                setChoosing("months");
              })}
              className={cn(cell, year === view.year && chosenCell)}
            >
              {year}
            </DropdownMenuItem>
          ))}
        </div>
      )}
      {choosing === "months" && (
        <div className="grid grid-cols-3 gap-1">
          {MONTHS_SHORT.map((label, month) => (
            <DropdownMenuItem
              key={label}
              data-pick-month={pad(month + 1)}
              onSelect={stay(() => {
                setView(({ year }) => ({ year, month }));
                setChoosing("days");
              })}
              className={cn(cell, month === view.month && chosenCell)}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </div>
      )}
      {choosing === "days" && (
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
                disabled={isDisabled(day)}
                onSelect={(e) => {
                  if (keepOpen) e.preventDefault();
                  onPick(day);
                }}
                className={cn(
                  "h-8 justify-center rounded-md p-0 text-sm",
                  day === selected && chosenCell,
                  day === today &&
                    day !== selected &&
                    "font-semibold text-primary ring-1 ring-inset ring-primary/40",
                )}
              >
                {Number(day.slice(8))}
              </DropdownMenuItem>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function TimeColumns({
  time,
  step,
  isDisabled,
  onPick,
  bordered,
}: {
  time: string;
  step: number;
  isDisabled: (time: string) => boolean;
  onPick: (time: string) => void;
  bordered: boolean;
}) {
  const chosen = time ? toClock(time) : null;
  const period = chosen?.period ?? "AM";
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) =>
    pad(i * step),
  );
  const columns = useRef<HTMLDivElement>(null);

  // Open with the chosen hour and minute in view.
  useEffect(() => {
    columns.current
      ?.querySelectorAll<HTMLElement>("[data-chosen=true]")
      .forEach((el) => {
        const list = el.parentElement!;
        list.scrollTop =
          el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
      });
  }, []);

  // An hour is unavailable when even its last minute is too early.
  const hourOff = (h: string) =>
    isDisabled(fromClock(h, minutes[minutes.length - 1], period));
  const cell = (
    key: string,
    label: string,
    isChosen: boolean,
    off: boolean,
    pick: () => void,
    data: Record<string, string>,
  ) => (
    <DropdownMenuItem
      key={key}
      {...data}
      data-chosen={isChosen}
      disabled={off}
      onSelect={(e) => {
        e.preventDefault();
        pick();
      }}
      className={cn(
        "h-8 w-12 shrink-0 justify-center rounded-md p-0 text-sm tabular-nums",
        isChosen &&
          "bg-primary font-semibold text-primary-foreground focus:bg-primary focus:text-primary-foreground",
      )}
    >
      {label}
    </DropdownMenuItem>
  );
  const list = "flex max-h-64 flex-col gap-1 overflow-y-auto p-1.5";

  return (
    <div
      ref={columns}
      aria-label="Time"
      className={cn("flex", bordered && "border-t sm:border-l sm:border-t-0")}
    >
      <div className={list} aria-label="Hour">
        {HOURS_12.map((h) =>
          cell(
            `h${h}`,
            h,
            chosen?.hour === h,
            hourOff(h),
            () => onPick(fromClock(h, chosen?.minute ?? "00", period)),
            { "data-hour": h },
          ),
        )}
      </div>
      <div className={list} aria-label="Minute">
        {minutes.map((m) =>
          cell(
            `m${m}`,
            m,
            chosen?.minute === m,
            isDisabled(fromClock(chosen?.hour ?? "09", m, period)),
            () => onPick(fromClock(chosen?.hour ?? "09", m, period)),
            { "data-minute": m },
          ),
        )}
      </div>
      <div className={list} aria-label="AM or PM">
        {(["AM", "PM"] as const).map((p) =>
          cell(
            p,
            p,
            chosen?.period === p,
            // Unavailable when even its last minute (11:59) is too early.
            isDisabled(fromClock("11", "59", p)),
            () =>
              onPick(
                fromClock(chosen?.hour ?? "09", chosen?.minute ?? "00", p),
              ),
            { "data-period": p },
          ),
        )}
      </div>
    </div>
  );
}
