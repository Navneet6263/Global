import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/stakeholders/client/client-intake-csv.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { parseClientCsv } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

test("CSV accepts BOM, quoted commas and normalizes Indian phone", () => {
  const rows = parseClientCsv(
    '\uFEFFfullName,email,phone,priority\r\n"Surname, Given",a@example.test,7004023078,HIGH\r\n',
  );
  assert.equal(rows[0].fullName, "Surname, Given");
  assert.equal(rows[0].phone, "+917004023078");
  assert.equal(rows[0].priority, "HIGH");
});
test("CSV rejects foreign scope columns, malformed quotes and invalid mobile", () => {
  assert.throws(
    () => parseClientCsv("fullName,email,clientId\nPerson,a@example.test,other"),
    /unknown/,
  );
  assert.throws(() => parseClientCsv('fullName,email\n"Person,a@example.test'), /unclosed/);
  assert.throws(
    () => parseClientCsv('fullName,email\nPer"son",a@example.test'),
    /unexpected quote/,
  );
  assert.throws(
    () => parseClientCsv('fullName,email\n"Person"invalid,a@example.test'),
    /after a quoted/,
  );
  assert.throws(() => parseClientCsv("fullName,phone\nPerson,5004023078"), /mobile/);
});
test("CSV prevents duplicate candidates and oversized batches", () => {
  assert.throws(
    () => parseClientCsv("fullName,email\nPerson,a@example.test\nPerson,a@example.test"),
    /duplicate/,
  );
  assert.throws(
    () =>
      parseClientCsv(
        "fullName,email\n" +
          Array.from({ length: 51 }, (_, i) => `Person ${i},p${i}@example.test`).join("\n"),
      ),
    /50/,
  );
});
