import { describe, it, expect } from "vitest";
import type { EventStatus } from "@prisma/client";

import { STATUS_META } from "@/components/events/status-badge";

// SCRUM-16 / SCRUM-84 — the events list no longer has a tab per status, so the
// badge is what tells the nine statuses apart at a glance. Nothing pinned that
// before: an edit could give two statuses the same icon and colour and the list
// would silently stop distinguishing them.

const ALL_STATUSES: EventStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PLANNING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
];

describe("StatusBadge metadata", () => {
  it("covers every one of the nine statuses", () => {
    expect(Object.keys(STATUS_META).sort()).toEqual([...ALL_STATUSES].sort());
  });

  it("gives every status its own icon, so colour is never the only signal", () => {
    const icons = ALL_STATUSES.map((status) => STATUS_META[status].icon);

    expect(new Set(icons).size).toBe(ALL_STATUSES.length);
  });

  it("gives every status a distinct icon and colour pair", () => {
    const pairs = ALL_STATUSES.map(
      (status) => `${STATUS_META[status].variant}:${STATUS_META[status].icon.displayName ?? STATUS_META[status].icon.name}`,
    );

    expect(new Set(pairs).size).toBe(ALL_STATUSES.length);
  });

  it("SCRUM-16: a draft is muted, and never shares a look with a request under review", () => {
    expect(STATUS_META.DRAFT.variant).toBe("muted");
    expect(STATUS_META.DRAFT.variant).not.toBe(STATUS_META.SUBMITTED.variant);
    expect(STATUS_META.DRAFT.variant).not.toBe(STATUS_META.UNDER_REVIEW.variant);
    expect(STATUS_META.DRAFT.icon).not.toBe(STATUS_META.SUBMITTED.icon);
  });

  it("labels each status in words a user reads, not the enum value", () => {
    expect(STATUS_META.UNDER_REVIEW.label).toBe("Under Review");
    for (const status of ALL_STATUSES) {
      expect(STATUS_META[status].label).not.toContain("_");
      expect(STATUS_META[status].label.trim()).not.toBe("");
    }
  });
});
