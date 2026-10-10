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
  // The newest definition: text after the last mention of the constraint, up to "))".
  const at = sql.lastIndexOf(`[${constraint}]`);
  assert.ok(at >= 0, `${constraint} not found`);
  const list = /\[status\] IN \(([^)]*)\)/.exec(sql.slice(at));
  assert.ok(list, `${constraint} has no status list`);
  return list[1]!.split(",").map((value) => value.trim().replaceAll("'", ""));
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
