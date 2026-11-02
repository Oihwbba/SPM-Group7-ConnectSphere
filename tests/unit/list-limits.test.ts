import { describe, it, expect } from "vitest";
import type { ZodType } from "zod";

import { bookingRequestSchema } from "@/lib/schemas/booking";
import { requestClarificationSchema } from "@/lib/schemas/clarification";
import { createDraftEventSchema, submitEventRequestSchema } from "@/lib/schemas/event";
import { eventDetailsEditSchema } from "@/lib/schemas/event-edit";
import { MAX_LIST_ITEMS } from "@/lib/schemas/limits";
import { recordUnavailabilitySchema } from "@/lib/schemas/unavailability";
import { venueSchema, venueUpdateSchema } from "@/lib/schemas/venue";
import { venueSearchSchema } from "@/lib/schemas/venue-search";

// SCRUM-259 — no list in a request is read past 500 entries, so an oversized
// request can't exhaust memory. Test cases: docs/testing/SCRUM-259.md. The
// safety check's two lists are in safety-check-outcome.test.ts, as that schema
// is private to its action file.

const issuesAt = (schema: ZodType, field: string, value: unknown) => {
  const parsed = schema.safeParse({ [field]: value });
  return parsed.success ? [] : parsed.error.issues.filter((issue) => issue.path[0] === field);
};

// Each row: the schema, the field, a valid entry, and an entry the field refuses.
const LISTS: [string, ZodType, string, string, unknown][] = [
  ["booking facilities", bookingRequestSchema, "requiredFacilities", "projector", ""],
  ["booking access features", bookingRequestSchema, "requiredAccessibilityFeatures", "ramp", ""],
  ["clarification fields", requestClarificationSchema, "editableFields", "schedule", "nope"],
  ["draft facilities", createDraftEventSchema, "requiredFacilities", "projector", 1],
  ["submitted facilities", submitEventRequestSchema, "requiredFacilities", "projector", 1],
  ["confirmed arrangements", eventDetailsEditSchema, "confirmedArrangements", "bkg_1", 1],
  ["unavailability bookings", recordUnavailabilitySchema, "confirmedBookingIds", "bkg_1", 1],
  ["venue update bookings", venueUpdateSchema, "confirmedBookingIds", "bkg_1", 1],
  ["search facilities", venueSearchSchema, "facility", "projector", "x".repeat(101)],
  ["search access features", venueSearchSchema, "access", "ramp", "x".repeat(101)],
];

const distinctTags = (count: number) => Array.from({ length: count }, (_, i) => `tag-${i}`);

describe("list limits — SCRUM-259", () => {
  it("SCRUM-259 [AC7] TC-259-01: the limit is 500 entries", () => {
    expect(MAX_LIST_ITEMS).toBe(500);
  });

  it.each(LISTS)(
    "SCRUM-259 [AC7] TC-259-01: %s accepts 500 entries and refuses 501",
    (_, schema, field, entry) => {
      expect(issuesAt(schema, field, Array(500).fill(entry))).toEqual([]);
      expect(issuesAt(schema, field, Array(501).fill(entry)).map((i) => i.code)).toEqual([
        "too_big",
      ]);
    },
  );

  it.each(LISTS)(
    "SCRUM-259 [AC7] TC-259-02: %s refuses 501 bad entries with one issue, without reading them",
    (_, schema, field, _entry, bad) => {
      expect(issuesAt(schema, field, Array(501).fill(bad))).toHaveLength(1);
    },
  );

  it.each(["facilities", "accessibilityFeatures", "supportedLayouts"])(
    "SCRUM-259 [AC7] TC-259-01: a venue's %s accepts 500 different tags and refuses 501",
    (field) => {
      expect(issuesAt(venueSchema, field, distinctTags(500))).toEqual([]);
      expect(issuesAt(venueSchema, field, distinctTags(501)).map((i) => i.code)).toEqual([
        "too_big",
      ]);
    },
  );

  it("SCRUM-259 [AC7] TC-259-04: tags are still normalised and repeats dropped, in order, and repeats don't count towards the limit", () => {
    const { facilities } = venueSchema.shape;
    expect(facilities.parse(["Sound System", "sound-system", " ", "Projector"])).toEqual([
      "sound-system",
      "projector",
    ]);
    expect(facilities.parse("Sound System, Projector,,projector")).toEqual([
      "sound-system",
      "projector",
    ]);
    expect(facilities.parse(Array(600).fill("Projector"))).toEqual(["projector"]);
  });

  it("SCRUM-259 [AC7] TC-259-05: 200,000 different tags are refused promptly, not compared with each other", () => {
    expect(issuesAt(venueSchema, "facilities", distinctTags(200_000))).toHaveLength(1);
  });
});
