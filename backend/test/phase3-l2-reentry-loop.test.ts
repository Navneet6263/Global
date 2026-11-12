import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { test } from "node:test";
import { ClarificationL2ReentryService } from "../src/clarifications/clarification-l2-reentry.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { ContentInspectionService } from "../src/documents/content-inspection.service";
import { DocumentsService } from "../src/documents/documents.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import type { QaReadinessService } from "../src/verification/qa-readiness.service";
import { TaskContextService } from "../src/verification/task-context.service";
import { TaskQueryService } from "../src/verification/task-query.service";
import { bigJson, testActor } from "./helpers/test-actor";
import { config, pii, secrets } from "./helpers/reupload-fixtures";

const ok = <T>(value: T) => Promise.resolve(value);
const deActor = testActor(["DATA_ENTRY"], ["clarification:read", "clarification:write", "document:read"], { userId: 41n });
const verifierActor = testActor(["VERIFIER"], ["task:read"], { userId: 21n });
const qaStub = { check: () => ok({ ready: false, missing: [] }), promoteIfReady: () => ok(false) } as unknown as QaReadinessService;

void test("Data Entry queue exposes check initiation/dependents and DocumentsService allows L2 DATA_ENTRY_PENDING preview", async () => {
  const prisma = {
    clarification: {
      findMany: () => ok([{
        publicId: "clar-l2-1", status: "DATA_ENTRY_PENDING", level: "L2", subject: "EMPLOYMENT DETAILS WRONG",
        caseId: 81n, checkId: 91n, requestedDocumentType: "EMPLOYMENT_PROOF", submittedDocumentVersion: 2,
        opsReviewedAt: new Date(), opsReviewNote: "Verified", rejectionCount: 0, lastRejectedAt: null,
        lastRejectedReason: null, dueAt: null, createdAt: new Date(), updatedAt: new Date(),
        case: { publicId: "case-1", caseNumber: "SG-0727E3", status: "CLARIFICATION_PENDING", workflowVersion: 2, intakeStage: null, branchId: null, clientId: 21n, dataEntryUserId: 41n, subject: { publicId: "sub-1", fullName: "Nikhil" }, client: { publicId: "cli-1", displayName: "Sapling" } },
        submittedDocument: { publicId: "doc-emp", type: "EMPLOYMENT_PROOF", status: "VERIFIED", currentVersion: 1, versions: [{ version: 2, originalName: "v2.pdf", contentType: "application/pdf", sizeBytes: 120n, malwareState: "CLEAN", reviewStatus: "PENDING", reviewNote: null, reviewedAt: null, createdAt: new Date() }] },
        messages: [],
      }]),
    },
    caseCheck: {
      findMany: (args: { select?: Record<string, unknown> }) => ok(args.select?.methodRuns
        ? [{ id: 92n, publicId: "chk-pan", type: "PAN_VALIDATION", status: "COMPLETED", result: "CLEAR", riskLevel: "LOW", sourceSummary: "ok", dueAt: null, tasks: [], methodRuns: [{ evidenceJson: JSON.stringify([{ documentId: "doc-emp", version: 1 }]) }] }]
        : [{ id: 91n, publicId: "chk-emp", type: "EMPLOYMENT", status: "IN_PROGRESS", initiationJson: JSON.stringify({ entries: [{ employerName: "Old Corp", empCode: "E1", tenureFrom: "2022-01-01", tenureTo: "2023-01-01" }] }), initiatedAt: new Date() }]),
    },
  } as unknown as PrismaService;

  const svc = new ClarificationL2ReentryService(prisma, qaStub, secrets, pii, config);
  const q = await svc.queue(deActor, {});
  assert.equal(q.items.length, 1);
  assert.equal(q.items[0].check?.entries[0].employerName, "Old Corp");
  assert.equal(q.items[0].dependentChecks.count, 1);
  assert.equal(q.items[0].dependentChecks.items[0].willReopen, true);

  let findCalls = 0;
  let secondWhere = "";
  const docPrisma = {
    documentVersion: {
      findFirst: (args: { where: unknown }) => {
        findCalls += 1;
        if (findCalls === 1) return ok(null);
        secondWhere = bigJson(args.where);
        return ok({ objectKey: "ten/case/doc/v2", originalName: "v2.pdf", contentType: "application/pdf", version: 2, document: { type: "EMPLOYMENT_PROOF", currentVersion: 1, case: { publicId: "case-1", caseNumber: "SG-0727E3" } } });
      },
    },
    auditEvent: { create: () => ok({}) },
  } as unknown as PrismaService;
  const storage = { auditedStream: async (_key: string, audit: () => Promise<unknown>) => { await audit(); return Buffer.from("pdf"); } } as unknown as LocalObjectStorageService;
  const docs = new DocumentsService(docPrisma, new ConfigService(), {} as ContentInspectionService, storage);
  const stream = await docs.download(deActor, "doc-emp", "preview", { version: 2 });
  assert.equal(findCalls, 2);
  assert.ok(secondWhere.includes("DATA_ENTRY_PENDING"));
  assert.ok(stream.file);
});

void test("Data Entry rejectDocument preserves v1 baseline, emits one candidate notice, and deduplicates staff alerts", async () => {
  const versionUpdates: Array<Record<string, unknown>> = [];
  let portalLinks = 0;
  const emailAggregateTypes: string[] = [];
  const notifiedUsers: bigint[] = [];
  const docStatusUpdates: number[] = [];
  const tx = {
    verificationCase: {
      updateMany: () => ok({ count: 1 }),
      findUniqueOrThrow: () => ok({
        publicId: "case-1", caseNumber: "SG-0727E3", clientId: 21n,
        subject: { fullName: "Nikhil Ranjan", email: "nikhil@example.com", phone: null, employeeCode: null, piiCiphertext: null, piiKeyVersion: 1 },
      }),
    },
    clarification: { updateMany: () => ok({ count: 1 }) },
    documentVersion: { updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => { versionUpdates.push({ ...args.where, ...args.data }); return ok({ count: 1 }); } },
    document: { update: () => { docStatusUpdates.push(1); return ok({}); } },
    clarificationMessage: { create: () => ok({}) },
    candidatePortalAccess: { updateMany: () => ok({ count: 0 }), create: () => { portalLinks += 1; return ok({ publicId: "acc-fresh" }); } },
    outboxEvent: { create: (args: { data: { aggregateType: string } }) => { emailAggregateTypes.push(args.data.aggregateType); return ok({ id: 1n }); } },
    user: { findMany: () => ok([{ id: 31n, email: "ops@example.com" }]) },
    checkTask: { findFirst: () => ok({ assigneeId: 21n }) },
    notification: {
      createMany: (args: { data: Array<{ type: string; userId: bigint }> }) => {
        for (const n of args.data) if (n.type === "CLARIFICATION_DOCUMENT_REJECTED") notifiedUsers.push(n.userId);
        return ok({ count: args.data.length });
      },
    },
    auditEvent: { create: () => ok({}) },
  };
  const prisma = {
    clarification: {
      findFirst: () => ok({
        id: 601n, publicId: "clar-l2-1", level: "L2", status: "DATA_ENTRY_PENDING",
        subject: "EMPLOYMENT DETAILS WRONG", checkId: 91n, raisedById: 21n, opsReviewedById: 31n,
        rejectionCount: 0, submittedDocumentVersion: 2,
        submittedDocument: { id: 701n, publicId: "doc-emp", type: "EMPLOYMENT_PROOF", status: "VERIFIED", currentVersion: 1 },
        case: { id: 81n, publicId: "case-1", status: "CLARIFICATION_PENDING", caseNumber: "SG-0727E3", branchId: null, clientId: 21n, workflowVersion: 2, intakeStage: null, dataEntryUserId: 41n, assignedOpsUserId: 31n },
      }),
    },
    $transaction: <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as PrismaService;
  const reentry = new ClarificationL2ReentryService(prisma, qaStub, secrets, pii, config);

  await assert.rejects(() => reentry.rejectDocument(deActor, "clar-l2-1", { reason: "bad" }), BadRequestException);
  const res = await reentry.rejectDocument(deActor, "clar-l2-1", { documentVersion: 2, reason: "Page 2 salary slip is cropped" });
  assert.equal(res.status, "OPEN");
  assert.equal(res.rejectionCount, 1);
  assert.equal(res.preservedVerifiedBaseline, true);
  assert.equal(docStatusUpdates.length, 0);
  assert.equal(versionUpdates[0].version, 2);
  assert.equal(versionUpdates[0].reviewStatus, "REJECTED");
  assert.equal(portalLinks, 1);
  assert.equal(emailAggregateTypes.filter((t) => t === "candidate-portal-access").length, 1);
  assert.deepEqual(notifiedUsers.sort((a, b) => Number(a - b)), [21n, 31n]);
});

void test("Data Entry completeReentry accepts v3, preserves v1/v2 history, updates initiationJson, selectively reopens dependents, and surfaces to Verifier", async () => {
  let completed = false;
  let promotedVersion: number | undefined;
  let updatedInitiation: string | undefined;
  const taskInstructionsByCheck = new Map<bigint, string>();
  let resumedCaseStatus: string | undefined;
  const reopenedDependents: bigint[] = [];
  const versionWrites: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  const tx = {
    verificationCase: {
      updateMany: (args: { data: { status?: string } }) => { if (args.data.status) resumedCaseStatus = args.data.status; return ok({ count: 1 }); },
      update: (args: { data: { status?: string } }) => { if (args.data.status) resumedCaseStatus = args.data.status; return ok({}); },
    },
    documentVersion: {
      findFirst: () => ok({ malwareState: "CLEAN", reviewStatus: "PENDING" }),
      updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => { versionWrites.push(args); return ok({ count: 1 }); },
    },
    clarification: { updateMany: () => ok({ count: 1 }), count: () => ok(0) },
    document: { update: (args: { data: { currentVersion: number } }) => { promotedVersion = args.data.currentVersion; return ok({}); } },
    caseCheck: {
      findMany: (args: { include?: { tasks?: unknown }; select?: { methodRuns?: unknown } }) => {
        if (args.include?.tasks) return ok([{ id: 91n, dueAt: new Date(), tasks: [{ id: 301n, status: "IN_PROGRESS", assigneeId: 21n }] }]);
        if (args.select?.methodRuns) return ok([
          { id: 92n, publicId: "chk-pan", type: "PAN_VALIDATION", status: "COMPLETED", result: "CLEAR", riskLevel: "LOW", sourceSummary: "ok", dueAt: null, tasks: [{ id: 302n, publicId: "tsk-2", assigneeId: 22n, status: "COMPLETED" }], methodRuns: [{ evidenceJson: JSON.stringify([{ documentId: "doc-emp", version: 1 }]) }] },
          { id: 93n, publicId: "chk-edu", type: "EDUCATION", status: "COMPLETED", result: "CLEAR", riskLevel: "LOW", sourceSummary: "ok", dueAt: null, tasks: [], methodRuns: [{ evidenceJson: JSON.stringify([{ documentId: "doc-other", version: 1 }]) }] },
        ]);
        return ok([{ riskLevel: null, result: null }]);
      },
      update: (args: { where: { id: bigint }; data: { initiationJson?: string; disposition?: unknown; result?: unknown } }) => {
        if (args.where.id === 91n && args.data.initiationJson) {
          updatedInitiation = args.data.initiationJson;
          assert.equal(args.data.result, undefined);
        } else if (args.where.id === 91n) {
          assert.equal(args.data.disposition, null);
        }
        if (args.where.id === 92n) reopenedDependents.push(92n);
        if (args.where.id === 93n) reopenedDependents.push(93n);
        return ok({});
      },
    },
    verificationMethodRun: { findMany: () => ok([]), updateMany: () => ok({ count: 0 }), create: () => ok({}) },
    checkTask: {
      findFirst: () => ok({ id: 301n, status: "IN_PROGRESS", assigneeId: 21n, dueAt: new Date() }),
      update: (args: { data: { checkId?: bigint; instructions?: string } }) => {
        if (args.data.checkId && args.data.instructions) taskInstructionsByCheck.set(args.data.checkId, args.data.instructions);
        return ok({ publicId: "tsk-1", status: "OPEN" });
      },
      create: (args: { data: { checkId?: bigint; instructions?: string } }) => {
        if (args.data.checkId && args.data.instructions) taskInstructionsByCheck.set(args.data.checkId, args.data.instructions);
        return ok({ publicId: "tsk-2", status: "OPEN" });
      },
    },
    user: { findFirst: () => ok({ id: 22n }) },
    notification: { create: () => ok({}), createMany: () => ok({ count: 1 }) },
    caseStatusHistory: { create: () => ok({}) },
    clarificationMessage: { create: () => ok({}) },
    auditEvent: { create: () => ok({}) },
  };
  const prisma = {
    clarification: {
      findFirst: () => ok({
        id: 601n, publicId: "clar-l2-1", level: "L2",
        status: completed ? "RESOLVED" : "DATA_ENTRY_PENDING",
        subject: "EMPLOYMENT DETAILS WRONG", checkId: 91n, raisedById: 21n, opsReviewedById: 31n,
        rejectionCount: 1, submittedDocumentVersion: 3,
        submittedDocument: { id: 701n, publicId: "doc-emp", type: "EMPLOYMENT_PROOF", status: "VERIFIED", currentVersion: 1 },
        case: { id: 81n, publicId: "case-1", status: "CLARIFICATION_PENDING", caseNumber: "SG-0727E3", branchId: null, clientId: 21n, workflowVersion: 2, intakeStage: null, dataEntryUserId: 41n, assignedOpsUserId: 31n },
      }),
    },
    caseCheck: { findUniqueOrThrow: () => ok({ type: "EMPLOYMENT" }) },
    $transaction: <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as PrismaService;

  const reentry = new ClarificationL2ReentryService(prisma, qaStub, secrets, pii, config);
  const out = await reentry.completeReentry(deActor, "clar-l2-1", {
    documentVersion: 3,
    entries: [{ employerName: "Acme Corp Ltd", tenureFrom: "2023-01-01", tenureTo: "2025-10-31", empCode: "EMP-9921" }],
  });
  completed = true;
  assert.equal(out.status, "RESOLVED");
  assert.equal(promotedVersion, 3);
  assert.equal(resumedCaseStatus, "IN_PROGRESS");
  assert.ok(updatedInitiation?.includes("Acme Corp Ltd"));
  const empInstructions = taskInstructionsByCheck.get(91n);
  assert.ok(empInstructions?.startsWith("All details re-entered by Data Entry"));
  assert.ok(taskInstructionsByCheck.get(92n)?.includes("shared employment proof updated to v3"));
  assert.deepEqual(reopenedDependents, [92n]);
  assert.equal(versionWrites[0].where.version, 3);
  assert.equal(versionWrites[0].data.reviewStatus, "VERIFIED");
  assert.equal(versionWrites[1].where.reviewStatus, "PENDING");
  assert.equal(versionWrites[1].data.reviewStatus, "SUPERSEDED");
  await assert.rejects(() => reentry.completeReentry(deActor, "clar-l2-1", { documentVersion: 3 }), ConflictException);

  const taskQueryPrisma = {
    checkTask: {
      findMany: () => ok([{
        publicId: "tsk-1", status: "OPEN", instructions: empInstructions, dueAt: new Date(),
        startedAt: null, completedAt: null, blockerReason: null, blockedAt: null, version: 2,
        check: {
          id: 91n, publicId: "chk-1", type: "EMPLOYMENT", status: "IN_PROGRESS",
          initiationJson: updatedInitiation, initiatedAt: new Date(),
          department: null, result: null, riskLevel: null, sourceSummary: null, findings: [],
          case: {
            publicId: "case-1", caseNumber: "SG-0727E3", priority: "NORMAL",
            subject: { publicId: "sub-1", fullName: "Nikhil" }, client: { publicId: "cli-1", displayName: "Sapling" },
            clarifications: [{ publicId: "clar-l2-1", level: "L2", status: "RESOLVED", subject: "EMPLOYMENT DETAILS WRONG", checkId: 91n, requestedDocumentType: "EMPLOYMENT_PROOF", submittedDocumentVersion: 3, opsReviewedAt: new Date(), reentryCompletedAt: new Date(), rejectionCount: 1, lastRejectedReason: "Cropped", dueAt: null, createdAt: new Date() }],
          },
        },
      }]),
      count: () => ok(1),
    },
  } as unknown as PrismaService;
  const mine = await new TaskQueryService(taskQueryPrisma).mine(verifierActor, { limit: 10 });
  assert.equal(mine.items[0].check.initiationJson, updatedInitiation);
  assert.equal(mine.items[0].check.clarifications[0].rejectionCount, 1);

  const ctxPrisma = {
    checkTask: {
      findFirst: () => ok({
        publicId: "tsk-1", createdAt: new Date(), startedAt: null, blockedAt: null, completedAt: null,
        check: {
          id: 91n, publicId: "chk-1", type: "EMPLOYMENT", initiationJson: updatedInitiation, initiatedAt: new Date(), department: null,
          case: {
            publicId: "case-1", caseNumber: "SG-0727E3", status: "IN_PROGRESS", priority: "NORMAL", dueAt: null,
            subject: { publicId: "sub-1", fullName: "Nikhil", email: null, phone: null, employeeCode: null },
            client: { publicId: "cli-1", displayName: "Sapling" }, branch: null, servicePackage: null, consents: [],
            documents: [{ publicId: "doc-emp", type: "EMPLOYMENT_PROOF", status: "VERIFIED", currentVersion: 3, versions: [{ version: 3, originalName: "v3.pdf", contentType: "application/pdf", sizeBytes: 100n, sha256: "a", malwareState: "CLEAN", reviewStatus: "VERIFIED", reviewNote: "ok", reviewedAt: new Date(), createdAt: new Date() }] }],
            clarifications: [{ publicId: "clar-l2-1", level: "L2", status: "RESOLVED", subject: "EMPLOYMENT DETAILS WRONG", checkId: 91n, requestedDocumentType: "EMPLOYMENT_PROOF", submittedDocumentVersion: 3, submittedDocument: { publicId: "doc-emp", type: "EMPLOYMENT_PROOF", status: "VERIFIED", currentVersion: 3 }, opsReviewedAt: new Date(), reentryCompletedAt: new Date(), rejectionCount: 1, lastRejectedReason: "Cropped", dueAt: null, createdAt: new Date() }],
            statusHistory: [],
          },
        },
      }),
    },
  } as unknown as PrismaService;
  const ctx = await new TaskContextService(ctxPrisma).get(verifierActor, "tsk-1");
  assert.equal(ctx.check.case.clarifications[0].isForCurrentCheck, true);
  assert.equal(ctx.check.case.documents[0].versions[0].reviewStatus, "VERIFIED");
});
