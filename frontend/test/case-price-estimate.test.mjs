import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = await readFile(
  new URL("../src/features/cases/new-case/case-price-estimate.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { casePriceEstimate } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
test("selected-check subsets preserve package price and total includes configured tax", () => {
  const result = casePriceEstimate(
    {
      services: [
        { servicePackageId: "a", selectedChecks: ["IDENTITY"] },
        { servicePackageId: "b" },
      ],
    },
    [
      { id: "a", price: "2500", taxRate: "18" },
      { id: "b", price: "1000", taxRate: "0" },
    ],
  );
  assert.equal(result.subtotal, 3500);
  assert.equal(result.tax, 450);
  assert.equal(result.total, 3950);
});
test("missing price or tax is not presented as a free verification", () => {
  for (const pkg of [
    { id: "a", price: null, taxRate: 18 },
    { id: "a", price: 200 },
    { id: "a", price: -1, taxRate: 18 },
  ])
    assert.equal(casePriceEstimate({ servicePackageId: "a" }, [pkg]).total, null);
  assert.equal(
    casePriceEstimate({ servicePackageId: "a" }, [{ id: "a", price: 0, taxRate: 0 }]).total,
    0,
  );
});
test("fewer checks cost the sum of their own prices, never more than the package", () => {
  const pkg = {
    id: "p",
    price: 10000,
    taxRate: 18,
    checks: ["IDENTITY", "EMPLOYMENT", "EDUCATION", "ADDRESS", "CRIMINAL", "REFERENCE"],
    checkPrices: {
      IDENTITY: 1000,
      EMPLOYMENT: 2500,
      EDUCATION: 2000,
      ADDRESS: 1500,
      CRIMINAL: 2000,
      REFERENCE: 1000,
    },
  };
  const one = casePriceEstimate(
    { services: [{ servicePackageId: "p", selectedChecks: ["EMPLOYMENT"] }] },
    [pkg],
  );
  assert.equal(one.subtotal, 2500);
  assert.equal(one.tax, 450);
  assert.equal(one.total, 2950);
  assert.equal(one.lines[0].selectedCount, 1);
  const all = casePriceEstimate(
    { services: [{ servicePackageId: "p", selectedChecks: pkg.checks }] },
    [pkg],
  );
  assert.equal(all.subtotal, 10000);
  assert.equal(all.total, 11800);
  const five = casePriceEstimate(
    { services: [{ servicePackageId: "p", selectedChecks: pkg.checks.slice(0, 5) }] },
    [{ ...pkg, checkPrices: { ...pkg.checkPrices, IDENTITY: 4000 } }],
  );
  assert.equal(five.subtotal, 10000);
});
