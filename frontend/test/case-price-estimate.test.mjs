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
