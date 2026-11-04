import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addWorkingHours,
  tatWorkingDays,
  workingDaysBetween,
} from "../src/cases/working-days";

const ist = (value: string) => new Date(`${value}+05:30`);

void test("a TAT day that would end on a Sunday ends on Monday", () => {
  // Saturday 7 Nov 2026 + 1 day skips Sunday 8 Nov.
  assert.deepEqual(
    addWorkingHours(ist("2026-11-07T10:00:00"), 24),
    ist("2026-11-09T10:00:00"),
  );
  // Wednesday + 3 days = Saturday; + 4 days skips Sunday.
  assert.deepEqual(
    addWorkingHours(ist("2026-11-04T10:00:00"), 72),
    ist("2026-11-07T10:00:00"),
  );
  assert.deepEqual(
    addWorkingHours(ist("2026-11-04T10:00:00"), 96),
    ist("2026-11-09T10:00:00"),
  );
});

void test("14 working days skip both Sundays in between", () => {
  assert.deepEqual(
    addWorkingHours(ist("2026-11-04T10:00:00"), 14 * 24),
    ist("2026-11-20T10:00:00"),
  );
});

void test("a case opened on a Sunday starts counting on Monday", () => {
  assert.deepEqual(
    addWorkingHours(ist("2026-11-08T15:00:00"), 24),
    ist("2026-11-10T00:00:00"),
  );
});

void test("half days also skip Sunday", () => {
  assert.deepEqual(
    addWorkingHours(ist("2026-11-07T18:00:00"), 12),
    ist("2026-11-09T06:00:00"),
  );
});

void test("elapsed working days leave Sundays out", () => {
  // Thursday 1 Oct to Monday 5 Oct 2026: Sunday 4 Oct does not count.
  assert.equal(
    workingDaysBetween(ist("2026-10-01T10:30:00"), ist("2026-10-05T10:30:00")),
    3,
  );
});

void test("the client's turnaround is the longest service, in working days", () => {
  assert.equal(tatWorkingDays([72, 14 * 24]), 14);
  assert.equal(tatWorkingDays([36]), 1.5);
  assert.equal(tatWorkingDays([]), null);
});
