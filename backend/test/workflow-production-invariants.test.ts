import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import { activeOperationsRecipients } from "../src/common/persistence/operations-recipients";
import { QaReadinessService } from "../src/verification/qa-readiness.service";
import { highestRisk } from "../src/verification/task-workflow.service";
import { validateAssignmentCheck } from "../src/verification/bulk-task-assignment.helpers";
import type { Prisma } from "../src/generated/prisma/client";
import { ConsentsService } from "../src/consents/consents.service";
import type { ConsentIssuanceService } from "../src/consents/consent-issuance.service";
import type { SubjectPiiService } from "../src/common/security/subject-pii.service";
import type { PrismaService } from "../src/database/prisma.service";
import { ClarificationsService } from "../src/clarifications/clarifications.service";
import type { ClarificationTokenService } from "../src/clarifications/clarification-token.service";

void test("empty verifier findings never manufacture a LOW risk", () => {
  assert.equal(highestRisk([]), undefined);
  assert.equal(
    highestRisk([
      {
        kind: "OTHER",
        severity: "LOW",
        title: "Low finding",
        description: "Low-severity factual finding",
      },
      {
        kind: "RECORD_FOUND",
        severity: "CRITICAL",
        title: "Critical finding",
        description: "Critical factual finding",
      },
    ]),
    "CRITICAL",
  );
});

void test("operations notification fallback cannot cross branch or client scope", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const tx = {
    user: {
      findMany: (input: Record<string, unknown>) => {
        calls.push(input);
        return Promise.resolve(calls.length === 1 ? [] : [{ id: 22n }]);
      },
    },
  } as unknown as Prisma.TransactionClient;

  const recipients = await activeOperationsRecipients(tx, {
    tenantId: 1n,
    branchId: 5n,
    clientId: 8n,
    assignedUserId: 20n,
  });
  assert.deepEqual(recipients, [{ id: 22n }]);
  const ownerWhere = calls[0]?.where as { AND: unknown[] };
  const fallbackWhere = calls[1]?.where as {
    OR: unknown[];
    AND: unknown[];
  };
  assert.equal(ownerWhere.AND.length, 2);
  assert.deepEqual(fallbackWhere.OR, [{ branchId: 5n }, { branchId: null }]);
  assert.equal(fallbackWhere.AND.length, 1);
});

void test("all completed checks promote a resolved clarification case to QA atomically", async () => {
  const writes: string[] = [];
  let recipientWhere: unknown;
  let notifications: Array<{ userId: bigint; href: string }> = [];
  const tx = {
    caseCheck: {
      count: () => Promise.resolve(0),
      findMany: () => Promise.resolve([]),
    },
    caseService: { findMany: () => Promise.resolve([]) },
    clarification: { count: () => Promise.resolve(0) },
    fieldVisit: { count: () => Promise.resolve(0) },
    verificationCase: {
      findUnique: () =>
        Promise.resolve({
          servicePackage: { requiredDocumentsJson: "[]" },
          documents: [],
        }),
      update: () => Promise.resolve({}),
      updateMany: () => {
        writes.push("case");
        return Promise.resolve({ count: 1 });
      },
    },
    caseStatusHistory: {
      create: () => {
        writes.push("history");
        return Promise.resolve({});
      },
    },
    outboxEvent: {
      create: () => {
        writes.push("outbox");
        return Promise.resolve({});
      },
    },
    user: {
      findMany: (input: { where: unknown }) => {
        recipientWhere = input.where;
        return Promise.resolve([
          { id: 30n, userRoles: [{ role: { code: "QA_REVIEWER" } }] },
          { id: 31n, userRoles: [{ role: { code: "OPS_MANAGER" } }] },
        ]);
      },
    },
    notification: {
      createMany: (input: {
        data: Array<{ userId: bigint; href: string }>;
      }) => {
        notifications = input.data;
        writes.push("notification");
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as Prisma.TransactionClient;
  const promoted = await new QaReadinessService().promoteIfReady(tx, {
    tenantId: 1n,
    caseId: 40n,
    casePublicId: "00000000-0000-4000-8000-000000000040",
    branchId: 5n,
    clientId: 8n,
    changedById: 10n,
    fromStatus: "CLARIFICATION_PENDING",
    reason: "All clarifications resolved",
  });
  assert.equal(promoted, true);
  assert.deepEqual(
    notifications.map(({ userId, href }) => ({ userId, href })),
    [
      { userId: 30n, href: "/qa-review" },
      { userId: 31n, href: "/operations/cases" },
    ],
  );
  assert.deepEqual(writes, ["case", "history", "outbox", "notification"]);
  assert.deepEqual((recipientWhere as { OR: unknown[] }).OR, [
    { branchId: 5n },
    { branchId: null },
  ]);
});

void test("QA readiness never advances while a check is unfinished", async () => {
  const tx = {
    caseCheck: { count: () => Promise.resolve(1) },
    verificationCase: {
      updateMany: () => {
        throw new Error("must not write");
      },
    },
  } as unknown as Prisma.TransactionClient;
  const promoted = await new QaReadinessService().promoteIfReady(tx, {
    tenantId: 1n,
    caseId: 40n,
    casePublicId: "00000000-0000-4000-8000-000000000040",
    changedById: 10n,
    fromStatus: "IN_PROGRESS",
    reason: "Checks complete",
  });
  assert.equal(promoted, false);
});

void test("a client-scoped verifier cannot receive another client's check", () => {
  assert.throws(
    () =>
      validateAssignmentCheck(
        {
          id: 1n,
          publicId: "00000000-0000-4000-8000-000000000001",
          status: "PENDING",
          case: {
            publicId: "00000000-0000-4000-8000-000000000002",
            caseNumber: "SG-1",
            branchId: 5n,
            clientId: 8n,
            status: "IN_PROGRESS",
          },
          tasks: [],
        },
        { checkId: "00000000-0000-4000-8000-000000000001" },
        {
          assigneeId: "00000000-0000-4000-8000-000000000020",
          mode: "ASSIGN",
          items: [{ checkId: "00000000-0000-4000-8000-000000000001" }],
        },
        { id: 20n, branchId: 5n, clientId: 99n },
      ),
    ConflictException,
  );
});

void test("concurrent OTP confirmation cannot emit duplicate consent events", async () => {
  let wroteEvent = false;
  const tx = {
    consent: { updateMany: () => Promise.resolve({ count: 0 }) },
    consentEvent: {
      create: () => {
        wroteEvent = true;
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    consent: {
      findUnique: () =>
        Promise.resolve({
          id: 1n,
          publicId: "00000000-0000-4000-8000-000000000001",
          caseId: 2n,
          status: "REQUESTED",
          otpHash: "expected-hash",
          otpExpiresAt: new Date(Date.now() + 60_000),
          otpAttempts: 0,
          noticeVersion: "2026-01",
          acceptedAt: null,
          case: {
            tenantId: 1n,
            publicId: "00000000-0000-4000-8000-000000000002",
            caseNumber: "SG-1",
            status: "CONSENT_PENDING",
            branchId: 5n,
            clientId: 8n,
            assignedOpsUserId: null,
          },
        }),
    },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  };
  const issuance = {
    hashOtp: () => "expected-hash",
  } as unknown as ConsentIssuanceService;
  const service = new ConsentsService(
    prisma as unknown as PrismaService,
    {} as SubjectPiiService,
    issuance,
  );
  await assert.rejects(
    service.confirm("00000000-0000-4000-8000-000000000001", "123456"),
    ConflictException,
  );
  assert.equal(wroteEvent, false);
});

void test("a raced public clarification response cannot append a second message", async () => {
  let wroteMessage = false;
  const tx = {
    clarification: { updateMany: () => Promise.resolve({ count: 0 }) },
    clarificationMessage: {
      create: () => {
        wroteMessage = true;
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  };
  const tokens = {
    authorize: () =>
      Promise.resolve({
        id: 3n,
        publicId: "00000000-0000-4000-8000-000000000003",
        tenantId: 1n,
        status: "OPEN",
        subject: "Address proof",
        responseTokenHash: "token-hash",
        case: {
          publicId: "00000000-0000-4000-8000-000000000002",
          caseNumber: "SG-1",
          branchId: 5n,
          clientId: 8n,
          assignedOpsUserId: null,
        },
        messages: [],
      }),
  } as unknown as ClarificationTokenService;
  const service = new ClarificationsService(
    prisma as unknown as PrismaService,
    tokens,
    new QaReadinessService(),
  );
  await assert.rejects(
    service.respond(
      "00000000-0000-4000-8000-000000000003",
      "portal-token",
      "Here is the corrected proof",
    ),
    ConflictException,
  );
  assert.equal(wroteMessage, false);
});
