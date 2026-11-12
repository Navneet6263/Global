import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { CandidatePortalService } from "../src/candidate-portal/candidate-portal.service";
import { ClientReviewService } from "../src/clients/client-review.service";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { SubjectPiiService } from "../src/common/security/subject-pii.service";
import { NavigationCountsService } from "../src/dashboards/navigation-counts.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { DocumentsService } from "../src/documents/documents.service";
import { DataHousekeepingService } from "../src/outbox/data-housekeeping.service";
import type { RequesterSupportRequestsService } from "../src/support/services/requester-support-requests.service";
import { CaseHoldService } from "../src/workflow/case-hold.service";
import { promoteIntakeAfterTeamUpload } from "../src/workflow/intake-eligibility.helpers";
import { IntakeService } from "../src/workflow/intake.service";
import {
  cleanDoc,
  createEligibilityStore,
  seedAccessRow,
  seedCaseRow,
  seedConsentRow,
  testUuid,
} from "./helpers/rm-eligibility-fixtures";
import { testActor } from "./helpers/test-actor";

const rmAshish = testActor(["SPOC_RM"], ["case:read", "case:write"], { userId: 11n, spocClients: [{ id: 40n } as never] });
const clientActor = testActor(["CLIENT_ADMIN"], ["case:read", "case:write"], { clientId: 40n, userId: 50n });

const stubPortal = (prisma: PrismaService) =>
  new CandidatePortalService(prisma, {} as DocumentsService, {} as ConfigService, {} as SecretBoxService, {} as SubjectPiiService, {} as RequesterSupportRequestsService);

const stubClientReview = (prisma: PrismaService) =>
  new ClientReviewService(
    prisma,
    { getOrThrow: () => "https://portal.local" } as unknown as ConfigService,
    { encrypt: (v: string) => v, seal: (v: string) => v } as unknown as SecretBoxService,
    { open: () => ({ email: null, phone: null }) } as unknown as SubjectPiiService,
  );

void test("Route A promotes CANDIDATE_UPLOAD -> CLIENT_REVIEW on complete(), excludes on CLIENT_RETURNED, and enters needs_data_entry on client approval", async () => {
  const row = seedCaseRow(1n, "SG-ROUTE-A", "DOCUMENT_PENDING", {
    client: { id: 40n, publicId: testUuid(40), code: "SGA", displayName: "Sapling", clientReviewFirst: true },
    documents: [cleanDoc(10n, "AADHAAR")],
  });
  const ctx = { cases: [row], consents: [seedConsentRow(2n, 1n, "ACCEPTED")], accesses: [seedAccessRow(3n, 1n, null, "tok")], audits: [], notifications: [] };
  const prisma = createEligibilityStore(ctx);
  const intake = new IntakeService(prisma);

  // Even when doc exists, unconfirmed CANDIDATE_UPLOAD stays excluded & unassignable.
  assert.equal((await intake.rmQueue(rmAshish, {})).total, 0);
  await assert.rejects(intake.assignDataEntry(rmAshish, row.publicId, { assigneeId: testUuid(21), version: row.version }), ConflictException);

  const res = await stubPortal(prisma).complete(testUuid(3), "tok");
  assert.equal(res.next, "client-review");
  assert.equal(row.intakeStage, "CLIENT_REVIEW");

  // Client returns to candidate -> excluded from RM Work Queue until candidate re-submits.
  await stubClientReview(prisma).returnToCandidate(clientActor, row.publicId, row.version, "Blurry passport");
  assert.equal(row.intakeStage, "CLIENT_RETURNED");
  assert.equal((await intake.rmQueue(rmAshish, {})).total, 0);

  const latestLink = ctx.accesses[ctx.accesses.length - 1]!;
  latestLink.tokenHash = seedAccessRow(99n, 1n, null, "tok2").tokenHash;
  await stubPortal(prisma).complete(latestLink.publicId, "tok2");
  assert.equal(row.intakeStage, "CLIENT_REVIEW");

  await stubClientReview(prisma).approve(clientActor, row.publicId, row.version);
  assert.equal(row.intakeStage, "INTAKE");
  const queue = await intake.rmQueue(rmAshish, { bucket: "needs_data_entry" });
  assert.deepEqual(queue.items.map((i) => i.caseNumber), ["SG-ROUTE-A"]);
});

void test("Auto-DE promotes CANDIDATE_UPLOAD directly to DATA_ENTRY; 0-doc packages wait for candidate complete()", async () => {
  const autoCase = seedCaseRow(1n, "SG-AUTO-DE", "DOCUMENT_PENDING", {
    documents: [cleanDoc(11n, "AADHAAR")],
    client: {
      id: 40n, publicId: testUuid(40), code: "SGA", displayName: "Sapling",
      defaultDataEntryUser: { id: 21n, publicId: testUuid(21), displayName: "Deepa DE", status: "ACTIVE", userRoles: [{ role: { code: "DATA_ENTRY", baseRoleCode: null } }] },
    },
  });
  const zeroDocCase = seedCaseRow(2n, "SG-ZERO-DOC", "DOCUMENT_PENDING", { services: [], checks: [], documents: [] });
  const ctx = {
    cases: [autoCase, zeroDocCase],
    consents: [seedConsentRow(10n, 1n, "ACCEPTED"), seedConsentRow(11n, 2n, "ACCEPTED")],
    accesses: [seedAccessRow(20n, 1n, null, "t1"), seedAccessRow(21n, 2n, null, "t2")],
    audits: [], notifications: [],
  };
  const prisma = createEligibilityStore(ctx);
  const intake = new IntakeService(prisma);

  assert.equal((await intake.rmQueue(rmAshish, {})).total, 0);
  await promoteIntakeAfterTeamUpload(prisma, rmAshish, zeroDocCase.id, zeroDocCase.publicId);
  assert.equal(zeroDocCase.intakeStage, "CANDIDATE_UPLOAD");

  assert.equal((await stubPortal(prisma).complete(testUuid(20), "t1")).next, "auto-data-entry");
  assert.equal(autoCase.intakeStage, "DATA_ENTRY");
  assert.ok(autoCase.dataEntryAssignedAt instanceof Date);
  assert.equal((await intake.rmQueue(rmAshish, { bucket: "with_data_entry" })).total, 1);

  await stubPortal(prisma).complete(testUuid(21), "t2");
  assert.equal(zeroDocCase.intakeStage, "INTAKE");
  assert.equal((await intake.rmQueue(rmAshish, { bucket: "needs_data_entry" })).total, 1);
});

void test("Internal team-assisted upload and non-CLEAN malware versions obey completion gate", async () => {
  const row = seedCaseRow(1n, "SG-TEAM-UPLOAD", "DOCUMENT_PENDING", {
    services: [{ requiredDocumentsJson: JSON.stringify(["AADHAAR", "EDUCATION_CERTIFICATE"]) }],
    documents: [
      { id: 1n, type: "AADHAAR", status: "AVAILABLE", currentVersion: 1, reviewNote: null, expiresAt: null, createdAt: new Date(), versions: [{ version: 1, malwareState: "INFECTED", uploadedById: 11n }] },
    ],
  });
  const ctx = { cases: [row], consents: [seedConsentRow(2n, 1n, "ACCEPTED")], accesses: [seedAccessRow(3n, 1n, null, "t")], audits: [], notifications: [] };
  const prisma = createEligibilityStore(ctx);

  await promoteIntakeAfterTeamUpload(prisma, rmAshish, row.id, row.publicId);
  assert.equal(row.intakeStage, "CANDIDATE_UPLOAD");

  row.documents = [cleanDoc(1n, "AADHAAR", 11n)]; // Still missing EDUCATION_CERTIFICATE
  await promoteIntakeAfterTeamUpload(prisma, rmAshish, row.id, row.publicId);
  assert.equal(row.intakeStage, "CANDIDATE_UPLOAD");

  row.documents.push(cleanDoc(2n, "EDUCATION_CERTIFICATE", 11n));
  await promoteIntakeAfterTeamUpload(prisma, rmAshish, row.id, row.publicId);
  assert.equal(row.intakeStage, "INTAKE");
  assert.ok(ctx.audits.some((a) => a.action === "case.team-documents-completed"));
  assert.equal((await new IntakeService(prisma).rmQueue(rmAshish, { bucket: "needs_data_entry" })).total, 1);
});

void test("Deleted-link legacy INTAKE rows fail closed unless permanent audit/team proof + CLEAN docs exist; housekeeping preserves active proof", async () => {
  const unsubmitted = seedCaseRow(1n, "SG-LEGACY-EMPTY", "DOCUMENT_PENDING", { intakeStage: "INTAKE" });
  const auditConfirmed = seedCaseRow(2n, "SG-LEGACY-AUDIT", "DOCUMENT_PENDING", { intakeStage: "INTAKE", documents: [cleanDoc(20n, "AADHAAR")] });
  const activeWithLink = seedCaseRow(3n, "SG-ACTIVE-PROOF", "DOCUMENT_PENDING", { intakeStage: "INTAKE", documents: [cleanDoc(30n, "AADHAAR")] });
  const oldRevoked = new Date(Date.now() - 40 * 86_400_000);
  const completedProof = { ...seedAccessRow(300n, 3n, oldRevoked), revokedAt: oldRevoked };
  const staleExpired = { ...seedAccessRow(301n, 1n, null), expiresAt: new Date(Date.now() - 10_000), revokedAt: null };
  const ctx = {
    cases: [unsubmitted, auditConfirmed, activeWithLink],
    consents: [seedConsentRow(10n, 1n, "ACCEPTED"), seedConsentRow(11n, 2n, "ACCEPTED"), seedConsentRow(12n, 3n, "ACCEPTED")],
    accesses: [completedProof, staleExpired],
    audits: [{ tenantId: 7n, action: "candidate-portal.completed", resourceType: "case", resourcePublicId: auditConfirmed.publicId }],
    notifications: [],
  };
  const prisma = createEligibilityStore(ctx);
  (prisma as unknown as { refreshSession: unknown; outboxEvent: unknown }).refreshSession = { deleteMany: () => Promise.resolve({ count: 0 }) };
  (prisma as unknown as { outboxEvent: unknown }).outboxEvent = { create: () => Promise.resolve({}), deleteMany: () => Promise.resolve({ count: 0 }) };

  await new DataHousekeepingService(prisma).run();
  assert.equal(ctx.accesses.some((a) => a.id === completedProof.id), true);
  assert.equal(ctx.accesses.some((a) => a.id === staleExpired.id), false);

  const intake = new IntakeService(prisma);
  const queue = await intake.rmQueue(rmAshish, { bucket: "needs_data_entry" });
  assert.deepEqual(queue.items.map((i) => i.caseNumber), ["SG-LEGACY-AUDIT", "SG-ACTIVE-PROOF"]);
  assert.equal((await new NavigationCountsService(prisma).get(rmAshish)).counts.rmNeedsDataEntry, 2);
  await assert.rejects(intake.assignDataEntry(rmAshish, unsubmitted.publicId, { assigneeId: testUuid(21), version: 1 }), ConflictException);
});

void test("Stop/Resume during CANDIDATE_UPLOAD preserves stage and keeps unsubmitted case excluded", async () => {
  const row = seedCaseRow(1n, "SG-STOP-RESUME", "DOCUMENT_PENDING", { intakeStage: "CANDIDATE_UPLOAD" });
  const prisma = createEligibilityStore({ cases: [row], consents: [seedConsentRow(2n, 1n, "ACCEPTED")], accesses: [seedAccessRow(3n, 1n, null)], audits: [], notifications: [] });
  const hold = new CaseHoldService(prisma);

  await hold.stop(rmAshish, row.publicId, { version: row.version, reason: "Candidate unavailable right now" });
  assert.equal(row.status, "STOPPED");
  await hold.resume(rmAshish, row.publicId, { version: row.version, note: "Ready to resume upload" });
  assert.equal(row.status, "DOCUMENT_PENDING");
  assert.equal(row.intakeStage, "CANDIDATE_UPLOAD");
  assert.equal((await new IntakeService(prisma).rmQueue(rmAshish, {})).total, 0);
});
