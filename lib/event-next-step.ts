import type { EventStatus, RejectionOutcome } from "@prisma/client";

import type { ReadinessChecklist } from "@/lib/event-readiness";
import { REJECTION_OUTCOME_LABEL } from "@/lib/schemas/event";
import { NOT_REQUESTED, SAFETY_CHECK_LABEL } from "@/lib/safety-checks";

/** The event page's tabs, in the order the work happens (SCRUM-208 AC3). */
export const EVENT_TABS = [
  "request",
  "clarification",
  "arrangements",
  "changes",
  "registrations",
  "notes",
] as const;
export type EventTab = (typeof EVENT_TABS)[number];

export function isEventTab(value: unknown): value is EventTab {
  return EVENT_TABS.includes(value as EventTab);
}

/** The Arrangements tab's sections, in the order they are made (SCRUM-209). */
export type ArrangementSection = "venues" | "equipment" | "safety";

/** What the viewer can do on the step: open a tab, or a page elsewhere. */
export type StepAction =
  | {
      kind: "tab";
      label: string;
      tab: EventTab;
      /** SCRUM-209: the part of the Arrangements tab the step is in. */
      section?: ArrangementSection;
    }
  | { kind: "link"; label: string; href: string }
  | { kind: "review" }
  | { kind: "resume" };

/**
 * SCRUM-208 AC2 — the one thing that happens next, and whose it is:
 * - `yours`: the viewer's job, with a way to it;
 * - `waiting`: someone else's, shown as information;
 * - `outcome`: a final state, with what happened and why.
 */
export type NextStep =
  | { kind: "yours"; text: string; tab: EventTab; action: StepAction }
  | { kind: "waiting"; text: string; tab: EventTab | null }
  | {
      kind: "outcome";
      text: string;
      reason: string | null;
      /** e.g. what the Organiser can do after a rejection, or when it happened. */
      detail: string | null;
      tone: "danger" | "neutral" | "success";
    };

export type NextStepFacts = {
  status: EventStatus;
  /** Whose view the page is: the event's Organiser or its Coordinator. */
  viewer: "organiser" | "coordinator";
  coordinatorName: string | null;
  organiserName: string | null;
  openClarification: boolean;
  /** Change requests waiting for the Coordinator's decision. */
  pendingChangeRequests: number;
  /** Flagged arrangements (SCRUM-26), counted for the Coordinator only. */
  flaggedArrangements: number;
  /** The readiness checklist, for an event in Planning. */
  checklist: ReadinessChecklist | null;
  decisionReason: string | null;
  rejectionOutcome: RejectionOutcome | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  completedAt?: string | null;
  /** SCRUM-82 AC10: its start passed before anyone decided or confirmed it. */
  overdue: boolean;
};

const coordinator = (facts: NextStepFacts) =>
  facts.coordinatorName ?? "the Coordinator";
const organiser = (facts: NextStepFacts) =>
  facts.organiserName ?? "the Organiser";

/** The first thing between the event and being confirmed, from the checklist. */
function planningStep(facts: NextStepFacts): NextStep {
  const mine = facts.viewer === "coordinator";
  // SCRUM-209: the button opens the Arrangements tab at the step's section.
  const SECTION_LABEL: Record<ArrangementSection, string> = {
    venues: "Request a venue",
    equipment: "Settle equipment",
    safety: "Request the safety check",
  };
  const yours = (text: string, section?: ArrangementSection): NextStep => ({
    kind: "yours",
    text: `Your turn: ${text}`,
    tab: "arrangements",
    action: {
      kind: "tab",
      label: section ? SECTION_LABEL[section] : "Go to Arrangements",
      tab: "arrangements",
      section,
    },
  });
  const waiting = (who: string, text: string): NextStep => ({
    kind: "waiting",
    text: `Waiting for ${who} to ${text}`,
    tab: "arrangements",
  });
  const byCoordinator = (text: string, section?: ArrangementSection) =>
    mine ? yours(text, section) : waiting(coordinator(facts), text);

  const items = facts.checklist?.items ?? [];
  const venue = items.find((item) => item.name === "Venue booking");
  if (venue && !venue.complete) {
    const pending = venue.bookings?.find((b) => b.pending);
    const held = venue.bookings?.find((b) => b.held);
    if (venue.needsReconsideration) {
      return byCoordinator("decide the flagged venue booking");
    }
    if (held?.holdApproved) {
      const text = `confirm or release the hold on ${held.venueName}`;
      return mine
        ? {
            kind: "yours",
            text: `Your turn: ${text}`,
            tab: "arrangements",
            action: { kind: "tab", label: "Go to Venues", tab: "arrangements", section: "venues" },
          }
        : waiting(coordinator(facts), text);
    }
    if (held) return waiting("Venue Staff", `approve the hold on ${held.venueName}`);
    if (pending) return waiting("Venue Staff", `approve ${pending.venueName}`);
    return byCoordinator("request a venue", "venues");
  }
  const equipment = items.find((item) => item.name === "Equipment");
  if (equipment && !equipment.complete) {
    if (equipment.needsReconsideration) {
      return byCoordinator("decide the flagged equipment reservation");
    }
    if (equipment.state === "Awaiting Technical Support review") {
      return waiting("Technical Support", "review the equipment request");
    }
    if (equipment.state.startsWith("Not fully reserved")) {
      return waiting("Technical Support", "reserve the equipment");
    }
    return byCoordinator("request the equipment, or record that none is needed", "equipment");
  }
  const safety = items.find((item) => item.name === "Safety check");
  if (safety && !safety.complete) {
    if (safety.state === SAFETY_CHECK_LABEL.AWAITING_REVIEW) {
      return waiting("the Safety Officer", "review the safety check");
    }
    if (safety.state === NOT_REQUESTED) return byCoordinator("request the safety check", "safety");
    return byCoordinator(`act on the safety check (${safety.state})`, "safety");
  }
  return byCoordinator("confirm the event");
}

/**
 * SCRUM-208 AC2 — the Next step banner. Changes and flags come first, since
 * they hold the event back; then, by status, what the request or the
 * readiness checklist (SCRUM-110) is waiting for.
 */
export function nextStep(facts: NextStepFacts): NextStep {
  const mine = facts.viewer === "coordinator";

  switch (facts.status) {
    case "REJECTED":
      return {
        kind: "outcome",
        text: "This request was rejected.",
        reason: facts.decisionReason,
        detail: facts.rejectionOutcome
          ? REJECTION_OUTCOME_LABEL[facts.rejectionOutcome]
          : null,
        tone: "danger",
      };
    case "CANCELLED":
      return {
        kind: "outcome",
        text: "This event was cancelled.",
        reason: facts.cancellationReason,
        detail: facts.cancelledAt,
        tone: "danger",
      };
    case "COMPLETED":
      return {
        kind: "outcome",
        text: "This event has taken place and is completed.",
        reason: null,
        detail: facts.completedAt ?? null,
        tone: "success",
      };
    case "DRAFT":
      return {
        kind: "yours",
        text: "Your turn: finish the request and submit it for review",
        tab: "request",
        action: { kind: "resume" },
      };
  }

  // SCRUM-249 AC4: it can no longer be approved or confirmed, so nothing else
  // on the event matters until its Coordinator closes it.
  if (mine && facts.overdue) {
    return {
      kind: "yours",
      text: "Your turn: this event is overdue, so reject it or cancel it",
      ...(facts.status === "PLANNING"
        ? {
            tab: "arrangements",
            action: { kind: "tab", label: "Go to Arrangements", tab: "arrangements" },
          }
        : { tab: "request", action: { kind: "review" } }),
    };
  }

  if (mine && facts.flaggedArrangements > 0) {
    return {
      kind: "yours",
      text: "Your turn: decide what happens to the flagged arrangements",
      tab: "changes",
      action: { kind: "tab", label: "Go to Changes", tab: "changes" },
    };
  }
  if (facts.pendingChangeRequests > 0) {
    return mine
      ? {
          kind: "yours",
          text: "Your turn: decide the change request",
          tab: "changes",
          action: { kind: "tab", label: "Go to Changes", tab: "changes" },
        }
      : {
          kind: "waiting",
          text: `Waiting for ${coordinator(facts)} to decide your change request`,
          tab: "changes",
        };
  }

  switch (facts.status) {
    case "SUBMITTED":
    case "UNDER_REVIEW":
      if (facts.openClarification) {
        return mine
          ? {
              kind: "waiting",
              text: `Waiting for ${organiser(facts)} to answer your question`,
              tab: "clarification",
            }
          : {
              kind: "yours",
              text: "Your turn: answer the Coordinator's question",
              tab: "clarification",
              action: { kind: "tab", label: "Answer the question", tab: "clarification" },
            };
      }
      if (!facts.coordinatorName) {
        return { kind: "waiting", text: "Waiting for a Coordinator to be assigned", tab: null };
      }
      return mine
        ? {
            kind: "yours",
            // Approve and Reject open once the request is Under Review (SCRUM-19).
            text:
              facts.status === "UNDER_REVIEW"
                ? "Your turn: review the request, then approve it, reject it or ask a question"
                : "Your turn: review the request, or ask the Organiser a question",
            tab: "request",
            action: { kind: "review" },
          }
        : {
            kind: "waiting",
            text: `Waiting for ${coordinator(facts)} to review the request`,
            tab: null,
          };
    case "APPROVED":
    case "PLANNING":
      return planningStep(facts);
    case "CONFIRMED":
      return {
        kind: "waiting",
        text: "Confirmed: the arrangements are secured. Nothing is waiting before the event.",
        tab: "arrangements",
      };
  }
  return { kind: "waiting", text: "Nothing is waiting.", tab: null };
}

/** AC3: the tab that opens first, the one holding the next step. */
export function defaultTab(step: NextStep): EventTab {
  return step.kind === "outcome" ? "request" : (step.tab ?? "request");
}

/** AC3: Arrangements start once the request is approved. */
export const ARRANGEMENT_STATUSES: EventStatus[] = [
  "APPROVED",
  "PLANNING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];
