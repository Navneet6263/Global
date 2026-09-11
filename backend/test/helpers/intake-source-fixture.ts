import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Prisma } from "../../src/generated/prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import { SubjectPiiService } from "../../src/common/security/subject-pii.service";
import { SecretBoxService } from "../../src/common/security/secret-box.service";
import { ConsentIssuanceService } from "../../src/consents/consent-issuance.service";
import { ConsentsService } from "../../src/consents/consents.service";
import { CasesService } from "../../src/cases/cases.service";
import { CaseReaderService } from "../../src/cases/case-reader.service";
import { CaseWorkflowPolicy } from "../../src/cases/case-workflow.policy";
import { DocumentsService } from "../../src/documents/documents.service";
import { ContentInspectionService } from "../../src/documents/content-inspection.service";
import type { LocalObjectStorageService } from "../../src/documents/local-object-storage.service";
import { DocumentReviewService } from "../../src/documents/document-review.service";
import { deliveryWorkflowFixture } from "./delivery-workflow-fixture";

export async function proofFile(label: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 28; index++)
    page.drawText(`SYNTHETIC ROLLBACK PROOF ${label} - line ${index + 1}`, {
      x: 40,
      y: 750 - index * 23,
      size: 11,
      font,
    });
  const buffer = Buffer.from(await pdf.save({ useObjectStreams: false }));
  return {
    buffer,
    size: buffer.length,
    mimetype: "application/pdf",
    originalName: `synthetic-${label}.pdf`,
  };
}

export async function intakeSourceFixture(
  tx: Prisma.TransactionClient,
  db: PrismaService,
  tenantCode: string,
  objects: Map<string, Buffer>,
) {
  const f = await deliveryWorkflowFixture(tx, tenantCode);
  for (const person of [f.verifier, f.qa, f.manager]) {
    const role = await tx.role.create({
      data: {
        tenantId: f.tenant.id,
        code: person.roles[0]!,
        name: person.roles[0]!,
        permissionsJson: '["*"]',
      },
    });
    await tx.userRole.create({
      data: { userId: person.userId, roleId: role.id },
    });
  }
  const packages = [];
  for (const [code, family, check, required] of [
    ["EMPLOYMENT", "HIRECHECK", "EMPLOYMENT", "EMPLOYMENT_PROOF"],
    ["REFERENCE", "INTEGRITYCHECK", "REFERENCE", "EDUCATION_CERTIFICATE"],
  ])
    packages.push(
      await tx.servicePackage.create({
        data: {
          tenantId: f.tenant.id,
          code: code!,
          name: `Synthetic ${code}`,
          serviceFamily: family!,
          checksJson: JSON.stringify([check]),
          requiredDocumentsJson: JSON.stringify([required]),
          price: 100,
          tatHours: 72,
        },
      }),
    );
  const config = new ConfigService({
    DATA_ENCRYPTION_KEY_VERSION: 1,
    DATA_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    WEB_ORIGIN: "https://rollback.invalid",
    CLAMAV_HOST: "",
    MALWARE_SCAN_REQUIRED: false,
  });
  const secrets = new SecretBoxService(config);
  const pii = new SubjectPiiService(secrets);
  const issuance = new ConsentIssuanceService(config, secrets);
  const workflow = new CaseWorkflowPolicy(db);
  const cases = new CasesService(
    db,
    workflow,
    new CaseReaderService(db, pii),
    pii,
    issuance,
  );
  const created = await cases.create(f.manager, {
    clientId: f.client.publicId,
    fullName: "Synthetic multi-service candidate",
    email: "synthetic@rollback.invalid",
    priority: "NORMAL",
    servicePackageId: packages[0]!.publicId,
    services: packages.map((pkg) => ({ servicePackageId: pkg.publicId })),
  });
  const row = await tx.verificationCase.findUniqueOrThrow({
    where: { publicId: created.id },
  });
  assert.equal(row.status, "CONSENT_PENDING");
  assert.equal(await tx.caseService.count({ where: { caseId: row.id } }), 2);
  assert.equal(await tx.caseCheck.count({ where: { caseId: row.id } }), 2);
  await assert.rejects(
    cases.transition(f.manager, row.publicId, {
      version: row.version,
      status: "IN_PROGRESS",
      reason: "This must be blocked without accepted consent",
    }),
    /cannot move/,
  );
  const consent = await tx.consent.findFirstOrThrow({
    where: { caseId: row.id },
  });
  const otpEvent = await tx.outboxEvent.findFirstOrThrow({
    where: {
      tenantId: f.tenant.id,
      aggregateId: consent.publicId,
      topic: "consent.otp.requested",
    },
  });
  const payload = JSON.parse(otpEvent.payloadJson) as { secret: string };
  const otp = secrets.open<{ otp: string }>(payload.secret).otp;
  await new ConsentsService(db, pii, issuance).confirm(
    consent.publicId,
    otp,
    "127.0.0.1",
    "Rollback-only integration",
  );
  assert.equal(
    await tx.outboxEvent.count({
      where: {
        tenantId: f.tenant.id,
        aggregateId: consent.publicId,
        topic: "notification.requested",
      },
    }),
    1,
  );
  const storage = {
    put: (key: string, value: Buffer) => {
      objects.set(key, value);
      return Promise.resolve();
    },
    delete: (key: string) => {
      objects.delete(key);
      return Promise.resolve();
    },
  } as unknown as LocalObjectStorageService;
  const documents = new DocumentsService(
    db,
    config,
    new ContentInspectionService(config),
    storage,
  );
  const reviews = new DocumentReviewService(db);
  const before = await tx.verificationCase.findUniqueOrThrow({
    where: { id: row.id },
  });
  await assert.rejects(
    cases.transition(f.manager, row.publicId, {
      version: before.version,
      status: "IN_PROGRESS",
      reason: "Required evidence is missing",
    }),
    /Evidence is not ready/,
  );
  const documentIds: string[] = [];
  for (const type of ["EMPLOYMENT_PROOF", "EDUCATION_CERTIFICATE"]) {
    const document = await documents.create(f.manager, row.publicId, { type });
    documentIds.push(document.id);
    await documents.upload(f.manager, document.id, await proofFile(type));
  }
  assert.equal((await reviews.readiness(f.manager, row.publicId)).ready, false);
  for (const id of documentIds) {
    const document = await tx.document.findUniqueOrThrow({
      where: { publicId: id },
    });
    await reviews.review(f.manager, id, {
      version: document.version,
      documentVersion: document.currentVersion,
      decision: "VERIFIED",
      note: "Synthetic proof reviewed for workflow integration only.",
    });
  }
  assert.equal((await reviews.readiness(f.manager, row.publicId)).ready, true);
  const current = await tx.verificationCase.findUniqueOrThrow({
    where: { id: row.id },
  });
  await cases.transition(f.manager, row.publicId, {
    version: current.version,
    status: "IN_PROGRESS",
    reason: "Consent and reviewed required evidence verified in SQL.",
  });
  return { ...f, row, cases, documents, reviews, documentIds };
}
