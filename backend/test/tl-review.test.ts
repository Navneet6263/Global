import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { physicalFieldIssues } from "../src/field-visits/physical-field-policy";
import type { QaReadinessService } from "../src/verification/qa-readiness.service";
import { TaskWorkflowService } from "../src/verification/task-workflow.service";

const lead = {
  tenantId: 1n,
  userId: 30n,
  roles: ["VERIFIER"],
  departments: [{ id: 4n, role: "LEAD", kind: "VERIFICATION" }],
} as unknown as Actor;
const member = {
  ...lead,
  userId: 21n,
  departments: [{ id: 4n, role: "MEMBER" }],
} as unknown as Actor;

function fixture(check: Record<string, unknown> = {}, promoted = true) {
  const audits: Array<{ action: string; afterJson: string }> = [];
  const notices: Array<{ data: { userId: bigint; body: string } }> = [];
  const checkUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];
  const promotions: unknown[] = [];
  const task = {
    id: 9n,
    publicId: "task-1",
    status: "COMPLETED",
    version: 3,
    assigneeId: 21n,
    check: {
      id: 7n,
      publicId: "check-1",
      caseId: 3n,
      type: "EMPLOYMENT",
      status: "TL_REVIEW",
      result: "CLEAR",
      departmentId: 4n,
      version: 2,
      case: {
        publicId: "case-1",
        caseNumber: "SG-1",
        branchId: null,
        clientId: 5n,
        status: "IN_PROGRESS",
      },
      ...check,
    },
  };
  const tx = {
    caseCheck: {
      updateMany: (args: { data: Record<string, unknown> }) => {
        checkUpdates.push(args.data);
        return { count: 1 };
      },
    },
    checkTask: {
      update: (args: { data: Record<string, unknown> }) =>
        taskUpdates.push(args.data),
    },
    auditEvent: {
      create: (args: { data: { action: string; afterJson: string } }) =>
        audits.push(args.data),
    },
    notification: {
      create: (args: (typeof notices)[number]) => notices.push(args),
    },
    outboxEvent: { create: () => ({}) },
  };
  const prisma = {
    checkTask: { findFirst: () => task },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const qa = {
    promoteIfReady: (_tx: unknown, target: unknown) => {
      promotions.push(target);
      return Promise.resolve(promoted);
    },
  } as unknown as QaReadinessService;
  return {
    service: new TaskWorkflowService(prisma, qa),
    audits,
    notices,
    checkUpdates,
    taskUpdates,
    promotions,
  };
}

void test("the Team Leader forwards a reviewed check: completed, audited, case checked for QA", async () => {
  const { service, audits, notices, checkUpdates, promotions } = fixture();
  const result = await service.forward(lead, "task-1", "Looks right");
  assert.deepEqual(result, {
    id: "task-1",
    status: "COMPLETED",
    caseToQa: true,
  });
  assert.equal(checkUpdates[0]!.status, "COMPLETED");
  assert.ok(checkUpdates[0]!.completedAt instanceof Date);
  assert.equal(audits[0]!.action, "check.forwarded-by-lead");
  assert.equal(promotions.length, 1);
  // The verifier hears that its work went on.
  assert.equal(notices[0]!.data.userId, 21n);
});

void test("sending back reopens the verifier's task with the reason", async () => {
  const { service, audits, notices, checkUpdates, taskUpdates, promotions } =
    fixture();
  await assert.rejects(service.sendBack(lead, "task-1", "fix"), /at least 10/);
  await service.sendBack(lead, "task-1", "Add the HR email as the source");
  assert.equal(checkUpdates[0]!.status, "IN_PROGRESS");
  assert.equal(taskUpdates[0]!.status, "IN_PROGRESS");
  assert.match(String(taskUpdates[0]!.instructions), /HR email/);
  assert.equal(audits[0]!.action, "check.sent-back-by-lead");
  assert.equal(notices[0]!.data.body, "Add the HR email as the source");
  assert.equal(promotions.length, 0);
});

void test("only that team's Team Leader reviews, and only a check waiting for review", async () => {
  await assert.rejects(
    fixture().service.forward(member, "task-1"),
    ForbiddenException,
  );
  const otherLead = {
    ...lead,
    departments: [{ id: 8n, role: "LEAD", kind: "VERIFICATION" }],
  } as unknown as Actor;
  await assert.rejects(
    fixture().service.forward(otherLead, "task-1"),
    ForbiddenException,
  );
  await assert.rejects(
    fixture({ status: "COMPLETED" }).service.forward(lead, "task-1"),
    ConflictException,
  );
  const ops = { tenantId: 1n, userId: 2n, roles: ["OPS_MANAGER"] } as Actor;
  assert.equal(
    (await fixture({}, false).service.forward(ops, "task-1")).caseToQa,
    false,
  );
});

void test("while field work is off an Address check does not wait for a physical visit", () => {
  const saved = process.env.FIELD_WORK_ENABLED;
  try {
    delete process.env.FIELD_WORK_ENABLED;
    assert.deepEqual(physicalFieldIssues([{ type: "ADDRESS" }], []), []);
    // A visit that was started still has to finish.
    assert.equal(
      physicalFieldIssues([{ type: "ADDRESS" }], [{ status: "ASSIGNED" }])
        .length,
      1,
    );
    process.env.FIELD_WORK_ENABLED = "true";
    assert.match(
      physicalFieldIssues([{ type: "ADDRESS" }], [])[0]!,
      /Physical address verification required/,
    );
  } finally {
    if (saved === undefined) delete process.env.FIELD_WORK_ENABLED;
    else process.env.FIELD_WORK_ENABLED = saved;
  }
});
