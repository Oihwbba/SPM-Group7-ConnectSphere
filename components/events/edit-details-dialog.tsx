"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
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
import { sgWallTimeToUtcIso, utcToSgWallTime } from "@/lib/datetime";
import { LAYOUT_OPTIONS } from "@/lib/schemas/event";
import {
  canEditEventDetails,
  updateEventDetails,
} from "@/app/(app)/events/edit-actions";

type Form = {
  name: string;
  purpose: string;
  description: string;
  accessibilityNeeds: string;
  preferredLayout: string;
  registrationNotes: string;
  programme: string;
  specialRequests: string;
  start: string;
  end: string;
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
    programme: event.programme ?? "",
    specialRequests: event.specialRequests ?? "",
    start: utcToSgWallTime(event.startAt),
    end: utcToSgWallTime(event.endAt),
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
    label: "Registration needs",
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

/**
 * SCRUM-25 — the event's assigned Coordinator edits its details while it is
 * Under Review or in Planning. Offered only to that Coordinator; the server
 * decides again on save. Date, time, attendance, venue and equipment can be
 * changed while nothing is booked or reserved (AC3); the server says so when
 * they can't.
 */
export function EditDetailsDialog({ event }: { event: Event }) {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(() => formFrom(event));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
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

  const update = (key: keyof Form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
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
    startTransition(async () => {
      const result = await updateEventDetails({
        eventId: event.id,
        name: form.name,
        purpose: form.purpose,
        description: form.description,
        accessibilityNeeds: form.accessibilityNeeds,
        preferredLayout: form.preferredLayout,
        registrationNotes: form.registrationNotes,
        programme: form.programme,
        specialRequests: form.specialRequests,
        startAt: sgWallTimeToUtcIso(form.start) ?? "",
        endAt: sgWallTimeToUtcIso(form.end) ?? "",
        expectedAttendance: form.expectedAttendance,
        venueRequirements: form.venueRequirements,
        equipmentRequirements: form.equipmentRequirements,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.error);
        return;
      }
      setFieldErrors({});
      setError(null);
      setOpen(false);
      toast.success(
        result.data.changed.length === 0
          ? "Nothing changed."
          : result.data.safetyCheckOutdated
            ? "Details saved. The safety check is now out of date and needs requesting again."
            : "Details saved.",
      );
      router.refresh();
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
            {MORE_FIELDS.map(textArea)}

            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">
                Date, attendance, venue and equipment
              </legend>
              <p className="text-xs text-muted-foreground">
                These can change only while nothing is booked or reserved for
                the event. Times are Singapore time (SGT, UTC+8).
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-start">Start</Label>
                  <Input
                    id="edit-start"
                    type="datetime-local"
                    value={form.start}
                    onChange={(e) => update("start", e.target.value)}
                    aria-invalid={invalid("startAt")}
                  />
                  {fieldError("startAt")}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-end">End</Label>
                  <Input
                    id="edit-end"
                    type="datetime-local"
                    value={form.end}
                    onChange={(e) => update("end", e.target.value)}
                    aria-invalid={invalid("endAt")}
                  />
                  {fieldError("endAt")}
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

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save details
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
