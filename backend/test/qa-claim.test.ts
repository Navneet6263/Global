import assert from "node:assert/strict";
import { test } from "node:test";
import { assertLiveClaim, claimCutoff } from "../src/qa/qa-claim";

void test("QA decisions require an unexpired claim, including the exact expiry boundary", () => {
  const now = new Date("2026-09-05T10:00:00Z");
  assert.throws(() => assertLiveClaim(null, now), /reservation expired/);
  assert.throws(
    () => assertLiveClaim(claimCutoff(now), now),
    /reservation expired/,
  );
  assert.doesNotThrow(() =>
    assertLiveClaim(new Date("2026-09-05T09:31:00Z"), now),
  );
});
