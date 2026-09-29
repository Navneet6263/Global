import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../src/database/prisma.service";
import { SupportDirectoryService } from "../src/support/services/support-directory.service";
import { SupportEmployeeDetailService } from "../src/support/services/support-employee-detail.service";
import {
  caseSupportState,
  supportStateWhere,
} from "../src/support/services/support-rules";
import { SupportDirectoryRepository } from "../src/support/support-directory.repository";
import { SupportRepository } from "../src/support/support.repository";
import { agent, type Args } from "./helpers/support-fixtures";

void test("employee status maps to Pending, Completed, Exception or Cancelled from existing fields", () => {
  const now = new Date("2026-09-29T10:00:00Z");
  const base = {
    status: "IN_PROGRESS",
    dueAt: new Date("2026-10-05T00:00:00Z"),
    blockedTasks: 0,
    documentStatuses: ["VERIFIED", "VERIFIED"],
    openClarifications: 0,
  };
  assert.deepEqual(caseSupportState(base, now), {
    state: "PENDING",
    reasons: [],
  });
  assert.deepEqual(
    caseSupportState(
      { ...base, documentStatuses: ["VERIFIED", "REUPLOAD_REQUIRED"] },
      now,
    ),
    { state: "EXCEPTION", reasons: ["Document re-upload required"] },
  );
  assert.deepEqual(
    caseSupportState(
      {
        ...base,
        dueAt: new Date("2026-09-01T00:00:00Z"),
        blockedTasks: 2,
        openClarifications: 1,
      },
      now,
    ).reasons,
    ["Overdue", "2 blocked tasks", "Awaiting clarification"],
  );
  assert.equal(
    caseSupportState(
      { ...base, status: "COMPLETED", documentStatuses: ["REJECTED"] },
      now,
    ).state,
    "COMPLETED",
  );
  assert.equal(
    caseSupportState({ ...base, status: "CANCELLED" }, now).state,
    "CANCELLED",
  );

  const exception = supportStateWhere("EXCEPTION", now);
  const pending = supportStateWhere("PENDING", now);
  assert.deepEqual(pending.NOT, { OR: exception.OR });
  assert.deepEqual((exception.OR as unknown[])[0], {
    dueAt: { not: null, lt: now },
  });
  assert.deepEqual(supportStateWhere("COMPLETED", now), {
    status: { in: ["COMPLETED", "CLOSED"] },
  });
});

function directoryHarness(detailRow: unknown = null) {
  const seen: Record<string, Args> = {};
  const capture =
    (key: string, result: unknown) =>
    (value: Args): Promise<unknown> => {
      seen[key] = value;
      return Promise.resolve(result);
    };
  const prisma = {
    verificationCase: {
      findMany: capture("list", []),
      findFirst: capture("detail", detailRow),
      findUnique: () => Promise.resolve({ documents: [] }),
      count: () => Promise.resolve(0),
    },
    caseService: { findMany: () => Promise.resolve([]) },
    supportRequest: { findMany: capture("requests", []) },
  } as unknown as PrismaService;
  const repository = new SupportDirectoryRepository(prisma);
  return {
    directory: new SupportDirectoryService(repository),
    detail: new SupportEmployeeDetailService(
      repository,
      new SupportRepository(prisma),
    ),
    seen,
  };
}

void test("support reads are tenant-scoped allow-lists without contact details, PII, files or money", async () => {
  const { directory, detail, seen } = directoryHarness();
  await directory.employees(agent, {
    page: 1,
    pageSize: 20,
    clientId: "11111111-1111-4111-8111-111111111111",
    state: "EXCEPTION",
    search: "Vivo",
  });
  const list = seen.list!;
  const conditions = (list.where as { AND: Array<Record<string, unknown>> })
    .AND;
  assert.deepEqual(conditions[0], { tenantId: 7n });
  assert.deepEqual(conditions[1], {
    client: { publicId: "11111111-1111-4111-8111-111111111111" },
  });
  await assert.rejects(detail.detail(agent, "case-x"), NotFoundException);
  const detailWhere = seen.detail!.where!;
  assert.deepEqual(detailWhere, { tenantId: 7n, publicId: "case-x" });

  const forbidden =
    /"(email|phone|dateOfBirth|piiCiphertext|employeeCode|objectKey|sha256|findings|invoiceLines|lineTotal|notes|checklistJson|passwordHash)"/;
  assert.doesNotMatch(JSON.stringify(list.select), forbidden);
  assert.doesNotMatch(JSON.stringify(seen.detail!.select), forbidden);
});
