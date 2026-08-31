import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Actor } from "../src/common/auth/actor";
import { PrismaService } from "../src/database/prisma.service";
import { BulkTaskAssignmentService } from "../src/verification/bulk-task-assignment.service";
import { BulkAssignTasksDto } from "../src/verification/dto/bulk-assign-tasks.dto";

const ids = {
  verifier: "00000000-0000-4000-8000-000000000020",
  oldVerifier: "00000000-0000-4000-8000-000000000021",
  checkOne: "00000000-0000-4000-8000-000000000031",
  checkTwo: "00000000-0000-4000-8000-000000000032",
  taskOne: "00000000-0000-4000-8000-000000000041",
  taskTwo: "00000000-0000-4000-8000-000000000042",
};

const actor: Actor = {
  userId: 10n,
  userPublicId: "00000000-0000-4000-8000-000000000010",
  tenantId: 1n,
  tenantPublicId: "00000000-0000-4000-8000-000000000001",
  tenantName: "Sapling Global",
  branchId: 5n,
  email: "operations@greencall.com",
  displayName: "Operations Manager",
  mustChangePassword: false,
  roles: ["OPS_MANAGER"],
  permissions: ["task:write"],
};

function check(
  publicId: string,
  task?: {
    publicId: string;
    version: number;
    assigneeId?: bigint;
  },
  branchId: bigint | null = 5n,
) {
  return {
    id: publicId === ids.checkOne ? 31n : 32n,
    publicId,
    status: "PENDING",
    case: {
      publicId: "00000000-0000-4000-8000-000000000050",
      caseNumber: publicId === ids.checkOne ? "SG-101" : "SG-102",
      branchId,
      clientId: 8n,
      status: "IN_PROGRESS",
    },
    tasks: task
      ? [
          {
            id: publicId === ids.checkOne ? 41n : 42n,
            publicId: task.publicId,
            status: "UNASSIGNED",
            version: task.version,
            assigneeId: task.assigneeId ?? null,
            assignee: task.assigneeId
              ? { publicId: ids.oldVerifier, displayName: "Old Verifier" }
              : null,
          },
        ]
      : [],
  };
}

function harness(checks: ReturnType<typeof check>[]) {
  const writes: Array<{ kind: string; input: unknown }> = [];
  let isolationLevel: unknown;
  const tx = {
    user: {
      findFirst: () =>
        Promise.resolve({
          id: 20n,
          publicId: ids.verifier,
          displayName: "New Verifier",
          branchId: 5n,
        }),
    },
    caseCheck: {
      findMany: () => Promise.resolve(checks),
      update: (input: unknown) => {
        writes.push({ kind: "check", input });
        return Promise.resolve(input);
      },
    },
    checkTask: {
      updateMany: (input: unknown) => {
        writes.push({ kind: "task-update", input });
        return Promise.resolve({ count: 1 });
      },
      create: (input: unknown) => {
        writes.push({ kind: "task-create", input });
        return Promise.resolve({ publicId: ids.taskTwo, version: 1 });
      },
    },
    auditEvent: {
      create: (input: unknown) => {
        writes.push({ kind: "audit", input });
        return Promise.resolve(input);
      },
    },
    notification: {
      create: (input: unknown) => {
        writes.push({ kind: "notification", input });
        return Promise.resolve(input);
      },
    },
  };
  const prisma = {
    $transaction: (
      work: (client: typeof tx) => Promise<unknown>,
      options: { isolationLevel: string },
    ) => {
      isolationLevel = options.isolationLevel;
      return work(tx);
    },
  };
  return {
    service: new BulkTaskAssignmentService(prisma as unknown as PrismaService),
    writes,
    isolation: () => isolationLevel,
  };
}

void test("bulk assignment commits every selected check in one serializable transaction", async () => {
  const setup = harness([
    check(ids.checkOne, { publicId: ids.taskOne, version: 3 }),
    check(ids.checkTwo),
  ]);
  const result = await setup.service.assign(actor, {
    assigneeId: ids.verifier,
    mode: "ASSIGN",
    items: [
      { checkId: ids.checkOne, taskId: ids.taskOne, version: 3 },
      { checkId: ids.checkTwo },
    ],
    instructions: "Verify against the primary source",
  });

  assert.equal(setup.isolation(), "Serializable");
  assert.equal(result.assigned, 2);
  assert.equal(result.memberName, "New Verifier");
  assert.equal(
    setup.writes.filter((entry) => entry.kind === "audit").length,
    2,
  );
  assert.deepEqual(
    setup.writes
      .filter((entry) => entry.kind.startsWith("task-"))
      .map((entry) => entry.kind),
    ["task-update", "task-create"],
  );
});

void test("a stale item aborts validation before any selected check is written", async () => {
  const setup = harness([
    check(ids.checkOne, { publicId: ids.taskOne, version: 3 }),
    check(ids.checkTwo, { publicId: ids.taskTwo, version: 4 }),
  ]);

  await assert.rejects(
    setup.service.assign(actor, {
      assigneeId: ids.verifier,
      mode: "ASSIGN",
      items: [
        { checkId: ids.checkOne, taskId: ids.taskOne, version: 3 },
        { checkId: ids.checkTwo, taskId: ids.taskTwo, version: 2 },
      ],
    }),
    (error: unknown) =>
      error instanceof ConflictException &&
      /queue changed/i.test(error.message),
  );
  assert.equal(setup.writes.length, 0);
});

void test("bulk reassignment audits the owner change and notifies both verifiers", async () => {
  const setup = harness([
    check(ids.checkOne, {
      publicId: ids.taskOne,
      version: 3,
      assigneeId: 21n,
    }),
  ]);
  const result = await setup.service.assign(actor, {
    assigneeId: ids.verifier,
    mode: "REASSIGN",
    items: [{ checkId: ids.checkOne, taskId: ids.taskOne, version: 3 }],
  });

  const audit = setup.writes.find((entry) => entry.kind === "audit")?.input as {
    data: { action: string };
  };
  assert.equal(result.assigned, 1);
  assert.equal(audit.data.action, "task.reassigned");
  assert.equal(
    setup.writes.filter((entry) => entry.kind === "notification").length,
    2,
  );
});

void test("branch scope mismatch aborts the complete bulk assignment", async () => {
  const setup = harness([check(ids.checkOne, undefined, 99n)]);
  await assert.rejects(
    setup.service.assign(actor, {
      assigneeId: ids.verifier,
      mode: "ASSIGN",
      items: [{ checkId: ids.checkOne }],
    }),
    (error: unknown) =>
      error instanceof ConflictException && /branch/i.test(error.message),
  );
  assert.equal(setup.writes.length, 0);
});

void test("a verifier cannot call bulk operations assignment", async () => {
  const setup = harness([]);
  await assert.rejects(
    setup.service.assign(
      { ...actor, roles: ["VERIFIER"] },
      {
        assigneeId: ids.verifier,
        mode: "ASSIGN",
        items: [{ checkId: ids.checkOne }],
      },
    ),
    ForbiddenException,
  );
});

void test("bulk assignment DTO rejects duplicate checks and malformed task versions", async () => {
  const duplicate = plainToInstance(BulkAssignTasksDto, {
    assigneeId: ids.verifier,
    mode: "ASSIGN",
    items: [{ checkId: ids.checkOne }, { checkId: ids.checkOne }],
  });
  const malformed = plainToInstance(BulkAssignTasksDto, {
    assigneeId: ids.verifier,
    mode: "ASSIGN",
    items: [{ checkId: "not-a-uuid" }],
  });
  assert.notEqual((await validate(duplicate)).length, 0);
  assert.notEqual((await validate(malformed)).length, 0);
});
