import { describe, it, expect } from "vitest";
import type { EventStatus } from "@prisma/client";

import {
  CANCELLABLE,
  EVENT_STATUS_LABEL,
  canTransition,
  transitionRefusal,
} from "@/lib/event-lifecycle";

// SCRUM-135 — the lifecycle table every status-changing action asks.
// Test cases: docs/testing/SCRUM-135.md. The actions' use of it is tested
// with each action (event-status, event-confirm, reject-planning,
// cancel-event, events and clarification-and-amend tests).

const ALL = Object.keys(EVENT_STATUS_LABEL) as EventStatus[];

const ALLOWED: [EventStatus, EventStatus, string][] = [
  ["DRAFT", "SUBMITTED", "AC1"],
  ["SUBMITTED", "UNDER_REVIEW", "AC2"],
  ["UNDER_REVIEW", "PLANNING", "AC3"],
  ["UNDER_REVIEW", "REJECTED", "AC4"],
  ["PLANNING", "REJECTED", "AC5"],
  ["PLANNING", "CONFIRMED", "AC7"],
  ["CONFIRMED", "PLANNING", "AC8"],
  ["UNDER_REVIEW", "CANCELLED", "AC9"],
  ["PLANNING", "CANCELLED", "AC9"],
  ["CONFIRMED", "CANCELLED", "AC9"],
  ["CONFIRMED", "COMPLETED", "AC10"],
];

describe("canTransition — SCRUM-135", () => {
  it.each(ALLOWED)(
    "SCRUM-135 TC-135-01: %s → %s is allowed (%s)",
    (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    },
  );

  it("SCRUM-135 [AC6, AC13] TC-135-06: a Rejected request goes back to Submitted only when its outcome is Amend and resubmit", () => {
    expect(
      canTransition("REJECTED", "SUBMITTED", {
        rejectionOutcome: "AMEND_AND_RESUBMIT",
      }),
    ).toBe(true);
    expect(
      canTransition("REJECTED", "SUBMITTED", { rejectionOutcome: "NEW_REQUEST" }),
    ).toBe(false);
    expect(
      canTransition("REJECTED", "SUBMITTED", { rejectionOutcome: null }),
    ).toBe(false);
    expect(canTransition("REJECTED", "SUBMITTED")).toBe(false);
  });

  it("SCRUM-135 [AC3, AC4] TC-135-03: a Submitted request can't be approved or rejected", () => {
    for (const to of ["PLANNING", "APPROVED", "REJECTED"] as EventStatus[]) {
      expect(canTransition("SUBMITTED", to)).toBe(false);
    }
  });

  it("SCRUM-135 [AC11] TC-135-11: every pair not in the table is refused", () => {
    const allowed = new Set(ALLOWED.map(([from, to]) => `${from}>${to}`));
    for (const from of ALL) {
      for (const to of ALL) {
        if (from === "REJECTED" && to === "SUBMITTED") continue;
        expect(canTransition(from, to), `${from} → ${to}`).toBe(
          allowed.has(`${from}>${to}`),
        );
      }
    }
  });

  it("SCRUM-135 [AC12] TC-135-12: nothing moves an event into Approved", () => {
    for (const from of ALL) {
      expect(canTransition(from, "APPROVED")).toBe(false);
    }
  });

  it("SCRUM-254 [AC3] TC-254-03: nothing moves an event out of Approved either, not even to Cancelled", () => {
    for (const to of ALL) {
      expect(canTransition("APPROVED", to), `APPROVED → ${to}`).toBe(false);
    }
  });

  it("SCRUM-135 [AC13] TC-135-13: Completed and Cancelled are final", () => {
    for (const to of ALL) {
      expect(canTransition("COMPLETED", to)).toBe(false);
      expect(canTransition("CANCELLED", to)).toBe(false);
    }
  });

  it("SCRUM-135 [AC9] TC-135-09: an event can be cancelled from Under Review, Planning or Confirmed", () => {
    expect([...CANCELLABLE].sort()).toEqual(
      ["CONFIRMED", "PLANNING", "UNDER_REVIEW"].sort(),
    );
  });
});

describe("the statuses — SCRUM-135 AC15, AC16", () => {
  it("SCRUM-135 [AC15, AC16] TC-135-15: clarification, the safety check and reassignment are not statuses", () => {
    expect(Object.values(EVENT_STATUS_LABEL)).toEqual([
      "Draft",
      "Submitted",
      "Under Review",
      "Approved",
      "Planning",
      "Confirmed",
      "Completed",
      "Cancelled",
      "Rejected",
    ]);
  });
});

describe("transitionRefusal — SCRUM-135 AC11", () => {
  it.each(ALL)(
    "SCRUM-135 [AC11] TC-135-11: the refusal for a %s event names its status",
    (status) => {
      expect(transitionRefusal(status, "confirmed")).toBe(
        `This event is ${EVENT_STATUS_LABEL[status]}, so it can't be confirmed.`,
      );
    },
  );
});
