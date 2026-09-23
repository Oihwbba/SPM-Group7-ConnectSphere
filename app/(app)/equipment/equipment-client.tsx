"use client";

import { useEffect, useRef, useState, useTransition, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  ChevronDown,
  ArrowRight,
  Minus,
  Plus,
  BarChart2,
  Laptop,
  Mic,
  Volume2,
  Projector,
  Presentation,
  Layers,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createReservation,
  getAllEquipmentAvailability,
} from "./actions";
import { EquipmentSchedulePanel } from "./equipment-schedule-panel";
import { allAvailabilitySchema } from "@/lib/schemas/reservation";
import { checkQuantity } from "@/lib/equipment/availability";
import {
  formatDate,
  formatDateTime,
  formatTime,
  parseSingaporeDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
} from "@/lib/datetime";

type Equipment = { id: string; type: string; totalQuantity: number };
type Event = { id: string; name: string };
type AvailabilityMap = Record<string, { available: number; total: number }>;

const emptySubscribe = () => () => {};

/** Convert naive Singapore local datetime string into UTC ISO string. */
function toUtcIso(localValue: string): string {
  return sgWallTimeToUtcIso(localValue) ?? localValue;
}

function formatDateDisplay(isoString: string): string {
  if (!isoString) return "Select date";
  const dateOnly = isoString.includes("T") ? isoString.split("T")[0] : isoString;
  if (!dateOnly) return "Select date";
  const [y, m, d] = dateOnly.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return "Select date";
  const dateObj = new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
  return formatDate(dateObj);
}

function formatTimeDisplay(isoString: string): string {
  if (!isoString || !isoString.includes("T")) return "Select time";
  const timeOnly = isoString.split("T")[1]?.slice(0, 5);
  if (!timeOnly) return "Select time";
  const [hStr, mStr] = timeOnly.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return "Select time";
  const dateObj = new Date(Date.UTC(2020, 0, 1, h - 8, m, 0));
  return formatTime(dateObj);
}

function getDurationDisplay(startAt: string, endAt: string) {
  if (!startAt || !endAt || !startAt.includes("T") || !endAt.includes("T") || startAt.startsWith("T") || endAt.startsWith("T")) {
    return { primary: "—", secondary: "Select dates & times" };
  }
  const start = parseSingaporeDateTime(startAt)?.getTime();
  const end = parseSingaporeDateTime(endAt)?.getTime();
  if (!start || !end || Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return { primary: "—", secondary: "Invalid period" };
  }
  const diffMs = end - start;
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const dayStr = days === 1 ? "1 day" : `${days} days`;
    return {
      primary: dayStr,
      secondary: `(${hours} hours)`,
    };
  }
  return {
    primary: `${hours} ${hours === 1 ? "hour" : "hours"}`,
    secondary: `(${Math.round(diffMs / (1000 * 60))} mins)`,
  };
}

function formatPeriodDisplay(startAt: string, endAt: string): string | null {
  const s = parseSingaporeDateTime(startAt);
  const e = parseSingaporeDateTime(endAt);
  if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return null;
  }

  return `Availability for ${formatDateTime(s)} → ${formatDateTime(e)}.`;
}

function getEquipmentIcon(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("projector")) return Projector;
  if (lower.includes("laptop")) return Laptop;
  if (lower.includes("lectern") || lower.includes("podium")) return Presentation;
  if (lower.includes("speaker") || lower.includes("sound") || lower.includes("pa")) return Volume2;
  if (lower.includes("mic")) return Mic;
  return Layers;
}

export function EquipmentClient({
  equipment,
  events,
}: {
  equipment: Equipment[];
  events: Event[];
}) {
  const isHydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [form, setForm] = useState({
    eventId: "",
    equipmentId: "",
    quantity: "1",
    startAt: "",
    endAt: "",
  });
  const [allAvailability, setAllAvailability] = useState<AvailabilityMap | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Derive per-equipment availability at render time — always in sync with both
  // allAvailability (set by the date-change effect) and form.equipmentId (set by update()).
  const availability =
    form.equipmentId && allAvailability?.[form.equipmentId]
      ? allAvailability[form.equipmentId].available
      : null;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const requestIdRef = useRef(0);

  const update = (field: keyof typeof form, value: string) => {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    }
    if (field === "startAt" || field === "endAt") {
      requestIdRef.current += 1;
      setAllAvailability(null);
      setAvailabilityError(null);
    }
  };

  // Live calculation: debounced validation & server availability fetch
  useEffect(() => {
    if (!form.startAt || !form.endAt) return;
    if (
      !form.startAt.includes("T") ||
      !form.endAt.includes("T") ||
      form.startAt.startsWith("T") ||
      form.endAt.startsWith("T")
    ) {
      return;
    }

    let isMounted = true;
    const timer = setTimeout(() => {
      // Past start time check
      const startDateObj = parseSingaporeDateTime(form.startAt);
      const startMs = startDateObj ? startDateObj.getTime() : NaN;
      if (!Number.isNaN(startMs) && startMs < Date.now() - 60000) {
        if (!isMounted) return;
        setAllAvailability(null);
        setFieldErrors((current) => ({
          ...current,
          startAt: ["Start time cannot be in the past."],
        }));
        setAvailabilityError("Start time cannot be in the past.");
        return;
      }

      const parsed = allAvailabilitySchema.safeParse({
        startAt: toUtcIso(form.startAt),
        endAt: toUtcIso(form.endAt),
      });

      if (!isMounted) return;

      if (!parsed.success) {
        setAllAvailability(null);
        const errs = parsed.error.flatten().fieldErrors;
        setFieldErrors((current) => ({
          ...current,
          startAt: errs.startAt,
          endAt: errs.endAt,
        }));
        setAvailabilityError(
          errs.endAt?.[0] || errs.startAt?.[0] || "Invalid reservation period.",
        );
        return;
      }

      setAvailabilityError(null);
      setFieldErrors((current) => ({
        ...current,
        startAt: undefined,
        endAt: undefined,
      }));

      const reqId = ++requestIdRef.current;

      startTransition(async () => {
        try {
          const res = await getAllEquipmentAvailability(parsed.data);

          if (!isMounted || reqId !== requestIdRef.current) return;

          if (res.ok) {
            setAllAvailability(res.data);
            setAvailabilityError(null);
          } else {
            setAllAvailability(null);
            if (res.fieldErrors) {
              setFieldErrors((current) => ({
                ...current,
                ...res.fieldErrors,
              }));
            }
            setAvailabilityError(
              res.error || "Couldn't calculate availability — check the period and try again",
            );
          }
        } catch {
          if (!isMounted || reqId !== requestIdRef.current) return;
          setAllAvailability(null);
          setAvailabilityError(
            "Couldn't calculate availability — check the period and try again",
          );
        }
      });
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [form.startAt, form.endAt]);

  const reserve = () =>
    startTransition(async () => {
      setFieldErrors({});

      const isStartComplete =
        Boolean(form.startAt) &&
        form.startAt.includes("T") &&
        !form.startAt.startsWith("T") &&
        Boolean(form.startAt.split("T")[1]);
      const isEndComplete =
        Boolean(form.endAt) &&
        form.endAt.includes("T") &&
        !form.endAt.startsWith("T") &&
        Boolean(form.endAt.split("T")[1]);

      if (!isStartComplete || !isEndComplete) {
        setFieldErrors((current) => ({
          ...current,
          ...(!isStartComplete ? { startAt: ["Choose both a start date and time."] } : {}),
          ...(!isEndComplete ? { endAt: ["Choose both an end date and time."] } : {}),
        }));
        toast.error("Please specify complete start and end dates and times.");
        return;
      }

      const startDateObj = parseSingaporeDateTime(form.startAt);
      const startMs = startDateObj ? startDateObj.getTime() : NaN;
      if (!Number.isNaN(startMs) && startMs < Date.now() - 60000) {
        setFieldErrors((current) => ({
          ...current,
          startAt: ["Start time cannot be in the past."],
        }));
        toast.error("Start time cannot be in the past.");
        return;
      }

      try {
        const result = await createReservation({
          ...form,
          startAt: toUtcIso(form.startAt),
          endAt: toUtcIso(form.endAt),
        });
        if (!result.ok) {
          if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
          }
          toast.error(result.error);
          return;
        }
        setFieldErrors({});
        toast.success(
          `Reservation confirmed. ${result.data.available} unit(s) remain available.`,
        );

        // Refresh live availability map (shared error handling with the effect)
        try {
          const refreshReqId = ++requestIdRef.current;
          const allRes = await getAllEquipmentAvailability({
            startAt: toUtcIso(form.startAt),
            endAt: toUtcIso(form.endAt),
          });
          if (refreshReqId !== requestIdRef.current) return;
          if (allRes.ok) {
            setAllAvailability(allRes.data);
          } else {
            setAllAvailability(null);
            setAvailabilityError(
              allRes.error || "Couldn't refresh availability — try changing the period.",
            );
          }
        } catch {
          setAllAvailability(null);
          setAvailabilityError(
            "Couldn't refresh availability — try changing the period.",
          );
        }
      } catch {
        toast.error("An unexpected error occurred while creating the reservation.");
      }
    });

  const durationText = getDurationDisplay(form.startAt, form.endAt);
  const periodText = formatPeriodDisplay(form.startAt, form.endAt);
  const selectedEquipment = equipment.find((e) => e.id === form.equipmentId);
  const otherEquipment = equipment.filter((e) => e.id !== form.equipmentId);

  const startDate =
    form.startAt && !form.startAt.startsWith("T")
      ? form.startAt.split("T")[0]
      : "";
  const startTime =
    form.startAt && form.startAt.includes("T")
      ? form.startAt.split("T")[1].slice(0, 5)
      : "";
  const endDate =
    form.endAt && !form.endAt.startsWith("T")
      ? form.endAt.split("T")[0]
      : "";
  const endTime =
    form.endAt && form.endAt.includes("T")
      ? form.endAt.split("T")[1].slice(0, 5)
      : "";

  const updateStartPart = (field: "date" | "time", val: string, currentStart: string) => {
    const curDate = currentStart && !currentStart.startsWith("T") ? currentStart.split("T")[0] : "";
    const curTime = currentStart && currentStart.includes("T") ? currentStart.split("T")[1].slice(0, 5) : "";
    if (field === "date") {
      if (!val) return curTime ? `T${curTime}` : "";
      return curTime ? `${val}T${curTime}` : val;
    }
    if (!val) return curDate;
    return curDate ? `${curDate}T${val}` : `T${val}`;
  };

  const updateEndPart = (field: "date" | "time", val: string, currentEnd: string) => {
    const curDate = currentEnd && !currentEnd.startsWith("T") ? currentEnd.split("T")[0] : "";
    const curTime = currentEnd && currentEnd.includes("T") ? currentEnd.split("T")[1].slice(0, 5) : "";
    if (field === "date") {
      if (!val) return curTime ? `T${curTime}` : "";
      return curTime ? `${val}T${curTime}` : val;
    }
    if (!val) return curDate;
    return curDate ? `${curDate}T${val}` : `T${val}`;
  };

  const [sgToday, sgNowTime] = utcToSgWallTime(new Date()).split("T");

  const reqQty = parseInt(form.quantity || "1", 10);
  const isQuantityValid = !Number.isNaN(reqQty) && reqQty > 0;

  // SCRUM-29 — the verdict comes from the same function the server reserves
  // with, so the shortfall shown here is the one the reservation would report.
  const verdict =
    availability !== null && isQuantityValid
      ? checkQuantity(
          {
            total: selectedEquipment?.totalQuantity ?? availability,
            available: availability,
            committed: Math.max(
              0,
              (selectedEquipment?.totalQuantity ?? availability) - availability,
            ),
          },
          reqQty,
        )
      : null;
  const isQuantityExceeded = verdict !== null && !verdict.sufficient;

  return (
    <div className="space-y-6" data-hydrated={isHydrated}>
      {/* 1. Reserve Equipment Card */}
      <Card className="border border-border bg-card text-card-foreground shadow-xs backdrop-blur-none backdrop-saturate-100">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">
                Reserve equipment
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Confirmed reservations secure equipment for the selected period.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Row 1: Approved Event & Equipment Type Selection */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event" className="text-sm font-semibold">Approved event</Label>
              <select
                id="event"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.eventId}
                onChange={(e) => update("eventId", e.target.value)}
              >
                <option value="">Select an event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              {fieldErrors.eventId?.[0] && (
                <p className="text-xs text-destructive">{fieldErrors.eventId[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipment" className="text-sm font-semibold">Equipment type</Label>
              <select
                id="equipment"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.equipmentId}
                onChange={(e) => update("equipmentId", e.target.value)}
              >
                <option value="">Select equipment</option>
                {equipment.map((item) => {
                  const liveCount = allAvailability?.[item.id]?.available;
                  const statusSuffix =
                    liveCount !== undefined
                      ? ` — ${liveCount} of ${item.totalQuantity} available`
                      : ` (${item.totalQuantity} total)`;
                  return (
                    <option key={item.id} value={item.id}>
                      {item.type}
                      {statusSuffix}
                    </option>
                  );
                })}
              </select>
              {fieldErrors.equipmentId?.[0] && (
                <p className="text-xs text-destructive">
                  {fieldErrors.equipmentId[0]}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Reservation Period with separate Date & Time visual bars */}
          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Reservation period</h3>
              <p className="text-xs text-muted-foreground">
                Select the start and end date & time for your reservation.
              </p>
            </div>

            <div className="flex flex-col md:flex-row md:items-start gap-4 pt-1">
              {/* Start Controls */}
              <div className="space-y-1.5 flex-1 max-w-sm">
                <Label htmlFor="startDate" className="text-xs font-medium text-muted-foreground">
                  Start
                </Label>
                <div className="relative flex items-center gap-2">
                  {/* Visual & Interactive Date Box */}
                  <div className="relative flex-1 flex items-center gap-2 h-10 px-3 rounded-lg border bg-background text-sm shadow-2xs hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring transition-colors">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className={`truncate ${startDate ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {formatDateDisplay(form.startAt)}
                    </span>
                    <input
                      id="startDate"
                      type="date"
                      aria-label="Start date"
                      value={startDate}
                      min={sgToday}
                      onChange={(e) => update("startAt", updateStartPart("date", e.target.value, form.startAt))}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {}
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>

                  {/* Visual & Interactive Time Box */}
                  <div className="relative flex-1 flex items-center justify-between h-10 px-3 rounded-lg border bg-background text-sm shadow-2xs hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className={`truncate ${startTime ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {formatTimeDisplay(form.startAt)}
                      </span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      id="startTime"
                      type="time"
                      aria-label="Start time"
                      value={startTime}
                      min={startDate === sgToday ? sgNowTime : undefined}
                      onChange={(e) => update("startAt", updateStartPart("time", e.target.value, form.startAt))}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {}
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>
                <div className="min-h-[1.25rem]">
                  {fieldErrors.startAt?.[0] && (
                    <p className="text-xs text-destructive">{fieldErrors.startAt[0]}</p>
                  )}
                </div>
              </div>

              <div className="hidden md:flex items-center justify-center pt-8 text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
              </div>

              {/* End Controls */}
              <div className="space-y-1.5 flex-1 max-w-sm">
                <Label htmlFor="endDate" className="text-xs font-medium text-muted-foreground">
                  End
                </Label>
                <div className="relative flex items-center gap-2">
                  {/* Visual & Interactive Date Box */}
                  <div className="relative flex-1 flex items-center gap-2 h-10 px-3 rounded-lg border bg-background text-sm shadow-2xs hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring transition-colors">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className={`truncate ${endDate ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {formatDateDisplay(form.endAt)}
                    </span>
                    <input
                      id="endDate"
                      type="date"
                      aria-label="End date"
                      value={endDate}
                      min={startDate || sgToday}
                      onChange={(e) => update("endAt", updateEndPart("date", e.target.value, form.endAt))}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {}
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>

                  {/* Visual & Interactive Time Box */}
                  <div className="relative flex-1 flex items-center justify-between h-10 px-3 rounded-lg border bg-background text-sm shadow-2xs hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className={`truncate ${endTime ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {formatTimeDisplay(form.endAt)}
                      </span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      id="endTime"
                      type="time"
                      aria-label="End time"
                      value={endTime}
                      min={endDate === startDate && startTime ? startTime : undefined}
                      onChange={(e) => update("endAt", updateEndPart("time", e.target.value, form.endAt))}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {}
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>
                <div className="min-h-[1.25rem]">
                  {fieldErrors.endAt?.[0] && (
                    <p className="text-xs text-destructive">{fieldErrors.endAt[0]}</p>
                  )}
                </div>
              </div>

              {/* Duration Box */}
              <div className="rounded-xl border bg-muted/20 px-4 py-2 flex flex-col justify-center self-start md:self-auto md:mt-6 text-xs text-muted-foreground min-w-[110px]">
                <div className="text-[10px] text-muted-foreground font-medium">Duration</div>
                <div className="font-bold text-foreground text-sm leading-tight mt-0.5">{durationText.primary}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">{durationText.secondary}</div>
              </div>
            </div>
          </div>

          {/* Row 3: Quantity & Reserve Button */}
          <div className="flex flex-wrap items-end justify-between gap-4 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-medium text-muted-foreground">
                Quantity
              </Label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(form.quantity || "1", 10);
                    if (current > 1) update("quantity", String(current - 1));
                  }}
                  disabled={pending || parseInt(form.quantity || "1", 10) <= 1}
                  className="flex h-10 w-10 items-center justify-center rounded-l-md border border-r-0 border-input bg-muted hover:bg-accent disabled:opacity-50 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                  className="h-10 w-16 rounded-none text-center border-input focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(form.quantity || "1", 10);
                    update("quantity", String(Number.isNaN(current) ? 1 : current + 1));
                  }}
                  disabled={pending}
                  className="flex h-10 w-10 items-center justify-center rounded-r-md border border-l-0 border-input bg-muted hover:bg-accent disabled:opacity-50 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {fieldErrors.quantity?.[0] && (
                <p className="text-xs text-destructive">
                  {fieldErrors.quantity[0]}
                </p>
              )}
            </div>

            <Button
              type="button"
              onClick={reserve}
              disabled={pending}
              className="h-11 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 flex items-center gap-2 shadow-xs"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Reserving equipment...</span>
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  <span>
                    {isQuantityValid
                      ? `Reserve ${form.quantity} equipment`
                      : "Reserve equipment"}
                  </span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>

          {!events.length && (
            <p className="text-sm text-muted-foreground pt-1">
              There are no approved events ready for an equipment reservation.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2. Live Equipment Availability Card */}
      <Card className="border border-border bg-card text-card-foreground shadow-xs backdrop-blur-none backdrop-saturate-100">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart2 className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">Live equipment availability</CardTitle>
              <CardDescription className="text-xs text-muted-foreground min-h-[1.25rem] mt-0.5 leading-normal">
                {availabilityError ? (
                  <span className="font-medium text-destructive">{availabilityError}</span>
                ) : periodText && allAvailability ? (
                  periodText
                ) : form.startAt && form.endAt && form.startAt.includes("T") && form.endAt.includes("T") && !form.startAt.startsWith("T") && !form.endAt.startsWith("T") ? (
                  "Calculating live equipment availability..."
                ) : (
                  "Select start and end dates and times above to view live equipment availability for that period."
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Hero Card for Selected Equipment */}
          {selectedEquipment ? (
            (() => {
              const SelectedIcon = getEquipmentIcon(selectedEquipment.type);

              return (
                <div className="rounded-xl border bg-muted/40 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-background text-foreground shadow-2xs">
                      <SelectedIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-foreground">{selectedEquipment.type}</h4>
                      <p className="text-xs text-muted-foreground">{selectedEquipment.totalQuantity} total unit(s)</p>
                    </div>
                  </div>

                  <div className="space-y-1 md:text-right min-w-[220px]">
                    <span className="text-sm font-bold text-foreground">
                      {availability !== null
                        ? `${availability} of ${selectedEquipment.totalQuantity} available`
                        : `— of ${selectedEquipment.totalQuantity} available`}
                    </span>

                    <div className="flex items-center gap-2 text-xs md:justify-end min-h-[1.25rem]">
                      <span
                        className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                          availability === null
                            ? "bg-muted-foreground"
                            : !isQuantityValid
                            ? "bg-warning"
                            : isQuantityExceeded
                            ? "bg-destructive"
                            : "bg-success"
                        }`}
                      />
                      <p
                        className={`text-xs font-medium ${
                          isQuantityExceeded ? "text-destructive" : "text-muted-foreground"
                        }`}
                        role="status"
                      >
                        {availability === null
                          ? "Select period above to calculate live availability."
                          : !isQuantityValid
                          ? "Enter a quantity of at least 1."
                          : isQuantityExceeded
                          ? `Requested quantity (${reqQty}) exceeds availability (${availability} unit(s) available for this period) — ${verdict?.shortfall} short.`
                          : `Your requested quantity is available (${availability} unit(s) available for this period).`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground bg-muted/20">
              Select an equipment type above to view detailed availability metrics.
            </div>
          )}

          {/* SCRUM-30 — what this item is already committed to, and where
              those commitments collide. */}
          {selectedEquipment && (
            <EquipmentSchedulePanel
              key={selectedEquipment.id}
              equipmentId={selectedEquipment.id}
              equipmentType={selectedEquipment.type}
            />
          )}

          {/* Grid of Other Equipment */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground">
              {selectedEquipment ? "Other equipment (for the same period)" : "Equipment pool"}
            </h4>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(selectedEquipment ? otherEquipment : equipment).map((item) => {
                const ItemIcon = getEquipmentIcon(item.type);
                const liveCount = allAvailability?.[item.id]?.available ?? null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => update("equipmentId", item.id)}
                    className="w-full text-left rounded-xl border p-4 text-sm flex flex-col justify-between space-y-3 bg-card hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/20 text-foreground">
                        <ItemIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-tight">{item.type}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.totalQuantity} total unit(s)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs pt-1">
                      <span
                        className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                          liveCount === null
                            ? "bg-muted-foreground"
                            : liveCount === 0
                            ? "bg-destructive"
                            : "bg-success"
                        }`}
                      />
                      {liveCount !== null ? (
                        <span
                          className={`font-semibold ${
                            liveCount === 0 ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {liveCount} of {item.totalQuantity} available
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Select period
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
