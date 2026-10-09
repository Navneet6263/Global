import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../src/database/prisma.service";
import { CaseOperationsService } from "../src/cases/case-operations.service";
import { CasesController } from "../src/cases/cases.controller";
import { passesGuard } from "./helpers/guard-check";
import { testActor } from "./helpers/test-actor";

const clientAdmin = testActor(["CLIENT_ADMIN"], ["case:read", "case:create"], {
  clientId: 40n,
});

function harness(escalatedAt: Date | null = null) {
  const calls: Record<string, unknown[]> = {};
  const record = (key: string, result: unknown) => (input: unknown) => {
    (calls[key] ??= []).push(input);
    return Promise.resolve(result);
  };
  const tx = {
    verificationCase: { updateMany: record("update", { count: 1 }) },
    auditEvent: { create: record("audit", {}) },
    notification: { createMany: record("notify", { count: 2 }) },
  };
  const prisma = {
    verificationCase: {
      findFirst: () =>
        Promise.resolve({
          id: 30n,
          clientId: 40n,
          caseNumber: "SG-TEST-3",
          status: "IN_PROGRESS",
          priority: "NORMAL",
          version: 2,
          escalatedAt,
          assignedOpsUser: { id: 77n, publicId: "rm" },
        }),
    },
    user: { findMany: record("recipients", [{ id: 50n }, { id: 77n }]) },
    $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
  } as unknown as PrismaService;
  return { service: new CaseOperationsService(prisma), calls };
}

void test("the company admin escalates its own case: urgent, audited, RM and Operations told", async () => {
  const { service, calls } = harness();
  const result = await service.clientEscalate(clientAdmin, "case-3", {
    version: 2,
    reason: "Candidate joins on Monday; we need the report by Friday.",
  });
  assert.equal(result.priority, "URGENT");
  const update = calls.update![0] as {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  };
  // Only this company's case, and only if not escalated already.
  assert.equal(update.where.clientId, 40n);
  assert.equal(update.where.escalatedAt, null);
  assert.equal(update.data.priority, "URGENT");
  assert.match(String(update.data.escalationNote), /^Client: Candidate joins/);
  const audit = calls.audit![0] as {
    data: { action: string; afterJson: string };
  };
  assert.equal(audit.data.action, "case.escalated");
  assert.equal(JSON.parse(audit.data.afterJson).source, "CLIENT");
  const notices = calls.notify![0] as {
    data: Array<{ userId: bigint; title: string }>;
  };
  assert.deepEqual(
    notices.data.map((row) => row.userId),
    [50n, 77n],
  );
  assert.match(notices.data[0]!.title, /Client escalated/);
});

void test("a case is escalated once, and only by the company admin", async () => {
  await assert.rejects(
    harness(new Date()).service.clientEscalate(clientAdmin, "case-3", {
      version: 2,
      reason: "Please speed this up urgently.",
    }),
    ConflictException,
  );
  await assert.rejects(
    harness().service.clientEscalate(testActor(["VERIFIER"], ["*"]), "case-3", {
      version: 2,
      reason: "Please speed this up urgently.",
    }),
    ForbiddenException,
  );
  assert.ok(passesGuard(CasesController, "clientEscalate", clientAdmin));
  assert.ok(
    !passesGuard(
      CasesController,
      "clientEscalate",
      testActor(["SPOC_RM"], ["*"]),
    ),
  );
});
