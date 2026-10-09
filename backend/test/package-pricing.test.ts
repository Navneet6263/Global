import assert from "node:assert/strict";
import { test } from "node:test";
import {
  effectivePackagePricing,
  parseCheckPrices,
  priceForSelectedChecks,
} from "../src/packages/package-pricing";

const SIX = [
  "IDENTITY",
  "EMPLOYMENT",
  "EDUCATION",
  "ADDRESS",
  "CRIMINAL",
  "REFERENCE",
];

void test("a 10,000 package of 6 checks: one check costs its own price, all six cost 10,000", () => {
  const pricing = effectivePackagePricing({
    listPrice: 10_000,
    checks: SIX,
    checkPrices: { EMPLOYMENT: 2500, EDUCATION: 2000 },
  });
  assert.equal(priceForSelectedChecks(pricing, SIX, ["EMPLOYMENT"]), 2500);
  assert.equal(
    priceForSelectedChecks(pricing, SIX, ["EMPLOYMENT", "EDUCATION"]),
    4500,
  );
  // A check without its own price shares the list price equally (10,000 / 6).
  assert.equal(priceForSelectedChecks(pricing, SIX, ["IDENTITY"]), 1666.67);
  assert.equal(priceForSelectedChecks(pricing, SIX, SIX), 10_000);
});

void test("fewer checks never cost more than the whole package", () => {
  const pricing = effectivePackagePricing({
    listPrice: 3000,
    checks: ["IDENTITY", "EMPLOYMENT"],
    checkPrices: { IDENTITY: 2000, EMPLOYMENT: 2000 },
  });
  assert.equal(
    priceForSelectedChecks(pricing, ["IDENTITY", "EMPLOYMENT"], ["IDENTITY"]),
    2000,
  );
  assert.equal(
    priceForSelectedChecks(
      pricing,
      ["IDENTITY", "EMPLOYMENT", "ADDRESS"],
      ["IDENTITY", "EMPLOYMENT"],
    ),
    3000,
  );
});

void test("the agreed rate and the RM discount apply to each check as well", () => {
  const pricing = effectivePackagePricing({
    listPrice: 10_000,
    agreedPrice: 9000,
    checks: SIX,
    checkPrices: { EMPLOYMENT: 2500 },
    discountPercent: 10,
  });
  assert.equal(pricing.full, 8100);
  // 2500 x 0.9 (agreed) x 0.9 (discount)
  assert.equal(priceForSelectedChecks(pricing, SIX, ["EMPLOYMENT"]), 2025);
});

void test("check prices are read safely", () => {
  assert.deepEqual(parseCheckPrices('{"EMPLOYMENT":2500,"BAD":-1,"X":"7"}'), {
    EMPLOYMENT: 2500,
  });
  assert.deepEqual(parseCheckPrices("not json"), {});
  assert.deepEqual(parseCheckPrices(null), {});
});
