import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaService } from "../src/database/prisma.service";
import type { Prisma } from "../src/generated/prisma/client";
import { VendorActivityService } from "../src/vendor-requests/services/vendor-activity.service";
import { VendorActivityController } from "../src/vendor-requests/vendor-activity.controller";
import { passesGuard } from "./helpers/guard-check";
import { testActor } from "./helpers/test-actor";
import { REQ } from "./helpers/vendor-fixtures";
import { mainVendor, teamUser } from "./helpers/vendor-team-fixtures";

const row = {
  id: "11111111-aaaa-4aaa-8aaa-111111111111",
  action: "vendor_assignment.report-downloaded",
  resourceType: "vendor_assignment",
  createdAt: new Date(0),
  actorName: "Sam SPOC",
  byVendorTeam: 0,
  requestId: REQ,
  caseNumber: "SG-1",
  documentType: "EDUCATION_CERTIFICATE",
  teamUserName: null,
  afterJson: '{"secret":"never"}',
};

function logs(rows: unknown[] = [row]) {
  const queries: Prisma.Sql[] = [];
  const prisma = {
    $queryRaw: (query: Prisma.Sql) => {
      queries.push(query);
      return Promise.resolve(rows);
    },
  } as unknown as PrismaService;
  return { service: new VendorActivityService(prisma), queries };
}

const text = (query: Prisma.Sql) => query.sql.replace(/\s+/g, " ");
/** Only the WHERE scope (the SELECT also looks up team-user names for context). */
const scopeOf = (query: Prisma.Sql) =>
  text(query).split("WHERE a.[tenantId]")[1] ?? "";

void test("the Main Vendor sees its whole account: requests, previews and its team", async () => {
  const { service, queries } = logs();
  await service.list(mainVendor, { limit: 20 });
  const sql = scopeOf(queries[0]!);
  assert.match(sql, /va\.\[vendorUserId\] = \?/);
  assert.doesNotMatch(sql, /va\.\[handlerUserId\] = \?/);
  assert.match(sql, /a\.\[resourceType\] = 'user'/);
  assert.match(sql, /a\.\[action\] <> 'vendor_assignment\.report-previewed'/);
  assert.ok(queries[0]!.values.includes(31n));
  assert.doesNotMatch(
    text(queries[0]!),
    /afterJson|ipAddress|objectKey|locationLabel/,
  );
});

void test("a team user sees only requests delegated to it and never team management", async () => {
  const { service, queries } = logs();
  await service.list(teamUser, { limit: 20 });
  const sql = scopeOf(queries[0]!);
  assert.match(sql, /va\.\[vendorUserId\] = \? AND va\.\[handlerUserId\] = \?/);
  assert.doesNotMatch(sql, /a\.\[resourceType\] = 'user'/);
  assert.ok(queries[0]!.values.includes(41n));
  assert.ok(queries[0]!.values.includes(31n));
});

void test("rows are an allowlist; a SPOC-RM download is marked as not by the vendor team", async () => {
  const { service } = logs();
  const page = await service.list(mainVendor, { limit: 20 });
  assert.deepEqual(Object.keys(page.items[0]!).sort(), [
    "action",
    "actorName",
    "byVendorTeam",
    "createdAt",
    "id",
    "request",
    "teamUser",
  ]);
  assert.equal(page.items[0]!.byVendorTeam, false);
  assert.deepEqual(page.items[0]!.request, {
    id: REQ,
    caseNumber: "SG-1",
    documentType: "EDUCATION_CERTIFICATE",
  });
  assert.equal(page.nextCursor, null);
});

void test("one request's log, cursor paging and the page size limit", async () => {
  const { service, queries } = logs([
    row,
    { ...row, id: "22222222-aaaa-4aaa-8aaa-222222222222" },
  ]);
  const page = await service.list(mainVendor, { limit: 1, requestId: REQ });
  assert.equal(page.items.length, 1);
  assert.equal(page.nextCursor, row.id);
  assert.ok(queries[0]!.values.includes(REQ));
  assert.doesNotMatch(scopeOf(queries[0]!), /a\.\[resourceType\] = 'user'/);
  const anchor = logs([
    { id: row.id, cursorTime: "2026-10-01T10:00:00.0000000" },
  ]);
  await anchor.service.list(mainVendor, { limit: 20, cursor: row.id });
  assert.equal(anchor.queries.length, 2, "anchor lookup, then the page");
});

void test("Vendor Logs are for vendor logins only", () => {
  assert.ok(passesGuard(VendorActivityController, "list", mainVendor));
  assert.ok(passesGuard(VendorActivityController, "list", teamUser));
  for (const role of [
    "SPOC_RM",
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "SUPPORT_AGENT",
  ])
    assert.ok(
      !passesGuard(VendorActivityController, "list", testActor([role], ["*"])),
      role,
    );
});
