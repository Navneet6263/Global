import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function transpile(path) {
  return ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const asUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const xlsx = await import(
  asUrl(await transpile("../src/features/operations/reports/xlsx-writer.ts"))
);
const queueUrl = asUrl(await transpile("../src/features/operations/workspace/ops-queue-model.ts"));
const colourUrl = asUrl(await transpile("../src/features/workflow-ui/colour-codes.ts"));
const model = await import(
  asUrl(
    (await transpile("../src/features/operations/reports/ops-report-model.ts"))
      .replace("../workspace/ops-queue-model", queueUrl)
      .replace("../../workflow-ui/colour-codes", colourUrl),
  )
);

/** Reads a stored (uncompressed) zip produced by the writer and verifies every CRC. */
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.slice(at + 46, at + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true);
    const data = bytes.slice(start, start + size);
    assert.equal(xlsx.crc32(data), crc, name);
    files.set(name, new TextDecoder().decode(data));
    at += 46 + nameLength;
  }
  return files;
}

test("xlsx writer builds a valid workbook with frozen header, filter and escaped text", async () => {
  const bytes = xlsx.buildXlsx([
    {
      name: "Case status: report/1",
      title: "Sapling Global — Case status report",
      subtitle: "All dates",
      columns: [
        { label: "Case ID" },
        { label: "Candidate" },
        { label: "TAT" },
        { label: "Colour" },
      ],
      rows: [
        ["SG-1", '=HYPERLINK("x")', 2.5, { value: "Clear", tone: "good" }],
        ["SG-2", "Rāj & <Co>\u0007", 10, { value: "Discrepancy", tone: "bad" }],
      ],
    },
  ]);
  if (process.env.XLSX_SAMPLE) await writeFile(process.env.XLSX_SAMPLE, bytes);
  const files = unzip(bytes);
  for (const part of [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
  ])
    assert.ok(files.has(part), part);
  assert.match(files.get("xl/workbook.xml"), /name="Case status  report 1"/);
  const sheet = files.get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /<pane ySplit="4" topLeftCell="A5"/);
  assert.match(sheet, /<autoFilter ref="A4:D6"\/>/);
  // Formula-looking text stays inline text, never a <f> formula.
  assert.doesNotMatch(sheet, /<f>/);
  assert.match(sheet, /=HYPERLINK\(&quot;x&quot;\)/);
  assert.match(sheet, /Rāj &amp; &lt;Co&gt;</);
  assert.match(sheet, /<c r="C5" s="0"><v>2.5<\/v><\/c>/);
  assert.match(sheet, /<c r="D5" s="4" t="inlineStr">/);
  assert.match(sheet, /<c r="D6" s="5" t="inlineStr">/);
});

test("sheet names are sanitised, unique and at most 31 characters", () => {
  assert.deepEqual(xlsx.uniqueSheetNames(["A/B", "a b", "x".repeat(40)]), [
    "A B",
    "a b (2)",
    "x".repeat(31),
  ]);
  assert.equal(xlsx.column(0), "A");
  assert.equal(xlsx.column(27), "AB");
});

const item = (overrides = {}) => ({
  id: "c1",
  caseNumber: "SG-1",
  status: "IN_PROGRESS",
  priority: "NORMAL",
  version: 1,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-02T00:00:00Z",
  dueAt: "2026-10-05T00:00:00Z",
  subject: { publicId: "s", fullName: "Kabir Sethi", employeeCode: "E-9" },
  client: { publicId: "cl", code: "H", displayName: "Horizon Tech" },
  assignedOpsUser: { publicId: "rm", displayName: "Riya Mehta" },
  checks: [
    { publicId: "k1", type: "EMPLOYMENT", status: "COMPLETED", result: "CLEAR", tasks: [] },
    { publicId: "k2", type: "EDUCATION", status: "COMPLETED", result: "DISCREPANCY", tasks: [] },
  ],
  ...overrides,
});

test("report rows carry the outcome, TAT and SLA from recorded case data", () => {
  const now = Date.parse("2026-10-06T00:00:00Z");
  const row = model.reportRow(item(), now);
  assert.equal(row.candidate, "Kabir Sethi");
  assert.equal(row.rm, "Riya Mehta");
  assert.deepEqual(row.colour, { value: "Major discrepancy", tone: "bad" });
  assert.deepEqual(row.sla, { value: "Overdue", tone: "bad" });
  assert.equal(row.tatDays, 5);
  assert.equal(row.discrepancy, 1);
  assert.match(row.created, /2026/);
  const done = model.reportRow(
    item({
      status: "COMPLETED",
      completedAt: "2026-10-03T00:00:00Z",
      checks: [{ publicId: "k1", type: "ID", status: "COMPLETED", result: "CLEAR", tasks: [] }],
    }),
    now,
  );
  assert.deepEqual(done.sla, { value: "Met", tone: "good" });
  assert.deepEqual(done.colour, { value: "Clear", tone: "good" });
  assert.equal(done.tatDays, 2);
  assert.equal(done.workingWith, "");
});

test("presets refine rows and queries never carry a tenant scope", () => {
  assert.equal(model.keepForPreset("utv", item()), false);
  assert.equal(model.keepForPreset("discrepancy", item()), true);
  assert.equal(model.keepForPreset("insufficiency", item({ status: "DOCUMENT_PENDING" })), true);
  const query = model.reportQuery(
    "status",
    { ...model.emptyReportFilters, scope: "active", from: "2026-09-01", clientId: "cl" },
    2,
  );
  assert.deepEqual(
    {
      view: query.view,
      from: query.from,
      clientId: query.clientId,
      page: query.page,
      pageSize: query.pageSize,
    },
    { view: "active", from: "2026-09-01", clientId: "cl", page: 2, pageSize: 100 },
  );
  assert.equal("tenantId" in query, false);
  assert.throws(() =>
    model.validateReportFilters({
      ...model.emptyReportFilters,
      from: "2026-10-05",
      to: "2026-10-01",
    }),
  );
});

test("CSV export keeps column order and neutralises formulas", () => {
  const rows = [model.reportRow(item({ subject: { publicId: "s", fullName: "=cmd()" } }))];
  const csv = model.reportCsv(rows, ["candidate", "caseNumber"]);
  assert.ok(csv.startsWith('\uFEFF"Candidate","Case ID"'));
  assert.match(csv, /"'=cmd\(\)","SG-1"/);
  assert.deepEqual(model.moveKey(["a", "b", "c"], 2, -1), ["a", "c", "b"]);
});
