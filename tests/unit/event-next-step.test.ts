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
  overdue: false,
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

describe("SCRUM-208 — the Next step, step by step", () => {
  const booking = {
    id: "b1",
    venueName: "Hall A",
    attendance: 50,
    state: "Held",
    complete: false,
    needsReconsideration: false,
    reason: null,
    held: true,
    holdApproved: false,
    pending: false,
  };
  const inPlanning = (
    items: Partial<ReadinessChecklist["items"][number]>[],
    over: Partial<NextStepFacts> = {},
  ) => facts({ status: "PLANNING", viewer: "coordinator", checklist: checklist(items), ...over });

  it.each([
    {
      when: "a flagged venue booking",
      items: [{ name: "Venue booking" as const, complete: false, state: "Approved", needsReconsideration: true }],
      text: "Your turn: decide the flagged venue booking",
    },
    {
      when: "a hold Venue Staff approved",
      items: [{ name: "Venue booking" as const, complete: false, state: "Held", bookings: [{ ...booking, holdApproved: true }] }],
      text: "Your turn: confirm or release the hold on Hall A",
    },
    {
      when: "a hold not yet approved",
      items: [{ name: "Venue booking" as const, complete: false, state: "Held", bookings: [booking] }],
      text: "Waiting for Venue Staff to approve the hold on Hall A",
    },
    {
      when: "a flagged equipment reservation",
      items: [{ name: "Equipment" as const, complete: false, state: "Reserved", needsReconsideration: true }],
      text: "Your turn: decide the flagged equipment reservation",
    },
    {
      when: "an equipment request awaiting review",
      items: [{ name: "Equipment" as const, complete: false, state: "Awaiting Technical Support review" }],
      text: "Waiting for Technical Support to review the equipment request",
    },
    {
      when: "equipment not fully reserved",
      items: [{ name: "Equipment" as const, complete: false, state: "Not fully reserved: Projector" }],
      text: "Waiting for Technical Support to reserve the equipment",
    },
    {
      when: "a safety check awaiting review",
      items: [{ name: "Safety check" as const, complete: false, state: "Awaiting review" }],
      text: "Waiting for the Safety Officer to review the safety check",
    },
    {
      when: "a safety check with changes requested",
      items: [{ name: "Safety check" as const, complete: false, state: "Changes requested" }],
      text: "Your turn: act on the safety check (Changes requested)",
    },
  ])("SCRUM-208 [AC2] TC-208-05: in Planning, with $when: \"$text\"", ({ items, text }) => {
    expect(nextStep(inPlanning(items))).toMatchObject({ text, tab: "arrangements" });
  });

  it("SCRUM-208 [AC2] TC-208-05: the Organiser waits on the Coordinator by name, or as \"the Coordinator\" when none is named", () => {
    const hold = [{ name: "Venue booking" as const, complete: false, state: "Held", bookings: [{ ...booking, holdApproved: true }] }];
    expect(nextStep(inPlanning(hold, { viewer: "organiser" }))).toEqual({
      kind: "waiting",
      text: "Waiting for Cody Coordinator to confirm or release the hold on Hall A",
      tab: "arrangements",
    });
    expect(
      nextStep(inPlanning([{ name: "Safety check", complete: false, state: "Not requested" }], { viewer: "organiser", coordinatorName: null })),
    ).toMatchObject({ text: "Waiting for the Coordinator to request the safety check" });
  });

  it("SCRUM-208 [AC2] TC-208-05: with no checklist read yet, confirming is all that is shown", () => {
    expect(nextStep(facts({ status: "APPROVED", viewer: "coordinator", checklist: null }))).toMatchObject({
      kind: "yours",
      text: "Your turn: confirm the event",
    });
  });

  it("SCRUM-208 [AC2] TC-208-06: flagged arrangements come first for the Coordinator; the Organiser isn't told", () => {
    expect(nextStep(facts({ status: "PLANNING", viewer: "coordinator", flaggedArrangements: 2 }))).toMatchObject({
      kind: "yours",
      text: "Your turn: decide what happens to the flagged arrangements",
      tab: "changes",
    });
    expect(nextStep(facts({ status: "PLANNING", flaggedArrangements: 2, checklist: checklist([]) }))).toMatchObject({
      kind: "waiting",
      text: "Waiting for Cody Coordinator to confirm the event",
    });
  });

  it("SCRUM-208 [AC2] TC-208-03: an open question waits on the Organiser by name, or as \"the Organiser\"", () => {
    expect(
      nextStep(facts({ viewer: "coordinator", openClarification: true, organiserName: null })),
    ).toMatchObject({ text: "Waiting for the Organiser to answer your question" });
  });

  it("SCRUM-208 [AC2] TC-208-04: a Submitted request can be reviewed or questioned, not yet decided", () => {
    expect(nextStep(facts({ status: "SUBMITTED", viewer: "coordinator" }))).toMatchObject({
      kind: "yours",
      text: "Your turn: review the request, or ask the Organiser a question",
      action: { kind: "review" },
    });
  });

  it.each([
    {
      status: "DRAFT" as const,
      step: { kind: "yours", text: "Your turn: finish the request and submit it for review", tab: "request", action: { kind: "resume" } },
    },
    {
      status: "CONFIRMED" as const,
      step: { kind: "waiting", text: "Confirmed: the arrangements are secured. Nothing is waiting before the event.", tab: "arrangements" },
    },
  ])("SCRUM-208 [AC2] TC-208-02: a $status event's single next step", ({ status, step }) => {
    expect(nextStep(facts({ status }))).toEqual(step);
  });

  it("SCRUM-208 [AC2] TC-208-07: a Completed event shows its outcome", () => {
    expect(nextStep(facts({ status: "COMPLETED" }))).toEqual({
      kind: "outcome",
      text: "This event has taken place and is completed.",
      reason: null,
      detail: null,
      tone: "success",
    });
  });

  it("SCRUM-208 [AC2] TC-208-07: a Rejected request with no outcome recorded has no detail", () => {
    expect(nextStep(facts({ status: "REJECTED", decisionReason: "No budget" }))).toMatchObject({
      kind: "outcome",
      reason: "No budget",
      detail: null,
    });
  });

  it("SCRUM-208 [AC2] TC-208-02: a status the page doesn't know waits on nothing", () => {
    expect(nextStep(facts({ status: "ARCHIVED" as NextStepFacts["status"] }))).toEqual({
      kind: "waiting",
      text: "Nothing is waiting.",
      tab: null,
    });
  });
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

describe("SCRUM-209 — the Next step opens Arrangements at its section", () => {
  type Item = Partial<ReadinessChecklist["items"][number]>;
  const actionFor = (items: Item[]) => {
    const step = nextStep(
      facts({ status: "PLANNING", viewer: "coordinator", checklist: checklist(items) }),
    );
    return step.kind === "yours" ? step.action : null;
  };

  it.each([
    {
      missing: "no venue",
      items: [{ name: "Venue booking" as const, complete: false, state: "Not requested" }],
      label: "Request a venue",
      section: "venues",
    },
    {
      missing: "equipment not decided",
      items: [{ name: "Equipment" as const, complete: false, state: "Not decided" }],
      label: "Settle equipment",
      section: "equipment",
    },
    {
      missing: "no safety check",
      items: [{ name: "Safety check" as const, complete: false, state: "Not requested" }],
      label: "Request the safety check",
      section: "safety",
    },
  ])(
    "SCRUM-209 [AC1, AC2, AC3] TC-209-10: with $missing, the button reads \"$label\" and opens the $section section",
    ({ items, label, section }) => {
      expect(actionFor(items as Item[])).toEqual({ kind: "tab", label, tab: "arrangements", section });
    },
  );

  it("SCRUM-209 [AC1, AC2, AC3] TC-209-10: a step with no section of its own still opens the tab", () => {
    expect(actionFor([])).toEqual({
      kind: "tab",
      label: "Go to Arrangements",
      tab: "arrangements",
      section: undefined,
    });
  });
});

// SCRUM-249 AC4 — test cases: docs/testing/SCRUM-249.md.
describe("nextStep — an overdue event, SCRUM-249", () => {
  const CLOSE_IT = "Your turn: this event is overdue, so reject it or cancel it";
  const ready = checklist([{ name: "Venue booking", complete: true, state: "Approved" }]);

  it("SCRUM-249 [AC4] TC-249-07: Under Review, its Coordinator is told to close it, with Reject at hand", () => {
    expect(nextStep(facts({ viewer: "coordinator", overdue: true }))).toEqual({
      kind: "yours",
      text: CLOSE_IT,
      tab: "request",
      action: { kind: "review" },
    });
  });

  it("SCRUM-249 [AC4] TC-249-07: in Planning, even when ready to confirm, its Coordinator is told to close it, and goes to where Reject is", () => {
    expect(
      nextStep(facts({ status: "PLANNING", viewer: "coordinator", overdue: true, checklist: ready })),
    ).toEqual({
      kind: "yours",
      text: CLOSE_IT,
      tab: "arrangements",
      action: { kind: "tab", label: "Go to Arrangements", tab: "arrangements" },
    });
  });

  it("SCRUM-249 [AC4] TC-249-07: it comes before flagged arrangements and change requests, which can't save an overdue event", () => {
    expect(
      nextStep(
        facts({
          status: "PLANNING",
          viewer: "coordinator",
          overdue: true,
          flaggedArrangements: 1,
          pendingChangeRequests: 1,
          checklist: ready,
        }),
      ),
    ).toMatchObject({ text: CLOSE_IT });
  });

  it("SCRUM-249 [AC4] TC-249-08: the Organiser can't close it, so their banner is unchanged", () => {
    expect(nextStep(facts({ overdue: true }))).toEqual({
      kind: "waiting",
      text: "Waiting for Cody Coordinator to review the request",
      tab: null,
    });
  });

  it("SCRUM-249 [AC4] TC-249-08: an event that isn't overdue still asks its Coordinator to approve or confirm it", () => {
    expect(nextStep(facts({ viewer: "coordinator" }))).toMatchObject({
      text: "Your turn: review the request, then approve it, reject it or ask a question",
    });
    expect(
      nextStep(
        facts({
          status: "PLANNING",
          viewer: "coordinator",
          checklist: { ...ready, ready: true },
        }),
      ),
    ).toMatchObject({ text: "Your turn: confirm the event" });
  });
});
