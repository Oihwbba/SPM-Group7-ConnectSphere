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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/lib/datetime";
import {
  createEquipmentRequestSchema,
  equipmentRequestLineSchema,
  fieldErrorsByPath,
} from "@/lib/schemas/equipment-request";
import { createEquipmentRequest } from "./actions";

export type EventOption = {
  id: string;
  name: string;
  startAt: Date | null;
  endAt: Date | null;
};
export type EquipmentOption = {
  id: string;
  type: string;
  totalQuantity: number;
  technicalSpecs: string | null;
};

type Line = {
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
const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

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
 */
export function NewRequestDialog({
  open,
  onOpenChange,
  events,
  equipment,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: EventOption[];
  equipment: EquipmentOption[];
  onDone: (requestId: string) => void;
}) {
  const [eventId, setEventId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [draftErrors, setDraftErrors] = useState<Errors>({});
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  const typeOf = (id: string) =>
    equipment.find((item) => item.id === id)?.type ?? "This type";
  const selectedEvent = events.find((event) => event.id === eventId);
  const draftType = equipment.find((item) => item.id === draft.equipmentId);

  const reset = () => {
    setEventId("");
    setNotes("");
    setLines([]);
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

  const submit = () => {
    // Equipment picked but not yet added still counts: nobody expects to lose it.
    let toSend = lines;
    if (draft.equipmentId) {
      const added = addDraft();
      if (!added) return;
      toSend = [...lines, added];
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
          <DialogTitle>New equipment request</DialogTitle>
          <DialogDescription>
            Technical Support reviews each request and updates its status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="request-event">Event</Label>
            <select
              id="request-event"
              className={SELECT_CLASS}
              value={eventId}
              aria-invalid={Boolean(errors.eventId)}
              aria-describedby={
                errors.eventId ? "request-event-error" : undefined
              }
              onChange={(e) => {
                setEventId(e.target.value);
                setErrors((current) => ({ ...current, eventId: undefined }));
              }}
            >
              <option value="">Select an event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.startAt
                    ? `${event.name} — ${formatDate(event.startAt)}`
                    : event.name}
                </option>
              ))}
            </select>
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

          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Equipment</legend>

            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <div className="space-y-2">
                <Label htmlFor="draft-equipment">Equipment type</Label>
                <select
                  id="draft-equipment"
                  className={SELECT_CLASS}
                  value={draft.equipmentId}
                  aria-invalid={Boolean(draftErrors.equipmentId)}
                  aria-describedby={
                    draftErrors.equipmentId
                      ? "draft-equipment-error"
                      : undefined
                  }
                  onChange={(e) => updateDraft("equipmentId", e.target.value)}
                >
                  <option value="">Select equipment</option>
                  {equipment.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.type} ({item.totalQuantity} in the pool)
                    </option>
                  ))}
                </select>
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

          <div className="space-y-2">
            <Label htmlFor="request-notes">
              Notes for Technical Support (optional)
            </Label>
            <Textarea
              id="request-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            {pending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
