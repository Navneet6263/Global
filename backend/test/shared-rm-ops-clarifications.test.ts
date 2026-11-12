import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { notifyClarificationStakeholders } from "../src/common/persistence/clarification-recipients";
import { ClarificationL1QueueService } from "../src/clarifications/clarification-l1-queue.service";
import { ClarificationL2OpsService } from "../src/clarifications/clarification-l2-ops.service";
import { ClarificationsService } from "../src/clarifications/clarifications.service";
import type { PrismaService } from "../src/database/prisma.service";
import { testActor } from "./helpers/test-actor";

const rmAshish = testActor(["SPOC_RM"], ["clarification:read", "case:read"], {
  userId: 11n,
  userPublicId: "rm-11",
  displayName: "Ashish RM",
  spocClients: [{ id: 40n, publicId: "c-40", name: "Sapling Global" }],
});
const opsUser = testActor(["OPS_MANAGER"], ["clarification:read", "clarification:write"], {
  userId: 21n,
  userPublicId: "ops-21",
  displayName: "Priya Ops",
});

void test("ClarificationL1QueueService scopes RM by clientId regardless of assignedOpsUserId and builds state filters", async () => {
  const queries: Array<Record<string, unknown>> = [];
  const prisma = {
    clarification: {
      findMany: (args: { where: Record<string, unknown> }) => {
        queries.push(args.where);
        return Promise.resolve([
          {
            publicId: "clar-l1-1",
            status: "RESPONDED",
            level: "L1",
            subject: "Confirm address",
            checkId: 5n,
            raisedById: 21n,
            dueAt: new Date(Date.now() - 60_000),
            resolvedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            case: { publicId: "case-1", caseNumber: "SG-101", status: "DOCUMENT_PENDING", subject: { fullName: "Asha" }, client: { publicId: "c-40", displayName: "Sapling Global" } },
            messages: [{ senderType: "CLIENT", body: "Updated", createdAt: new Date() }],
          },
        ]);
      },
    },
    caseCheck: { findMany: () => Promise.resolve([{ id: 5n, publicId: "chk-5", type: "ADDRESS", status: "PENDING" }]) },
    user: { findMany: () => Promise.resolve([{ id: 21n, publicId: "ops-21", displayName: "Priya Ops" }]) },
  } as unknown as PrismaService;

  const svc = new ClarificationL1QueueService(prisma);
  const res = await svc.queue(rmAshish, { state: "overdue", search: "SG-101" });
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0]!.checkType, "ADDRESS");
  assert.equal(res.items[0]!.raisedBy?.displayName, "Priya Ops");
  assert.equal(res.items[0]!.overdue, true);
  assert.deepEqual(queries[0]!.case, { tenantId: 7n, clientId: { in: [40n] } });
  const emptyRm = testActor(["SPOC_RM"], ["clarification:read"], { spocClients: [] });
  await svc.queue(emptyRm, { state: "response_received" });
  assert.deepEqual(queries[1]!.case, { tenantId: 7n, clientId: { in: [-1n] } });
});

void test("Shared L1 resolve allows mapped RM across un-assigned cases, notifies peers, and throws 409 on race", async () => {
  const notifications: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const clarState = { updateCount: 1, clientId: 40n, status: "RESPONDED" };
  const makeTx = () => ({
    $executeRaw: () => Promise.resolve(1),
    clarification: {
      findFirst: () => Promise.resolve({ id: 7n, status: "RESPONDED" }),
      updateMany: () => Promise.resolve({ count: clarState.updateCount }),
      count: () => Promise.resolve(0),
    },
    clarificationMessage: { create: () => Promise.resolve({}) },
    verificationCase: {
      findUnique: () => Promise.resolve({ status: "DOCUMENT_PENDING" }),
      update: () => Promise.resolve({}),
      updateMany: () => Promise.resolve({ count: 1 }),
    },
    user: {
      findMany: (args: { where: { userRoles?: { some?: { role?: { code?: unknown } } }; spocClientScopes?: unknown } }) => {
        if (args.where.spocClientScopes) return Promise.resolve([{ id: 11n }]);
        if (typeof args.where.userRoles?.some?.role?.code === "string") return Promise.resolve([{ id: 21n }]);
        return Promise.resolve([
          { id: 11n, userRoles: [{ role: { code: "SPOC_RM" } }] },
          { id: 21n, userRoles: [{ role: { code: "OPS_MANAGER" } }] },
        ]);
      },
    },
    notification: { createMany: (a: { data: Array<Record<string, unknown>> }) => { notifications.push(...a.data); return Promise.resolve({}); } },
    auditEvent: { create: (a: { data: Record<string, unknown> }) => { audits.push(a.data); return Promise.resolve({}); } },
  });
  const prisma = {
    clarification: {
      findFirst: ({ where }: { where: { case?: { clientId?: { in: bigint[] } } } }) => {
        if (where.case?.clientId && !where.case.clientId.in.includes(clarState.clientId)) return Promise.resolve(null);
        return Promise.resolve({
          id: 7n,
          status: clarState.status,
          level: "L1",
          subject: "Verify pin",
          requestedDocumentType: null,
          submittedDocumentId: null,
          submittedDocumentVersion: null,
          reverificationRequired: false,
          checkId: null,
          raisedById: 21n,
          case: {
            id: 50n, publicId: "case-50", caseNumber: "SG-50", status: "DOCUMENT_PENDING",
            branchId: null, clientId: 40n, assignedOpsUserId: 99n, workflowVersion: 2, intakeStage: "INTAKE", dataEntryUserId: null,
          },
        });
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(makeTx()),
  } as unknown as PrismaService;

  const svc = new ClarificationsService(prisma, {}, { promoteIfReady: () => Promise.resolve(false) });

  // Mapped RM resolves case assigned to user 99n -> succeeds and notifies Ops.
  const rmRes = await svc.resolve(rmAshish, "case-50", "clar-7", "Verified with client");
  assert.equal(rmRes.status, "RESOLVED");
  assert.ok(notifications.some((n) => n.userId === 21n && n.href === "/operations/clarifications"));
  assert.deepEqual(JSON.parse(String(audits[0]!.afterJson)).actorRoles, ["SPOC_RM"]);

  // Ops resolves -> notifies mapped RM (11n) with RM href.
  notifications.length = 0;
  await svc.resolve(opsUser, "case-50", "clar-7");
  assert.ok(notifications.some((n) => n.userId === 11n && n.href === "/spoc-rm/work?bucket=correction"));

  // Cross-client RM blocked (fail closed).
  clarState.clientId = 999n;
  await assert.rejects(() => svc.resolve(rmAshish, "case-50", "clar-7"), NotFoundException);

  // Concurrent race -> 409 ConflictException.
  clarState.clientId = 40n;
  clarState.updateCount = 0;
  await assert.rejects(() => svc.resolve(rmAshish, "case-50", "clar-7"), ConflictException);
});

void test("Shared L2 queue/handoff enforces branch scope, records RM attribution & opsReviewedBy, and prevents double handoff", async () => {
  const notifications: Array<Record<string, unknown>> = [];
  const messages: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const state = { clientId: 40n, updateCount: 1 };
  const branchOps = testActor(["OPS_MANAGER"], ["clarification:write"], { userId: 21n, branchId: 3n, displayName: "Branch Ops" });

  const txMock = {
    $executeRaw: () => Promise.resolve(1),
    clarification: { updateMany: () => Promise.resolve({ count: state.updateCount }) },
    verificationCase: {
      update: () => Promise.resolve({}),
      updateMany: () => Promise.resolve({ count: 1 }),
    },
    clarificationMessage: { create: (a: { data: Record<string, unknown> }) => { messages.push(a.data); return Promise.resolve({}); } },
    notification: {
      create: (a: { data: Record<string, unknown> }) => { notifications.push(a.data); return Promise.resolve({}); },
      createMany: (a: { data: Array<Record<string, unknown>> }) => { notifications.push(...a.data); return Promise.resolve({}); },
    },
    user: {
      findMany: (args: { where: { userRoles?: { some?: { role?: { code?: unknown } } }; spocClientScopes?: unknown } }) => {
        if (args.where.spocClientScopes) return Promise.resolve([{ id: 11n }]);
        if (typeof args.where.userRoles?.some?.role?.code === "string") return Promise.resolve([{ id: 21n }]);
        return Promise.resolve([]);
      },
    },
    auditEvent: { create: (a: { data: Record<string, unknown> }) => { audits.push(a.data); return Promise.resolve({}); } },
  };
  const deQueries: Array<Record<string, unknown>> = [];
  const prisma = {
    clarification: {
      findMany: () => Promise.resolve([{
        publicId: "clar-l2-9", status: "DATA_ENTRY_PENDING", level: "L2", subject: "Clear PAN",
        requestedDocumentType: "PAN", submittedDocumentVersion: 2, submittedDocumentId: 10n,
        opsReviewedById: 11n, opsReviewedAt: new Date(), opsReviewNote: "Looks sharp",
        dataEntryReviewedAt: null, dataEntryReviewNote: null, reentryCompletedAt: null,
        rejectionCount: 0, lastRejectedAt: null, lastRejectedReason: null, dueAt: null,
        createdAt: new Date(), updatedAt: new Date(), checkId: null,
        case: { publicId: "case-50", caseNumber: "SG-50", status: "IN_VERIFICATION", workflowVersion: 2, intakeStage: "VERIFICATION", subject: { fullName: "Ravi" }, client: { displayName: "Sapling Global" }, dataEntryUser: { publicId: "de-31", displayName: "Deepa DE" } },
        submittedDocument: { publicId: "doc-10", fileName: "pan.pdf", type: "PAN", verificationStatus: "PENDING", currentVersion: 2, versions: [] },
        messages: [],
      }]),
      findFirst: ({ where }: { where: { case?: { clientId?: { in: bigint[] } } } }) => {
        if (where.case?.clientId && !where.case.clientId.in.includes(state.clientId)) return Promise.resolve(null);
        return Promise.resolve({
          id: 9n, publicId: "clar-l2-9", level: "L2", status: "CANDIDATE_SUBMITTED", subject: "Clear PAN",
          submittedDocumentId: 10n, submittedDocumentVersion: 2, raisedById: 33n,
          case: { id: 50n, publicId: "case-50", caseNumber: "SG-50", branchId: 3n, clientId: 40n, assignedOpsUserId: 99n, dataEntryUserId: null },
        });
      },
    },
    user: {
      findMany: (args: { where: Record<string, unknown> }) => {
        if ((args.where as { userRoles?: unknown }).userRoles) deQueries.push(args.where);
        return Promise.resolve([{ id: 11n, publicId: "rm-11", displayName: "Ashish RM", branchId: 3n }, { id: 31n, publicId: "de-31", displayName: "Deepa DE", branchId: 3n }]);
      },
      findFirst: () => Promise.resolve({ id: 31n, publicId: "de-31", displayName: "Deepa DE" }),
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(txMock),
  } as unknown as PrismaService;

  const svc = new ClarificationL2OpsService(prisma);
  const queue = await svc.opsQueue(branchOps, {});
  assert.deepEqual(deQueries[0]!.OR, [{ branchId: 3n }, { branchId: null }]);
  assert.deepEqual(queue.items[0]!.opsReviewedBy, { id: "rm-11", displayName: "Ashish RM" });

  // Mapped RM hands off across non-assigned case -> DE & Ops notified, RM attribution in message & audit.
  const out = await svc.completeOpsReview(rmAshish, "clar-l2-9", { dataEntryUserId: "de-31" });
  assert.equal(out.status, "DATA_ENTRY_PENDING");
  assert.match(String(messages[0]!.body), /^RM \(Ashish RM\)/);
  assert.ok(notifications.some((n) => n.userId === 31n && String(n.href).startsWith("/data-entry")));
  assert.ok(notifications.some((n) => n.userId === 21n && n.href === "/operations/clarifications"));
  assert.deepEqual(JSON.parse(String(audits[0]!.afterJson)).actorRoles, ["SPOC_RM"]);

  // Unmapped client RM blocked.
  state.clientId = 999n;
  await assert.rejects(() => svc.completeOpsReview(rmAshish, "clar-l2-9", { dataEntryUserId: "de-31" }), NotFoundException);

  // Concurrent handoff -> 409 ConflictException.
  state.clientId = 40n;
  state.updateCount = 0;
  await assert.rejects(() => svc.completeOpsReview(opsUser, "clar-l2-9", { dataEntryUserId: "de-31" }), ConflictException);
});

void test("notifyClarificationStakeholders routes Ops and mapped RMs to portal-specific hrefs without self-notification", async () => {
  const created: Array<{ userId: bigint; href: string }> = [];
  const tx = {
    user: {
      findMany: (args: { where: { userRoles?: { some?: { role?: { code?: unknown } } }; spocClientScopes?: unknown } }) => {
        if (args.where.spocClientScopes) return Promise.resolve([{ id: 11n }, { id: 12n }]);
        return Promise.resolve([{ id: 21n }, { id: 11n }]);
      },
    },
    notification: { createMany: (a: { data: Array<{ userId: bigint; href: string }> }) => { created.push(...a.data); return Promise.resolve({}); } },
  } as never;

  await notifyClarificationStakeholders(tx, {
    tenantId: 7n,
    clientId: 40n,
    excludeUserId: 11n,
    type: "CLARIFICATION_RESPONDED",
    title: "Response received",
    body: "Candidate replied",
    opsHref: "/operations/clarifications",
    rmHref: "/spoc-rm/work?bucket=correction",
  });

  assert.equal(created.some((n) => n.userId === 11n), false);
  assert.equal(created.find((n) => n.userId === 21n)?.href, "/operations/clarifications");
  assert.equal(created.find((n) => n.userId === 12n)?.href, "/spoc-rm/work?bucket=correction");
});
