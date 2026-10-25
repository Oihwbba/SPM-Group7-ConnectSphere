"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/app/app-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/lib/datetime";
import {
  changeEquipmentRequestSchema,
  createEquipmentRequestSchema,
  equipmentRequestLineSchema,
  fieldErrorsByPath,
} from "@/lib/schemas/equipment-request";
import { changeEquipmentRequest, createEquipmentRequest } from "./actions";
import { OrganiserEquipmentAnswer } from "@/components/events/organiser-answers";

export type EventOption = {
  id: string;
  name: string;
  startAt: Date | null;
  endAt: Date | null;
  /** SCRUM-170 AC3: the Organiser's answer, shown read-only. */
  equipmentRequirements: string | null;
};
export type EquipmentOption = {
  id: string;
  type: string;
  totalQuantity: number;
  technicalSpecs: string | null;
};

export type Line = {
  equipmentId: string;
  quantity: number;
  technicalRequirements: string | null;
};
type Errors = Record<string, string[] | undefined>;

const EMPTY_DRAFT = {
  equipmentId: "",
  quantity: "1",
  technicalRequirements: "",
};

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.[0]) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {messages[0]}
    </p>
  );
}

/**
 * SCRUM-27 — raise an equipment request. Equipment is added one type at a
 * time: each line is checked with the same schema the server uses (AC 3), and
 * a type already on the request is refused with a message instead of a second
 * line (AC 4). The whole request is checked again before it is sent.
 *
 * SCRUM-142 AC1 — given `editing`, the same form changes an existing
 * request's lines instead: it starts with them, and saving sends the request
 * back to Pending Review. Give it a `key` per request so it starts afresh.
 */
export function NewRequestDialog({
  open,
  onOpenChange,
  events,
  equipment,
  onDone,
  editing,
  fixedEventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: EventOption[];
  equipment: EquipmentOption[];
  onDone: (requestId: string) => void;
  editing?: { requestId: string; eventName: string; lines: Line[] };
  /**
   * SCRUM-209 AC2: raised from the event's own page, so the event is already
   * chosen and there is no event to pick.
   */
  fixedEventId?: string;
}) {
  const [eventId, setEventId] = useState(fixedEventId ?? "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>(editing?.lines ?? []);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [draftErrors, setDraftErrors] = useState<Errors>({});
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  const typeOf = (id: string) =>
    equipment.find((item) => item.id === id)?.type ?? "This type";
  const selectedEvent = events.find((event) => event.id === eventId);
  const draftType = equipment.find((item) => item.id === draft.equipmentId);

  const reset = () => {
    setEventId(fixedEventId ?? "");
    setNotes("");
    setLines(editing?.lines ?? []);
    setDraft(EMPTY_DRAFT);
    setDraftErrors({});
    setErrors({});
  };

  const changeOpen = (next: boolean) => {
    if (pending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const updateDraft = (field: keyof typeof EMPTY_DRAFT, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setDraftErrors((current) => ({ ...current, [field]: undefined }));
  };

  /** Adds the draft as a line; returns it, or null when it was refused. */
  const addDraft = (): Line | null => {
    const parsed = equipmentRequestLineSchema.safeParse(draft);
    if (!parsed.success) {
      setDraftErrors(parsed.error.flatten().fieldErrors);
      return null;
    }
    if (lines.some((line) => line.equipmentId === parsed.data.equipmentId)) {
      setDraftErrors({
        equipmentId: [
          `${typeOf(parsed.data.equipmentId)} is already on this request.`,
        ],
      });
      return null;
    }
    setLines((current) => [...current, parsed.data]);
    setDraft(EMPTY_DRAFT);
    setDraftErrors({});
    setErrors((current) => ({ ...current, lines: undefined }));
    return parsed.data;
  };

  const removeLine = (equipmentId: string) => {
    setLines((current) =>
      current.filter((line) => line.equipmentId !== equipmentId),
    );
    setErrors({});
  };

  const saveChanges = (requestId: string, toSend: Line[]) => {
    const payload = { requestId, lines: toSend };
    const checked = changeEquipmentRequestSchema.safeParse(payload);
    if (!checked.success) {
      setErrors(fieldErrorsByPath(checked.error));
      toast.error("Please fix the highlighted fields.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await changeEquipmentRequest(payload);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          toast.error(result.error);
          return;
        }
        toast.success(
          result.data.changed
            ? "Request changed. It's back in Pending Review."
            : "Nothing changed, so the request is as it was.",
        );
        onDone(requestId);
      } catch {
        toast.error(
          "Couldn't save the changes. Check your connection and try again.",
        );
      }
    });
  };

  const submit = () => {
    // Equipment picked but not yet added still counts: nobody expects to lose it.
    let toSend = lines;
    if (draft.equipmentId) {
      const added = addDraft();
      if (!added) return;
      toSend = [...lines, added];
    }

    if (editing) {
      saveChanges(editing.requestId, toSend);
      return;
    }

    const payload = { eventId, notes, lines: toSend };
    const checked = createEquipmentRequestSchema.safeParse(payload);
    if (!checked.success) {
      setErrors(fieldErrorsByPath(checked.error));
      toast.error("Please fix the highlighted fields.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createEquipmentRequest(payload);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          toast.error(result.error);
          return;
        }
        if (result.data.existing) {
          toast.info(
            "This event already has a request waiting for review, so no new one was made. It's highlighted below.",
          );
        } else {
          toast.success("Request submitted. It's now Pending Review.");
        }
        reset();
        onDone(result.data.id);
      } catch {
        toast.error(
          "Couldn't submit the request. Check your connection and try again.",
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Change equipment lines" : "New equipment request"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `For ${editing.eventName}. Saving sends the request back to Pending Review for Technical Support to re-check, and equipment reserved for a changed or removed line is released.`
              : fixedEventId && selectedEvent
                ? `For ${selectedEvent.name}. Technical Support reviews the request and updates its status.`
                : "Technical Support reviews each request and updates its status."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className={editing || fixedEventId ? "hidden" : "space-y-2"}>
            <Label htmlFor="request-event">Event</Label>
            <AppSelect
              id="request-event"
              value={eventId}
              placeholder="Select an event"
              aria-invalid={Boolean(errors.eventId)}
              aria-describedby={
                errors.eventId ? "request-event-error" : undefined
              }
              onValueChange={(value) => {
                setEventId(value);
                setErrors((current) => ({ ...current, eventId: undefined }));
              }}
              options={events.map((event) => ({
                value: event.id,
                label: event.startAt
                  ? `${event.name} — ${formatDate(event.startAt)}`
                  : event.name,
              }))}
            />
            {selectedEvent?.startAt && selectedEvent.endAt && (
              <p
                className="text-xs text-muted-foreground"
                data-testid="selected-event-period"
              >
                Runs {formatDateTime(selectedEvent.startAt)} to{" "}
                {formatDateTime(selectedEvent.endAt)}
              </p>
            )}
            <FieldError id="request-event-error" messages={errors.eventId} />
          </div>

          {/* SCRUM-170 AC3: the Organiser's answer, read-only; the equipment
              lines below are the Coordinator's to enter. */}
          {selectedEvent && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium">
                What the Organiser asked for
              </p>
              <OrganiserEquipmentAnswer
                equipmentRequirements={selectedEvent.equipmentRequirements}
              />
            </div>
          )}

          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Equipment</legend>

            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <div className="space-y-2">
                <Label htmlFor="draft-equipment">Equipment type</Label>
                <AppSelect
                  id="draft-equipment"
                  value={draft.equipmentId}
                  placeholder="Select equipment"
                  aria-invalid={Boolean(draftErrors.equipmentId)}
                  aria-describedby={
                    draftErrors.equipmentId
                      ? "draft-equipment-error"
                      : undefined
                  }
                  onValueChange={(value) => updateDraft("equipmentId", value)}
                  options={equipment.map((item) => ({
                    value: item.id,
                    label: `${item.type} (${item.totalQuantity} in the pool)`,
                  }))}
                />
                <FieldError
                  id="draft-equipment-error"
                  messages={draftErrors.equipmentId}
                />
                {draftType?.technicalSpecs && (
                  <p className="text-xs text-muted-foreground">
                    Specs: {draftType.technicalSpecs}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-quantity">Quantity</Label>
                <Input
                  id="draft-quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={draft.quantity}
                  aria-invalid={Boolean(draftErrors.quantity)}
                  aria-describedby={
                    draftErrors.quantity ? "draft-quantity-error" : undefined
                  }
                  onChange={(e) => updateDraft("quantity", e.target.value)}
                />
                <FieldError
                  id="draft-quantity-error"
                  messages={draftErrors.quantity}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="draft-requirements">
                Technical requirements (optional)
              </Label>
              <Textarea
                id="draft-requirements"
                rows={2}
                placeholder="For example: HDMI to the lectern, spare batteries"
                value={draft.technicalRequirements}
                aria-invalid={Boolean(draftErrors.technicalRequirements)}
                aria-describedby={
                  draftErrors.technicalRequirements
                    ? "draft-requirements-error"
                    : undefined
                }
                onChange={(e) =>
                  updateDraft("technicalRequirements", e.target.value)
                }
              />
              <FieldError
                id="draft-requirements-error"
                messages={draftErrors.technicalRequirements}
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={addDraft}
            >
              <Plus className="h-4 w-4" />
              Add equipment
            </Button>

            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No equipment added yet.
              </p>
            ) : (
              <ul
                className="divide-y rounded-md border"
                aria-label="Equipment on this request"
              >
                {lines.map((line, index) => {
                  const lineErrors = [
                    ...(errors[`lines.${index}.equipmentId`] ?? []),
                    ...(errors[`lines.${index}.quantity`] ?? []),
                  ];
                  return (
                    <li
                      key={line.equipmentId}
                      className="flex items-start justify-between gap-3 px-3 py-2"
                      data-testid="draft-line"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium">
                          {typeOf(line.equipmentId)}{" "}
                          <span className="font-normal text-muted-foreground">
                            × {line.quantity}
                          </span>
                        </p>
                        {line.technicalRequirements && (
                          <p className="whitespace-pre-line text-xs text-muted-foreground">
                            {line.technicalRequirements}
                          </p>
                        )}
                        {lineErrors[0] && (
                          <p className="text-xs text-destructive">
                            {lineErrors[0]}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label={`Remove ${typeOf(line.equipmentId)}`}
                        onClick={() => removeLine(line.equipmentId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <FieldError id="request-lines-error" messages={errors.lines} />
          </fieldset>

          <div className={editing ? "hidden" : "space-y-2"}>
            <Label htmlFor="request-notes">
              Notes for Technical Support (optional)
            </Label>
            <Textarea
              id="request-notes"
              rows={3}
              value={notes}
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={
                errors.notes ? "request-notes-error" : undefined
              }
              onChange={(e) => {
                setNotes(e.target.value);
                setErrors((current) => ({ ...current, notes: undefined }));
              }}
            />
            <FieldError id="request-notes-error" messages={errors.notes} />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => changeOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={pending}
            className="gap-2"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending
              ? "Submitting…"
              : editing
                ? "Save changes"
                : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
