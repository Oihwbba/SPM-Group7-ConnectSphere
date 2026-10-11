"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePenLine } from "lucide-react";
import type { Event } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getChangeRequestsForEvent,
  raiseChangeRequest,
  type ChangeRequestView,
} from "@/app/(app)/events/change-request-actions";
import { getFormCatalogues } from "@/app/(app)/events/actions";
import {
  CHANGEABLE_FIELDS,
  CHANGE_REQUEST_STATUS_LABEL,
  changeFieldLabel,
  type ChangeableField,
  type ChangeRequestChanges,
} from "@/lib/schemas/change-request";
import {
  formatDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
} from "@/lib/datetime";

const TEXT_FIELDS = [
  "name",
  "purpose",
  "description",
  "venueRequirements",
  "accessibilityNeeds",
  "preferredLayout",
  "equipmentRequirements",
  "registrationNotes",
  "programme",
  "specialRequests",
] as const;

const SHORT_FIELDS: readonly string[] = ["name", "purpose", "preferredLayout"];

/** The order fields are listed in, matching the request form. */
const FIELD_ORDER = [
  "name",
  "purpose",
  "description",
  "startAt",
  "endAt",
  "expectedAttendance",
  "venueRequirements",
  "accessibilityNeeds",
  "preferredLayout",
  "equipmentRequirements",
  "registrationNotes",
  "programme",
  "specialRequests",
];

type Draft = Record<string, string>;

/** The catalogue names the request form suggests (SCRUM-13), by the field they fill. */
type Suggestions = { venueRequirements: string[]; equipmentRequirements: string[] };

const SUGGESTION_LEAD: Record<keyof Suggestions, string> = {
  venueRequirements: "Preferred venue",
  equipmentRequirements: "Requested equipment",
};

function draftFrom(event: Event): Draft {
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, event[f] ?? ""])),
    startAt: utcToSgWallTime(event.startAt),
    endAt: utcToSgWallTime(event.endAt),
    expectedAttendance: event.expectedAttendance?.toString() ?? "",
  };
}

/** Only what was edited, in the shape the action takes. */
function changesBetween(before: Draft, after: Draft): ChangeRequestChanges {
  const changes: ChangeRequestChanges = {};
  if (after.startAt !== before.startAt || after.endAt !== before.endAt) {
    changes.startAt = sgWallTimeToUtcIso(after.startAt) ?? after.startAt;
    changes.endAt = sgWallTimeToUtcIso(after.endAt) ?? after.endAt;
  }
  if (after.expectedAttendance !== before.expectedAttendance) {
    changes.expectedAttendance = Number(after.expectedAttendance);
  }
  for (const key of TEXT_FIELDS) {
    if (after[key] !== before[key]) changes[key] = after[key];
  }
  return changes;
}

function shown(fieldName: string, value: string | null): string {
  if (value === null || value === "") return "—";
  return fieldName === "startAt" || fieldName === "endAt"
    ? formatDateTime(new Date(value))
    : value;
}

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.[0]) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {messages[0]}
    </p>
  );
}

function ChangeRequestItem({ request }: { request: ChangeRequestView }) {
  const fields = [...request.fields].sort(
    (a, b) => FIELD_ORDER.indexOf(a.fieldName) - FIELD_ORDER.indexOf(b.fieldName),
  );
  return (
    <li
      data-testid="change-request"
      data-status={request.status}
      className="space-y-2 rounded-md border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {CHANGE_REQUEST_STATUS_LABEL[request.status]}
        </span>
        <span className="text-muted-foreground">
          Raised {formatDateTime(request.createdAt)}
        </span>
      </div>
      {request.raisedFor && (
        <p className="text-muted-foreground">
          Raised by Coordinator for {request.raisedFor}
        </p>
      )}
      {request.requestsCancellation ? (
        <p className="font-medium">Asks for the event to be cancelled.</p>
      ) : (
        <ul className="space-y-1">
          {fields.map((field) => (
            <li key={field.fieldName}>
              <span className="font-medium">
                {changeFieldLabel(field.fieldName)}
              </span>
              {field.isMajor && (
                <span className="ml-1 rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning-foreground">
                  Impactful
                </span>
              )}
              <span className="block text-muted-foreground">
                {shown(field.fieldName, field.oldValue)} →{" "}
                <span className="text-foreground">
                  {shown(field.fieldName, field.newValue)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {request.reason && (
        <p className="whitespace-pre-wrap">
          <span className="font-semibold text-muted-foreground">Reason:</span>{" "}
          {request.reason}
        </p>
      )}
      {request.status === "REJECTED" && request.decisionReason && (
        <p className="whitespace-pre-wrap text-destructive">
          <span className="font-semibold">Rejected because:</span>{" "}
          {request.decisionReason}
        </p>
      )}
    </li>
  );
}

/**
 * SCRUM-41 — inside the event details dialog for the Organiser and the
 * Coordinator. Lists the event's change requests with their status (AC6),
 * and lets the Organiser or the assigned Coordinator raise one (AC1, AC9)
 * while none is waiting for a decision (AC7). Renders nothing for an event
 * that has none and can't take one.
 */
export function ChangeRequestPanel({ event }: { event: Event }) {
  const [requests, setRequests] = useState<ChangeRequestView[]>([]);
  const [canRaise, setCanRaise] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<Draft>(() => draftFrom(event));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // SCRUM-41 AC4: the same catalogue suggestions as the request form. Only
  // the Organiser may read the catalogue (SCRUM-13), so a Coordinator raising
  // a request on their behalf types the values instead.
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const router = useRouter();

  function openForm() {
    setFormOpen(true);
    if (suggestions) return;
    getFormCatalogues()
      .then((result) => {
        if (!result.ok) return;
        setSuggestions({
          venueRequirements: result.data.venues.map((v) => v.name),
          equipmentRequirements: result.data.equipment.map((e) => e.type),
        });
      })
      .catch(() => {});
  }

  function suggest(field: keyof Suggestions, name: string) {
    setDraft((current) => ({
      ...current,
      [field]: current[field]
        ? `${current[field]}, ${name}`
        : `${SUGGESTION_LEAD[field]}: ${name}`,
    }));
  }

  // Bumped after a submission, so the list is read again.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    getChangeRequestsForEvent(event.id)
      .then((result) => {
        if (cancelled) return;
        setLoadFailed(!result.ok);
        if (result.ok) {
          setRequests(result.data.requests);
          setCanRaise(result.data.canRaise);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id, version]);

  async function submit() {
    setSubmitting(true);
    const result = await raiseChangeRequest({
      eventId: event.id,
      requestsCancellation: cancelling,
      reason,
      changes: cancelling ? {} : changesBetween(draftFrom(event), draft),
    });
    setSubmitting(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      reload();
      return;
    }
    setErrors({});
    setFormError(null);
    setFormOpen(false);
    setReason("");
    setCancelling(false);
    setDraft(draftFrom(event));
    toast.success("Change request submitted.");
    reload();
    router.refresh();
  }

  if (loading) return null;
  if (loadFailed) {
    return (
      <p role="alert" className="text-xs text-muted-foreground">
        Couldn&apos;t load the change requests — try reopening this event.
      </p>
    );
  }
  if (requests.length === 0 && !canRaise) return null;

  const set = (key: string) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const describedBy = (key: string) =>
    errors[key] ? `change-${key}-error` : undefined;

  return (
    <Card>
      <CardHeader className="bg-muted/30 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FilePenLine className="h-4 w-4 text-primary" /> Change requests
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-xs">
        {requests.length === 0 ? (
          <p className="text-muted-foreground">No change requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((request) => (
              <ChangeRequestItem key={request.id} request={request} />
            ))}
          </ul>
        )}

        {canRaise && !formOpen && (
          <Button size="sm" variant="outline" onClick={openForm}>
            Request a change
          </Button>
        )}

        {formOpen && (
          <form
            aria-label="Request a change"
            // The shared schema's message, next to the field, not the browser's.
            noValidate
            className="space-y-3 border-t pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <p className="text-muted-foreground">
              Your coordinator reviews the request before anything changes.
            </p>
            {formError && (
              <p role="alert" className="text-destructive">
                {formError}
              </p>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cancelling}
                onChange={(e) => setCancelling(e.target.checked)}
              />
              <span>Ask to cancel the event instead</span>
            </label>

            {!cancelling && (
              <div className="space-y-2">
                {(Object.keys(CHANGEABLE_FIELDS) as ChangeableField[]).map(
                  (field) =>
                    field === "schedule" ? (
                      <div
                        key={field}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                      >
                        {(["startAt", "endAt"] as const).map((key) => (
                          <label key={key} className="space-y-1">
                            <span className="font-medium">
                              {key === "startAt" ? "Start" : "End"}
                            </span>
                            <Input
                              type="datetime-local"
                              value={draft[key]}
                              onChange={(e) => set(key)(e.target.value)}
                              aria-invalid={Boolean(errors[key])}
                              aria-describedby={describedBy(key)}
                            />
                            <FieldError
                              id={`change-${key}-error`}
                              messages={errors[key]}
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      // A div, not a label: the suggestion buttons must not
                      // become the field's labelled control.
                      <div key={field} className="space-y-1">
                        <label
                          htmlFor={`change-${field}`}
                          className="block font-medium"
                        >
                          {CHANGEABLE_FIELDS[field]}
                        </label>
                        {suggestions &&
                          (field === "venueRequirements" ||
                            field === "equipmentRequirements") &&
                          suggestions[field].length > 0 && (
                            <span className="flex flex-wrap gap-1.5">
                              {suggestions[field].map((name) => (
                                <button
                                  key={name}
                                  type="button"
                                  aria-label={`Add ${name} to ${CHANGEABLE_FIELDS[field].toLowerCase()}`}
                                  className="rounded border bg-background px-2 py-0.5 text-[11px] hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
                                  onClick={() => suggest(field, name)}
                                >
                                  {name}
                                </button>
                              ))}
                            </span>
                          )}
                        {field === "expectedAttendance" ||
                        SHORT_FIELDS.includes(field) ? (
                          <Input
                            id={`change-${field}`}
                            type={
                              field === "expectedAttendance" ? "number" : "text"
                            }
                            min={field === "expectedAttendance" ? 1 : undefined}
                            value={draft[field]}
                            onChange={(e) => set(field)(e.target.value)}
                            aria-invalid={Boolean(errors[field])}
                            aria-describedby={describedBy(field)}
                          />
                        ) : (
                          <Textarea
                            id={`change-${field}`}
                            value={draft[field]}
                            onChange={(e) => set(field)(e.target.value)}
                            aria-invalid={Boolean(errors[field])}
                            aria-describedby={describedBy(field)}
                          />
                        )}
                        <FieldError
                          id={`change-${field}-error`}
                          messages={errors[field]}
                        />
                      </div>
                    ),
                )}
                <FieldError id="change-changes-error" messages={errors.changes} />
              </div>
            )}

            <label className="block space-y-1">
              <span className="font-medium">
                {cancelling ? "Reason for cancelling" : "Reason (optional)"}
              </span>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={Boolean(errors.reason)}
                aria-describedby={describedBy("reason")}
              />
              <FieldError id="change-reason-error" messages={errors.reason} />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit change request"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={submitting}
                onClick={() => {
                  setFormOpen(false);
                  setErrors({});
                  setFormError(null);
                }}
              >
                Discard changes
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
