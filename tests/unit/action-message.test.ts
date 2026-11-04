import { describe, it, expect } from "vitest";

import {
  DEFAULT_NEXT_STEP,
  NOT_ALLOWED_NEXT_STEP,
  withNextStep,
} from "@/lib/action-message";

// SCRUM-207 AC4 — every error says what to do next.
describe("SCRUM-207 AC4 — an error says what to do next", () => {
  it.each([
    "Choose someone who is a Coordinator.",
    "Enter the expected attendance.",
    "Please fix the highlighted fields.",
    "This event was updated by another user. Refresh and try again.",
    "This request was rejected. Raise a new request instead.",
  ])(
    "SCRUM-207 [AC4] TC-207-09: %s already says what to do, so it shows as it is",
    (message) => {
      expect(withNextStep(message)).toBe(message);
    },
  );

  it.each([
    ["Event not found.", `Event not found. ${DEFAULT_NEXT_STEP}`],
    // A message without its full stop still reads as two sentences.
    ["Venue not found", `Venue not found. ${DEFAULT_NEXT_STEP}`],
  ])(
    "SCRUM-207 [AC4] TC-207-09: %s gets the next step added",
    (message, shown) => {
      expect(withNextStep(message)).toBe(shown);
    },
  );

  it("SCRUM-207 [AC4] TC-207-09: a refusal by role is told who to ask, not to try again", () => {
    expect(withNextStep("You do not have permission to do that.")).toBe(
      `You do not have permission to do that. ${NOT_ALLOWED_NEXT_STEP}`,
    );
  });

  it("SCRUM-207 [AC4] TC-207-09: an action that knows its own next step says that instead", () => {
    expect(
      withNextStep(
        "Booking request not found.",
        "Go back to the list; someone may have decided it.",
      ),
    ).toBe(
      "Booking request not found. Go back to the list; someone may have decided it.",
    );
  });
});
