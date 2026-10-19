import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { OtherCommitments } from "@/app/(app)/equipment/equipment-schedule-panel";
import type { ScheduleEntry } from "@/lib/equipment/availability";

// SCRUM-131 AC2, AC3 — a reservation on Technical Support's equipment
// schedule reads Reserved, and a flagged one keeps that status with the Needs
// Reconsideration badge beside it. Rendered to static markup; the journey runs
// in e2e/report-reservation.spec.ts. Test cases: docs/testing/SCRUM-131.md.
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/app/(app)/equipment/actions", () => ({
  getEquipmentSchedule: vi.fn(),
  reportUnprovidableEquipment: vi.fn(),
}));

function reservation(needsReconsideration: boolean): ScheduleEntry {
  return {
    id: "res1",
    kind: "reservation",
    startAt: new Date("2031-06-01T01:00:00Z"),
    endAt: new Date("2031-06-01T05:00:00Z"),
    quantity: 2,
    eventName: "Charity Gala",
    reason: null,
    note: null,
    needsReconsideration,
  };
}

function render(entry: ScheduleEntry, onReported?: () => void): string {
  return renderToStaticMarkup(
    <OtherCommitments
      state={{
        schedule: {
          equipmentId: "eq1",
          type: "Projector",
          totalQuantity: 4,
          entries: [entry],
          fullyAvailable: false,
        },
        error: null,
        loading: false,
      }}
      equipmentType="Projector"
      period={null}
      onReported={onReported}
    />,
  );
}

function text(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
}

function statusLine(html: string): string {
  const match = html.match(/<p[^>]*data-testid="reservation-status"[^>]*>(.*?)<\/p>/s);
  return match ? text(match[1]) : "";
}

describe("equipment schedule — SCRUM-131 AC2, AC3", () => {
  it("SCRUM-131 [AC2, AC3] TC-131-11: a flagged reservation reads Reserved with the Needs Reconsideration badge beside it, not in place of it", () => {
    const html = render(reservation(true), vi.fn());

    expect(statusLine(html)).toBe("Reserved Needs Reconsideration");
    expect(html).toContain('data-testid="needs-reconsideration"');
    expect(text(html)).not.toContain("Reported as not providable");
    expect(text(html)).not.toContain("Confirmed");
    // Already reported: waiting for the Coordinator, not reportable again.
    expect(text(html)).toContain("Waiting for the event's Coordinator to decide.");
    expect(text(html)).not.toContain("Can't provide this");
  });

  it("SCRUM-131 [AC2, AC3] TC-131-11: an unflagged reservation reads Reserved, without the badge, and can still be reported", () => {
    const html = render(reservation(false), vi.fn());

    expect(statusLine(html)).toBe("Reserved");
    expect(html).not.toContain('data-testid="needs-reconsideration"');
    expect(text(html)).toContain("Can't provide this");
  });
});
