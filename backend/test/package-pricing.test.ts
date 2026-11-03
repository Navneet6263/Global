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
  // Checks without a price share what the priced ones leave: (10,000 - 4,500) / 4.
  assert.equal(priceForSelectedChecks(pricing, SIX, ["IDENTITY"]), 1375);
  assert.equal(priceForSelectedChecks(pricing, SIX, SIX), 10_000);
});

void test("fewer checks never cost more than the whole package", () => {
  const pricing = effectivePackagePricing({
    listPrice: 3000,
    checks: ["IDENTITY", "EMPLOYMENT"],
    checkPrices: { IDENTITY: 2000, EMPLOYMENT: 2000 },
  });
  // The checks add up to 4,000 against a 3,000 package, so each is scaled by 3/4.
  assert.equal(
    priceForSelectedChecks(pricing, ["IDENTITY", "EMPLOYMENT"], ["IDENTITY"]),
    1500,
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

const FIVE = ["IDENTITY", "ADDRESS", "EMPLOYMENT", "EDUCATION", "REFERENCE"];
const STANDARD = {
  IDENTITY: 70,
  ADDRESS: 300,
  EMPLOYMENT: 200,
  EDUCATION: 500,
  REFERENCE: 80,
};

void test("removing a check takes its exact price off when the checks add up to the package", () => {
  const pricing = effectivePackagePricing({
    listPrice: 1150,
    checks: FIVE,
    checkPrices: STANDARD,
  });
  const without = FIVE.filter((check) => check !== "EMPLOYMENT");
  assert.equal(priceForSelectedChecks(pricing, FIVE, FIVE), 1150);
  assert.equal(priceForSelectedChecks(pricing, FIVE, without), 950);
});

void test("a package with no price costs the total of its checks, even with a zero rate", () => {
  for (const agreedPrice of [undefined, 0]) {
    const pricing = effectivePackagePricing({
      listPrice: null,
      agreedPrice,
      checks: FIVE,
      checkPrices: STANDARD,
    });
    assert.equal(pricing.full, 1150);
    assert.equal(
      priceForSelectedChecks(
        pricing,
        FIVE,
        FIVE.filter((check) => check !== "EDUCATION"),
      ),
      650,
    );
  }
});

void test("an agreed rate below the check total still falls with every check removed", () => {
  const pricing = effectivePackagePricing({
    listPrice: null,
    agreedPrice: 230,
    checks: FIVE,
    checkPrices: STANDARD,
  });
  assert.equal(priceForSelectedChecks(pricing, FIVE, FIVE), 230);
  // 230 is a fifth of 1,150, so Employment (200) takes off 40.
  assert.equal(
    priceForSelectedChecks(
      pricing,
      FIVE,
      FIVE.filter((check) => check !== "EMPLOYMENT"),
    ),
    190,
  );
});

void test("a zero agreed rate on a priced package stays free", () => {
  const pricing = effectivePackagePricing({
    listPrice: 1000,
    agreedPrice: 0,
    checks: ["IDENTITY"],
    checkPrices: {},
  });
  assert.equal(pricing.full, 0);
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
