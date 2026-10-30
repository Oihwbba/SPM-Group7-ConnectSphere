/**
 * SCRUM-253 — every venue has opening hours for each day of the week, and
 * the database refuses one without them when its transaction commits. A test
 * venue that isn't testing opening hours is open 00:00–23:59 every day, the
 * week the migration gave old venues that had none, so no booking period
 * within one day is refused for its hours.
 */
export const OPEN_ALL_WEEK = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  opensMinute: 0,
  closesMinute: 1439,
}));

/** For `prisma.venue.create({ data: { ...withHours } })`: the venue's week in the same write. */
export const withHours = { openingHours: { create: OPEN_ALL_WEEK } };
