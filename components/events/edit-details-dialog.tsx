"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Pencil } from "lucide-react";
import type { Event } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EventPeriodInputs } from "@/components/events/event-period-inputs";
import { joinEventPeriod, splitEventPeriod } from "@/lib/datetime";
import { LAYOUT_OPTIONS } from "@/lib/schemas/event";
import type { Arrangement } from "@/lib/reconsideration";
import {
  canEditEventDetails,
  updateEventDetails,
  type EventDetailsSaved,
} from "@/app/(app)/events/edit-actions";

type Form = {
  name: string;
  purpose: string;
  description: string;
  accessibilityNeeds: string;
  preferredLayout: string;
  registrationNotes: string;
  /** SCRUM-171: empty for a request made before the choice existed. */
  registrationRequired: "" | "yes" | "no";
  programme: string;
  specialRequests: string;
  /** SCRUM-190 AC3: one date with a start and an end time. */
  date: string;
  startTime: string;
  endTime: string;
  expectedAttendance: string;
  venueRequirements: string;
  equipmentRequirements: string;
};

function formFrom(event: Event): Form {
  return {
    name: event.name,
    purpose: event.purpose ?? "",
    description: event.description ?? "",
    accessibilityNeeds: event.accessibilityNeeds ?? "",
    preferredLayout: event.preferredLayout ?? "",
    registrationNotes: event.registrationNotes ?? "",
    registrationRequired:
      event.registrationRequired === true
        ? "yes"
        : event.registrationRequired === false
          ? "no"
          : "",
    programme: event.programme ?? "",
    specialRequests: event.specialRequests ?? "",
    ...splitEventPeriod(event.startAt, event.endAt),
    expectedAttendance: event.expectedAttendance?.toString() ?? "",
    venueRequirements: event.venueRequirements ?? "",
    equipmentRequirements: event.equipmentRequirements ?? "",
  };
}

type TextField = { key: keyof Form; label: string; placeholder: string };

const BASIC_FIELDS: TextField[] = [
  {
    key: "purpose",
    label: "Purpose",
    placeholder: "Explain the goal and business objective of the event...",
  },
  {
    key: "description",
    label: "Description",
    placeholder:
      "Provide a detailed description of the event agenda, background, and overview...",
  },
];

const MORE_FIELDS: TextField[] = [
  {
    key: "registrationNotes",
    label: "Registration notes",
    placeholder:
      "Describe attendee registration needs (e.g., online registration open to public, max capacity limit, check-in desks)...",
  },
  {
    key: "programme",
    label: "Programme",
    placeholder:
      "Outline the event schedule, keynotes, breaks, and session timeline...",
  },
  {
    key: "specialRequests",
    label: "Special requests",
    placeholder:
      "Detail any special catering, security, VIP reception, or custom logistics needed...",
  },
];

function savedMessage({ changed, flagged, safetyCheckOutdated }: EventDetailsSaved) {
  if (changed.length === 0) return "Nothing changed.";
  return [
    "Details saved.",
    flagged > 0 &&
      `${flagged} ${flagged === 1 ? "arrangement" : "arrangements"} flagged Needs Reconsideration.`,
    safetyCheckOutdated &&
      "The safety check is now out of date and needs requesting again.",
  ]
    .filter(Boolean)
    .join(" ");
}

type SaveReply = Awaited<ReturnType<typeof updateEventDetails>>;
type FlagWarning = { arrangements: Arrangement[]; message: string | null };

/**
 * What the dialog does with a save's reply. `null` means none arrived (an
 * unexpected error or a lost connection), so the edit may or may not have
 * been saved. Exported for its unit test: this suite has no DOM to click in.
 */
export function showSaveReply(
  reply: SaveReply | null,
  ui: {
    showError: (error: string, fieldErrors: Record<string, string[]>) => void;
    showWarning: (warning: FlagWarning) => void;
    close: (message: string) => void;
    refresh: () => void;
    onSaved?: () => void;
  },
) {
  if (reply === null) {
    ui.showError(
      "The details couldn't be saved — check your connection and try again.",
      {},
    );
    ui.refresh();
    ui.onSaved?.();
    return;
  }
  if (!reply.ok) {
    ui.showError(reply.error, reply.fieldErrors ?? {});
    return;
  }
  if ("confirm" in reply.data) {
    ui.showWarning({ arrangements: reply.data.confirm, message: reply.data.message });
    return;
  }
  ui.close(savedMessage(reply.data));
  ui.refresh();
  ui.onSaved?.();
}

/**
 * SCRUM-25 — the event's assigned Coordinator edits its details while it is
 * Under Review or in Planning. Offered only to that Coordinator; the server
 * decides again on save. In Planning, a change to date, time, attendance,
 * venue or equipment that would flag the event's arrangements is saved only
 * once the Coordinator has seen which ones and confirmed (AC3, SCRUM-26 AC1).
 * `onSaved` runs after a save that may have landed, so the view around the
 * dialog can read again what the edit may have flagged.
 */
export function EditDetailsDialog({
  event,
  onSaved,
}: {
  event: Event;
  onSaved?: () => void;
}) {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(() => formFrom(event));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  // SCRUM-26 AC1: what saving will flag, once the server has said so.
  const [toFlag, setToFlag] = useState<FlagWarning | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // A refusal is reported above the form; bring the first field it names, or
  // else the message itself, into view so it isn't missed further down.
  useEffect(() => {
    if (!error) return;
    const form = formRef.current;
    const target =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form?.querySelector<HTMLElement>('[role="alert"]');
    target?.scrollIntoView({ block: "center" });
    target?.focus({ preventScroll: true });
  }, [error, fieldErrors]);

  useEffect(() => {
    let cancelled = false;
    canEditEventDetails(event.id)
      .then((yes) => !cancelled && setAllowed(yes))
      .catch(() => !cancelled && setAllowed(false));
    return () => {
      cancelled = true;
    };
  }, [event.id, event.status]);

  if (!allowed) return null;

  // A changed form is a different edit, so any warning no longer applies.
  const update = (key: keyof Form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setToFlag(null);
  };
  const invalid = (key: string) => Boolean(fieldErrors[key]?.length);
  const fieldError = (key: string) =>
    fieldErrors[key]?.[0] && (
      <p className="text-xs text-destructive">{fieldErrors[key][0]}</p>
    );
  const textArea = ({ key, label, placeholder }: TextField) => (
    <div key={key} className="space-y-1">
      <Label htmlFor={`edit-${key}`}>{label}</Label>
      <Textarea
        id={`edit-${key}`}
        placeholder={placeholder}
        rows={3}
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
        aria-invalid={invalid(key)}
      />
      {fieldError(key)}
    </div>
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save([]);
  }

  function save(confirmedArrangements: string[]) {
    startTransition(async () => {
      let reply: SaveReply | null = null;
      try {
        reply = await updateEventDetails({
          eventId: event.id,
          name: form.name,
          purpose: form.purpose,
          description: form.description,
          accessibilityNeeds: form.accessibilityNeeds,
          preferredLayout: form.preferredLayout,
          registrationNotes: form.registrationNotes,
          registrationRequired: form.registrationRequired || undefined,
          programme: form.programme,
          specialRequests: form.specialRequests,
          startAt: joinEventPeriod(form).startAt ?? "",
          endAt: joinEventPeriod(form).endAt ?? "",
          expectedAttendance: form.expectedAttendance,
          venueRequirements: form.venueRequirements,
          equipmentRequirements: form.equipmentRequirements,
          confirmedArrangements,
        });
      } catch {
        // Left null: the form keeps what was typed, any warning is dropped so
        // the next save asks again, and the event is read again.
      }
      showSaveReply(reply, {
        showError: (message, errors) => {
          setFieldErrors(errors);
          setError(message);
          setToFlag(null);
        },
        showWarning: (warning) => {
          setFieldErrors({});
          setError(null);
          setToFlag(warning);
        },
        close: (message) => {
          setFieldErrors({});
          setError(null);
          setToFlag(null);
          setOpen(false);
          toast.success(message);
        },
        refresh: () => router.refresh(),
        onSaved,
      });
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setForm(formFrom(event));
          setFieldErrors({});
          setError(null);
          setToFlag(null);
          setOpen(true);
        }}
      >
        <Pencil className="h-4 w-4" /> Edit details
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {event.name}</DialogTitle>
            <DialogDescription>
              Editing doesn&apos;t change the event&apos;s status.
            </DialogDescription>
          </DialogHeader>
          <form ref={formRef} onSubmit={submit} className="space-y-4" noValidate>
            {error && (
              <p
                role="alert"
                tabIndex={-1}
                data-testid="edit-details-error"
                className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="edit-name">Event name</Label>
              <Input
                id="edit-name"
                placeholder="e.g. Annual Southeast Asia Tech Conference"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                aria-invalid={invalid("name")}
              />
              {fieldError("name")}
            </div>
            {BASIC_FIELDS.map(textArea)}

            <div className="space-y-1">
              <Label htmlFor="edit-preferredLayout">Preferred room layout</Label>
              <div className="mb-2 flex flex-wrap gap-2">
                {LAYOUT_OPTIONS.map((layout) => (
                  <Button
                    key={layout}
                    type="button"
                    variant={form.preferredLayout === layout ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    aria-pressed={form.preferredLayout === layout}
                    onClick={() => update("preferredLayout", layout)}
                  >
                    {layout}
                  </Button>
                ))}
              </div>
              <Input
                id="edit-preferredLayout"
                placeholder="e.g. Theatre style or custom arrangement"
                value={form.preferredLayout}
                onChange={(e) => update("preferredLayout", e.target.value)}
                aria-invalid={invalid("preferredLayout")}
              />
              {fieldError("preferredLayout")}
            </div>
            {textArea({
              key: "accessibilityNeeds",
              label: "Accessibility needs",
              placeholder:
                "State any wheelchair access, special physical seating, mobility, or facility arrangements required for attendees...",
            })}
            {/* SCRUM-171 AC5: refused to No while anyone is registered. */}
            <fieldset
              className="space-y-1"
              aria-describedby={
                invalid("registrationRequired")
                  ? "edit-registrationRequired-error"
                  : undefined
              }
            >
              <legend className="text-sm font-medium">
                Registration needed
              </legend>
              <div className="flex gap-4">
                {(["yes", "no"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="edit-registrationRequired"
                      value={value}
                      checked={form.registrationRequired === value}
                      onChange={() => update("registrationRequired", value)}
                      className="h-4 w-4 accent-primary"
                    />
                    {value === "yes" ? "Yes" : "No"}
                  </label>
                ))}
              </div>
              {invalid("registrationRequired") && (
                <p
                  id="edit-registrationRequired-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.registrationRequired[0]}
                </p>
              )}
            </fieldset>
            {MORE_FIELDS.map(textArea)}

            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">
                Date, attendance, venue and equipment
              </legend>
              <p className="text-xs text-muted-foreground">
                In Planning, changing these flags the event&apos;s venue
                bookings and equipment reservations for you to reconsider;
                you&apos;ll see which before anything is saved. Times are
                Singapore time (SGT, UTC+8).
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <EventPeriodInputs
                    idPrefix="edit"
                    value={form}
                    onChange={update}
                    errors={fieldErrors}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-attendance">Expected attendance</Label>
                  <Input
                    id="edit-attendance"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 150"
                    value={form.expectedAttendance}
                    onKeyDown={(e) => {
                      if (["-", "e", "+", "."].includes(e.key)) e.preventDefault();
                    }}
                    onChange={(e) => update("expectedAttendance", e.target.value)}
                    aria-invalid={invalid("expectedAttendance")}
                  />
                  {fieldError("expectedAttendance")}
                </div>
              </div>
              {textArea({
                key: "venueRequirements",
                label: "Venue requirements",
                placeholder:
                  "Specify space size, hall preference, or specific space requirements...",
              })}
              {textArea({
                key: "equipmentRequirements",
                label: "Equipment requirements",
                placeholder:
                  "List required technical equipment (microphones, projectors, sound systems, live streaming, technical staff support)...",
              })}
            </fieldset>

            {toFlag ? (
              <div
                role="alert"
                data-testid="edit-details-flag-warning"
                className="space-y-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
              >
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Saving will flag these arrangements Needs Reconsideration
                </p>
                {toFlag.message && <p>{toFlag.message}</p>}
                <ul className="list-disc space-y-1 pl-5">
                  {toFlag.arrangements.map((arrangement) => (
                    <li key={arrangement.id}>{arrangement.label}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Each keeps its status and its original times until you decide
                  Still stands or Cancel arrangement. Nothing is cancelled for
                  you.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setToFlag(null)}
                  >
                    Back to editing
                  </Button>
                  <Button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      save(toFlag.arrangements.map((arrangement) => arrangement.id))
                    }
                  >
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save and flag
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save details
                </Button>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
