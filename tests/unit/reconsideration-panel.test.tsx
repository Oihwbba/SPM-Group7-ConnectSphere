import { describe, it, expect } from "vitest";

import { afterCancelling } from "@/components/events/reconsideration-panel";

// SCRUM-26 AC9 — after Cancel arrangement, the Coordinator is told what
// happens next. Test cases: docs/testing/SCRUM-26.md (TC-26-10).

describe("afterCancelling — SCRUM-26 AC9", () => {
  it("SCRUM-26 [AC9] TC-26-10: a cancelled equipment reservation tells the Coordinator Technical Support will reserve it again, so no new request is made", () => {
    expect(afterCancelling("reservation")).toBe(
      "Technical Support will reserve it again.",
    );
  });

  it("SCRUM-26 [AC9] TC-26-10: a cancelled venue booking tells the Coordinator to request a venue again", () => {
    expect(afterCancelling("booking")).toBe("Request a venue again when you're ready.");
  });
});
