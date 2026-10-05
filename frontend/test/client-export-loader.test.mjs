import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const options = {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
};
async function compile(name) {
  return ts.transpileModule(
    await readFile(new URL("../src/features/stakeholders/client/" + name, import.meta.url), "utf8"),
    options,
  ).outputText;
}
const model = {};
new Function("exports", await compile("client-export-model.ts"))(model);
const compiled = await compile("client-export-loader.ts");
function loader(apis) {
  const module = {};
  new Function("require", "exports", compiled)((name) => {
    if (name.includes("client-export-model")) return model;
    if (name.includes("case-services")) return { casePackageName: () => "Standard BGV" };
    return apis;
  }, module);
  return module.loadClientExport;
}
const filters = { search: "", status: "", from: "", to: "" };
const invoice = (id) => ({
  id,
  invoiceNumber: id,
  status: "PAID",
  currency: "INR",
  totalAmount: 100,
  paidAmount: 100,
  creditedAmount: 0,
  balance: 0,
  issuedAt: "2026-10-01T05:00:00Z",
  dueAt: null,
});
const candidate = (id) => ({
  id,
  caseNumber: id,
  subject: { fullName: id },
  status: "COMPLETED",
  priority: "NORMAL",
  checks: [],
  createdAt: "2026-10-01T05:00:00Z",
  updatedAt: "2026-10-01T05:00:00Z",
});
test("case export reads all pages and never submits a client/tenant selector", async () => {
  const calls = [];
  const load = loader({
    listCases: async (query) => {
      calls.push(query);
      return {
        items:
          query.page === 1
            ? Array.from({ length: 100 }, (_, i) => candidate(String(i)))
            : [candidate("100")],
        total: 101,
      };
    },
  });
  const result = await load(
    "cases",
    { ...filters, from: "2026-10-01", to: "2026-10-02" },
    new AbortController().signal,
    () => {},
  );
  assert.equal(result.length, 101);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].from, "2026-10-01T00:00:00+05:30");
  assert.equal(calls[0].to, "2026-10-02T23:59:59.999+05:30");
  assert.ok(!("clientId" in calls[0]));
  assert.ok(!("tenantId" in calls[0]));
});
test("invoice export follows every cursor and applies issue-date filters", async () => {
  const calls = [];
  const load = loader({
    listClientInvoices: async (query) => {
      calls.push(query);
      return query.cursor
        ? { items: [invoice("two")], nextCursor: null }
        : { items: [{ ...invoice("one"), issuedAt: "2026-09-01T00:00:00Z" }], nextCursor: "next" };
    },
  });
  const result = await load(
    "invoices",
    { ...filters, from: "2026-10-01" },
    new AbortController().signal,
    () => {},
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].cursor, "next");
  assert.equal(result.length, 1);
  assert.equal(result[0].invoiceNumber, "two");
});
test("a failed later page, repeated cursor and changing case count reject the entire result", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(
    loader({
      listClientInvoices: async (query) => {
        if (query.cursor) throw new Error("Network lost");
        return { items: [invoice("one")], nextCursor: "next" };
      },
    })("invoices", filters, signal, () => {}),
    /Network lost/,
  );
  await assert.rejects(
    loader({
      listClientInvoices: async () => ({
        items: [invoice("one")],
        nextCursor: "next",
      }),
    })("invoices", filters, signal, () => {}),
    /moved|Incomplete/,
  );
  await assert.rejects(
    loader({
      listCases: async (query) => ({
        items: [candidate(String(query.page))],
        total: query.page === 1 ? 2 : 3,
      }),
    })("cases", filters, signal, () => {}),
    /Records changed/,
  );
});
test("oversized and cancelled exports never return a partial result", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(
    loader({ listCases: async () => ({ items: [], total: 10001 }) })(
      "cases",
      filters,
      signal,
      () => {},
    ),
    /10,000/,
  );
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await assert.rejects(
    loader({
      listCases: async () => {
        called = true;
      },
    })("cases", filters, controller.signal, () => {}),
  );
  assert.equal(called, false);
});
