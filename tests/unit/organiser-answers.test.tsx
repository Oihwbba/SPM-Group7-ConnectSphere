import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  OrganiserEquipmentAnswer,
  OrganiserVenueAnswers,
} from "@/components/events/organiser-answers";

// SCRUM-170 — the Organiser's answers as the people planning see them.
// Test cases: docs/testing/SCRUM-170.md.

describe("OrganiserVenueAnswers and OrganiserEquipmentAnswer — SCRUM-170", () => {
  it("SCRUM-170 [AC5] TC-170-05: the venue and accessibility answers are shown under their own labels, exactly as entered, line breaks kept", () => {
    const html = renderToStaticMarkup(
      <OrganiserVenueAnswers
        answers={{
          venueRequirements: "Hall for 200,\nnear the lobby",
          preferredLayout: "Cabaret, round tables",
          accessibilityNeeds: "Two wheelchair users",
        }}
      />,
    );

    expect(html).toContain("Venue Requirements:");
    expect(html).toContain("Hall for 200,\nnear the lobby");
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("Preferred Room Layout:");
    expect(html).toContain("Cabaret, round tables");
    expect(html).toContain("Accessibility Needs:");
    expect(html).toContain("Two wheelchair users");
    expect(html).not.toContain("Required Facilities");
  });

  it("SCRUM-170 [AC5] TC-170-05: an answer left blank, or only spaces, shows a dash rather than nothing", () => {
    const html = renderToStaticMarkup(
      <OrganiserVenueAnswers
        answers={{
          venueRequirements: null,
          preferredLayout: "   ",
          accessibilityNeeds: "",
        }}
      />,
    );

    expect(html.match(/<dd[^>]*>—<\/dd>/g)).toHaveLength(3);
  });

  it("SCRUM-170 [AC3, AC5] TC-170-03, TC-170-05: the equipment answer is shown under Equipment Requirements, exactly as entered", () => {
    const html = renderToStaticMarkup(
      <OrganiserEquipmentAnswer
        equipmentRequirements={"2 projectors\nlapel mics"}
      />,
    );

    expect(html).toContain("Equipment Requirements:");
    expect(html).toContain("2 projectors\nlapel mics");
  });
});
