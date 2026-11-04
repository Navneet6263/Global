const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Sapling works on India time. */
const IST_OFFSET_MS = 330 * 60_000;

const isSunday = (time: number) =>
  new Date(time + IST_OFFSET_MS).getUTCDay() === 0;

/** Midnight (IST) at the start of the next day. */
const nextMidnight = (time: number) =>
  Math.floor((time + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS + DAY_MS;

/** Working days (Sundays excluded) between two times, rounded to whole days. */
export function workingDaysBetween(start: Date, end: Date): number {
  let at = start.getTime();
  const until = end.getTime();
  let working = 0;
  while (at < until) {
    const next = Math.min(nextMidnight(at), until);
    if (!isSunday(at)) working += next - at;
    at = next;
  }
  return Math.round(working / DAY_MS);
}

/** Turnaround in working days, as clients see it (no due date). */
export function tatWorkingDays(hours: readonly number[]): number | null {
  const longest = Math.max(0, ...hours.filter((value) => Number.isFinite(value)));
  return longest > 0 ? Math.round((longest / 24) * 2) / 2 : null;
}

/**
 * Due time for a turnaround in working days: TAT hours are counted 24 at a time and
 * Sundays (IST) never count. A case opened on a Sunday starts its clock on Monday; a day
 * that would end on a Sunday ends on Monday instead.
 */
export function addWorkingHours(start: Date, hours: number): Date {
  let at = start.getTime();
  while (isSunday(at)) at = nextMidnight(at);
  let left = Math.max(0, hours);
  while (left > 0) {
    const step = Math.min(left, 24);
    at += step * HOUR_MS;
    left -= step;
    while (isSunday(at)) at += DAY_MS;
  }
  return new Date(at);
}
