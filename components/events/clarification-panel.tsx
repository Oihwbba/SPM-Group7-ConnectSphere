"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircleQuestion } from "lucide-react";
import type { Event } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/app/date-time-picker";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import {
  getClarificationForEvent,
  respondToClarification,
} from "@/app/(app)/events/clarification-actions";
import {
  CLARIFIABLE_FIELDS,
  type ClarifiableField,
  type ClarificationChanges,
} from "@/lib/schemas/clarification";
import {
  formatDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";

interface ClarificationPanelProps {
  /** The event as currently stored, to pre-fill the fields the answer may change. */
  event: Event;
  /** True when the viewer is the Coordinator (read-only here); false means
   * the viewer is the Organiser, who can respond while a request is OPEN. */
  isCoordinator: boolean;
  /** Told once loaded whether the event has a thread, so the details
   * pop-up can offer it as its own tab. */
  onLoaded?: (hasThread: boolean) => void;
}

type Clarification = {
  id: string;
  message: string;
  editableFields: string[];
  status: string;
  response: string | null;
  createdAt: string | Date;
  respondedAt: string | Date | null;
};

type Draft = Record<string, string>;

/** SCRUM-187 AC1 — shown when the answer never got a reply, e.g. the connection dropped. */
const SEND_FAILED_MESSAGE =
  "Your response couldn't be sent. If it isn't shown as answered above, try again.";

const TEXT_FIELDS = [
  "name",
  "purpose",
  "description",
  "venueRequirements",
  "accessibilityNeeds",
  "preferredLayout",
  "equipmentRequirements",
  "registrationNotes",
] as const;

/** The editable values as the inputs hold them, from the stored event. */
function draftFrom(event: Event): Draft {
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, event[f] ?? ""])),
    startAt: utcToSgWallTime(event.startAt),
    endAt: utcToSgWallTime(event.endAt),
    expectedAttendance: event.expectedAttendance?.toString() ?? "",
  };
}

/** Only what the Organiser actually changed, in the shape the action takes. */
function changesBetween(
  fields: string[],
  before: Draft,
  after: Draft,
): ClarificationChanges {
  const changes: ClarificationChanges = {};
  for (const field of fields) {
    if (field === "schedule") {
      if (after.startAt !== before.startAt || after.endAt !== before.endAt) {
        changes.startAt = sgWallTimeToUtcIso(after.startAt) ?? after.startAt;
        changes.endAt = sgWallTimeToUtcIso(after.endAt) ?? after.endAt;
      }
    } else if (field === "expectedAttendance") {
      if (after.expectedAttendance !== before.expectedAttendance) {
        changes.expectedAttendance = Number(after.expectedAttendance);
      }
    } else {
      const key = field as (typeof TEXT_FIELDS)[number];
      if (after[key] !== before[key]) changes[key] = after[key];
    }
  }
  return changes;
}

/**
 * SCRUM-18 — shown inside the event details modal for both roles. A
 * Coordinator sees their question, which fields they let the Organiser change
 * (SCRUM-108 AC1) and, once answered, the Organiser's reply. An Organiser
 * sees the question and, while it's OPEN, the named fields to edit and a box
 * to reply (SCRUM-108 AC2).
 *
 * Renders nothing when there is no clarification thread on this event, so it
 * adds no visual noise to events that were never questioned.
 */
export function ClarificationPanel({
  event,
  isCoordinator,
  onLoaded,
}: ClarificationPanelProps) {
  const [clarification, setClarification] = useState<Clarification | null>(
    null,
  );
  const [earlier, setEarlier] = useState<Clarification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [response, setResponse] = useState("");
  const [draft, setDraft] = useState<Draft>(() => draftFrom(event));
  // The server's validation errors, keyed by field (SCRUM-108 AC2).
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  // Bumped after a send that got no reply, so the thread is read again.
  const [version, setVersion] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getClarificationForEvent(event.id)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setClarification(result.data.clarification);
          setEarlier(result.data.earlier);
          onLoaded?.(result.data.clarification !== null);
        } else setLoadFailed(true);
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
    // onLoaded is the parent's setter; reading again for it isn't wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, version]);

  async function submitResponse() {
    if (!clarification || !response.trim()) return;
    setSubmitting(true);
    setSendFailed(false);
    let result: Awaited<ReturnType<typeof respondToClarification>>;
    try {
      result = await respondToClarification({
        clarificationId: clarification.id,
        response,
        changes: changesBetween(
          clarification.editableFields,
          draftFrom(event),
          draft,
        ),
      });
    } catch {
      // SCRUM-187 AC1, AC2: the action rethrows anything unexpected, and a
      // lost connection rejects too. Either way the answer may or may not
      // have been saved, so the thread is read again rather than guessed.
      setErrors({});
      setSendFailed(true);
      setVersion((v) => v + 1);
      return;
    } finally {
      setSubmitting(false);
    }
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }
    setErrors({});
    toast.success("Response sent to the coordinator.");
    setClarification({
      ...clarification,
      status: "ANSWERED",
      response,
      respondedAt: new Date(),
    });
    router.refresh();
  }

  if (loading) return null;

  // Distinct from the intentional empty case below: a failed fetch would
  // otherwise hide an open question from the organiser with no sign why.
  if (loadFailed) {
    return (
      <p role="alert" className="text-xs text-muted-foreground">
        Couldn&apos;t load the clarification thread — try reopening this event.
      </p>
    );
  }

  if (!clarification) return null;

  const isOpen = clarification.status === "OPEN";
  const named = clarification.editableFields.filter(
    (f): f is ClarifiableField => f in CLARIFIABLE_FIELDS,
  );
  const set = (key: string) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const fieldsNote = (fields: string[]) => {
    const names = fields
      .filter((f): f is ClarifiableField => f in CLARIFIABLE_FIELDS)
      .map((f) => CLARIFIABLE_FIELDS[f]);
    return names.length > 0
      ? `The organiser may change: ${names.join(", ")}.`
      : "Text answer only.";
  };

  // Shared page conventions, change 2: the thread as messages, one
  // Coordinator question and one Organiser answer at a time.
  return (
    <section
      aria-label="Clarification thread"
      className="space-y-4 text-sm"
      data-testid="clarification-thread"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <MessageCircleQuestion className="h-4 w-4 text-warning" />
        Clarification {isOpen ? "requested" : "thread"}
      </h3>
      <ol className="space-y-3">
        {[...earlier, clarification].map((item) => {
          const current = item.id === clarification.id;
          return (
            <li key={item.id} className="space-y-3">
              <Message
                from="Coordinator asked:"
                at={item.createdAt}
                side="left"
              >
                <p className="whitespace-pre-wrap">{item.message}</p>
                <p
                  data-testid={current ? "clarification-fields" : undefined}
                  className="mt-1 text-xs text-muted-foreground"
                >
                  {fieldsNote(item.editableFields)}
                </p>
              </Message>
              {item.status === "ANSWERED" && (
                <Message
                  from="Organiser responded:"
                  at={item.respondedAt}
                  side="right"
                >
                  <p className="whitespace-pre-wrap">{item.response}</p>
                </Message>
              )}
            </li>
          );
        })}
      </ol>

      {isOpen && isCoordinator && (
        <p className="text-xs text-muted-foreground">
          Waiting for the organiser&apos;s response.
        </p>
      )}

      {isOpen && !isCoordinator && (
        <div className="space-y-2 rounded-xl border bg-background p-3 text-xs">
          {named.map((field) =>
            field === "schedule" ? (
              <div
                key={field}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {(["startAt", "endAt"] as const).map((key) => (
                  <div key={key} className="space-y-1">
                    <label
                      htmlFor={`clarify-${key}`}
                      className="block font-medium"
                    >
                      {key === "startAt" ? "Start" : "End"}
                    </label>
                    <DateTimePicker
                      id={`clarify-${key}`}
                      value={draft[key]}
                      onChange={set(key)}
                      aria-invalid={Boolean(errors[key])}
                      aria-describedby={
                        errors[key] ? `clarify-${key}-error` : undefined
                      }
                    />
                    <FieldError
                      id={`clarify-${key}-error`}
                      messages={errors[key]}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <label key={field} className="block space-y-1">
                <span className="font-medium">{CLARIFIABLE_FIELDS[field]}</span>
                <Input
                  type={field === "expectedAttendance" ? "number" : "text"}
                  min={field === "expectedAttendance" ? 1 : undefined}
                  value={draft[field]}
                  onChange={(e) => set(field)(e.target.value)}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={
                    errors[field] ? `clarify-${field}-error` : undefined
                  }
                />
                <FieldError
                  id={`clarify-${field}-error`}
                  messages={errors[field]}
                />
              </label>
            ),
          )}
          <Textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Type your response…"
            aria-label="Response to clarification"
            aria-invalid={Boolean(errors.response)}
          />
          <FieldError id="clarify-response-error" messages={errors.response} />
          {sendFailed && (
            <p role="alert" className="text-destructive">
              {SEND_FAILED_MESSAGE}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={submitting || !response.trim()}
              onClick={submitResponse}
            >
              {submitting ? "Sending…" : "Send response"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** One message in the thread: the Coordinator's on the left, the Organiser's on the right. */
function Message({
  from,
  at,
  side,
  children,
}: {
  from: string;
  at: string | Date | null;
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex", side === "right" && "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] space-y-1 rounded-2xl px-4 py-3",
          side === "left"
            ? "rounded-tl-sm bg-muted"
            : "rounded-tr-sm bg-primary/10",
        )}
      >
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-semibold text-muted-foreground">{from}</span>
          {at && (
            <span className="text-muted-foreground/80">
              {formatDateTime(at)}
            </span>
          )}
        </p>
        {children}
      </div>
    </div>
  );
}
