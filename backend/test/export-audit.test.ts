import assert from "node:assert/strict";
import { test } from "node:test";
import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { ExportLogDto } from "../src/audit/audit.controller";
import { AuditService } from "../src/audit/audit.service";

void test("a browser export is audited with list, row count and columns", async () => {
  const writes: Array<{
    action: string;
    resourcePublicId: string;
    afterJson: string;
  }> = [];
  const prisma = {
    auditEvent: {
      create: (args: { data: (typeof writes)[number] }) =>
        writes.push(args.data),
    },
  } as unknown as PrismaService;
  const actor = {
    tenantId: 1n,
    userId: 4n,
    roles: ["VERIFIER"],
  } as unknown as Actor;
  await new AuditService(prisma).logExport(actor, {
    source: "team-queue",
    rows: 12,
    columns: ["caseNumber", "check"],
  });
  assert.equal(writes[0]?.action, "export.downloaded");
  assert.equal(writes[0]?.resourcePublicId, "team-queue");
  assert.deepEqual(JSON.parse(writes[0].afterJson), {
    rows: 12,
    columns: ["caseNumber", "check"],
  });
});

void test("only known lists can be logged", () => {
  const bad = plainToInstance(ExportLogDto, {
    source: "anything",
    rows: 1,
    columns: ["a"],
  });
  assert.ok(validateSync(bad).length > 0);
  const good = plainToInstance(ExportLogDto, {
    source: "qa-history",
    rows: "3",
    columns: ["a"],
  });
  assert.equal(validateSync(good).length, 0);
});
