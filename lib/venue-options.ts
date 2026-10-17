import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * SCRUM-34 AC3, AC6 — what Venue Staff choose a venue's facilities,
 * accessibility features and supported layouts from: a predefined list, plus
 * anything they added to an active venue themselves. The same options are
 * offered wherever a venue is matched against what an event needs: the event
 * request form (SCRUM-13), venue search (SCRUM-38) and suitability
 * (SCRUM-40). Values are tags (see toTag in lib/schemas/venue.ts), so
 * "Sound System" and "sound-system" are one option.
 */
export const VENUE_OPTION_FIELDS = [
  "facilities",
  "accessibilityFeatures",
  "supportedLayouts",
] as const;

export type VenueOptionField = (typeof VENUE_OPTION_FIELDS)[number];
export type VenueOptions = Record<VenueOptionField, string[]>;

export const PREDEFINED_VENUE_OPTIONS: VenueOptions = {
  facilities: [
    "projector",
    "sound-system",
    "microphone",
    "stage",
    "whiteboard",
    "video-conferencing",
    "livestream",
    "wifi",
    "open-floor",
    "loading-bay",
  ],
  accessibilityFeatures: [
    "wheelchair-access",
    "step-free-entrance",
    "lift",
    "accessible-restroom",
    "hearing-loop",
    "braille-signage",
    "accessible-seating",
  ],
  supportedLayouts: [
    "theatre",
    "classroom",
    "banquet",
    "boardroom",
    "u-shape",
    "cocktail",
    "exhibition",
  ],
};

/** Longest tag Venue Staff may add, so a list stays readable. */
export const MAX_VENUE_OPTION_LENGTH = 60;

/**
 * The options for each field: the predefined ones in their order, then every
 * other value the given venues hold, alphabetically, each once.
 */
export function venueOptions(
  venues: Partial<Record<VenueOptionField, string[]>>[],
): VenueOptions {
  const merge = (field: VenueOptionField) => {
    const predefined = PREDEFINED_VENUE_OPTIONS[field];
    const added = new Set(
      venues.flatMap((venue) => venue[field] ?? []).filter((tag) => !predefined.includes(tag)),
    );
    return [...predefined, ...[...added].sort()];
  };
  return {
    facilities: merge("facilities"),
    accessibilityFeatures: merge("accessibilityFeatures"),
    supportedLayouts: merge("supportedLayouts"),
  };
}

/** The options as the catalogue holds them now, from active venues only. */
export async function readVenueOptions(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<VenueOptions> {
  const venues = await db.venue.findMany({
    where: { isActive: true },
    select: { facilities: true, accessibilityFeatures: true, supportedLayouts: true },
  });
  return venueOptions(venues);
}

/** "sound-system" -> "Sound system" */
export function tagLabel(tag: string): string {
  const words = tag.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Letters and digits only, to compare a typed label with a tag. */
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * SCRUM-13 — the request form's layout presets, followed by every venue
 * layout none of them already names. "Cocktail / Standing" covers the
 * "cocktail" layout, so it isn't offered twice.
 */
export function withVenueLayouts(presets: string[], layouts: string[]): string[] {
  const presetKeys = presets.map(key);
  const extra = layouts.filter(
    (layout) => !presetKeys.some((preset) => preset.startsWith(key(layout))),
  );
  return [...presets, ...extra.map(tagLabel)];
}

/**
 * SCRUM-13 — add an accessibility feature to the Organiser's free-text
 * accessibility needs, unless the text already mentions it.
 */
export function addAccessibilityNeed(text: string, feature: string): string {
  const current = text.trim();
  if (key(current).includes(key(feature))) return text;
  return current ? `${current}, ${feature}` : feature;
}
