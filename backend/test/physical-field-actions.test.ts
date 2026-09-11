import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { QaService } from "../src/qa/qa.service";
import { fieldQaWhere } from "../src/field-visits/physical-field-policy";
import { FieldVisitAssignmentService } from "../src/field-visits/field-visit-assignment.service";
import { CasesService } from "../src/cases/cases.service";
import type { CaseReaderService } from "../src/cases/case-reader.service";
import type { CaseWorkflowPolicy } from "../src/cases/case-workflow.policy";
import type { SubjectPiiService } from "../src/common/security/subject-pii.service";
import type { ConsentIssuanceService } from "../src/consents/consent-issuance.service";

const actor = {
  tenantId: 1n,
  userId: 2n,
  userPublicId: "operator",
  roles: ["OPS_MANAGER"],
  permissions: ["*"],
} as unknown as Actor;
void test("direct QA claim cannot bypass the physical gate or emit a successful audit", async () => {
  const db = {
    verificationCase: {
      findFirst: () => ({
        id: 1n,
        status: "QA_REVIEW",
        version: 4,
        qaReviewerId: null,
        qaClaimedAt: null,
      }),
      updateMany: (input: { where: { AND: unknown[] } }) => {
        assert.deepEqual(input.where.AND, [fieldQaWhere()]);
        return { count: 0 };
      },
    },
    auditEvent: {
      create: () => {
        assert.fail("No audit for a blocked claim");
      },
    },
    $transaction: (work: (tx: unknown) => unknown) => work(db),
  } as unknown as PrismaService;
  await assert.rejects(
    new QaService(db).claim(actor, "case-1", 4),
    /required field verification is incomplete/,
  );
});

void test("field assignment locks the case before creating a visit and loses safely to a QA transition", async () => {
  const writes: string[] = [];
  let canLock = false;
  const db = {
    verificationCase: {
      findFirst: () => ({
        id: 1n,
        publicId: "case-1",
        caseNumber: "CASE-1",
        status: "IN_PROGRESS",
        branchId: null,
        clientId: 5n,
      }),
      updateMany: () => {
        writes.push("lock");
        return { count: canLock ? 1 : 0 };
      },
    },
    user: { findFirst: () => ({ id: 3n }) },
    tenantFieldPolicy: {
      findUnique: () => ({ defaultRadiusMeters: 150 }),
    },
    fieldVisit: {
      create: () => {
        writes.push("visit");
        return {
          publicId: "visit-1",
          status: "ASSIGNED",
          address: "Test address",
          version: 1,
          geofenceMeters: 150,
        };
      },
    },
    notification: {
      create: () => {
        writes.push("notification");
      },
    },
    auditEvent: {
      create: () => {
        writes.push("audit");
      },
    },
    $transaction: (work: (tx: unknown) => unknown) => work(db),
  } as unknown as PrismaService;
  const input = {
    assigneeId: "field-1",
    address: "Test address",
    latitude: 28,
    longitude: 77,
  };
  await assert.rejects(
    new FieldVisitAssignmentService(db).create(actor, "case-1", input),
    /Case stage changed/,
  );
  assert.deepEqual(writes, ["lock"]);
  canLock = true;
  writes.length = 0;
  await new FieldVisitAssignmentService(db).create(actor, "case-1", input);
  assert.deepEqual(writes, ["lock", "visit", "notification", "audit"]);
});

void test("returning an existing QA case clears its claim and retains a reasoned status history", async () => {
  let saved: Record<string, unknown> | undefined;
  let history: Record<string, unknown> | undefined;
  let audited = false;
  const db = {
    verificationCase: {
      findFirst: () => ({
        id: 1n,
        caseNumber: "CASE-1",
        status: "QA_REVIEW",
        version: 8,
      }),
      updateMany: (input: { data: Record<string, unknown> }) => {
        saved = input.data;
        return { count: 1 };
      },
    },
    caseStatusHistory: {
      create: (input: { data: Record<string, unknown> }) => {
        history = input.data;
      },
    },
    auditEvent: {
      create: () => {
        audited = true;
      },
    },
    outboxEvent: { create: () => ({}) },
    $transaction: (work: (tx: unknown) => unknown) => work(db),
  } as unknown as PrismaService;
  const service = new CasesService(
    db,
    { assertAllowed: async () => {} } as unknown as CaseWorkflowPolicy,
    { get: () => ({}) } as unknown as CaseReaderService,
    {} as SubjectPiiService,
    {} as ConsentIssuanceService,
  );
  await service.transition(actor, "case-1", {
    status: "IN_PROGRESS",
    version: 8,
    reason: "Physical visit required before QA",
  });
  assert.equal(saved?.qaReviewerId, null);
  assert.equal(saved?.qaClaimedAt, null);
  assert.equal(history?.fromStatus, "QA_REVIEW");
  assert.equal(history?.toStatus, "IN_PROGRESS");
  assert.equal(history?.reason, "Physical visit required before QA");
  assert.equal(audited, true);
});
