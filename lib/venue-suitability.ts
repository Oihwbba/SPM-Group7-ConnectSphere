import { toTag } from "@/lib/schemas/venue";

/**
 * SCRUM-40 — does a venue appear suitable for what a booking request (or a
 * search, before a request exists) asks for? Pure, so the request form, the
 * review queue and venue search (SCRUM-38) all give the same answer, and the
 * reasons read the same everywhere, including when a venue edit makes a
 * booking stop fitting (SCRUM-34 AC10).
 */

/** What a venue offers, as far as suitability compares it. */
export type SuitabilityVenue = {
  capacity: number;
  facilities: string[];
  accessibilityFeatures: string[];
  supportedLayouts: string[];
};

/**
 * What is asked for: the attendance, facilities, accessibility features and
 * layout on the booking request, or entered in the search (AC1–AC4).
 */
export type SuitabilityNeeds = {
  attendance: number | null;
  facilities: string[];
  accessibilityFeatures: string[];
  layout: string | null;
};

export type Suitability = { suitable: boolean; reasons: string[] };

/** "wheelchair-access" -> "wheelchair access" */
function readable(tag: string): string {
  return toTag(tag).replace(/-/g, " ");
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * AC1–AC6 — Not suitable when the attendance is over capacity, a facility or
 * accessibility feature asked for is missing, or the layout isn't supported;
 * otherwise Suitable with no reasons. Every reason that applies is listed,
 * naming the mismatch and both values where there are two (AC6). Attendance
 * equal to capacity fits (AC1). Values are compared as tags, so "Sound
 * System" and "sound-system" match.
 */
export function assessSuitability(
  venue: SuitabilityVenue,
  needs: SuitabilityNeeds,
): Suitability {
  const reasons: string[] = [];

  if (needs.attendance !== null && needs.attendance > venue.capacity) {
    reasons.push(`Capacity ${venue.capacity} < attendance ${needs.attendance}`);
  }

  const facilities = new Set(venue.facilities.map(toTag));
  for (const facility of needs.facilities) {
    if (!facilities.has(toTag(facility))) {
      reasons.push(`Missing facility: ${readable(facility)}`);
    }
  }

  const features = new Set(venue.accessibilityFeatures.map(toTag));
  for (const feature of needs.accessibilityFeatures) {
    if (!features.has(toTag(feature))) {
      const name = readable(feature);
      reasons.push(`No ${name}; event needs ${name}`);
    }
  }

  if (
    needs.layout &&
    !venue.supportedLayouts.map(toTag).includes(toTag(needs.layout))
  ) {
    reasons.push(`${capitalised(readable(needs.layout))} layout not supported`);
  }

  return { suitable: reasons.length === 0, reasons };
}

/** The Coordinator's own judgement, as it is shown beside the automatic one. */
export type SuitabilityJudgement = {
  suitable: boolean;
  note: string;
  recordedByName: string;
  recordedAt: Date;
};

/**
 * AC8 — the result that counts for this event: the Coordinator's judgement
 * when they have recorded one, otherwise the automatic result.
 */
export function suitabilityThatCounts(
  automatic: Suitability,
  judgement: SuitabilityJudgement | null,
): boolean {
  return judgement ? judgement.suitable : automatic.suitable;
}
