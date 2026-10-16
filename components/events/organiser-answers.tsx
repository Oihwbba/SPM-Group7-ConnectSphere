/**
 * SCRUM-170 — the Organiser's own answers from the request form, shown
 * read-only, exactly as entered, to the people planning the event: the
 * Coordinator requesting a venue (AC2) or equipment (AC3), Venue Staff and
 * Technical Support reviewing those requests, and the event's details (AC5).
 * The answers are free text, so they are shown, never used to pre-fill.
 */

export type VenueAnswers = {
  venueRequirements: string | null;
  preferredLayout: string | null;
  accessibilityNeeds: string | null;
};

function Answer({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="font-semibold text-muted-foreground">{label}:</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-foreground">
        {value?.trim() ? value : "—"}
      </dd>
    </div>
  );
}

/** AC2, AC5: Venue & Accessibility Requirements. */
export function OrganiserVenueAnswers({
  answers,
  className,
}: {
  answers: VenueAnswers;
  className?: string;
}) {
  return (
    <dl
      className={className ?? "space-y-2 text-xs"}
      data-testid="organiser-venue-answers"
      aria-label="The Organiser's venue and accessibility requirements"
    >
      <Answer label="Venue Requirements" value={answers.venueRequirements} />
      <Answer label="Preferred Room Layout" value={answers.preferredLayout} />
      <Answer label="Accessibility Needs" value={answers.accessibilityNeeds} />
    </dl>
  );
}

/** AC3, AC5: Equipment & Technical Support. */
export function OrganiserEquipmentAnswer({
  equipmentRequirements,
  className,
}: {
  equipmentRequirements: string | null;
  className?: string;
}) {
  return (
    <dl
      className={className ?? "text-xs"}
      data-testid="organiser-equipment-answer"
      aria-label="The Organiser's equipment and technical support requirements"
    >
      <Answer label="Equipment Requirements" value={equipmentRequirements} />
    </dl>
  );
}
