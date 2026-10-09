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
    verificationCase: {
      updateMany: (input: unknown) => {
        writes.push({ kind: "case-lock", data: input });
        return Promise.resolve({ count: 1 });
      },
    },
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
              id: 9n,
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
  assert.equal(writes[0]?.kind, "case-lock");
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

  const { escalatedAt, ...rest } = result;
  assert.ok(escalatedAt instanceof Date);
  assert.deepEqual(rest, {
    id: "00000000-0000-4000-8000-000000000030",
    priority: "URGENT",
    version: 6,
    escalated: true,
  });
  assert.deepEqual(writes, ["audit", "notification"]);
});

void test("Platform Admin escalation is internal: URGENT, recorded, Operations and owner told", async () => {
  let update: { data: Record<string, unknown> } | undefined;
  let recipients: { where: Record<string, unknown> } | undefined;
  let notices: { data: Array<{ href: string; title: string }> } | undefined;
  const tx = {
    verificationCase: {
      updateMany: (input: { data: Record<string, unknown> }) => {
        update = input;
        return Promise.resolve({ count: 1 });
      },
    },
    auditEvent: { create: () => Promise.resolve({}) },
    notification: {
      createMany: (input: { data: Array<{ href: string; title: string }> }) => {
        notices = input;
        return Promise.resolve({ count: 2 });
      },
    },
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
          assignedOpsUser: { id: 77n, publicId: "owner" },
        }),
    },
    user: {
      findMany: (input: { where: Record<string, unknown> }) => {
        recipients = input;
        return Promise.resolve([{ id: 50n }, { id: 77n }]);
      },
    },
    $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
  };
  await new CaseOperationsService(prisma as unknown as PrismaService).escalate(
    { ...actor, userId: 1n, roles: ["PLATFORM_ADMIN"] },
    "00000000-0000-4000-8000-000000000030",
    { version: 2, note: "Client CEO asked for this today" },
  );
  assert.equal(update?.data.priority, "URGENT");
  assert.equal(update?.data.escalatedById, 1n);
  assert.equal(update?.data.escalationNote, "Client CEO asked for this today");
  // Internal: no client-admin filter; Operations Managers plus the case owner.
  assert.equal(recipients?.where.clientId, undefined);
  assert.equal(notices?.data.length, 2);
  assert.equal(
    notices?.data[0]?.href,
    "/cases/00000000-0000-4000-8000-000000000030",
  );
  assert.match(notices?.data[0]?.title ?? "", /high priority/);
});

void test("operations can assign a client-mapped RM as case owner with audit", async () => {
  const writes: Array<{ kind: string; data: unknown }> = [];
  let ownerQuery: unknown;
  const tx = {
    verificationCase: {
      updateMany: (input: unknown) => {
        writes.push({ kind: "case", data: input });
        return Promise.resolve({ count: 1 });
      },
    },
    auditEvent: {
      create: (input: unknown) => {
        writes.push({ kind: "audit", data: input });
        return Promise.resolve(input);
      },
    },
    notification: {
      create: (input: unknown) => {
        writes.push({ kind: "notification", data: input });
        return Promise.resolve(input);
      },
    },
  };
  const prisma = {
    verificationCase: {
      findFirst: () =>
        Promise.resolve({
          id: 30n,
          clientId: 40n,
          branchId: null,
          caseNumber: "SG-TEST-3",
          status: "DOCUMENT_PENDING",
          priority: "NORMAL",
          version: 2,
          assignedOpsUser: null,
        }),
    },
    user: {
      findFirst: (input: unknown) => {
        ownerQuery = input;
        return Promise.resolve({
          id: 60n,
          publicId: "00000000-0000-4000-8000-000000000060",
          displayName: "Riya Mehta",
          branchId: null,
          userRoles: [{ role: { code: "SPOC_RM" } }],
        });
      },
    },
    $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
  };
  const service = new CaseOperationsService(prisma as unknown as PrismaService);
  const result = await service.assignOwner(
    actor,
    "00000000-0000-4000-8000-000000000030",
    {
      ownerId: "00000000-0000-4000-8000-000000000060",
      version: 2,
      note: "Dedicated RM for this client",
    },
  );

  assert.deepEqual(result.owner, {
    id: "00000000-0000-4000-8000-000000000060",
    displayName: "Riya Mehta",
  });
  assert.equal(result.version, 3);
  const scope = JSON.stringify(ownerQuery, (_key, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  assert.match(scope, /"SPOC_RM"/);
  assert.match(scope, /"spocClientScopes":\{"some":\{"clientId":"40"\}\}/);
  const audit = writes.find((entry) => entry.kind === "audit")?.data as {
    data: { action: string; afterJson: string };
  };
  assert.equal(audit.data.action, "case.owner-assigned");
  assert.match(audit.data.afterJson, /Riya Mehta/);
  const notification = writes.find((entry) => entry.kind === "notification")
    ?.data as { data: { href: string; title: string } };
  assert.equal(notification.data.title, "Case assigned to you as RM");
  assert.match(notification.data.href, /^\/spoc-rm\/records\?domain=cases/);
});

void test("case owner cannot be reassigned to the same RM", async () => {
  const prisma = {
    verificationCase: {
      findFirst: () =>
        Promise.resolve({
          id: 30n,
          clientId: 40n,
          branchId: null,
          caseNumber: "SG-TEST-4",
          status: "IN_PROGRESS",
          priority: "NORMAL",
          version: 4,
          assignedOpsUser: { id: 60n, publicId: "rm" },
        }),
    },
    user: {
      findFirst: () =>
        Promise.resolve({
          id: 60n,
          publicId: "00000000-0000-4000-8000-000000000060",
          displayName: "Riya Mehta",
          branchId: null,
          userRoles: [{ role: { code: "SPOC_RM" } }],
        }),
    },
  };
  const service = new CaseOperationsService(prisma as unknown as PrismaService);
  await assert.rejects(
    service.assignOwner(actor, "00000000-0000-4000-8000-000000000030", {
      ownerId: "00000000-0000-4000-8000-000000000060",
      version: 4,
    }),
    ConflictException,
  );
});
