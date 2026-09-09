import { describe, it } from "vitest";

// Placeholder for the "at the same moment" cases (SCRUM-31/53/74). These are the
// acceptance criteria the database constraints and row locks exist to satisfy,
// so each one needs a real concurrent test against a live Postgres — see
// docs/data-model.md §4.4. Replace each `it.todo` as the feature lands.
describe("concurrency", () => {
  // Enforced by the `booking_no_double_booking` EXCLUDE constraint.
  it.todo("rejects the second of two simultaneous overlapping approvals (SCRUM-53)");
  it.todo("allows a booking that starts exactly when another ends (SCRUM-38/50)");

  // Enforced by SELECT ... FOR UPDATE on the Equipment row — a counted pool
  // cannot use an exclusion constraint.
  it.todo("does not over-allocate equipment when two staff reserve the last unit (SCRUM-31)");

  // Enforced by SELECT ... FOR UPDATE on the Event row.
  it.todo("gives the last remaining place to exactly one of two simultaneous registrations (SCRUM-74)");
});
