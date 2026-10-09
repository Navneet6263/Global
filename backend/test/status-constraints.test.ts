import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { VENDOR_CHECK_STATUSES } from "../src/vendor-checks/vendor-check-rules";

const dir = join(__dirname, "..", "prisma", "migrations");

/** The values the newest migration allows for a CHECK constraint. */
function allowed(constraint: string) {
  const sql = readdirSync(dir)
    .filter((name) => /^\d{14}_/.test(name))
    .sort()
    .map((name) => readFileSync(join(dir, name, "migration.sql"), "utf8"))
    .join("\n");
  const pattern = new RegExp(
    `\[${constraint}\][\s\S]*?CHECK \(\[status\] IN \(([^)]*)\)\)`,
    "g",
  );
  const last = [...sql.matchAll(pattern)].at(-1);
  assert.ok(last, `${constraint} not found`);
  return last[1]!.split(",").map((value) => value.trim().replaceAll("'", ""));
}

void test("the database accepts every check status the workflow writes", () => {
  const values = allowed("CaseCheck_status_ck");
  for (const status of [
    "PENDING",
    "ASSIGNED",
    "IN_PROGRESS",
    "BLOCKED",
    "TL_REVIEW",
    "COMPLETED",
  ])
    assert.ok(
      values.includes(status),
      `CaseCheck status ${status} is not allowed by the database`,
    );
});

void test("the database accepts every vendor job status", () => {
  const values = allowed("VendorCheckAssignment_status_ck");
  for (const status of VENDOR_CHECK_STATUSES)
    assert.ok(
      values.includes(status),
      `Vendor status ${status} is not allowed by the database`,
    );
});
