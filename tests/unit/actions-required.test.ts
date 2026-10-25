import { describe, it, expect, vi } from "vitest";

import {
  filterAndSortEvents,
  needsOrganiserAction,
} from "@/app/(app)/events/events-client";

// The list's own dependencies aren't exercised here.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

// Shared page conventions, change 1 — the Organiser's "Actions required" tab:
// the requests waiting on them, and no others.
const event = (
  id: string,
  status: string,
  rejectionOutcome: string | null = null,
) => ({ id, name: id, status, rejectionOutcome });

describe("needsOrganiserAction", () => {
  const none = new Set<string>();

  it("SCRUM-207 TC-207-16: a request rejected to be amended and resubmitted waits on the Organiser", () => {
    expect(
      needsOrganiserAction(event("a", "REJECTED", "AMEND_AND_RESUBMIT"), none),
    ).toBe(true);
    // Rejections from before the choice existed are amended (SCRUM-126 AC7).
    expect(needsOrganiserAction(event("b", "REJECTED", null), none)).toBe(true);
  });

  it("SCRUM-207 TC-207-16: a request rejected for a new one to be started does not: it stays rejected", () => {
    expect(
      needsOrganiserAction(event("c", "REJECTED", "NEW_REQUEST"), none),
    ).toBe(false);
  });

  it("SCRUM-207 TC-207-16: a request with a clarification the Organiser hasn't answered waits on them", () => {
    expect(
      needsOrganiserAction(event("d", "UNDER_REVIEW"), new Set(["d"])),
    ).toBe(true);
    expect(
      needsOrganiserAction(event("e", "UNDER_REVIEW"), new Set(["d"])),
    ).toBe(false);
  });

  it("SCRUM-207 TC-207-16: drafts and requests in every other state don't", () => {
    for (const status of [
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "PLANNING",
      "CONFIRMED",
      "COMPLETED",
      "CANCELLED",
    ]) {
      expect(needsOrganiserAction(event("f", status), none)).toBe(false);
    }
  });
});

describe("the Actions required tab", () => {
  it("SCRUM-207 TC-207-16: lists exactly the requests needsAction picks", () => {
    const events = [
      event("amend", "REJECTED", "AMEND_AND_RESUBMIT"),
      event("asked", "UNDER_REVIEW"),
      event("waiting", "UNDER_REVIEW"),
      event("draft", "DRAFT"),
    ];
    const awaiting = new Set(["asked"]);
    const listed = filterAndSortEvents(events, {
      activeTab: "ACTION",
      needsAction: (e) =>
        needsOrganiserAction(e as (typeof events)[number], awaiting),
    });
    expect(listed.map((e) => e.id).sort()).toEqual(["amend", "asked"]);
  });

  it("SCRUM-207 TC-207-16: lists nothing when the list doesn't say what needs action", () => {
    expect(
      filterAndSortEvents([event("a", "REJECTED")], { activeTab: "ACTION" }),
    ).toEqual([]);
  });
});
