"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FilePenLine } from "lucide-react";
import type { Event } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/app/date-time-picker";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import {
  getChangeRequestsForEvent,
  raiseChangeRequest,
  type ChangeRequestView,
} from "@/app/(app)/events/change-request-actions";
import { getFormCatalogues } from "@/app/(app)/events/actions";
import { ChangeRequestDecision } from "@/components/events/change-request-decision";
import {
  CHANGEABLE_FIELDS,
  CHANGE_KEYS,
  CHANGE_REQUEST_STATUS_LABEL,
  changeFieldLabel,
  changeValueLabel,
  type ChangeableField,
  type ChangeKey,
  type ChangeRequestChanges,
} from "@/lib/schemas/change-request";
import {
  formatDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
} from "@/lib/datetime";

type TextField = Exclude<
  ChangeKey,
  "startAt" | "endAt" | "expectedAttendance" | "registrationRequired"
>;

const TEXT_FIELDS = CHANGE_KEYS.filter(
  (key): key is TextField =>
    key !== "startAt" &&
    key !== "endAt" &&
    key !== "expectedAttendance" &&
    key !== "registrationRequired",
);

const SHORT_FIELDS: readonly string[] = ["name", "purpose", "preferredLayout"];

/** The order fields are listed in, matching the request form. */
const FIELD_ORDER: readonly string[] = CHANGE_KEYS;

type Draft = Record<string, string>;

/** The catalogue names the request form suggests (SCRUM-13), by the field they fill. */
type Suggestions = { venueRequirements: string[]; equipmentRequirements: string[] };

const SUGGESTION_LEAD: Record<keyof Suggestions, string> = {
  venueRequirements: "Preferred venue",
  equipmentRequirements: "Requested equipment",
};

/** Shown when the submission never got an answer, e.g. the connection dropped. */
const SEND_FAILED_MESSAGE =
  "The change request couldn't be sent. If it isn't in the list of change requests, try again.";

function draftFrom(event: Event): Draft {
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, event[f] ?? ""])),
    startAt: utcToSgWallTime(event.startAt),
    endAt: utcToSgWallTime(event.endAt),
    expectedAttendance: event.expectedAttendance?.toString() ?? "",
    // SCRUM-171: blank on a request made before the question was asked.
    registrationRequired:
      event.registrationRequired === null ? "" : event.registrationRequired ? "yes" : "no",
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
  if (after.registrationRequired !== before.registrationRequired) {
    changes.registrationRequired = after.registrationRequired === "yes";
  }
  for (const key of TEXT_FIELDS) {
    if (after[key] !== before[key]) changes[key] = after[key];
  }
  return changes;
}


/** A number for attendance, a line for short text, a box for the rest. */
function FieldControl({
  field,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  field: Exclude<ChangeableField, "schedule" | "registrationRequired">;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  const props = {
    id: `change-${field}`,
    value,
    "aria-invalid": invalid,
    "aria-describedby": describedBy,
  };
  if (field === "expectedAttendance" || SHORT_FIELDS.includes(field)) {
    return (
      <Input
        {...props}
        type={field === "expectedAttendance" ? "number" : "text"}
        min={field === "expectedAttendance" ? 1 : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return <Textarea {...props} onChange={(e) => onChange(e.target.value)} />;
}

function ChangeRequestItem({
  request,
  children,
}: {
  request: ChangeRequestView;
  children?: React.ReactNode;
}) {
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
                {changeValueLabel(field.fieldName, field.oldValue)} →{" "}
                <span className="text-foreground">
                  {changeValueLabel(field.fieldName, field.newValue)}
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
      {children}
    </li>
  );
}

/**
 * SCRUM-41 — on the event page's Changes tab, for the Organiser and the
 * Coordinator. Lists the event's change requests with their status (AC6),
 * and lets the Organiser or the assigned Coordinator raise one (AC1, AC9)
 * while none is waiting for a decision (AC7), in a pop-up over the tab
 * (SCRUM-208). For an event that has none and can't take one, shows
 * `whenEmpty` (SCRUM-208 AC3), or nothing.
 */
export function ChangeRequestPanel({
  event,
  whenEmpty = null,
}: {
  event: Event;
  whenEmpty?: React.ReactNode;
}) {
  // null while loading; "failed" if the read failed.
  const [loaded, setLoaded] = useState<
    { requests: ChangeRequestView[]; canRaise: boolean } | "failed" | null
  >(null);
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

  function openForm() {
    setFormOpen(true);
    if (suggestions) return;
    // A refusal is remembered as no suggestions, so it isn't asked again.
    const none = { venueRequirements: [], equipmentRequirements: [] };
    getFormCatalogues()
      .then((result) =>
        setSuggestions(
          result.ok
            ? {
                venueRequirements: result.data.venues.map((v) => v.name),
                equipmentRequirements: result.data.equipment.map((e) => e.type),
              }
            : none,
        ),
      )
      .catch(() => setSuggestions(none));
  }

  function closeForm() {
    setFormOpen(false);
    setErrors({});
    setFormError(null);
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
        if (!cancelled) setLoaded(result.ok ? result.data : "failed");
      })
      .catch(() => {
        if (!cancelled) setLoaded("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [event.id, version]);

  async function submit() {
    setSubmitting(true);
    let result: Awaited<ReturnType<typeof raiseChangeRequest>>;
    try {
      result = await raiseChangeRequest({
        eventId: event.id,
        requestsCancellation: cancelling,
        reason,
        changes: cancelling ? {} : changesBetween(draftFrom(event), draft),
      });
    } catch {
      // The action rethrows anything unexpected, and a lost connection
      // rejects too. Either way the request may or may not have been saved,
      // so the list is read again.
      setErrors({});
      setFormError(SEND_FAILED_MESSAGE);
      reload();
      return;
    } finally {
      setSubmitting(false);
    }
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      // A validation error changed nothing on the server; anything else
      // (a request raised elsewhere, a decision) may have.
      if (!result.fieldErrors) reload();
      return;
    }
    closeForm();
    setReason("");
    setCancelling(false);
    setDraft(draftFrom(event));
    toast.success("Change request submitted.");
    // The action's revalidatePath already refreshed the page around the dialog.
    reload();
  }

  if (loaded === null) {
    return <p className="text-xs text-muted-foreground">Loading change requests…</p>;
  }
  if (loaded === "failed") {
    return (
      <p role="alert" className="text-xs text-muted-foreground">
        Couldn&apos;t load the change requests — try reopening this event.
      </p>
    );
  }
  const { requests, canRaise } = loaded;
  if (requests.length === 0 && !canRaise) return whenEmpty;

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
              <ChangeRequestItem key={request.id} request={request}>
                {/* SCRUM-128: the assigned Coordinator decides it here. */}
                {request.status === "PENDING_REVIEW" && (
                  <ChangeRequestDecision eventId={event.id} onDecided={reload} />
                )}
              </ChangeRequestItem>
            ))}
          </ul>
        )}

        {canRaise && (
          <Button size="sm" variant="outline" onClick={openForm}>
            Request a change
          </Button>
        )}

        <Dialog
          open={formOpen}
          // Closing keeps what was typed, as Discard changes always has.
          onOpenChange={(open) => !open && !submitting && closeForm()}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request a change</DialogTitle>
              <DialogDescription>
                Your coordinator reviews the request before anything changes.
              </DialogDescription>
            </DialogHeader>
            <form
              aria-label="Request a change"
              // The shared schema's message, next to the field, not the browser's.
              noValidate
              className="space-y-3 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
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
                            <div key={key} className="space-y-1">
                              <label
                                htmlFor={`change-${key}`}
                                className="block font-medium"
                              >
                                {key === "startAt" ? "Start" : "End"}
                              </label>
                              <DateTimePicker
                                id={`change-${key}`}
                                value={draft[key]}
                                onChange={set(key)}
                                aria-invalid={Boolean(errors[key])}
                                aria-describedby={describedBy(key)}
                              />
                              <FieldError
                                id={`change-${key}-error`}
                                messages={errors[key]}
                              />
                            </div>
                          ))}
                        </div>
                      ) : field === "registrationRequired" ? (
                        <fieldset
                          key={field}
                          className="space-y-1"
                          aria-describedby={describedBy(field)}
                        >
                          <legend className="font-medium">
                            {CHANGEABLE_FIELDS[field]}
                          </legend>
                          <div className="flex gap-4">
                            {(["yes", "no"] as const).map((value) => (
                              <label key={value} className="flex items-center gap-1.5">
                                <input
                                  type="radio"
                                  name="change-registrationRequired"
                                  value={value}
                                  checked={draft.registrationRequired === value}
                                  onChange={() => set(field)(value)}
                                  className="h-4 w-4 accent-primary"
                                />
                                {value === "yes" ? "Yes" : "No"}
                              </label>
                            ))}
                          </div>
                          <FieldError
                            id={`change-${field}-error`}
                            messages={errors[field]}
                          />
                        </fieldset>
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
                          <FieldControl
                            field={field}
                            value={draft[field]}
                            onChange={set(field)}
                            invalid={Boolean(errors[field])}
                            describedBy={describedBy(field)}
                          />
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
                  onClick={closeForm}
                >
                  Discard changes
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
