import assert from "node:assert/strict";
import test from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { SubjectPiiService } from "../src/common/security/subject-pii.service";
import { presentCaseDetail } from "../src/cases/case.presenter";
import { ACTIVE_CLARIFICATION_STATUSES } from "../src/clarifications/clarification-status";
import { sendInsufficiencyNotice } from "../src/clarifications/insufficiency-notice";
import { InsufficiencyReminderService } from "../src/clarifications/insufficiency-reminder.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { Prisma } from "../src/generated/prisma/client";
import { reportBodyFor, type ApprovalCase } from "../src/reports/report-snapshot";
import { reopenDependentChecksForPromotedVersion } from "../src/verification/shared-document-dependencies";

const actor = (roles: string[]): Actor => ({
  userId: 10n,
  userPublicId: "user-10",
  tenantId: 7n,
  tenantPublicId: "tenant-7",
  email: "ops@example.com",
  displayName: "Ops",
  mustChangePassword: false,
  roles,
  permissions: ["case:read", "document:read"],
});

void test("ACTIVE_CLARIFICATION_STATUSES covers L1 and L2 in-flight clarification stages", () => {
  assert.deepEqual([...ACTIVE_CLARIFICATION_STATUSES], [
    "OPEN",
    "RESPONDED",
    "CANDIDATE_SUBMITTED",
    "DATA_ENTRY_PENDING",
  ]);
});

void test("sendInsufficiencyNotice deduplicates recipient emails and reminder waits 24h after lastRejectedAt", async () => {
  const outboxTopics: Array<{ topic: string; to?: string }> = [];
  const notifUsers: bigint[][] = [];
  const now = new Date("2026-11-11T12:00:00Z");
  const secretBox = { seal: (v: unknown) => JSON.stringify(v) } as unknown as SecretBoxService;
  const pii = { open: (s: { email: string }) => s } as unknown as SubjectPiiService;

  const caseRecord = {
    publicId: "case-1",
    caseNumber: "SG-1",
    clientId: 2n,
    subject: { fullName: "Candidate", email: "cand@example.com", phone: null, employeeCode: null, piiCiphertext: null, piiKeyVersion: null },
  };
  const tx = {
    verificationCase: {
      findFirst: () => Promise.resolve(caseRecord),
      findUniqueOrThrow: () => Promise.resolve(caseRecord),
    },
    candidatePortalAccess: { updateMany: () => Promise.resolve({ count: 0 }), create: () => Promise.resolve({ publicId: "acc-1" }) },
    user: { findMany: () => Promise.resolve([{ id: 1n, email: "Admin@Acme.com" }, { id: 2n, email: " admin@acme.com " }]) },
    notification: { createMany: (args: { data: Array<{ userId: bigint }> }) => { notifUsers.push(args.data.map((d) => d.userId)); return Promise.resolve({}); } },
    auditEvent: { findMany: () => Promise.resolve([]), create: () => Promise.resolve({}) },
    outboxEvent: {
      create: (args: { data: { topic: string; payloadJson: string } }) => {
        const parsed = JSON.parse(args.data.payloadJson) as { secret?: string };
        const inner = parsed.secret ? (JSON.parse(parsed.secret) as { to?: string }) : {};
        outboxTopics.push({ topic: args.data.topic, to: inner.to });
        return Promise.resolve({});
      },
    },
  };

  await sendInsufficiencyNotice(tx as unknown as Prisma.TransactionClient, { secretBox, pii, webOrigin: "https://app.test" }, {
    tenantId: 7n,
    caseId: 30n,
    subject: "PAN",
    message: "Unclear copy",
    level: "L2",
  });
  assert.deepEqual(notifUsers[0], [1n, 2n]);
  assert.equal(outboxTopics.filter((e) => e.topic === "email.requested").length, 1);
  assert.equal(outboxTopics.filter((e) => e.topic === "candidate.access.issued").length, 1);

  let lastRejectedAt = new Date(now.getTime() - 20 * 3_600_000);
  const reminderTx = { ...tx, auditEvent: { findMany: () => Promise.resolve([]), create: () => Promise.resolve({}) }, user: { findMany: () => Promise.resolve([]) } };
  const reminders = new InsufficiencyReminderService(
    {
      clarification: {
        findMany: () => Promise.resolve([{
          id: 5n,
          publicId: "clar-5",
          tenantId: 7n,
          caseId: 30n,
          subject: "PAN",
          level: "L2",
          createdAt: new Date(now.getTime() - 72 * 3_600_000),
          lastRejectedAt,
          lastRejectedReason: "Blurry scan",
          messages: [{ body: "Initial" }],
        }]),
      },
      $transaction: (fn: (client: typeof reminderTx) => Promise<unknown>) => fn(reminderTx),
    } as unknown as PrismaService,
    { get: (k: string) => (k === "WEB_ORIGIN" ? "https://app.test" : undefined) } as ConfigService,
    secretBox,
    pii,
  );
  assert.equal(await reminders.run(now), 0);
  lastRejectedAt = new Date(now.getTime() - 25 * 3_600_000);
  assert.equal(await reminders.run(now), 1);
});

void test("shared-document dependency helper reopens only checks citing older versions and views pin currentVersion", async () => {
  const reopened: string[] = [];
  const criminalTouched: string[] = [];
  const tx = {
    caseCheck: {
      findMany: (args?: unknown) => {
        const where = (args as { where?: { status?: unknown } } | undefined)?.where;
        if (where && "methodRuns" in where) {
          return Promise.resolve([
            {
              id: 11n, publicId: "chk-id", type: "IDENTITY", status: "COMPLETED", result: "CLEAR", riskLevel: "LOW",
              sourceSummary: "PAN matched", dueAt: null, tasks: [{ id: 1n, publicId: "t1", assigneeId: 8n, status: "COMPLETED" }],
              methodRuns: [{ evidenceJson: '[{"documentId":"doc-pan","version":1}]' }],
            },
            {
              id: 12n, publicId: "chk-crim", type: "CRIMINAL", status: "COMPLETED", result: "CLEAR", riskLevel: "LOW",
              sourceSummary: "Clear", dueAt: null, tasks: [],
              methodRuns: [{ evidenceJson: '[{"documentId":"doc-court","version":1}]' }],
            },
          ]);
        }
        return Promise.resolve([{ riskLevel: null, status: "ASSIGNED" }]);
      },
      update: (args: { where: { id: bigint } }) => {
        if (args.where.id === 11n) reopened.push("IDENTITY");
        else criminalTouched.push(args.where.id.toString());
        return Promise.resolve({});
      },
      findUnique: () => Promise.resolve({ riskLevel: "LOW" }),
    },
    verificationMethodRun: { findMany: () => Promise.resolve([]), updateMany: () => Promise.resolve({ count: 0 }) },
    user: { findFirst: () => Promise.resolve({ id: 8n }) },
    checkTask: { create: () => Promise.resolve({ publicId: "t2" }) },
    notification: { create: () => Promise.resolve({}) },
    auditEvent: { create: () => Promise.resolve({}) },
    verificationCase: { update: () => Promise.resolve({}), findMany: () => Promise.resolve([]) },
  };

  const affected = await reopenDependentChecksForPromotedVersion(tx as unknown as Prisma.TransactionClient, actor(["OPS_MANAGER"]), {
    tenantId: 7n,
    caseId: 30n,
    documentPublicId: "doc-pan",
    documentType: "PAN",
    promotedVersion: 2,
    reason: "Data entry verified new PAN",
  });
  assert.deepEqual(affected, [{ checkId: "chk-id", type: "IDENTITY", reopened: true }]);
  assert.deepEqual(reopened, ["IDENTITY"]);
  assert.deepEqual(criminalTouched, []);

  const row = {
    publicId: "case-30",
    caseNumber: "SG-30",
    status: "IN_PROGRESS",
    priority: "STANDARD",
    riskLevel: "LOW",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    subject: { id: "s1", fullName: "Candidate" },
    client: { publicId: "c1", code: "C1", displayName: "Client" },
    services: [],
    checks: [],
    fieldVisits: [],
    documents: [{
      publicId: "doc-pan",
      type: "PAN",
      status: "VERIFIED",
      currentVersion: 1,
      versions: [
        { version: 2, originalName: "v2-unreviewed.pdf", contentType: "application/pdf", sizeBytes: 20n, malwareState: "CLEAN", reviewStatus: "PENDING", clarification: { publicId: "clar-1" }, createdAt: new Date() },
        { version: 1, originalName: "v1-verified.pdf", contentType: "application/pdf", sizeBytes: 10n, malwareState: "CLEAN", reviewStatus: "VERIFIED", clarification: null, createdAt: new Date() },
      ],
    }],
    clarifications: [],
  };
  const clientView = presentCaseDetail(row, actor(["CLIENT_ADMIN"])) as { documents: Array<{ versions: Array<{ originalName: string }> }> };
  assert.equal(clientView.documents[0]?.versions[0]?.originalName, "v1-verified.pdf");
  const opsView = presentCaseDetail(row, actor(["OPS_MANAGER"])) as { documents: Array<{ versions: Array<{ reviewStatus: string; clarificationId: string | null }> }> };
  assert.equal(opsView.documents[0]?.versions[0]?.reviewStatus, "PENDING");
  assert.equal(opsView.documents[0]?.versions[0]?.clarificationId, "clar-1");

  const body = reportBodyFor({
    caseNumber: "SG-30",
    client: { displayName: "Client" },
    subject: { fullName: "Candidate", employeeCode: null, dateOfBirth: null, piiCiphertext: null },
    services: [],
    checks: [],
    fieldVisits: [],
    qaReviews: [],
    documents: [{
      type: "PAN",
      currentVersion: 1,
      versions: [
        { version: 2, reviewStatus: "REJECTED", originalName: "bad-v2.pdf", sha256: "bad" },
        { version: 1, reviewStatus: "VERIFIED", originalName: "good-v1.pdf", sha256: "good" },
      ],
    }],
  } as unknown as ApprovalCase);
  assert.equal(body.evidence?.[0]?.name, "good-v1.pdf");
});
