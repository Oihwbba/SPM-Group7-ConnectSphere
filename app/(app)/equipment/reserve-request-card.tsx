"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ClipboardCheck,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
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
import { checkQuantity, type Availability } from "@/lib/equipment/availability";
import { formatEventPeriod } from "@/lib/equipment/requests";
import type { ReservableRequest } from "@/lib/equipment/request-queries";
import { sgWallTimeToUtcIso, utcToSgWallTime } from "@/lib/datetime";
import {
  getAllEquipmentAvailability,
  reserveEquipmentRequest,
} from "./actions";

type Equipment = { id: string; type: string; totalQuantity: number };
// `requirements` are the Coordinator's notes for the line the row came from.
type Row = {
  key: number;
  equipmentId: string;
  quantity: string;
  requirements: string | null;
};
type AvailabilityMap = Record<string, Availability>;

const OFFLINE =
  "Couldn't reach the server. Check your connection and try again.";
const PREVIEW_FAILED =
  "Couldn't check what is free for this period. You can still reserve; the server checks again.";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

let nextRowKey = 0;
const newRow = (
  equipmentId = "",
  quantity = "1",
  requirements: string | null = null,
): Row => ({
  key: nextRowKey++,
  equipmentId,
  quantity,
  requirements,
});

/**
 * SCRUM-155 — reserve an approved request in one step. Choosing a request
 * fills in its event's period and one row per requested type (AC 2); the
 * rows are reserved together or not at all (AC 3, 4).
 */
export function ReserveRequestCard({
  requests,
  equipment,
  onReserved,
}: {
  requests: ReservableRequest[];
  equipment: Equipment[];
  onReserved?: () => void;
}) {
  const [requestId, setRequestId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [availability, setAvailability] = useState<AvailabilityMap | null>(
    null,
  );
  const [previewFailed, setPreviewFailed] = useState(false);
  // Bumped whenever the free counts may be stale with the period unchanged:
  // a request is chosen again, or a reservation has just used up stock.
  const [previewVersion, setPreviewVersion] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = requests.find((request) => request.id === requestId);
  const startIso = sgWallTimeToUtcIso(startAt);
  const endIso = sgWallTimeToUtcIso(endAt);

  // What is free for the period, so each row can say whether it fits before
  // saving. The server counts again under its locks; this is only a preview.
  useEffect(() => {
    if (!startIso || !endIso || endIso <= startIso) return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const result = await getAllEquipmentAvailability({
          startAt: startIso,
          endAt: endIso,
        });
        if (!current) return;
        setAvailability(result.ok ? result.data : null);
        setPreviewFailed(!result.ok);
      } catch {
        if (!current) return;
        setAvailability(null);
        setPreviewFailed(true);
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [startIso, endIso, previewVersion]);

  const clearMessages = () => {
    setFieldErrors({});
    setError(null);
  };

  const choose = (id: string) => {
    clearMessages();
    setAvailability(null);
    setPreviewFailed(false);
    setPreviewVersion((version) => version + 1);
    setRequestId(id);
    const request = requests.find((candidate) => candidate.id === id);
    setStartAt(utcToSgWallTime(request?.event.startAt));
    setEndAt(utcToSgWallTime(request?.event.endAt));
    setRows(
      request?.lines.map((line) =>
        newRow(
          line.equipment.id,
          String(line.quantity),
          line.technicalRequirements,
        ),
      ) ?? [],
    );
  };

  const changePeriod = (set: (value: string) => void, value: string) => {
    clearMessages();
    setAvailability(null);
    setPreviewFailed(false);
    set(value);
  };

  const changeRow = (key: number, change: Partial<Row>) => {
    clearMessages();
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  };

  const removeRow = (key: number) => {
    clearMessages();
    setRows((current) => current.filter((row) => row.key !== key));
  };

  const addRow = () => {
    clearMessages();
    setRows((current) => [...current, newRow()]);
  };

  const reserve = () =>
    startTransition(async () => {
      clearMessages();
      try {
        const result = await reserveEquipmentRequest({
          requestId,
          // A time that isn't a full Singapore date and time is sent empty,
          // so the server reports it at the field rather than reading the
          // raw text as UTC (GLM review of #130).
          startAt: startIso ?? "",
          endAt: endIso ?? "",
          lines: rows.map((row) => ({
            equipmentId: row.equipmentId,
            quantity: row.quantity,
          })),
        });
        if (!result.ok) {
          setError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }
        toast.success(
          `Reserved ${result.data.reserved} item(s) for ${chosen?.event.name}.`,
        );
        setRequestId("");
        setRows([]);
        setAvailability(null);
        setPreviewVersion((version) => version + 1);
        onReserved?.();
      } catch {
        // An unexpected failure rejects instead of returning an error, so the
        // card says so rather than only stopping its spinner.
        setError(OFFLINE);
      }
    });

  return (
    <Card
      id="reserve-request"
      className="shadow-xs scroll-mt-24 border border-border bg-card text-card-foreground"
    >
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold tracking-tight">
              Reserve an approved request
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs text-muted-foreground">
              Fills in what the Coordinator asked for that isn&apos;t reserved
              yet. Every item is reserved together, or none is.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-2">
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No approved requests are waiting to be reserved.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="approved-request" className="text-sm font-semibold">
              Approved request
            </Label>
            <select
              id="approved-request"
              className={SELECT_CLASS}
              value={requestId}
              onChange={(event) => choose(event.target.value)}
            >
              <option value="">Select a request</option>
              {requests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.event.name} — {formatEventPeriod(request.event)}
                  {request.partlyReserved
                    ? " (rest of a partly reserved request)"
                    : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {chosen && (
          <>
            <div
              className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
              data-testid="request-summary"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{chosen.event.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatEventPeriod(chosen.event)} · Requested by{" "}
                    {chosen.requestedBy.name}
                  </p>
                </div>
                <Link
                  href={`/equipment-requests#request-${chosen.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  View request
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              {chosen.notes && (
                <p className="mt-2 text-xs" data-testid="request-notes">
                  <span className="font-medium">Notes:</span> {chosen.notes}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="request-starts"
                  className="text-sm font-semibold"
                >
                  Reservation starts (Singapore time)
                </Label>
                <Input
                  id="request-starts"
                  type="datetime-local"
                  value={startAt}
                  onChange={(event) =>
                    changePeriod(setStartAt, event.target.value)
                  }
                  aria-invalid={Boolean(fieldErrors.startAt)}
                />
                <FieldError messages={fieldErrors.startAt} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-ends" className="text-sm font-semibold">
                  Reservation ends (Singapore time)
                </Label>
                <Input
                  id="request-ends"
                  type="datetime-local"
                  value={endAt}
                  onChange={(event) =>
                    changePeriod(setEndAt, event.target.value)
                  }
                  aria-invalid={Boolean(fieldErrors.endAt)}
                />
                <FieldError messages={fieldErrors.endAt} />
              </div>
            </div>

            <ul className="space-y-3" aria-label="Items to reserve">
              {rows.map((row, index) => {
                const free = availability?.[row.equipmentId];
                const quantity = Number(row.quantity);
                const verdict =
                  free && Number.isInteger(quantity) && quantity > 0
                    ? checkQuantity(free, quantity)
                    : null;
                const errors = [
                  ...(fieldErrors[`lines.${index}.equipmentId`] ?? []),
                  ...(fieldErrors[`lines.${index}.quantity`] ?? []),
                ];
                return (
                  <li
                    key={row.key}
                    className="rounded-lg border border-border p-3"
                    data-testid="request-row"
                  >
                    <div className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_auto]">
                      <div className="space-y-1">
                        <Label htmlFor={`item-${row.key}`} className="text-xs">
                          Item {index + 1}
                        </Label>
                        <select
                          id={`item-${row.key}`}
                          className={SELECT_CLASS}
                          value={row.equipmentId}
                          onChange={(event) =>
                            changeRow(row.key, {
                              equipmentId: event.target.value,
                            })
                          }
                        >
                          <option value="">Select a type</option>
                          {equipment.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`units-${row.key}`} className="text-xs">
                          Units for item {index + 1}
                        </Label>
                        <Input
                          id={`units-${row.key}`}
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(event) =>
                            changeRow(row.key, { quantity: event.target.value })
                          }
                          aria-invalid={errors.length > 0}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.key)}
                        aria-label={`Remove item ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {row.requirements && (
                      <p
                        className="mt-2 text-xs text-muted-foreground"
                        data-testid="row-requirements"
                      >
                        <span className="font-medium">Requirements:</span>{" "}
                        {row.requirements}
                      </p>
                    )}
                    {verdict && (
                      <p
                        className={
                          verdict.sufficient
                            ? "mt-2 text-xs text-success"
                            : "mt-2 text-xs text-destructive"
                        }
                        data-testid="row-availability"
                      >
                        {verdict.sufficient
                          ? `${verdict.available} of ${verdict.total} free for this period.`
                          : `Only ${verdict.available} of ${verdict.total} free for this period — ${verdict.shortfall} short.`}
                      </p>
                    )}
                    <FieldError messages={errors} />
                  </li>
                );
              })}
            </ul>
            <FieldError messages={fieldErrors.lines} />
            {previewFailed && (
              <p
                className="text-xs text-muted-foreground"
                data-testid="preview-failed"
              >
                {PREVIEW_FAILED}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={addRow}>
                <Plus className="h-4 w-4" />
                Add item
              </Button>
              <Button
                type="button"
                onClick={reserve}
                disabled={pending || rows.length === 0}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reserving…
                  </>
                ) : (
                  `Reserve all ${rows.length} item(s)`
                )}
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}
