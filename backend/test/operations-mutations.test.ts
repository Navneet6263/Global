import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import { CaseOperationsService } from "../src/cases/case-operations.service";
import { PrismaService } from "../src/database/prisma.service";
import { TaskAssignmentService } from "../src/verification/task-assignment.service";

const actor: Actor = {
  userId: 10n,
  userPublicId: "00000000-0000-4000-8000-000000000010",
  tenantId: 1n,
  tenantPublicId: "00000000-0000-4000-8000-000000000001",
  tenantName: "Sapling Global",
  email: "operations@greencall.com",
  displayName: "Operations Manager",
  mustChangePassword: false,
  roles: ["OPS_MANAGER"],
  permissions: ["task:write", "case:transition"],
};

void test("task reassignment updates the active task with audit and notifications", async () => {
  const writes: Array<{ kind: string; data: unknown }> = [];
  const tx = {
    checkTask: {
      updateMany: (input: unknown) => {
        writes.push({ kind: "task", data: input });
        return Promise.resolve({ count: 1 });
      },
    },
    caseCheck: { update: (input: unknown) => Promise.resolve(input) },
    auditEvent: {
      create: (input: unknown) => {
        writes.push({ kind: "audit", data: input });
        return Promise.resolve(input);
      },
    },
    notification: { create: (input: unknown) => Promise.resolve(input) },
  };
  const prisma = {
    checkTask: {
      findFirst: () =>
        Promise.resolve({
          id: 7n,
          status: "BLOCKED",
          version: 3,
          assignee: {
            id: 20n,
            publicId: "00000000-0000-4000-8000-000000000020",
            displayName: "Old Verifier",
          },
          check: {
            id: 8n,
            publicId: "00000000-0000-4000-8000-000000000008",
            case: {
              publicId: "00000000-0000-4000-8000-000000000009",
              caseNumber: "SG-TEST-1",
              status: "IN_PROGRESS",
            },
          },
        }),
    },
    user: {
      findFirst: () =>
        Promise.resolve({
          id: 21n,
          publicId: "00000000-0000-4000-8000-000000000021",
          displayName: "New Verifier",
        }),
    },
    $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
  };
  const service = new TaskAssignmentService(prisma as unknown as PrismaService);
  const result = await service.reassign(
    actor,
    "00000000-0000-4000-8000-000000000007",
    {
      assigneeId: "00000000-0000-4000-8000-000000000021",
      version: 3,
      instructions: "Continue from the verified source record",
    },
  );

  assert.equal(result.version, 4);
  assert.equal(result.assignee.displayName, "New Verifier");
  assert.equal(writes.filter((entry) => entry.kind === "task").length, 1);
  const audit = writes.find((entry) => entry.kind === "audit")?.data as {
    data?: { action?: string };
  };
  assert.equal(audit.data?.action, "task.reassigned");
  assert.equal(
    writes.some((entry) => entry.kind === "outbox"),
    false,
  );
});

void test("in-progress work cannot be silently moved to another verifier", async () => {
  const prisma = {
    checkTask: {
      findFirst: () =>
        Promise.resolve({
          id: 7n,
          status: "IN_PROGRESS",
          version: 2,
          assignee: null,
          check: {},
        }),
    },
  };
  const service = new TaskAssignmentService(prisma as unknown as PrismaService);
  await assert.rejects(
    service.reassign(actor, "00000000-0000-4000-8000-000000000007", {
      assigneeId: "00000000-0000-4000-8000-000000000021",
      version: 2,
    }),
    (error: unknown) =>
      error instanceof ConflictException &&
      /must be blocked/.test(error.message),
  );
});

void test("a verifier cannot use the operations reassignment endpoint", async () => {
  const service = new TaskAssignmentService({} as PrismaService);
  await assert.rejects(
    service.reassign(
      { ...actor, roles: ["VERIFIER"] },
      "00000000-0000-4000-8000-000000000007",
      { assigneeId: "00000000-0000-4000-8000-000000000021", version: 1 },
    ),
    ForbiddenException,
  );
});

void test("case escalation persists urgency, audit and client notification", async () => {
  const writes: string[] = [];
  const tx = {
    verificationCase: { updateMany: () => Promise.resolve({ count: 1 }) },
    auditEvent: {
      create: () => {
        writes.push("audit");
        return Promise.resolve({});
      },
    },
    notification: {
      createMany: () => {
        writes.push("notification");
        return Promise.resolve({ count: 1 });
      },
    },
  };
  const prisma = {
    verificationCase: {
      findFirst: () =>
        Promise.resolve({
          id: 30n,
          clientId: 40n,
          caseNumber: "SG-TEST-2",
          status: "IN_PROGRESS",
          priority: "NORMAL",
          version: 5,
          assignedOpsUser: null,
        }),
    },
    user: { findMany: () => Promise.resolve([{ id: 50n }]) },
    $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
  };
  const service = new CaseOperationsService(prisma as unknown as PrismaService);
  const result = await service.escalate(
    actor,
    "00000000-0000-4000-8000-000000000030",
    {
      version: 5,
      note: "Client decision is required today",
    },
  );

  assert.deepEqual(result, {
    id: "00000000-0000-4000-8000-000000000030",
    priority: "URGENT",
    version: 6,
    escalated: true,
  });
  assert.deepEqual(writes, ["audit", "notification"]);
});
