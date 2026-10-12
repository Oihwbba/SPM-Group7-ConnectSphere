"use client";

import { useEffect, useState, useTransition } from "react";
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

const TEXT_FIELDS: { key: keyof Form; label: string; long?: boolean }[] = [
  { key: "name", label: "Event name" },
  { key: "purpose", label: "Purpose", long: true },
  { key: "description", label: "Description", long: true },
  { key: "preferredLayout", label: "Preferred room layout" },
  { key: "accessibilityNeeds", label: "Accessibility needs", long: true },
  { key: "registrationNotes", label: "Registration needs", long: true },
  { key: "programme", label: "Programme", long: true },
  { key: "specialRequests", label: "Special requests", long: true },
];

const ARRANGEMENT_TEXT_FIELDS: { key: keyof Form; label: string }[] = [
  { key: "venueRequirements", label: "Venue requirements" },
  { key: "equipmentRequirements", label: "Equipment requirements" },
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
  const fieldError = (key: string) =>
    fieldErrors[key]?.[0] && (
      <p className="text-xs text-destructive">{fieldErrors[key][0]}</p>
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
              Editing doesn&apos;t change the event&apos;s status. Times are
              Singapore time.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" noValidate>
            {error && (
              <p
                role="alert"
                data-testid="edit-details-error"
                className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {TEXT_FIELDS.map(({ key, label, long }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`edit-${key}`}>{label}</Label>
                {long ? (
                  <Textarea
                    id={`edit-${key}`}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                ) : (
                  <Input
                    id={`edit-${key}`}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                )}
                {fieldError(key)}
              </div>
            ))}

            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">
                Date, attendance, venue and equipment
              </legend>
              <p className="text-xs text-muted-foreground">
                These can change only while nothing is booked or reserved for
                the event.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-start">Start</Label>
                  <Input
                    id="edit-start"
                    type="datetime-local"
                    value={form.start}
                    onChange={(e) => update("start", e.target.value)}
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
                  />
                  {fieldError("endAt")}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-attendance">Expected attendance</Label>
                  <Input
                    id="edit-attendance"
                    inputMode="numeric"
                    value={form.expectedAttendance}
                    onChange={(e) => update("expectedAttendance", e.target.value)}
                  />
                  {fieldError("expectedAttendance")}
                </div>
              </div>
              {ARRANGEMENT_TEXT_FIELDS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`edit-${key}`}>{label}</Label>
                  <Textarea
                    id={`edit-${key}`}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </div>
              ))}
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
