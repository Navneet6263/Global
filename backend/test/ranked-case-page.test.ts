import assert from "node:assert/strict";
import { test } from "node:test";
import { pageSlices } from "../src/cases/ranked-case-page";

void test("ranked pages cross category boundaries without fetching prior pages", () => {
  assert.deepEqual(pageSlices([7, 9, 1000], 10, 10), [
    { group: 1, skip: 3, take: 6 },
    { group: 2, skip: 0, take: 4 },
  ]);
  assert.deepEqual(pageSlices([0, 0, 3], 0, 10), [
    { group: 2, skip: 0, take: 3 },
  ]);
  assert.deepEqual(pageSlices([2, 3], 8, 10), []);
});
