"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Info,
  Search,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import type { Event } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/app/tabs";
import { PersonPill } from "@/components/app/audit-trail";
import { StatusBadge } from "@/components/events/status-badge";
import { ClarificationPanel } from "@/components/events/clarification-panel";
import { ChangeRequestPanel } from "@/components/events/change-request-panel";
import { ReadinessChecklist } from "@/components/events/readiness-checklist";
import { ReconsiderationPanel } from "@/components/events/reconsideration-panel";
import { CancelEvent } from "@/components/events/cancel-event";
import { ConfirmedArrangements } from "@/components/events/confirmed-arrangements";
import { VenueBookings } from "@/components/events/venue-bookings";
import { RegistrationListPanel } from "@/components/events/registration-list-panel";
import { RegistrationControl } from "@/components/events/registration-control";
import { EditDetailsDialog } from "@/components/events/edit-details-dialog";
import { OperationalNotes } from "@/components/events/operational-notes";
import { ReviewDecision } from "@/components/events/review-decision";
import {
  OrganiserEquipmentAnswer,
  OrganiserVenueAnswers,
} from "@/components/events/organiser-answers";
import { CANCELLABLE } from "@/lib/event-lifecycle";
import { BOOKABLE_EVENT_STATUSES } from "@/lib/schemas/booking";
import { registrationNeededLabel } from "@/lib/schemas/event";
import { formatDateTime } from "@/lib/datetime";
import {
  ARRANGEMENT_STATUSES,
  defaultTab,
  type EventTab,
  type NextStep,
} from "@/lib/event-next-step";
import { cn } from "@/lib/utils";
import { CreateEventDialog } from "../create-event-dialog";
import { isEventStillVisible } from "../readiness-actions";
import type { EventPageData } from "./event-page-data";

/**
 * SCRUM-208 — one event on its own page. The top says, whatever tab is open,
 * what state the event is in, who is handling it and what happens next, and
 * whether that is the viewer's job (AC2). The tabs follow the order the work
 * happens (AC3); the open one is part of the link. Every panel is the one the
 * pop-up showed, with the same rules and the same people allowed to act.
 */
export function EventPage({
  event,
  viewer,
  coordinatorName,
  step,
  attention,
  requestedTab,
}: EventPageData & { requestedTab: EventTab | null }) {
  const router = useRouter();
  const isCoordinator = viewer === "coordinator";
  const showRegistrations = event.registrationRequired !== false;
  const opening =
    requestedTab && (requestedTab !== "registrations" || showRegistrations)
      ? requestedTab
      : defaultTab(step);
  const [tab, setTab] = useState<EventTab>(opening);
  const [resuming, setResuming] = useState(false);
  // A resolved flag or an edit changes the flags and the checklist (SCRUM-25
  // AC3); a hold settled changes the bookings beside it (SCRUM-162 AC7).
  const [reloads, setReloads] = useState(0);
  const [bookingChanges, setBookingChanges] = useState(0);
  // SCRUM-24: set when the event is reassigned or removed while open.
  const [gone, setGone] = useState(false);

  // SCRUM-24: the page stays current while it is open, as the list does. An
  // event this user can no longer see keeps its last view, with a notice.
  useEffect(() => {
    if (gone) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      isEventStillVisible(event.id)
        .then((visible) => (visible ? router.refresh() : setGone(true)))
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [router, event.id, gone]);

  // AC3: the open tab is part of the link, so a refresh or a shared link keeps it.
  function openTab(next: string) {
    setTab(next as EventTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }

  const yours = (target: EventTab) =>
    step.kind === "yours" && step.tab === target;
  const changesWaiting = isCoordinator
    ? attention.pendingChangeRequests + attention.flaggedArrangements
    : 0;

  const tabs = [
    {
      id: "request",
      label: <TabLabel label="Request" />,
      content: <RequestTab event={event} />,
    },
    {
      id: "clarification",
      label: (
        <TabLabel
          label="Clarification"
          dot={(!isCoordinator && attention.openClarification) || yours("clarification")}
        />
      ),
      content: <ClarificationPanel event={event} isCoordinator={isCoordinator} />,
    },
    {
      id: "arrangements",
      label: <TabLabel label="Arrangements" dot={yours("arrangements")} />,
      content: ARRANGEMENT_STATUSES.includes(event.status) ? (
        <div className="space-y-4">
          {/* SCRUM-110: venue, equipment and the safety check, in that order. */}
          {(event.status === "PLANNING" || event.status === "APPROVED") && (
            <ReadinessChecklist
              key={`checklist-${reloads}`}
              eventId={event.id}
              onBookingsChanged={() => setBookingChanges((n) => n + 1)}
            />
          )}
          {/* SCRUM-81: what a Confirmed event has secured */}
          {event.status === "CONFIRMED" && <ConfirmedArrangements eventId={event.id} />}
          {/* SCRUM-162 AC7: every venue booking */}
          <VenueBookings key={`bookings-${reloads}-${bookingChanges}`} eventId={event.id} />
        </div>
      ) : (
        <Empty>Arrangements start once the request is approved.</Empty>
      ),
    },
    {
      id: "changes",
      label: <TabLabel label="Changes" count={changesWaiting} dot={yours("changes")} />,
      content:
        event.status === "DRAFT" ? (
          <Empty>Changes can be asked for once the request is submitted.</Empty>
        ) : (
          <div className="space-y-4">
            {/* SCRUM-26: flagged arrangements, for the assigned Coordinator */}
            {(event.status === "PLANNING" || event.status === "CONFIRMED") && (
              <ReconsiderationPanel
                key={`flags-${reloads}`}
                eventId={event.id}
                onResolved={() => setReloads((n) => n + 1)}
              />
            )}
            {/* SCRUM-41: says when there is nothing here, and nothing to raise. */}
            <ChangeRequestPanel
              key={event.id}
              event={event}
              whenEmpty={
                attention.flaggedArrangements === 0 && (
                  <Empty>No change requests, and nothing flagged Needs Reconsideration.</Empty>
                )
              }
            />
          </div>
        ),
    },
    ...(showRegistrations
      ? [
          {
            id: "registrations",
            label: <TabLabel label="Registrations" />,
            content: (
              <div className="space-y-4">
                {/* SCRUM-75 AC6: close or reopen registration */}
                {event.status === "CONFIRMED" && <RegistrationControl eventId={event.id} />}
                {/* SCRUM-70 */}
                {["PLANNING", "CONFIRMED", "CANCELLED", "COMPLETED"].includes(event.status) ? (
                  <RegistrationListPanel eventId={event.id} />
                ) : (
                  <Empty>Registrations open once the event is being planned.</Empty>
                )}
              </div>
            ),
          },
        ]
      : []),
    {
      id: "notes",
      label: <TabLabel label="Notes" />,
      // SCRUM-25 AC6: it says "No notes yet." itself.
      content: <OperationalNotes eventId={event.id} />,
    },
  ];

  return (
    <div className="space-y-5" data-testid="event-page">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {isCoordinator ? "Back to Events" : "Back to My Events"}
      </Link>

      {gone && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/15 px-3 py-2 text-xs font-medium text-warning-foreground"
          data-testid="event-no-longer-available-warning"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-warning" />
          <span>
            This event request is no longer available in your view (it may have been reassigned or updated).
          </span>
        </div>
      )}

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            {/* AC2: the name only; the status is the badge, once. */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-semibold tracking-tight">
                {event.name}
              </h1>
              <StatusBadge status={event.status} />
            </div>
            <p
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"
              data-testid="event-summary"
            >
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" aria-hidden />
                {event.startAt && event.endAt
                  ? `${formatDateTime(event.startAt)} to ${formatDateTime(event.endAt)}`
                  : "Date and time not set"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden />
                {event.expectedAttendance
                  ? `${event.expectedAttendance} expected`
                  : "Attendance not set"}
              </span>
              <span className="inline-flex items-center gap-1.5" data-testid="current-coordinator">
                <span>Coordinator:</span>
                {coordinatorName ? (
                  <PersonPill name={coordinatorName} />
                ) : (
                  <span>Waiting for a Coordinator</span>
                )}
              </span>
            </p>
          </div>
          {isCoordinator && (
            <div className="flex flex-wrap items-center gap-2">
              {/* SCRUM-38 AC1: venue search for this event's period. */}
              {BOOKABLE_EVENT_STATUSES.includes(event.status) && (
                <Button asChild size="sm" variant="outline">
                  <Link href={{ pathname: "/venues/search", query: { event: event.id } }}>
                    <Search className="h-4 w-4" aria-hidden /> Find a venue
                  </Link>
                </Button>
              )}
              {/* SCRUM-25: the assigned Coordinator edits details. */}
              <EditDetailsDialog event={event} onSaved={() => setReloads((n) => n + 1)} />
              {/* SCRUM-82 AC1: the server checks the event is theirs. */}
              {CANCELLABLE.includes(event.status) && <CancelEvent eventId={event.id} />}
            </div>
          )}
        </div>

        <NextStepBanner
          step={step}
          event={event}
          onTab={openTab}
          onResume={() => setResuming(true)}
        />
      </header>

      <Tabs label="Event" tabs={tabs} value={tab} onChange={openTab} />

      {/* AC2: a Draft's next step is the Organiser finishing it. */}
      {event.status === "DRAFT" && resuming && (
        <CreateEventDialog
          open
          onOpenChange={(open) => !open && setResuming(false)}
          draftEvent={event}
          onSubmitted={() => {
            setResuming(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** A tab's name, with a dot or a count when it needs the viewer (AC3). */
function TabLabel({ label, dot = false, count = 0 }: { label: string; dot?: boolean; count?: number }) {
  return (
    <>
      {label}
      {count > 0 ? (
        <span
          className="rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-4 text-white"
          data-testid="tab-attention"
        >
          {count}
          <span className="sr-only"> need your attention</span>
        </span>
      ) : (
        dot && (
          <span className="h-2 w-2 rounded-full bg-destructive" data-testid="tab-attention">
            <span className="sr-only">needs your attention</span>
          </span>
        )
      )}
    </>
  );
}

/** AC3: a tab never hides for being empty; it says so in one line. */
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground" data-testid="tab-empty">
      {children}
    </p>
  );
}

/** AC2 — whose the next step is, and the way to it when it's the viewer's. */
function NextStepBanner({
  step,
  event,
  onTab,
  onResume,
}: {
  step: NextStep;
  event: Event;
  onTab: (tab: EventTab) => void;
  onResume: () => void;
}) {
  if (step.kind === "outcome") {
    return (
      <section
        aria-label="Outcome"
        data-testid="next-step"
        data-kind="outcome"
        className={cn(
          "space-y-1 rounded-xl border-l-4 px-4 py-3 text-sm",
          step.tone === "danger"
            ? "border-destructive bg-destructive/5"
            : "border-success bg-success/5",
        )}
      >
        <p className="flex items-center gap-2 font-semibold">
          {step.tone === "danger" ? (
            <XCircle className="h-4 w-4 text-destructive" aria-hidden />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
          )}
          {step.text}
        </p>
        {event.status === "REJECTED" && (
          <>
            {step.reason && (
              <p className="whitespace-pre-wrap">
                <span className="font-medium">Rejection reason: </span>
                {step.reason}
              </p>
            )}
            {/* SCRUM-126 AC5: what the Coordinator said happens next. */}
            {step.detail && <p data-testid="rejection-outcome">Next step: {step.detail}</p>}
          </>
        )}
        {event.status === "CANCELLED" && step.reason && (
          <div data-testid="cancellation-reason">
            <p className="whitespace-pre-wrap">
              <span className="font-medium">Cancellation reason: </span>
              {step.reason}
            </p>
            {step.detail && (
              <p className="text-muted-foreground">Cancelled on {formatDateTime(step.detail)}</p>
            )}
          </div>
        )}
      </section>
    );
  }

  const mine = step.kind === "yours";
  return (
    <section
      aria-label="Next step"
      data-testid="next-step"
      data-kind={step.kind}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 px-4 py-3 text-sm",
        mine ? "border-primary bg-primary/5" : "border-muted-foreground/40 bg-muted/40",
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        <Info className={cn("h-4 w-4 shrink-0", mine ? "text-primary" : "text-muted-foreground")} aria-hidden />
        {step.text}
      </p>
      {step.kind === "yours" && (
        <div className="flex flex-wrap gap-2">
          {step.action.kind === "tab" && (
            <Button size="sm" onClick={() => onTab((step.action as { tab: EventTab }).tab)}>
              {step.action.label}
            </Button>
          )}
          {step.action.kind === "link" && (
            <Button asChild size="sm">
              <Link href={step.action.href}>{step.action.label}</Link>
            </Button>
          )}
          {step.action.kind === "resume" && (
            <Button size="sm" onClick={onResume}>
              Resume draft
            </Button>
          )}
          {/* SCRUM-18, SCRUM-19: the Coordinator decides right here. */}
          {step.action.kind === "review" && (
            <ReviewDecision event={event} buttonClassName="h-8 gap-1.5 text-xs" />
          )}
        </div>
      )}
    </section>
  );
}

/** AC3 — what the Organiser asked for, in the request form's order. */
function RequestTab({ event }: { event: Event }) {
  return (
    <div className="space-y-4">
      <Section icon={Info} title="Basics">
        <Field label="Event Purpose">{event.purpose}</Field>
        <Field label="Event Description" multiline>
          {event.description}
        </Field>
      </Section>
      <Section icon={Calendar} title="Schedule & Attendance" grid>
        <Field label="Proposed Start">{event.startAt && formatDateTime(event.startAt)}</Field>
        <Field label="Proposed End">{event.endAt && formatDateTime(event.endAt)}</Field>
        <Field label="Expected Attendance">
          {event.expectedAttendance && `${event.expectedAttendance} attendees`}
        </Field>
      </Section>
      <Section icon={Building2} title="Venue, Layout & Accessibility">
        {/* SCRUM-170 AC5: the Organiser's answers exactly as entered. */}
        <OrganiserVenueAnswers answers={event} />
      </Section>
      <Section icon={Wrench} title="Equipment & Technical Support">
        <OrganiserEquipmentAnswer equipmentRequirements={event.equipmentRequirements} />
      </Section>
      <Section icon={ClipboardList} title="Registration & Other Details">
        {/* SCRUM-171 AC3: an older request shows "Not answered". */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="registration-needed">
          <Field label="Registration Needed">{registrationNeededLabel(event.registrationRequired)}</Field>
          <Field label="Registration Notes" multiline>
            {event.registrationNotes}
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Event Programme">{event.programme || "Not specified"}</Field>
          <Field label="Special Requests">{event.specialRequests || "None"}</Field>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  grid = false,
  children,
}: {
  icon: typeof Info;
  title: string;
  grid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-primary" aria-hidden /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "p-4 text-sm",
          grid ? "grid grid-cols-1 gap-3 sm:grid-cols-3" : "space-y-3",
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  multiline = false,
  children,
}: {
  label: string;
  multiline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-foreground", multiline && "whitespace-pre-wrap")}>
        {children || "—"}
      </p>
    </div>
  );
}
