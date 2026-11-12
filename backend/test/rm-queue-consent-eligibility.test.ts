import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { CandidatePortalService } from "../src/candidate-portal/candidate-portal.service";
import { caseRegisterWhere } from "../src/cases/case-register-query";
import { presentCaseListItem } from "../src/cases/case.presenter";
import type { ClarificationTokenService } from "../src/clarifications/clarification-token.service";
import { ClarificationsService } from "../src/clarifications/clarifications.service";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { SubjectPiiService } from "../src/common/security/subject-pii.service";
import type { ConsentIssuanceService } from "../src/consents/consent-issuance.service";
import { ConsentsService } from "../src/consents/consents.service";
import { NavigationCountsService } from "../src/dashboards/navigation-counts.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { DocumentsService } from "../src/documents/documents.service";
import type { RequesterSupportRequestsService } from "../src/support/services/requester-support-requests.service";
import { QaReadinessService } from "../src/verification/qa-readiness.service";
import { IntakeService } from "../src/workflow/intake.service";
import {
  cleanDoc,
  createEligibilityStore,
  matchesWhere,
  otpDigest,
  seedAccessRow,
  seedCaseRow,
  seedConsentRow,
  testUuid,
} from "./helpers/rm-eligibility-fixtures";
import { testActor } from "./helpers/test-actor";
import { DOC, VENDOR_2, vendorWriters } from "./helpers/vendor-fixtures";

const rmAshish = testActor(["SPOC_RM"], ["case:read"], { userId: 11n, spocClients: [{ id: 40n } as never] });
const opsActor = testActor(["OPS_MANAGER"], ["case:read"]);
const clientActor = testActor(["CLIENT_ADMIN"], ["case:read"], { clientId: 40n });

const portalService = (prisma: PrismaService) =>
  new CandidatePortalService(
    prisma,
    {} as DocumentsService,
    {} as ConfigService,
    {} as SecretBoxService,
    {} as SubjectPiiService,
    {} as RequesterSupportRequestsService,
  );

void test("pending consent, draft, and upload-pending cases stay out of RM Work Queue while remaining visible to Client Admin & Ops", async () => {
  const past = new Date(Date.now() - 3_600_000);
  const cases = [
    seedCaseRow(1n, "SG-20261111-DE42C4", "CONSENT_PENDING", { escalatedAt: past, dueAt: past }),
    seedCaseRow(2n, "SG-DRAFT-2", "DRAFT"),
    seedCaseRow(3n, "SG-STALE-CONSENT-3", "DOCUMENT_PENDING"),
    seedCaseRow(4n, "SG-WITHDRAWN-4", "DOCUMENT_PENDING"),
    seedCaseRow(5n, "SG-UPLOAD-PENDING-5", "DOCUMENT_PENDING", { intakeStage: "CANDIDATE_UPLOAD" }),
    seedCaseRow(6n, "SG-SUBMITTED-6", "DOCUMENT_PENDING", {
      intakeStage: "INTAKE",
      subject: { fullName: "Eligible Candidate" },
      documents: [cleanDoc(601n)],
    }),
  ];
  const consents = [
    seedConsentRow(101n, 1n, "REQUESTED"),
    seedConsentRow(103n, 3n, "REQUESTED"),
    seedConsentRow(104n, 4n, "WITHDRAWN"),
    seedConsentRow(105n, 5n, "ACCEPTED"),
    seedConsentRow(106n, 6n, "ACCEPTED"),
  ];
  const ctx = {
    cases,
    consents,
    accesses: [seedAccessRow(505n, 5n, null), seedAccessRow(506n, 6n, new Date())],
    audits: [],
    notifications: [],
  };
  const prisma = createEligibilityStore(ctx);
  const intake = new IntakeService(prisma);

  for (const query of [{}, { bucket: "needs_data_entry" }, { flag: "escalated" as const }, { flag: "overdue" as const }]) {
    const queue = await intake.rmQueue(rmAshish, query);
    assert.deepEqual(queue.items.map((item) => item.caseNumber), query.flag ? [] : ["SG-SUBMITTED-6"]);
    assert.equal(queue.counts.needs_data_entry, 1);
    assert.deepEqual({ active: queue.summary.active, escalated: queue.summary.escalated, overdue: queue.summary.overdue }, { active: 1, escalated: 0, overdue: 0 });
  }

  const rmNav = await new NavigationCountsService(prisma).get(rmAshish);
  assert.deepEqual(rmNav.counts, { rmActive: 1, rmActions: 1, rmNeedsDataEntry: 1, rmReady: 0, rmFinal: 0, rmCorrections: 0, rmClarifications: 0, rmOverdue: 0, rmEscalated: 0 });
  assert.equal((await new NavigationCountsService(prisma).get(opsActor)).counts.activeCases, 6);
  assert.ok(matchesWhere(cases[0]!, ctx, caseRegisterWhere(clientActor, {})));
  const clientView = presentCaseListItem(cases[0]!, clientActor) as { clientProgress: { label: string } };
  assert.equal(clientView.clientProgress.label, "Waiting for the candidate's consent");
});

void test("OTP consent keeps case at CANDIDATE_UPLOAD & excluded until required docs are uploaded and submitted via complete()", async () => {
  const cases = [
    seedCaseRow(1n, "SG-20261111-DE42C4", "CONSENT_PENDING", {
      intakeStage: "CANDIDATE_UPLOAD",
      services: [{ requiredDocumentsJson: JSON.stringify(["AADHAAR", "EDUCATION_CERTIFICATE"]) }],
    }),
  ];
  const consents = [seedConsentRow(201n, 1n, "REQUESTED", "123456")];
  const accesses = [seedAccessRow(401n, 1n, null, "secret-token")];
  const ctx = { cases, consents, accesses, audits: [], notifications: [] };
  const prisma = createEligibilityStore(ctx);
  const consentsService = new ConsentsService(
    prisma,
    { open: () => ({ email: null, phone: null }) } as unknown as SubjectPiiService,
    { hashOtp: otpDigest, receipt: () => Promise.resolve({}) } as unknown as ConsentIssuanceService,
  );
  const portal = portalService(prisma);
  const intake = new IntakeService(prisma);

  assert.equal((await intake.rmQueue(rmAshish, {})).total, 0);
  await assert.rejects(consentsService.confirm(testUuid(201), "000000"));
  assert.equal(cases[0]!.status, "CONSENT_PENDING");

  const accepted = await consentsService.confirm(testUuid(201), "123456");
  assert.equal(accepted.accepted, true);
  assert.equal(cases[0]!.status, "DOCUMENT_PENDING");
  assert.equal(cases[0]!.intakeStage, "CANDIDATE_UPLOAD");
  assert.equal((await intake.rmQueue(rmAshish, {})).total, 0);
  assert.equal((await new NavigationCountsService(prisma).get(rmAshish)).counts.rmNeedsDataEntry, 0);
  await assert.rejects(
    intake.assignDataEntry(rmAshish, cases[0]!.publicId, { assigneeId: testUuid(21), version: cases[0]!.version }),
    ConflictException,
  );

  // Partial upload (only AADHAAR, missing EDUCATION_CERTIFICATE) rejects complete() and stays out.
  cases[0]!.documents.push(cleanDoc(701n, "AADHAAR"));
  await assert.rejects(portal.complete(testUuid(401), "secret-token"), ConflictException);
  assert.equal((await intake.rmQueue(rmAshish, {})).total, 0);

  // Complete clean upload + candidate submission promotes to INTAKE and makes eligible.
  cases[0]!.documents.push(cleanDoc(702n, "EDUCATION_CERTIFICATE"));
  const completed = await portal.complete(testUuid(401), "secret-token");
  assert.equal(completed.completed, true);
  assert.equal(cases[0]!.intakeStage, "INTAKE");

  const afterQueue = await intake.rmQueue(rmAshish, {});
  assert.deepEqual(afterQueue.items.map((item) => item.caseNumber), ["SG-20261111-DE42C4"]);
  assert.equal(afterQueue.counts.needs_data_entry, 1);
  assert.equal((await new NavigationCountsService(prisma).get(rmAshish)).counts.rmActive, 1);

  const assigned = await intake.assignDataEntry(rmAshish, cases[0]!.publicId, { assigneeId: testUuid(21), version: cases[0]!.version });
  assert.equal(assigned.intakeStage, "DATA_ENTRY");
});

void test("consent-pending cases reject premature RM actions and preserve multi-role scope filters", async () => {
  const pendingCase = seedCaseRow(1n, "SG-20261111-DE42C4", "CONSENT_PENDING");
  const prisma = createEligibilityStore({ cases: [pendingCase], consents: [seedConsentRow(301n, 1n, "REQUESTED")], accesses: [], audits: [], notifications: [] });

  await assert.rejects(new IntakeService(prisma).assignDataEntry(rmAshish, pendingCase.publicId, { assigneeId: testUuid(21), version: 1 }), ConflictException);
  await assert.rejects(new ClarificationsService(prisma, {} as ClarificationTokenService, new QaReadinessService()).create(rmAshish, pendingCase.publicId, { subject: "Missing", message: "Upload ID" }), ConflictException);

  const vendorPrisma = {
    document: { findFirst: () => Promise.resolve({ id: 91n, publicId: DOC, type: "IDENTITY", case: pendingCase, versions: [{ version: 1 }], vendorAssignments: [] }) },
    $transaction: (fn: (client: unknown) => Promise<unknown>) => fn(vendorPrisma),
  } as unknown as PrismaService;
  await assert.rejects(vendorWriters(vendorPrisma).assign(testActor(["SPOC_RM"], ["vendor:assign"], { spocClients: [{ id: 40n } as never] }), DOC, { vendorId: VENDOR_2 }), ConflictException);

  const multiRoleRm = testActor(["SPOC_RM", "DATA_ENTRY"], ["case:read"], { userId: 11n, spocClients: [{ id: 40n } as never] });
  assert.equal((await new IntakeService(prisma).rmQueue(multiRoleRm, { bucket: "needs_data_entry" })).total, 0);
});
