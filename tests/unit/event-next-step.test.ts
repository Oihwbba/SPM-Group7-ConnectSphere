import { describe, it, expect } from "vitest";

import {
  defaultTab,
  isEventTab,
  nextStep,
  type NextStepFacts,
} from "@/lib/event-next-step";
import type { ReadinessChecklist } from "@/lib/event-readiness";

const facts = (over: Partial<NextStepFacts> = {}): NextStepFacts => ({
  status: "UNDER_REVIEW",
  viewer: "organiser",
  coordinatorName: "Cody Coordinator",
  organiserName: "Olivia Organiser",
  openClarification: false,
  pendingChangeRequests: 0,
  flaggedArrangements: 0,
  checklist: null,
  decisionReason: null,
  rejectionOutcome: null,
  cancellationReason: null,
  cancelledAt: null,
  ...over,
});

const checklist = (
  items: Partial<ReadinessChecklist["items"][number]>[],
): ReadinessChecklist => ({
  ready: false,
  items: ([
    { name: "Venue booking", complete: true, state: "Approved", reason: null },
    { name: "Equipment", complete: true, state: "Reserved", reason: null },
    { name: "Safety check", complete: true, state: "Approved", reason: null },
  ] as ReadinessChecklist["items"]).map((base) => ({
    ...base,
    ...items.find((i) => i.name === base.name),
  })),
});

describe("SCRUM-208 — the Next step banner", () => {
  it("SCRUM-208 [AC2] TC-208-03: an open question is the Organiser's turn, and the Coordinator waits for it", () => {
    const organiser = nextStep(facts({ openClarification: true }));
    expect(organiser).toMatchObject({
      kind: "yours",
      text: "Your turn: answer the Coordinator's question",
      tab: "clarification",
      action: { kind: "tab", tab: "clarification" },
    });
    expect(nextStep(facts({ openClarification: true, viewer: "coordinator" }))).toEqual({
      kind: "waiting",
      text: "Waiting for Olivia Organiser to answer your question",
      tab: "clarification",
    });
  });

  it("SCRUM-208 [AC2] TC-208-04: a request under review is the Coordinator's to decide, and the Organiser waits", () => {
    expect(nextStep(facts({ viewer: "coordinator" }))).toMatchObject({
      kind: "yours",
      action: { kind: "review" },
    });
    expect(nextStep(facts())).toEqual({
      kind: "waiting",
      text: "Waiting for Cody Coordinator to review the request",
      tab: null,
    });
  });

  it("SCRUM-208 [AC2] TC-208-04: a Submitted request with no Coordinator waits for one", () => {
    expect(nextStep(facts({ status: "SUBMITTED", coordinatorName: null }))).toEqual({
      kind: "waiting",
      text: "Waiting for a Coordinator to be assigned",
      tab: null,
    });
  });

  it("SCRUM-208 [AC2] TC-208-05: in Planning, a pending venue waits for Venue Staff, named, with no button", () => {
    const step = nextStep(
      facts({
        status: "PLANNING",
        viewer: "coordinator",
        checklist: checklist([
          {
            name: "Venue booking",
            complete: false,
            state: "Pending",
            bookings: [
              {
                id: "b1",
                venueName: "Hall A",
                attendance: 50,
                state: "Pending",
                complete: false,
                needsReconsideration: false,
                reason: null,
                held: false,
                holdApproved: false,
                pending: true,
              },
            ],
          },
        ]),
      }),
    );
    expect(step).toEqual({
      kind: "waiting",
      text: "Waiting for Venue Staff to approve Hall A",
      tab: "arrangements",
    });
  });

  it("SCRUM-208 [AC2] TC-208-05: in Planning, the first missing item is the Coordinator's turn, and the Organiser sees whose it is", () => {
    const missing = checklist([
      { name: "Equipment", complete: false, state: "Not decided" },
    ]);
    expect(
      nextStep(facts({ status: "PLANNING", viewer: "coordinator", checklist: missing })),
    ).toMatchObject({
      kind: "yours",
      text: "Your turn: request the equipment, or record that none is needed",
      tab: "arrangements",
    });
    expect(nextStep(facts({ status: "PLANNING", checklist: missing }))).toEqual({
      kind: "waiting",
      text: "Waiting for Cody Coordinator to request the equipment, or record that none is needed",
      tab: "arrangements",
    });
    // Everything complete: confirming is all that's left.
    expect(
      nextStep(facts({ status: "PLANNING", viewer: "coordinator", checklist: checklist([]) })),
    ).toMatchObject({ kind: "yours", text: "Your turn: confirm the event" });
  });

  it("SCRUM-208 [AC2] TC-208-06: a pending change request comes first: the Coordinator's to decide, on Changes", () => {
    const step = nextStep(
      facts({ status: "PLANNING", viewer: "coordinator", pendingChangeRequests: 1 }),
    );
    expect(step).toMatchObject({ kind: "yours", tab: "changes" });
    expect(nextStep(facts({ status: "PLANNING", pendingChangeRequests: 1 }))).toEqual({
      kind: "waiting",
      text: "Waiting for Cody Coordinator to decide your change request",
      tab: "changes",
    });
  });

  it("SCRUM-208 [AC2] TC-208-07: final states show the outcome and the reason instead of a step", () => {
    expect(
      nextStep(
        facts({
          status: "REJECTED",
          decisionReason: "No venue that week.",
          rejectionOutcome: "AMEND_AND_RESUBMIT",
        }),
      ),
    ).toMatchObject({ kind: "outcome", reason: "No venue that week.", tone: "danger" });
    expect(
      nextStep(facts({ status: "CANCELLED", cancellationReason: "Speaker unwell." })),
    ).toMatchObject({ kind: "outcome", reason: "Speaker unwell." });
    expect(nextStep(facts({ status: "COMPLETED" }))).toMatchObject({ kind: "outcome" });
  });

  it("SCRUM-208 [AC3] TC-208-08: the tab holding the next step opens first; otherwise Request", () => {
    expect(defaultTab(nextStep(facts({ openClarification: true })))).toBe("clarification");
    expect(defaultTab(nextStep(facts()))).toBe("request");
    expect(defaultTab(nextStep(facts({ status: "REJECTED" })))).toBe("request");
  });

  it("SCRUM-208 [AC3] TC-208-09: only the page's own tabs are accepted from the link", () => {
    expect(isEventTab("clarification")).toBe(true);
    expect(isEventTab("notes")).toBe(true);
    expect(isEventTab("details")).toBe(false);
    expect(isEventTab(undefined)).toBe(false);
  });
});
