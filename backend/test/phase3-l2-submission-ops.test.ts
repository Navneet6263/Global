import "reflect-metadata";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { test } from "node:test";
import type { FastifyRequest } from "fastify";
import { digestPortalToken } from "../src/candidate-portal/candidate-access-authorizer";
import { CandidatePortalService } from "../src/candidate-portal/candidate-portal.service";
import { ROLES_KEY } from "../src/common/auth/auth.decorators";
import { readUploadedMultipart } from "../src/common/http/uploaded-binary";
import { ClarificationL2OpsService } from "../src/clarifications/clarification-l2-ops.service";
import { ClarificationL2SubmissionService } from "../src/clarifications/clarification-l2-submission.service";
import { ClarificationsController } from "../src/clarifications/clarifications.controller";
import { ClarificationsService } from "../src/clarifications/clarifications.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { ContentInspectionService } from "../src/documents/content-inspection.service";
import type { DocumentsService } from "../src/documents/documents.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import type { RequesterSupportRequestsService } from "../src/support/services/requester-support-requests.service";
import type { QaReadinessService } from "../src/verification/qa-readiness.service";
import { config, pii, secrets } from "./helpers/reupload-fixtures";
import { testActor } from "./helpers/test-actor";

const ok = <T>(value: T) => Promise.resolve(value);
const verifier = testActor(["VERIFIER"], ["case:read", "clarification:write"], { userId: 21n });
const opsActor = testActor(["OPS_MANAGER"], ["clarification:read", "clarification:write"], { userId: 31n });
const qaStub = { check: () => ok({ ready: false, missing: [] }) } as unknown as QaReadinessService;
const inspectStub = { inspect: () => ok(undefined) } as unknown as ContentInspectionService;

void test("Verifier raises L2 insufficiency with requestedDocumentType and blocks active duplicates while keeping L1", async () => {
  let createdData: Record<string, unknown> | undefined;
  let existingConflict: Record<string, unknown> | null = null;
  let caseStatus = "IN_PROGRESS";
  const tx = {
    verificationCase: {
      updateMany: () => ok({ count: 1 }),
      update: () => ok({}),
      findUniqueOrThrow: () => ok({
        publicId: "case-1", caseNumber: "SG-0727E3", clientId: 21n,
        subject: { fullName: "Nikhil", email: "n@example.com", phone: null, employeeCode: null, piiCiphertext: null, piiKeyVersion: 1 },
      }),
    },
    caseCheck: { findUniqueOrThrow: () => ok({ type: "EMPLOYMENT", reviewCycle: 1 }) },
    caseCheckRequirement: { findMany: () => ok([]) },
    servicePackageDocument: { findMany: () => ok([]) },
    clarification: {
      findFirst: () => ok(existingConflict),
      create: (args: { data: Record<string, unknown> }) => {
        createdData = args.data;
        return ok({ publicId: "c-l2-1", status: "OPEN", ...args.data, createdAt: new Date() });
      },
    },
    candidatePortalAccess: { updateMany: () => ok({ count: 0 }), create: () => ok({ publicId: "acc-1" }) },
    user: { findMany: () => ok([]) },
    notification: { createMany: () => ok({ count: 0 }) },
    outboxEvent: { create: () => ok({ id: 1n }) },
    caseStatusHistory: { create: () => ok({}) },
    auditEvent: { create: () => ok({}) },
  };
  const prisma = {
    verificationCase: {
      findFirst: () => ok({ id: 81n, status: caseStatus, workflowVersion: 2, intakeStage: null, dataEntryUserId: 41n }),
    },
    caseCheck: { findFirst: () => ok({ id: 91n, type: "EMPLOYMENT", reviewCycle: 1 }) },
    $transaction: <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as PrismaService;
  const service = new ClarificationsService(prisma, {} as never, qaStub, secrets, pii, config);

  const l2 = await service.create(verifier, "case-1", {
    checkId: "chk-emp",
    subject: "EMPLOYMENT DETAILS WRONG",
    message: "Upload updated relieving letter",
    requestedDocumentType: "EMPLOYMENT_PROOF",
  });
  assert.equal(l2.level, "L2");
  assert.equal(createdData?.requestedDocumentType, "EMPLOYMENT_PROOF");

  await assert.rejects(
    () => service.create(verifier, "case-1", {
      checkId: "chk-emp",
      subject: "Wrong type",
      message: "Need education cert",
      requestedDocumentType: "EDUCATION_CERTIFICATE",
    }),
    BadRequestException,
  );
  existingConflict = { publicId: "c-l2-1", checkId: 91n, requestedDocumentType: "EMPLOYMENT_PROOF" };
  await assert.rejects(
    () => service.create(verifier, "case-1", {
      checkId: "chk-emp",
      subject: "Duplicate",
      message: "Another active L2",
      requestedDocumentType: "EMPLOYMENT_PROOF",
    }),
    ConflictException,
  );

  existingConflict = null;
  caseStatus = "DOCUMENT_PENDING";
  const l1 = await service.create(opsActor, "case-1", {
    subject: "Clear copy needed",
    message: "Please re-upload",
  });
  assert.equal(l1.level, "L1");
});

void test("Candidate L2 submission preserves v1 VERIFIED baseline, records v2 PENDING, and blocks bypasses", async () => {
  const token = "candidate-secret-portal-token";
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  let clarStatus = "OPEN";
  let versionCreated: Record<string, unknown> | undefined;
  let docUpdateData: Record<string, unknown> | undefined;
  let clarUpdateData: Record<string, unknown> | undefined;
  const opsNotifs: Array<Record<string, unknown>> = [];
  const outboxTopics: string[] = [];
  let leaseCancelled = false;

  const accessRow = {
    id: 501n, publicId: "acc-1", tenantId: 7n, caseId: 81n,
    tokenHash: digestPortalToken(token), expiresAt: new Date(Date.now() + 60_000),
    completedAt: null, revokedAt: null,
    tenant: { publicId: "ten-1" },
    case: {
      publicId: "case-1", caseNumber: "SG-0727E3", status: "CLARIFICATION_PENDING",
      branchId: null, clientId: 21n, assignedOpsUserId: 31n, dueAt: new Date(),
      subject: { fullName: "Nikhil Ranjan" }, client: { displayName: "Sapling Global" },
      consents: [{ status: "ACCEPTED" }], checks: [{ id: 91n, publicId: "chk-1", type: "EMPLOYMENT", status: "IN_PROGRESS" }],
      documents: [{ id: 701n, type: "EMPLOYMENT_PROOF", status: "VERIFIED", currentVersion: 1, reviewNote: null, expiresAt: null }],
      clarifications: [{
        id: 601n, publicId: "clar-l2-1", level: "L2", subject: "EMPLOYMENT DETAILS WRONG",
        status: "OPEN", dueAt: null, requestedDocumentType: "EMPLOYMENT_PROOF",
        submittedDocumentVersion: null, submittedDocument: null, rejectionCount: 0,
        lastRejectedAt: null, lastRejectedReason: null, opsReviewedAt: null, reentryCompletedAt: null,
        messages: [],
      }],
      reports: [],
    },
  };
  const tx = {
    verificationCase: { updateMany: () => ok({ count: 1 }) },
    documentVersion: {
      findFirst: () => ok(null),
      aggregate: () => ok({ _max: { version: 1 } }),
      create: (args: { data: Record<string, unknown> }) => {
        versionCreated = args.data;
        return ok({ ...args.data, createdAt: new Date() });
      },
    },
    document: {
      findFirst: () => ok({ id: 701n, publicId: "doc-emp", status: "VERIFIED", currentVersion: 1, version: 3 }),
      updateMany: (args: { data: Record<string, unknown> }) => { docUpdateData = args.data; return ok({ count: 1 }); },
    },
    clarification: {
      updateMany: (args: { data: Record<string, unknown> }) => { clarUpdateData = args.data; clarStatus = "CANDIDATE_SUBMITTED"; return ok({ count: 1 }); },
    },
    clarificationMessage: { create: () => ok({}) },
    outboxEvent: {
      updateMany: () => { leaseCancelled = true; return ok({ count: 1 }); },
      create: (args: { data: { topic: string } }) => { outboxTopics.push(args.data.topic); return ok({ id: 1n }); },
    },
    user: { findMany: () => ok([{ id: 31n }, { id: 31n }, { id: 32n }]) },
    notification: { createMany: (args: { data: Array<Record<string, unknown>> }) => { opsNotifs.push(...args.data); return ok({ count: args.data.length }); } },
    auditEvent: { create: () => ok({}) },
  };
  const prisma = {
    candidatePortalAccess: { findUnique: () => ok(accessRow) },
    caseCheck: { findUnique: () => ok({ type: "EMPLOYMENT" }), findMany: () => ok([{ type: "EMPLOYMENT" }]) },
    caseCheckRequirement: { findMany: () => ok([]) },
    servicePackageDocument: { findMany: () => ok([]) },
    clarification: {
      findFirst: () => ok({
        id: 601n, publicId: "clar-l2-1", level: "L2", status: clarStatus,
        subject: "EMPLOYMENT DETAILS WRONG", checkId: 91n, requestedDocumentType: "EMPLOYMENT_PROOF",
        submittedDocumentId: 701n, submittedDocumentVersion: 2, reverificationRequired: true,
        case: { id: 81n, publicId: "case-1", status: "CLARIFICATION_PENDING", branchId: null, clientId: 21n, caseNumber: "SG-0727E3", workflowVersion: 2, intakeStage: null, dataEntryUserId: 41n },
      }),
    },
    document: { findFirst: () => ok({ id: 701n, publicId: "doc-emp", currentVersion: 1 }) },
    documentVersion: { findFirst: () => ok(null), aggregate: () => ok({ _max: { version: 1 } }) },
    outboxEvent: { create: () => ok({ id: 99n }) },
    $transaction: <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as PrismaService;
  const storage = { put: () => ok("key"), remove: () => ok(undefined) } as unknown as LocalObjectStorageService;
  const subService = new ClarificationL2SubmissionService(prisma, config, inspectStub, storage);

  const file = { buffer: pdf, mimetype: "application/pdf", originalName: "relieving-v2.pdf", size: pdf.length };
  const result = await subService.submit("acc-1", token, "clar-l2-1", file, { message: "Corrected relieving letter attached" });
  assert.equal(result.status, "CANDIDATE_SUBMITTED");
  assert.equal(result.submittedDocumentVersion, 2);
  assert.equal(result.preservedBaseline, true);
  assert.equal(versionCreated?.reviewStatus, "PENDING");
  assert.equal(versionCreated?.clarificationId, 601n);
  assert.equal(docUpdateData?.currentVersion, undefined);
  assert.equal(clarUpdateData?.submittedDocumentVersion, 2);
  assert.equal(opsNotifs.length, 2);
  assert.ok(outboxTopics.includes("clarification.responded"));
  assert.equal(leaseCancelled, true);

  await assert.rejects(() => subService.submit("acc-1", token, "clar-l2-1", file, { message: "Retry" }), ConflictException);
  await assert.rejects(() => subService.submit("acc-1", "wrong-token", "clar-l2-1", file, { message: "Bad token" }), UnauthorizedException);

  const portal = new CandidatePortalService(prisma, {} as DocumentsService, config, secrets, pii, {} as RequesterSupportRequestsService);
  await assert.rejects(() => portal.respondToClarification("acc-1", token, "clar-l2-1", "Text only bypass"), ConflictException);
  const clarSvc = new ClarificationsService(prisma, {} as never, qaStub);
  await assert.rejects(() => clarSvc.resolve(opsActor, "case-1", "clar-l2-1", "bypass"), ConflictException);

  const multipartReq = {
    headers: { "x-content-sha256": sha256 },
    parts: async function* () {
      yield await ok({ type: "field", fieldname: "explanation", value: "Updated proof" });
      yield await ok({ type: "file", fieldname: "file", filename: "v2.pdf", mimetype: "application/pdf", file: { truncated: false }, toBuffer: () => ok(pdf) });
      yield await ok({ type: "field", fieldname: "documentType", value: "EMPLOYMENT_PROOF" });
    },
  } as unknown as FastifyRequest;
  const parsed = await readUploadedMultipart(multipartReq, 1_000_000);
  assert.equal(parsed.fields.explanation, "Updated proof");
  assert.equal(parsed.fields.documentType, "EMPLOYMENT_PROOF");
  assert.equal(parsed.file.size, pdf.length);
});

void test("Operations queue and handoff transition CANDIDATE_SUBMITTED -> DATA_ENTRY_PENDING without allowing SPOC_RM", async () => {
  let handoffCount = 0;
  let caseUpdateData: Record<string, unknown> | undefined;
  const tx = {
    verificationCase: { updateMany: () => ok({ count: 1 }), update: (args: { data: Record<string, unknown> }) => { caseUpdateData = args.data; return ok({}); } },
    clarification: { updateMany: () => { handoffCount += 1; return ok({ count: handoffCount === 1 ? 1 : 0 }); } },
    clarificationMessage: { create: () => ok({}) },
    notification: { create: () => ok({}) },
    auditEvent: { create: () => ok({}) },
  };
  const prisma = {
    clarification: {
      findFirst: () => ok({
        id: 601n, publicId: "clar-l2-1", level: "L2",
        status: handoffCount === 0 ? "CANDIDATE_SUBMITTED" : "DATA_ENTRY_PENDING",
        subject: "EMPLOYMENT DETAILS WRONG", submittedDocumentId: 701n, submittedDocumentVersion: 2,
        case: { id: 81n, publicId: "case-1", caseNumber: "SG-0727E3", dataEntryUserId: null },
      }),
    },
    user: { findFirst: () => ok({ id: 41n, publicId: "de-user-1", displayName: "DE Priya" }) },
    $transaction: <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as PrismaService;
  const opsSvc = new ClarificationL2OpsService(prisma);
  const done = await opsSvc.completeOpsReview(opsActor, "clar-l2-1", { dataEntryUserId: "de-user-1", note: "Legible" });
  assert.equal(done.status, "DATA_ENTRY_PENDING");
  assert.equal(caseUpdateData?.dataEntryUserId, 41n);
  assert.equal(caseUpdateData?.intakeStage, undefined);
  await assert.rejects(() => opsSvc.completeOpsReview(opsActor, "clar-l2-1", { dataEntryUserId: "de-user-1" }), ConflictException);

  const proto = ClarificationsController.prototype as unknown as Record<string, object>;
  const opsQueueRoles = Reflect.getMetadata(ROLES_KEY, proto.opsQueue) as string[];
  const opsCompleteRoles = Reflect.getMetadata(ROLES_KEY, proto.opsComplete) as string[];
  assert.deepEqual(opsQueueRoles, ["PLATFORM_ADMIN", "OPS_MANAGER"]);
  assert.deepEqual(opsCompleteRoles, ["PLATFORM_ADMIN", "OPS_MANAGER"]);
});
