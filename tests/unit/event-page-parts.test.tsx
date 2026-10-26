import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Users } from "lucide-react";

import { EventProgress } from "@/app/(app)/events/[id]/event-progress";
import { StatStrip } from "@/components/app/stat-strip";

/** The step marked current, as aria-current="step" marks it. */
const currentStep = (html: string) =>
  /aria-current="step"[^>]*>([\s\S]*?)<\/li>/.exec(html)?.[1].replace(/<[^>]+>/g, "") ?? null;

describe("SCRUM-208 — the event's progress", () => {
  it("SCRUM-208 [AC2] TC-208-02: the steps done are ticked and the current one is marked, with the status for screen readers", () => {
    const html = renderToStaticMarkup(<EventProgress status="UNDER_REVIEW" />);
    expect(html).toContain('data-status="UNDER_REVIEW"');
    expect(html).toContain("Status: Under Review");
    expect(currentStep(html)).toBe("Review");
    // Request is done: one tick, before the current step.
    expect(html.match(/lucide-check/g)).toHaveLength(1);
  });

  it("SCRUM-208 [AC2] TC-208-02: Planning and Approved are the same step, Confirmed the next", () => {
    expect(currentStep(renderToStaticMarkup(<EventProgress status="APPROVED" />))).toBe("Planning");
    expect(currentStep(renderToStaticMarkup(<EventProgress status="PLANNING" />))).toBe("Planning");
    expect(currentStep(renderToStaticMarkup(<EventProgress status="CONFIRMED" />))).toBe("Confirmed");
  });

  it("SCRUM-208 [AC2] TC-208-02: a Rejected request is marked Rejected where it stopped", () => {
    const html = renderToStaticMarkup(<EventProgress status="REJECTED" />);
    expect(currentStep(html)).toBe("Rejected");
    expect(html).toContain("bg-destructive");
    // It stopped at Review: only Request before it is done.
    expect(html.match(/lucide-check/g)).toHaveLength(1);
  });

  it("SCRUM-208 [AC2] TC-208-02: a Cancelled event shows how far it got, then Cancelled", () => {
    const html = renderToStaticMarkup(
      <EventProgress status="CANCELLED" cancelledFrom="CONFIRMED" />,
    );
    expect(currentStep(html)).toBe("Cancelled");
    // Request, Review and Planning were done.
    expect(html.match(/lucide-check/g)).toHaveLength(3);
  });

  it("SCRUM-208 [AC2] TC-208-02: a Completed event has every step done and none current", () => {
    const html = renderToStaticMarkup(<EventProgress status="COMPLETED" />);
    expect(currentStep(html)).toBeNull();
    expect(html.match(/lucide-check/g)).toHaveLength(5);
  });
});

describe("SCRUM-208 — key facts as a strip of stats", () => {
  it("SCRUM-208 [AC2, AC3] TC-208-17: each fact has its label and value, the value bold in the primary colour unless good or bad news, or plain", () => {
    const html = renderToStaticMarkup(
      <StatStrip
        stats={[
          { icon: Users, label: "Registered", value: "2 of 250", testId: "count" },
          { icon: Users, label: "Status", value: "Open", tone: "success" },
          { icon: Users, label: "Closed", value: "Registration closed", tone: "danger" },
          { icon: Users, label: "Equipment", value: "Projector × 2", plain: true },
        ]}
      />,
    );
    expect(html).toMatch(/<dt[^>]*>Registered<\/dt><dd class="[^"]*font-bold text-primary[^"]*" data-testid="count">2 of 250<\/dd>/);
    expect(html).toMatch(/<dd class="[^"]*text-success[^"]*">Open<\/dd>/);
    expect(html).toMatch(/<dd class="[^"]*text-destructive[^"]*">Registration closed<\/dd>/);
    expect(html).toMatch(/<dd class="[^"]*font-normal text-foreground[^"]*">Projector × 2<\/dd>/);
  });
});
