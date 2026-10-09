import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { caseAccessScope } from "../src/common/auth/access-scope";
import type { Actor, ActorDepartment } from "../src/common/auth/actor";
import { CaseWorkflowPolicy } from "../src/cases/case-workflow.policy";
import type { PrismaService } from "../src/database/prisma.service";
import { assertFinalApprover } from "../src/reports/manager-review.service";
import { IntakeService } from "../src/workflow/intake.service";
import { RoutingService } from "../src/workflow/routing.service";

const UUID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function actorOf(roles: string[], extra: Partial<Actor> = {}): Actor {
  return {
    userId: 10n,
    userPublicId: UUID(10),
    tenantId: 1n,
    tenantPublicId: UUID(1),
    tenantName: "Sapling Global",
    email: "user@example.invalid",
    displayName: "Test User",
    mustChangePassword: false,
    roles,
    permissions: [],
    ...extra,
  };
}
const dept = (
  id: bigint,
  kind: string,
  role: "LEAD" | "MEMBER",
): ActorDepartment => ({
  id,
  publicId: UUID(Number(id)),
  code: kind,
  name: kind,
  kind,
  role,
});
const rm = actorOf(["SPOC_RM"], {
  spocClients: [{ id: 40n, publicId: UUID(40), name: "Horizon Tech" }],
});

type Write = { kind: string; data: unknown };

/** Minimal Prisma double: records writes; per-test overrides supply reads. */
function prismaDouble(overrides: Record<string, Record<string, unknown>> = {}) {
  const writes: Write[] = [];
  const record =
    (kind: string, result: unknown = {}) =>
    (input: unknown) => {
      writes.push({ kind, data: input });
      return Promise.resolve(result);
    };
  const tx: Record<string, Record<string, unknown>> = {
    verificationCase: {
      updateMany: record("case.updateMany", { count: 1 }),
      update: record("case.update"),
      findUnique: () =>
        Promise.resolve({
          workflowVersion: 2,
          intakeStage: "ROUTED",
          documents: [],
        }),
    },
    caseStatusHistory: { create: record("history") },
    caseCheck: {
      update: record("check.update"),
      // Every check already initiated unless a test says otherwise.
      findMany: () => Promise.resolve([]),
    },
    checkTask: {
      create: record("task.create"),
      updateMany: record("task.updateMany", { count: 1 }),
    },
    auditEvent: { create: record("audit") },
    outboxEvent: { create: record("outbox") },
    notification: {
      create: record("notify"),
      createMany: record("notifyMany"),
    },
    clarification: { count: () => Promise.resolve(0) },
    document: { count: () => Promise.resolve(0) },
    consent: { count: () => Promise.resolve(1) },
    caseService: { findMany: () => Promise.resolve([]) },
    ...overrides["tx"],
  };
  const prisma = {
    ...overrides,
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  };
  return { prisma: prisma as unknown as PrismaService, writes };
}

const v2Case = (extra: Record<string, unknown> = {}) => ({
  id: 30n,
  publicId: UUID(30),
  caseNumber: "SG-V2-1",
  status: "DOCUMENT_PENDING",
  version: 4,
  workflowVersion: 2,
  intakeStage: "INTAKE",
  assignedOpsUserId: 10n,
  dataEntryUserId: null,
  branchId: null,
  clientId: 40n,
  ...extra,
});

void test("access scopes: Data Entry, Team Leader and RM see only their own work", () => {
  const member = caseAccessScope(actorOf(["DATA_ENTRY"]));
  assert.deepEqual(
    {
      workflowVersion: member.workflowVersion,
      dataEntryUserId: member.dataEntryUserId,
    },
    { workflowVersion: 2, dataEntryUserId: 10n },
  );
  const lead = caseAccessScope(
    actorOf(["VERIFIER"], { departments: [dept(7n, "VERIFICATION", "LEAD")] }),
  ) as { OR: unknown[] };
  assert.equal(lead.OR.length, 2);
  assert.match(
    JSON.stringify(lead.OR[1], (_k, v: unknown) =>
      typeof v === "bigint" ? String(v) : v,
    ),
    /"departmentId":\{"in":\["7"\]\}/,
  );
  const plainVerifier = caseAccessScope(actorOf(["VERIFIER"])) as Record<
    string,
    unknown
  >;
  assert.equal("OR" in plainVerifier, false);
  assert.deepEqual(caseAccessScope(rm).clientId, { in: [40n] });
  assert.deepEqual(
    caseAccessScope(actorOf(["SPOC_RM"], { spocClients: [] })).clientId,
    { in: [-1n] },
  );
});

void test("RM assigns Data Entry: audited, notified, only a Data Entry team member", async () => {
  let userQuery: unknown;
  const { prisma, writes } = prismaDouble({
    verificationCase: { findFirst: () => Promise.resolve(v2Case()) },
    user: {
      findFirst: (input: unknown) => {
        userQuery = input;
        return Promise.resolve({
          id: 60n,
          publicId: UUID(60),
          displayName: "Ankit Rao",
        });
      },
    },
  });
  const result = await new IntakeService(prisma).assignDataEntry(rm, UUID(30), {
    assigneeId: UUID(60),
    version: 4,
    note: "Priority client",
  });
  assert.equal(result.intakeStage, "DATA_ENTRY");
  assert.match(
    JSON.stringify(userQuery, (_k, v: unknown) =>
      typeof v === "bigint" ? String(v) : v,
    ),
    /"DATA_ENTRY"/,
  );
  const audit = writes.find((w) => w.kind === "audit")?.data as {
    data: { action: string };
  };
  assert.equal(audit.data.action, "case.data-entry-assigned");
  assert.ok(writes.some((w) => w.kind === "notify"));

  const other = actorOf(["SPOC_RM"], {
    userId: 99n,
    spocClients: rm.spocClients,
  });
  await assert.rejects(
    new IntakeService(prisma).assignDataEntry(other, UUID(30), {
      assigneeId: UUID(60),
      version: 4,
    }),
    ForbiddenException,
  );
  const v1 = prismaDouble({
    verificationCase: {
      findFirst: () => Promise.resolve(v2Case({ workflowVersion: 1 })),
    },
  });
  await assert.rejects(
    new IntakeService(v1.prisma).assignDataEntry(rm, UUID(30), {
      assigneeId: UUID(60),
      version: 4,
    }),
    ConflictException,
  );
});

void test("Data Entry marks Ready only with no open corrections and returns the case to the RM", async () => {
  const dataEntry = actorOf(["DATA_ENTRY"], { userId: 60n });
  const ready = prismaDouble({
    verificationCase: {
      findFirst: () =>
        Promise.resolve(
          v2Case({ intakeStage: "DATA_ENTRY", dataEntryUserId: 60n }),
        ),
    },
  });
  const result = await new IntakeService(ready.prisma).markReady(
    dataEntry,
    UUID(30),
    { version: 4 },
  );
  assert.equal(result.intakeStage, "READY");
  const notify = ready.writes.find((w) => w.kind === "notify")?.data as {
    data: { userId: bigint; type: string };
  };
  assert.deepEqual(
    [notify.data.userId, notify.data.type],
    [10n, "DATA_ENTRY_READY"],
  );

  const blocked = prismaDouble({
    verificationCase: {
      findFirst: () =>
        Promise.resolve(
          v2Case({ intakeStage: "DATA_ENTRY", dataEntryUserId: 60n }),
        ),
    },
    tx: { clarification: { count: () => Promise.resolve(1) } },
  });
  await assert.rejects(
    new IntakeService(blocked.prisma).markReady(dataEntry, UUID(30), {
      version: 4,
    }),
    BadRequestException,
  );
  // A check without its initiation details blocks Ready.
  const notInitiated = prismaDouble({
    verificationCase: {
      findFirst: () =>
        Promise.resolve(
          v2Case({ intakeStage: "DATA_ENTRY", dataEntryUserId: 60n }),
        ),
    },
    tx: {
      caseCheck: { findMany: () => Promise.resolve([{ type: "EMPLOYMENT" }]) },
    },
  });
  await assert.rejects(
    new IntakeService(notInitiated.prisma).markReady(dataEntry, UUID(30), {
      version: 4,
    }),
    /Initiate every check before marking Ready: employment/,
  );
  const correction = prismaDouble({
    verificationCase: {
      findFirst: () =>
        Promise.resolve(
          v2Case({ intakeStage: "CORRECTION", dataEntryUserId: 60n }),
        ),
    },
  });
  await assert.rejects(
    new IntakeService(correction.prisma).markReady(dataEntry, UUID(30), {
      version: 4,
    }),
    /Resolve the open correction/,
  );
  const someoneElse = actorOf(["DATA_ENTRY"], { userId: 61n });
  await assert.rejects(
    new IntakeService(ready.prisma).markReady(someoneElse, UUID(30), {
      version: 4,
    }),
    ForbiddenException,
  );
});

const department = (
  id: bigint,
  name: string,
  types: string[],
  lead = true,
) => ({
  id,
  publicId: UUID(Number(id)),
  name,
  checkTypesJson: JSON.stringify(types),
  members: lead
    ? [{ role: "LEAD", user: { id: id + 100n, displayName: `${name} TL` } }]
    : [],
});

void test("RM routes every open check to a department; verification starts and leads are told", async () => {
  const routed = v2Case({
    intakeStage: "READY",
    checks: [
      {
        id: 1n,
        publicId: UUID(101),
        type: "EMPLOYMENT",
        status: "PENDING",
        tasks: [],
      },
      {
        id: 2n,
        publicId: UUID(102),
        type: "EDUCATION",
        status: "PENDING",
        tasks: [],
      },
    ],
  });
  const { prisma, writes } = prismaDouble({
    verificationCase: { findFirst: () => Promise.resolve(routed) },
    department: {
      findMany: () =>
        Promise.resolve([
          department(7n, "Employment", ["EMPLOYMENT"]),
          department(8n, "Education", ["EDUCATION"]),
        ]),
    },
  });
  const service = new RoutingService(prisma, new CaseWorkflowPolicy(prisma));
  const result = await service.route(rm, UUID(30), {
    version: 4,
    routes: [
      { checkId: UUID(101), departmentId: UUID(7) },
      { checkId: UUID(102), departmentId: UUID(8) },
    ],
  });
  assert.equal(result.status, "IN_PROGRESS");
  assert.equal(writes.filter((w) => w.kind === "task.create").length, 2);
  assert.equal(writes.filter((w) => w.kind === "check.update").length, 2);
  const history = writes.find((w) => w.kind === "history")?.data as {
    data: { toStatus: string };
  };
  assert.equal(history.data.toStatus, "IN_PROGRESS");
  const leads = writes.find((w) => w.kind === "notifyMany")?.data as {
    data: Array<{ userId: bigint }>;
  };
  assert.deepEqual(leads.data.map((n) => n.userId).sort(), [107n, 108n]);

  await assert.rejects(
    service.route(rm, UUID(30), {
      version: 4,
      routes: [{ checkId: UUID(101), departmentId: UUID(7) }],
    }),
    /Route every open check/,
  );
  const noLead = prismaDouble({
    verificationCase: { findFirst: () => Promise.resolve(routed) },
    department: {
      findMany: () =>
        Promise.resolve([department(7n, "Employment", [], false)]),
    },
  });
  await assert.rejects(
    new RoutingService(
      noLead.prisma,
      new CaseWorkflowPolicy(noLead.prisma),
    ).route(rm, UUID(30), {
      version: 4,
      routes: [
        { checkId: UUID(101), departmentId: UUID(7) },
        { checkId: UUID(102), departmentId: UUID(7) },
      ],
    }),
    /no Team Leader/,
  );
});

void test("a v2 case cannot be started manually before routing", async () => {
  const { prisma } = prismaDouble({
    tx: {
      verificationCase: {
        findUnique: () =>
          Promise.resolve({
            workflowVersion: 2,
            intakeStage: "READY",
            documents: [],
          }),
      },
    },
  });
  const policy = new CaseWorkflowPolicy(prisma);
  await prisma.$transaction(async (tx) => {
    await assert.rejects(
      policy.assertAllowed(30n, "DOCUMENT_PENDING", "IN_PROGRESS", tx),
      /RM routes its checks/,
    );
  });
});

void test("only the department Team Leader assigns a routed check to its own member", async () => {
  const task = {
    id: 5n,
    status: "UNASSIGNED",
    version: 1,
    assigneeId: null,
    assignee: null,
    check: {
      id: 1n,
      type: "EMPLOYMENT",
      departmentId: 7n,
      department: { name: "Employment" },
      case: {
        id: 30n,
        publicId: UUID(30),
        caseNumber: "SG-V2-1",
        status: "IN_PROGRESS",
      },
    },
  };
  let memberQuery: unknown;
  const { prisma, writes } = prismaDouble({
    checkTask: { findFirst: () => Promise.resolve(task) },
    user: {
      findFirst: (input: unknown) => {
        memberQuery = input;
        return Promise.resolve({
          id: 70n,
          publicId: UUID(70),
          displayName: "Neeraj",
        });
      },
    },
  });
  const service = new RoutingService(prisma, new CaseWorkflowPolicy(prisma));
  const lead = actorOf(["VERIFIER"], {
    departments: [dept(7n, "VERIFICATION", "LEAD")],
  });
  const result = await service.assignTask(lead, UUID(5), {
    assigneeId: UUID(70),
    version: 1,
  });
  assert.equal(result.status, "OPEN");
  assert.match(
    JSON.stringify(memberQuery, (_k, v: unknown) =>
      typeof v === "bigint" ? String(v) : v,
    ),
    /"departmentId":"7"/,
  );
  const audit = writes.find((w) => w.kind === "audit")?.data as {
    data: { action: string };
  };
  assert.equal(audit.data.action, "task.assigned-by-lead");

  const member = actorOf(["VERIFIER"], {
    departments: [dept(7n, "VERIFICATION", "MEMBER")],
  });
  await assert.rejects(
    service.assignTask(member, UUID(5), { assigneeId: UUID(70), version: 1 }),
    ForbiddenException,
  );
  const otherLead = actorOf(["VERIFIER"], {
    departments: [dept(8n, "VERIFICATION", "LEAD")],
  });
  await assert.rejects(
    service.assignTask(otherLead, UUID(5), {
      assigneeId: UUID(70),
      version: 1,
    }),
    ForbiddenException,
  );
  const busy = prismaDouble({
    checkTask: {
      findFirst: () => Promise.resolve({ ...task, status: "IN_PROGRESS" }),
    },
  });
  await assert.rejects(
    new RoutingService(
      busy.prisma,
      new CaseWorkflowPolicy(busy.prisma),
    ).assignTask(lead, UUID(5), {
      assigneeId: UUID(70),
      version: 1,
    }),
    /blocked/,
  );
});

void test("a Team Leader may take a routed check itself: audited, no self-notification", async () => {
  const task = {
    id: 5n,
    status: "UNASSIGNED",
    version: 1,
    assigneeId: null,
    assignee: null,
    check: {
      id: 1n,
      type: "EMPLOYMENT",
      departmentId: 7n,
      department: { name: "Employment" },
      case: {
        id: 30n,
        publicId: UUID(30),
        caseNumber: "SG-V2-1",
        status: "IN_PROGRESS",
      },
    },
  };
  const { prisma, writes } = prismaDouble({
    checkTask: { findFirst: () => Promise.resolve(task) },
    user: {
      // The lead itself (actor userId 10) is an active member of the department.
      findFirst: () =>
        Promise.resolve({ id: 10n, publicId: UUID(10), displayName: "Lead" }),
    },
  });
  const lead = actorOf(["VERIFIER"], {
    departments: [dept(7n, "VERIFICATION", "LEAD")],
  });
  const result = await new RoutingService(
    prisma,
    new CaseWorkflowPolicy(prisma),
  ).assignTask(lead, UUID(5), { assigneeId: UUID(10), version: 1 });
  assert.equal(result.selfPick, true);
  const audit = writes.find((w) => w.kind === "audit")?.data as {
    data: { action: string };
  };
  assert.equal(audit.data.action, "task.taken-by-lead");
  assert.equal(writes.filter((w) => w.kind === "notify").length, 0);
});

void test("final approval: the current RM for v2 cases, Operations for earlier cases", () => {
  const owner = { workflowVersion: 2, assignedOpsUserId: 10n };
  assert.doesNotThrow(() => assertFinalApprover(rm, owner, "RM"));
  assert.throws(
    () => assertFinalApprover(rm, { ...owner, assignedOpsUserId: 11n }, "RM"),
    ForbiddenException,
  );
  assert.throws(
    () => assertFinalApprover(actorOf(["OPS_MANAGER"]), owner, "OPERATIONS"),
    ForbiddenException,
  );
  assert.doesNotThrow(() =>
    assertFinalApprover(actorOf(["PLATFORM_ADMIN"]), owner, "OPERATIONS"),
  );
  assert.doesNotThrow(() =>
    assertFinalApprover(
      actorOf(["OPS_MANAGER"]),
      { workflowVersion: 1, assignedOpsUserId: null },
      "OPERATIONS",
    ),
  );
  assert.throws(
    () =>
      assertFinalApprover(
        rm,
        { workflowVersion: 1, assignedOpsUserId: 10n },
        "RM",
      ),
    ForbiddenException,
  );
});

void test("an RM who also holds Data Entry may take the data entry itself, no team needed", async () => {
  const queries: unknown[] = [];
  const { prisma } = prismaDouble({
    verificationCase: { findFirst: () => Promise.resolve(v2Case()) },
    user: {
      findFirst: (input: unknown) => {
        queries.push(input);
        return Promise.resolve({
          id: rm.userId,
          publicId: rm.userPublicId,
          displayName: "Niku",
        });
      },
    },
  });
  const both = { ...rm, roles: ["SPOC_RM", "DATA_ENTRY"] };
  const result = await new IntakeService(prisma).assignDataEntry(
    both,
    UUID(30),
    {
      assigneeId: both.userPublicId,
      version: 4,
    },
  );
  assert.equal(result.intakeStage, "DATA_ENTRY");
  const self = JSON.stringify(queries[0], (_k, v: unknown) =>
    typeof v === "bigint" ? String(v) : v,
  );
  assert.doesNotMatch(self, /departmentMemberships/);
  // Anyone else still has to be a Data Entry team member.
  queries.length = 0;
  await new IntakeService(prisma).assignDataEntry(both, UUID(30), {
    assigneeId: UUID(60),
    version: 4,
  });
  assert.match(
    JSON.stringify(queries[0], (_k, v: unknown) =>
      typeof v === "bigint" ? String(v) : v,
    ),
    /departmentMemberships/,
  );
});
