import assert from "node:assert/strict";
import { test } from "node:test";
import { haversineMeters } from "../src/field-visits/geo";

void test("haversine distance is stable for field geofencing", () => {
  assert.equal(haversineMeters(19.076, 72.8777, 19.076, 72.8777), 0);
  const distance = haversineMeters(19.076, 72.8777, 19.077, 72.8777);
  assert.ok(distance > 110 && distance < 112);
});
