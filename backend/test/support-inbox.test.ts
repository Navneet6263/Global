import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  agent,
  storedRequest,
  supportHarness,
} from "./helpers/support-fixtures";

void test("agents take and resolve requests with version checks; the Client Admin requester is told", async () => {
  const take = supportHarness();
  await take.updater.update(agent, "req-1", {
    status: "IN_PROGRESS",
    version: 1,
  });
  const update = take.calls.update![0]!;
  assert.deepEqual(update.where, { id: 5n, version: 1, status: "OPEN" });
  assert.equal(update.data!.status, "IN_PROGRESS");
  assert.equal(update.data!.assignedToId, 11n);
  assert.equal(take.calls.notifyRequester![0]!.data!.userId, 41n);
  assert.equal(
    take.calls.notifyRequester![0]!.data!.type,
    "SUPPORT_REQUEST_UPDATED",
  );
  assert.equal(
    take.calls.audit![0]!.data!.action,
    "support_request.status_changed",
  );

  const noNote = supportHarness();
  await assert.rejects(
    noNote.updater.update(agent, "req-1", { status: "RESOLVED", version: 1 }),
    BadRequestException,
  );
  const resolve = supportHarness({
    current: storedRequest({ status: "IN_PROGRESS", assignedToId: 99n }),
  });
  await resolve.updater.update(agent, "req-1", {
    status: "RESOLVED",
    version: 1,
    note: "The report was released today.",
  });
  const resolved = resolve.calls.update![0]!.data!;
  assert.equal(resolved.resolutionNote, "The report was released today.");
  assert.ok(resolved.resolvedAt instanceof Date);
  assert.equal(resolved.assignedToId, 99n, "keeps the agent who took it");

  const stale = supportHarness();
  await assert.rejects(
    stale.updater.update(agent, "req-1", { status: "IN_PROGRESS", version: 3 }),
    /refresh/,
  );
  const done = supportHarness({
    current: storedRequest({ status: "RESOLVED" }),
  });
  await assert.rejects(
    done.updater.update(agent, "req-1", { status: "IN_PROGRESS", version: 1 }),
    /already resolved/,
  );
  const candidate = supportHarness({
    current: storedRequest({
      requesterType: "CANDIDATE",
      requesterUserId: null,
    }),
  });
  await candidate.updater.update(agent, "req-1", {
    status: "IN_PROGRESS",
    version: 1,
  });
  assert.equal(candidate.calls.notifyRequester, undefined);
  const missing = supportHarness({ current: null });
  await assert.rejects(
    missing.updater.update(agent, "req-x", {
      status: "IN_PROGRESS",
      version: 1,
    }),
    NotFoundException,
  );
});

void test("the inbox is tenant-scoped and never selects contact details", async () => {
  const { inbox, calls } = supportHarness();
  await inbox.list(agent, {
    page: 1,
    pageSize: 20,
    status: "OPEN",
    requesterType: "CANDIDATE",
    mine: true,
    search: "SR-2026",
  });
  const where = calls.list![0]!.where!;
  assert.equal(where.tenantId, 7n);
  assert.equal(where.status, "OPEN");
  assert.equal(where.assignedToId, 11n);
  assert.doesNotMatch(
    JSON.stringify(calls.list![0]!.select),
    /"(email|phone|piiCiphertext|passwordHash)"/,
  );
});

void test("the support migration adds the table, the role and the Client Admin permission idempotently", () => {
  const sql = readFileSync(
    join(
      __dirname,
      "../prisma/migrations/20260930100000_support_requests/migration.sql",
    ),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE \[dbo\]\.\[SupportRequest\]/);
  assert.match(
    sql,
    /'SUPPORT_AGENT', 'SUPPORT_AGENT', '\["support:read","support:handle","notification:read"\]'/,
  );
  assert.match(
    sql,
    /JSON_MODIFY\(\[permissionsJson\], 'append \$', 'support:request'\)/,
  );
  assert.match(sql, /WHERE \[code\] = 'CLIENT_ADMIN'/);
  assert.match(
    sql,
    /NOT EXISTS \(\s*SELECT 1 FROM OPENJSON\(\[permissionsJson\]\)\s*WHERE \[value\] = 'support:request'/,
  );
});
