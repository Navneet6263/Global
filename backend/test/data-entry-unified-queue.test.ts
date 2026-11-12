import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { DataEntryInsightsController } from "../src/workflow/data-entry-insights.controller";
import { DataEntryUnifiedQueueService } from "../src/workflow/data-entry-unified-queue.service";

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const toJson = (value: unknown) =>
  JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));

function actorOf(roles: string[], extra: Partial<Actor> = {}): Actor {
  return {
    userId: 10n,
    userPublicId: UUID(10),
    tenantId: 1n,
    tenantPublicId: UUID(1),
    tenantName: "Sapling Global",
    email: "de@example.invalid",
    displayName: "Sara Khan",
    mustChangePassword: false,
    roles,
    permissions: ["case:read", "clarification:read", "clarification:write"],
    ...extra,
  };
}

function makeCaseRow(overrides: Record<string, unknown> = {}) {
  return {
    publicId: UUID(101),
    caseNumber: "SG-2026-001",
    status: "DOCUMENT_PENDING",
    priority: "NORMAL",
    version: 2,
    workflowVersion: 2,
    intakeStage: "DATA_ENTRY",
    dueAt: new Date("2026-11-15T10:00:00Z"),
    createdAt: new Date("2026-11-10T10:00:00Z"),
    updatedAt: new Date("2026-11-11T10:00:00Z"),
    dataEntryAssignedAt: new Date("2026-11-10T12:00:00Z"),
    dataEntryReadyAt: null,
    escalatedAt: null,
    escalationNote: null,
    subject: { fullName: "Kabir Sethi" },
    client: { publicId: UUID(40), displayName: "Horizon Tech" },
    assignedOpsUser: { publicId: UUID(20), displayName: "Riya Mehta" },
    dataEntryUser: { publicId: UUID(10), displayName: "Sara Khan" },
    documents: [{ status: "PENDING" }],
    clarifications: [],
    checks: [{ status: "PENDING", department: null, tasks: [] }],
    ...overrides,
  };
}

void test("DataEntryUnifiedQueueService blocks unauthorized roles", async () => {
  const svc = new DataEntryUnifiedQueueService({} as PrismaService);
  await assert.rejects(
    () => svc.queue(actorOf(["VERIFIER"]), {}),
    ForbiddenException,
  );
  await assert.rejects(
    () => svc.queue(actorOf(["SPOC_RM"]), {}),
    ForbiddenException,
  );
});

void test("DataEntryUnifiedQueueService merges normal intake and pending L2 cases without duplicates", async () => {
  const findManyCalls: unknown[] = [];
  const countCalls: unknown[] = [];
  const l2Due = new Date("2026-11-13T09:00:00Z");
  const rows = [
    makeCaseRow(),
    makeCaseRow({
      publicId: UUID(102),
      caseNumber: "SG-2026-L201",
      status: "CLARIFICATION_PENDING",
      intakeStage: "ROUTED",
      dueAt: null,
      subject: { fullName: "Asha Verma" },
      clarifications: [
        {
          publicId: UUID(501),
          level: "L2",
          status: "DATA_ENTRY_PENDING",
          subject: "Relieving letter cropped",
          checkId: 77n,
          requestedDocumentType: "EMPLOYMENT_PROOF",
          submittedDocumentVersion: 2,
          opsReviewedAt: new Date("2026-11-11T08:00:00Z"),
          rejectionCount: 1,
          dueAt: l2Due,
          createdAt: new Date("2026-11-10T08:00:00Z"),
        },
        {
          publicId: UUID(502),
          level: "L2",
          status: "DATA_ENTRY_PENDING",
          subject: "Marksheet missing",
          checkId: 78n,
          requestedDocumentType: "EDUCATION_CERTIFICATE",
          submittedDocumentVersion: 3,
          opsReviewedAt: new Date("2026-11-11T09:00:00Z"),
          rejectionCount: 0,
          dueAt: null,
          createdAt: new Date("2026-11-10T09:00:00Z"),
        },
      ],
    }),
  ];

  let countIdx = 0;
  const countReplies = [2, 2, 1, 1, 0, 1, 2, 1];
  const prisma = {
    verificationCase: {
      findMany: (arg: unknown) => {
        findManyCalls.push(arg);
        return Promise.resolve(rows);
      },
      count: (arg: unknown) => {
        countCalls.push(arg);
        return Promise.resolve(countReplies[countIdx++] ?? 0);
      },
    },
    caseCheck: {
      findMany: () =>
        Promise.resolve([
          { id: 77n, publicId: UUID(77), type: "EMPLOYMENT", status: "IN_PROGRESS", initiationJson: null, initiatedAt: null },
          { id: 78n, publicId: UUID(78), type: "EDUCATION", status: "IN_PROGRESS", initiationJson: null, initiatedAt: null },
        ]),
    },
  } as unknown as PrismaService;

  const svc = new DataEntryUnifiedQueueService(prisma);
  const res = await svc.queue(actorOf(["DATA_ENTRY"]), { filter: "all", search: "Verma", page: 1, pageSize: 10 });

  assert.equal(findManyCalls.length, 1);
  assert.equal(res.total, 2);
  assert.equal(res.items.length, 2);
  assert.equal(res.counts["mine"], 2);
  assert.equal(res.counts["l2Reentry"], 1);
  assert.equal(res.counts["overdue"], 1);

  assert.deepEqual(res.items[0]!.l2Reentries, []);
  const l2Item = res.items[1]!;
  assert.equal(l2Item.caseNumber, "SG-2026-L201");
  assert.equal(l2Item.dueAt?.toISOString(), l2Due.toISOString());
  assert.equal(l2Item.l2Reentries.length, 2);
  assert.equal(l2Item.l2Reentries[0]!.checkType, "EMPLOYMENT");
  assert.equal(l2Item.l2Reentries[1]!.checkType, "EDUCATION");

  const findArg = findManyCalls[0] as { where: unknown };
  const serialized = toJson(findArg.where);
  assert.match(serialized, /DATA_ENTRY_PENDING/);
  assert.match(serialized, /Verma/);
  assert.match(serialized, /subject/);
  assert.equal(countCalls.length, 8);
});

void test("DataEntryUnifiedQueueService applies Lead team vs mine filters and l2_reentry filter", async () => {
  const captured: unknown[] = [];
  const prisma = {
    verificationCase: {
      findMany: (arg: unknown) => {
        captured.push(arg);
        return Promise.resolve([]);
      },
      count: () => Promise.resolve(0),
    },
    caseCheck: { findMany: () => Promise.resolve([]) },
  } as unknown as PrismaService;

  const lead = actorOf(["DATA_ENTRY"], {
    departments: [{ id: 9n, publicId: UUID(9), code: "DE", name: "DE", kind: "DATA_ENTRY", role: "LEAD" }],
  });
  const svc = new DataEntryUnifiedQueueService(prisma);

  await svc.queue(lead, { view: "mine", filter: "l2_reentry" });
  const mineSerialized = toJson((captured[0] as { where: unknown }).where);
  assert.match(mineSerialized, /"dataEntryUserId":"10"/);
  assert.match(mineSerialized, /"dataEntryUserId":null/);

  await svc.queue(lead, { view: "team", filter: "correction" });
  const teamSerialized = toJson((captured[1] as { where: unknown }).where);
  assert.match(teamSerialized, /"intakeStage":"CORRECTION"/);
  assert.match(teamSerialized, /"departmentId":\{"in":\["9"\]\}/);
});

void test("DataEntryInsightsController preserves role guard metadata with unified-queue endpoint", () => {
  const roles = Reflect.getMetadata("roles", DataEntryInsightsController) as string[] | undefined;
  assert.deepEqual(roles, ["PLATFORM_ADMIN", "OPS_MANAGER", "DATA_ENTRY"]);
});
