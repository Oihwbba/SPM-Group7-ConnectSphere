import { describe, it, expect, vi } from "vitest";

import {
  addAccessibilityNeed,
  PREDEFINED_VENUE_OPTIONS,
  readVenueOptions,
  tagLabel,
  venueOptions,
  withVenueLayouts,
} from "@/lib/venue-options";
import { getVenueOptions } from "@/app/(app)/venues/queries";

// SCRUM-34 AC3, AC6 — the options a venue's facilities, accessibility
// features and layouts are chosen from, and how the event request form
// (SCRUM-13) offers the ones Venue Staff add.
const db = vi.hoisted(() => ({ venue: { findMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));

describe("venueOptions — SCRUM-34 AC3, AC6", () => {
  it("SCRUM-34 [AC3, AC6] TC-34-18: the predefined options come first, then each value Venue Staff added, once and in order", () => {
    const options = venueOptions([
      { facilities: ["projector", "rooftop-bar"], supportedLayouts: ["garden-party"] },
      { facilities: ["rooftop-bar", "dance-floor"], accessibilityFeatures: ["tactile-paving"] },
    ]);

    expect(options.facilities).toEqual([
      ...PREDEFINED_VENUE_OPTIONS.facilities,
      "dance-floor",
      "rooftop-bar",
    ]);
    expect(options.accessibilityFeatures).toEqual([
      ...PREDEFINED_VENUE_OPTIONS.accessibilityFeatures,
      "tactile-paving",
    ]);
    expect(options.supportedLayouts).toEqual([
      ...PREDEFINED_VENUE_OPTIONS.supportedLayouts,
      "garden-party",
    ]);
  });

  it("SCRUM-34 [AC3] TC-34-18: with no venues, only the predefined options are offered", () => {
    expect(venueOptions([])).toEqual(PREDEFINED_VENUE_OPTIONS);
  });

  it("SCRUM-34 [AC6, AC8] TC-34-18: the options are read from active venues only, so a retired venue's own values drop out", async () => {
    db.venue.findMany.mockResolvedValue([{ facilities: ["rooftop-bar"] }]);

    const options = await getVenueOptions();

    expect(db.venue.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { facilities: true, accessibilityFeatures: true, supportedLayouts: true },
    });
    expect(options.facilities).toContain("rooftop-bar");
    expect(await readVenueOptions(db as never)).toEqual(options);
  });

  it("SCRUM-34 [AC1] TC-34-18: a tag reads as words", () => {
    expect(tagLabel("sound-system")).toBe("Sound system");
    expect(tagLabel("wifi")).toBe("Wifi");
  });
});

describe("the event request form's options — SCRUM-13 with SCRUM-34 AC6", () => {
  const PRESETS = ["Theatre", "Classroom", "Banquet", "Boardroom", "U-Shape", "Cocktail / Standing"];

  it("SCRUM-13 [AC1] TC-13-14: a layout Venue Staff added follows the presets; one a preset already names isn't offered twice", () => {
    expect(
      withVenueLayouts(PRESETS, ["theatre", "u-shape", "cocktail", "exhibition", "garden-party"]),
    ).toEqual([...PRESETS, "Exhibition", "Garden party"]);
  });

  it("SCRUM-13 [AC1] TC-13-14: picking an accessibility feature adds it to the answer, once", () => {
    expect(addAccessibilityNeed("", "Wheelchair access")).toBe("Wheelchair access");
    expect(addAccessibilityNeed("Seating near exits ", "Hearing loop")).toBe(
      "Seating near exits, Hearing loop",
    );
    // Already there, however it was written: the answer is left as typed.
    expect(addAccessibilityNeed("needs wheelchair-access", "Wheelchair access")).toBe(
      "needs wheelchair-access",
    );
  });
});
