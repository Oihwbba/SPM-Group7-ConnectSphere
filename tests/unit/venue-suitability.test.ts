import { describe, it, expect } from "vitest";

import {
  assessSuitability,
  suitabilityThatCounts,
  type SuitabilityNeeds,
  type SuitabilityVenue,
} from "@/lib/venue-suitability";

// SCRUM-40 AC1–AC6, AC8 — the automatic suitability result and the one that
// counts. Expected wording is the examples AC6 gives.

const venue: SuitabilityVenue = {
  capacity: 100,
  facilities: ["projector", "sound-system"],
  accessibilityFeatures: ["hearing-loop"],
  supportedLayouts: ["theatre", "classroom"],
};

const nothingAsked: SuitabilityNeeds = {
  attendance: null,
  facilities: [],
  accessibilityFeatures: [],
  layout: null,
};

describe("assessSuitability — SCRUM-40", () => {
  it("SCRUM-40 [AC1] TC-40-01: attendance one over capacity is Not suitable, naming both values", () => {
    expect(assessSuitability(venue, { ...nothingAsked, attendance: 101 })).toEqual({
      suitable: false,
      reasons: ["Capacity 100 < attendance 101"],
    });
  });

  it("SCRUM-40 [AC1] TC-40-01: attendance equal to capacity is not unsuitable on capacity", () => {
    expect(assessSuitability(venue, { ...nothingAsked, attendance: 100 })).toEqual({
      suitable: true,
      reasons: [],
    });
  });

  it("SCRUM-40 [AC2] TC-40-02: a facility the request needs and the venue lacks is Not suitable", () => {
    expect(
      assessSuitability(venue, { ...nothingAsked, facilities: ["livestream"] }),
    ).toEqual({ suitable: false, reasons: ["Missing facility: livestream"] });
  });

  it("SCRUM-40 [AC2] TC-40-02: facilities are compared as tags, so wording and case don't matter", () => {
    expect(
      assessSuitability(venue, {
        ...nothingAsked,
        facilities: ["Sound System", "PROJECTOR"],
      }).suitable,
    ).toBe(true);
  });

  it("SCRUM-40 [AC3] TC-40-03: an accessibility feature the venue doesn't provide is Not suitable, as AC6 words it", () => {
    expect(
      assessSuitability(venue, {
        ...nothingAsked,
        accessibilityFeatures: ["wheelchair-access"],
      }),
    ).toEqual({
      suitable: false,
      reasons: ["No wheelchair access; event needs wheelchair access"],
    });
  });

  it("SCRUM-40 [AC4] TC-40-04: a layout the venue doesn't support is Not suitable, as AC6 words it", () => {
    expect(assessSuitability(venue, { ...nothingAsked, layout: "banquet" })).toEqual({
      suitable: false,
      reasons: ["Banquet layout not supported"],
    });
    expect(assessSuitability(venue, { ...nothingAsked, layout: "Classroom" }).suitable).toBe(
      true,
    );
  });

  it("SCRUM-40 [AC5] TC-40-05: a venue that meets everything asked is Suitable with no reasons", () => {
    expect(
      assessSuitability(venue, {
        attendance: 80,
        facilities: ["projector"],
        accessibilityFeatures: ["hearing-loop"],
        layout: "theatre",
      }),
    ).toEqual({ suitable: true, reasons: [] });
  });

  it("SCRUM-40 [AC6] TC-40-06: every reason that applies is listed, with both values where relevant", () => {
    expect(
      assessSuitability(
        { ...venue, capacity: 100 },
        {
          attendance: 150,
          facilities: ["projector", "livestream", "stage"],
          accessibilityFeatures: ["wheelchair-access"],
          layout: "banquet",
        },
      ).reasons,
    ).toEqual([
      "Capacity 100 < attendance 150",
      "Missing facility: livestream",
      "Missing facility: stage",
      "No wheelchair access; event needs wheelchair access",
      "Banquet layout not supported",
    ]);
  });

  it("SCRUM-40 [AC1] TC-40-01: a request that states no attendance is never short of capacity", () => {
    expect(assessSuitability({ ...venue, capacity: 1 }, nothingAsked).suitable).toBe(true);
  });
});

describe("suitabilityThatCounts — SCRUM-40 AC8", () => {
  const judgement = (suitable: boolean) => ({
    suitable,
    note: "Checked on site.",
    recordedByName: "Cora",
    recordedAt: new Date(),
  });

  it("SCRUM-40 [AC8] TC-40-08: the Coordinator's judgement counts over the automatic result, either way", () => {
    expect(suitabilityThatCounts({ suitable: false, reasons: ["x"] }, judgement(true))).toBe(true);
    expect(suitabilityThatCounts({ suitable: true, reasons: [] }, judgement(false))).toBe(false);
  });

  it("SCRUM-40 [AC8] TC-40-08: with no judgement, the automatic result counts", () => {
    expect(suitabilityThatCounts({ suitable: false, reasons: ["x"] }, null)).toBe(false);
    expect(suitabilityThatCounts({ suitable: true, reasons: [] }, null)).toBe(true);
  });
});
