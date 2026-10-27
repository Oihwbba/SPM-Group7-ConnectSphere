/**
 * SCRUM-190 — an event starts and ends on one Singapore day, so a test period
 * built as "now + N hours" crosses midnight SGT for part of every day and
 * makes its test flaky. This one is pinned to the wall clock instead:
 * `daysAhead` Singapore days from today, from `startHour` to `endHour` SGT.
 * Worked out here rather than with lib/datetime, so a fixture never depends
 * on the code it tests.
 */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SGT = 8 * HOUR;

export function sgtPeriod(daysAhead: number, startHour = 10, endHour = 12) {
  const todaySgt = Math.floor((Date.now() + SGT) / DAY) * DAY - SGT;
  const day = todaySgt + daysAhead * DAY;
  return {
    startAt: new Date(day + startHour * HOUR),
    endAt: new Date(day + endHour * HOUR),
  };
}
