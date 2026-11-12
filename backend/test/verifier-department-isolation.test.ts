import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { TaskContextService } from "../src/verification/task-context.service";
import { TaskInsightsService } from "../src/verification/task-insights.service";
import {
  ACTIVE_TASK_STATUSES,
  resolveTaskAccessScope,
  scopedVerifierCheckWhere,
} from "../src/verification/task-query.helpers";
import { TaskQueryService } from "../src/verification/task-query.service";
import { TaskWorkflowService } from "../src/verification/task-workflow.service";
import type { QaReadinessService } from "../src/verification/qa-readiness.service";
import { CheckReworkService } from "../src/workflow/check-rework.service";

const DEPTS = {
  DIGITAL: { id: 10n, publicId: "a81ce6a3-7f2a-4ec4-8a5f-084013366afe", name: "Digital", teamType: "DIGITAL" },
  EDUCATION: { id: 11n, publicId: "7b6c6514-16dc-40d3-90dd-9e301db5496d", name: "Education", teamType: "EDUCATION" },
  EMPLOYMENT: { id: 12n, publicId: "e5d1e927-7e6b-431c-a775-d32e28dcf932", name: "Employment", teamType: "EMPLOYMENT" },
  VENDOR: { id: 13n, publicId: "b23e397b-9799-4397-aac5-96898ff3ebd3", name: "Vendor", teamType: "VENDOR" },
} as const;

const makeLead = (userId: bigint, deptId: bigint, displayName: string) =>
  ({
    tenantId: 1n,
    tenantPublicId: "t-1",
    userId,
    userPublicId: `user-${userId}`,
    displayName,
    roles: ["VERIFIER"],
    departments: [{ id: deptId, role: "LEAD", kind: "VERIFICATION" }],
  }) as unknown as Actor;

const digitalLeadA = makeLead(101n, DEPTS.DIGITAL.id, "Digital TL A");
const digitalLeadB = makeLead(102n, DEPTS.DIGITAL.id, "Digital TL B");
const opsSupervisor = {
  tenantId: 1n,
  userId: 1n,
  roles: ["OPS_MANAGER"],
  departments: [],
} as unknown as Actor;
const plainMember = {
  tenantId: 1n,
  userId: 501n,
  roles: ["VERIFIER"],
  departments: [{ id: DEPTS.DIGITAL.id, role: "MEMBER", kind: "VERIFICATION" }],
} as unknown as Actor;

function deptLookupPrisma() {
  const byPublicId = new Map(Object.values(DEPTS).map((d) => [d.publicId, d]));
  return {
    department: {
      findFirst: (args: { where: { publicId: string } }) =>
        Promise.resolve(byPublicId.get(args.where.publicId) ?? null),
    },
  } as unknown as PrismaService;
}

void test("all 4 verification departments isolate My Checks scope and exclude UNASSIGNED", async () => {
  const prisma = deptLookupPrisma();
  for (const [key, dept] of Object.entries(DEPTS)) {
    const actor = makeLead(BigInt(900 + Number(dept.id)), dept.id, `${key} TL`);
    const scope = await resolveTaskAccessScope(prisma, actor, dept.publicId);
    assert.deepEqual(scope, {
      tenantId: 1n,
      assigneeId: { not: null },
      status: { not: "UNASSIGNED" },
      check: { departmentId: dept.id },
    });
  }
});

void test("TL of Digital cannot query Education, Employment or Vendor checks", async () => {
  const prisma = deptLookupPrisma();
  await assert.rejects(
    resolveTaskAccessScope(prisma, digitalLeadA, DEPTS.EDUCATION.publicId),
    ForbiddenException,
  );
  await assert.rejects(
    resolveTaskAccessScope(prisma, digitalLeadA, DEPTS.EMPLOYMENT.publicId),
    ForbiddenException,
  );
  await assert.rejects(
    resolveTaskAccessScope(prisma, digitalLeadA, DEPTS.VENDOR.publicId),
    ForbiddenException,
  );
  await assert.rejects(
    resolveTaskAccessScope(prisma, opsSupervisor, "00000000-0000-4000-8000-000000000000"),
    NotFoundException,
  );
});

void test("supervisor sees claimed checks across all depts when unfiltered and single dept when selected, never UNASSIGNED", async () => {
  const prisma = deptLookupPrisma();
  const unfiltered = await resolveTaskAccessScope(prisma, opsSupervisor);
  assert.deepEqual(unfiltered, {
    tenantId: 1n,
    assigneeId: { not: null },
    status: { not: "UNASSIGNED" },
    check: {},
  });
  const digitalFiltered = await resolveTaskAccessScope(
    prisma,
    opsSupervisor,
    DEPTS.DIGITAL.publicId,
  );
  assert.deepEqual(digitalFiltered, {
    tenantId: 1n,
    assigneeId: { not: null },
    status: { not: "UNASSIGNED" },
    check: { departmentId: DEPTS.DIGITAL.id },
  });
});

void test("plain verifier stays strictly restricted to own assigned tasks", async () => {
  const scope = await resolveTaskAccessScope(deptLookupPrisma(), plainMember);
  assert.deepEqual(scope, { tenantId: 1n, assigneeId: 501n });
  await assert.rejects(
    resolveTaskAccessScope(deptLookupPrisma(), plainMember, DEPTS.EDUCATION.publicId),
    ForbiddenException,
  );
});

void test("My Checks queries, ACTIVE filter, overdue counts and insights never include UNASSIGNED", async () => {
  const taskWheres: unknown[] = [];
  const countWheres: unknown[] = [];
  const insightWheres: unknown[] = [];
  const prisma = {
    ...deptLookupPrisma(),
    checkTask: {
      findMany: (args: { where: unknown }) => {
        taskWheres.push(args.where);
        return Promise.resolve([
          {
            publicId: "task-digital-1",
            status: "OPEN",
            instructions: null,
            dueAt: new Date(),
            startedAt: null,
            completedAt: null,
            blockerReason: null,
            blockedAt: null,
            version: 1,
            assignee: { publicId: digitalLeadA.userPublicId, displayName: digitalLeadA.displayName },
            check: {
              id: 77n,
              publicId: "chk-digital-1",
              type: "IDENTITY",
              status: "ASSIGNED",
              initiationJson: null,
              initiatedAt: new Date(),
              department: {
                publicId: DEPTS.DIGITAL.publicId,
                name: DEPTS.DIGITAL.name,
                teamType: DEPTS.DIGITAL.teamType,
              },
              result: null,
              riskLevel: null,
              sourceSummary: null,
              findings: [],
              case: {
                publicId: "case-7f1857",
                caseNumber: "SG-20261111-7F1857",
                priority: "NORMAL",
                subject: { publicId: "sub-1", fullName: "Candidate" },
                client: { publicId: "cli-1", displayName: "Sapling Global Assurance" },
                clarifications: [],
              },
            },
          },
        ]);
      },
      count: (args: { where: unknown }) => {
        countWheres.push(args.where);
        insightWheres.push(args.where);
        return Promise.resolve(1);
      },
    },
  } as unknown as PrismaService;

  const mine = await new TaskQueryService(prisma).mine(digitalLeadB, {
    view: "ACTIVE",
    departmentId: DEPTS.DIGITAL.publicId,
    limit: 25,
  });
  assert.equal(mine.items[0]!.assignee?.name, "Digital TL A");
  assert.equal(mine.items[0]!.check.department?.id, DEPTS.DIGITAL.publicId);
  assert.equal(ACTIVE_TASK_STATUSES.includes("UNASSIGNED"), false);
  const safeJson = (value: unknown) =>
    JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
  const queryJson = safeJson(taskWheres[0]);
  assert.match(queryJson, /"not":"UNASSIGNED"/);
  assert.doesNotMatch(queryJson, /"in":\[[^\]]*"UNASSIGNED"/);

  await new TaskInsightsService(prisma).mine(digitalLeadB, DEPTS.DIGITAL.publicId);
  const insightsJson = safeJson(insightWheres);
  assert.doesNotMatch(insightsJson, /"in":\[[^\]]*"UNASSIGNED"/);
});

void test("Option A: peer TL sees owner metadata in TaskContext but cannot directly mutate task workflow without takeover", async () => {
  const prisma = {
    ...deptLookupPrisma(),
    checkTask: {
      findFirst: () =>
        Promise.resolve({
          publicId: "task-digital-1",
          status: "OPEN",
          createdAt: new Date(),
          startedAt: null,
          blockedAt: null,
          completedAt: null,
          assignee: { publicId: digitalLeadA.userPublicId, displayName: "Digital TL A" },
          check: {
            id: 77n,
            publicId: "chk-digital-1",
            type: "IDENTITY",
            initiationJson: null,
            initiatedAt: new Date(),
            department: {
              publicId: DEPTS.DIGITAL.publicId,
              name: "Digital",
              teamType: "DIGITAL",
            },
            case: {
              publicId: "case-7f1857",
              caseNumber: "SG-20261111-7F1857",
              status: "IN_PROGRESS",
              priority: "NORMAL",
              dueAt: null,
              subject: {
                publicId: "sub-1",
                fullName: "Candidate",
                email: null,
                phone: null,
                employeeCode: null,
              },
              client: { publicId: "cli-1", displayName: "Sapling Global Assurance" },
              branch: null,
              servicePackage: null,
              consents: [],
              documents: [],
              clarifications: [],
              statusHistory: [],
            },
          },
        }),
    },
  } as unknown as PrismaService;

  const ctx = await new TaskContextService(prisma).get(
    digitalLeadB,
    "task-digital-1",
    DEPTS.DIGITAL.publicId,
  );
  assert.equal(ctx.assignee?.name, "Digital TL A");
  assert.equal(ctx.check.department?.id, DEPTS.DIGITAL.publicId);

  const workflow = new TaskWorkflowService(
    { checkTask: { findFirst: () => Promise.resolve(null) } } as unknown as PrismaService,
    {} as QaReadinessService,
  );
  await assert.rejects(
    workflow.update(digitalLeadB, "task-digital-1", {
      status: "IN_PROGRESS",
      version: 1,
      findings: [],
    }),
    /not assigned to you/,
  );
});

void test("check read scope and rework queries isolate across departments on shared multi-check cases", async () => {
  const checkWhere = scopedVerifierCheckWhere(digitalLeadA);
  assert.deepEqual(checkWhere, {
    OR: [{ departmentId: { in: [DEPTS.DIGITAL.id] } }, { tasks: { some: { assigneeId: 101n } } }],
  });
  assert.equal(scopedVerifierCheckWhere(opsSupervisor), undefined);

  const utvWheres: unknown[] = [];
  const reworkPrisma = {
    ...deptLookupPrisma(),
    caseCheck: {
      count: (args: { where: unknown }) => {
        utvWheres.push(args.where);
        return Promise.resolve(0);
      },
      findMany: () => Promise.resolve([]),
    },
  } as unknown as PrismaService;
  await new CheckReworkService(reworkPrisma).utvBucket(opsSupervisor, {
    page: 1,
    pageSize: 20,
    departmentId: DEPTS.EDUCATION.publicId,
  });
  assert.equal((utvWheres[0] as { departmentId?: bigint }).departmentId, DEPTS.EDUCATION.id);
});
