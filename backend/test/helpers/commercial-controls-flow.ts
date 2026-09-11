import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "../../src/generated/prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import { CreditControlController } from "../../src/finance/credit-control.controller";
import { RetentionPreviewController } from "../../src/privacy/retention-preview.controller";
import { VendorSharingController } from "../../src/privacy/vendor-sharing.controller";
import { VerificationMethodsService } from "../../src/verification/verification-methods.service";
import { SourceOutreachService } from "../../src/verification/source-outreach.service";
import { createVerificationCase } from "../../src/cases/case-intake";
import { SecretBoxService } from "../../src/common/security/secret-box.service";
import { SubjectPiiService } from "../../src/common/security/subject-pii.service";
import { ConsentIssuanceService } from "../../src/consents/consent-issuance.service";
import type { CommercialFixture } from "./rollback-database";

export async function commercialControlsFlow(
  tx: Prisma.TransactionClient,
  db: PrismaService,
  f: CommercialFixture,
) {
  const admin = { ...f.manager, roles: ["PLATFORM_ADMIN"] };
  const otherAdmin = { ...f.finance, roles: ["PLATFORM_ADMIN"] };
  const privacy = new RetentionPreviewController(db);
  const held = await privacy.hold(admin, f.row.publicId, {
    version: f.row.version,
    hold: true,
    reason: "Synthetic hold during approved retention review.",
  });
  assert.equal(held.deletionTriggered, false);
  assert.equal(
    (await privacy.preview(admin, { page: 1, days: 365, mode: "HELD" })).total,
    1,
  );
  await assert.rejects(
    privacy.hold(admin, f.row.publicId, {
      version: f.row.version,
      hold: false,
      reason: "Stale hold release should fail.",
    }),
    /changed/,
  );
  await privacy.hold(admin, f.row.publicId, {
    version: held.version,
    hold: false,
    reason: "Synthetic review complete; release hold only.",
  });
  const sharing = new VendorSharingController(db);
  const proposed = await sharing.create(admin, {
    recipient: "Synthetic institute",
    purpose: "Employment source verification for the named case only.",
    agreementReference: "DPA-TEST-001",
    scopeReference: f.row.caseNumber,
    categories: ["EMPLOYMENT"],
    expiresAt: new Date(Date.now() + 86400000 * 10).toISOString(),
  });
  const decision = {
    version: 1,
    status: "AUTHORISED",
    reason: "Synthetic independent review of stated scope and DPA.",
  };
  await assert.rejects(
    sharing.decide(admin, proposed.id, decision),
    /different/,
  );
  const authorised = await sharing.decide(otherAdmin, proposed.id, decision);
  assert.equal(authorised.status, "AUTHORISED");
  await sharing.decide(admin, proposed.id, {
    version: authorised.version,
    status: "REVOKED",
    reason: "Synthetic sharing authority revoked after review.",
  });
  assert.equal(
    (await sharing.events(admin, proposed.id, { page: 1 })).total,
    3,
  );
  assert.equal(
    (await sharing.list({ ...admin, tenantId: -1n }, { page: 1 })).total,
    0,
  );
  const credit = new CreditControlController(db);
  const client = await tx.client.findUniqueOrThrow({
    where: { id: f.client.id },
  });
  const onHold = await credit.update(f.finance, f.client.publicId, {
    version: client.version,
    creditLimit: 500,
    creditHold: true,
    reason: "Synthetic Finance hold; no real client is changed.",
  });
  assert.equal(
    (await credit.list(f.finance, { page: 1 })).items[0]?.creditHold,
    true,
  );
  const config = new ConfigService({
    DATA_ENCRYPTION_KEY_VERSION: 1,
    DATA_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    WEB_ORIGIN: "https://rollback.invalid",
  });
  const secrets = new SecretBoxService(config);
  const pack = await tx.servicePackage.findUniqueOrThrow({
    where: { id: f.row.servicePackageId! },
  });
  const intake = {
    fullName: "Credit hold rollback candidate",
    email: "credit@rollback.invalid",
    priority: "NORMAL",
    clientId: f.client.publicId,
    servicePackageId: pack.publicId,
  };
  await assert.rejects(
    createVerificationCase(
      db,
      new SubjectPiiService(secrets),
      new ConsentIssuanceService(config, secrets),
      admin,
      intake,
    ),
    /Finance intake hold/,
  );
  assert.equal(await tx.subject.count({ where: { tenantId: f.tenant.id } }), 1);
  await credit.update(f.finance, f.client.publicId, {
    version: onHold.version,
    creditLimit: null,
    creditHold: false,
    reason: "Synthetic hold lifted by Finance.",
  });
  await assert.rejects(
    credit.update({ ...f.finance, tenantId: -1n }, f.client.publicId, {
      version: 1,
      creditLimit: null,
      creditHold: false,
      reason: "Foreign tenant must not alter credit.",
    }),
    /not found/,
  );
  await tx.verificationCase.update({
    where: { id: f.row.id },
    data: { status: "IN_PROGRESS" },
  });
  await tx.caseCheck.update({
    where: { id: f.check.id },
    data: { status: "IN_PROGRESS", completedAt: null },
  });
  const methods = new VerificationMethodsService(db);
  const source = await methods.create(admin, f.check.publicId, {
    method: "THIRD_PARTY",
    provider: "Synthetic authorised source",
    sourceContact: "source@rollback.invalid",
  });
  const outreach = new SourceOutreachService(db, methods);
  const input = {
    version: source.version,
    channel: "EMAIL",
    outcome: "CONTACTED",
    notes: "Synthetic contact logged; no email actually sent.",
    occurredAt: new Date().toISOString(),
    nextFollowUpAt: new Date(Date.now() + 86400000).toISOString(),
  };
  const contact = await outreach.record(
    admin,
    f.check.publicId,
    source.id,
    input,
  );
  assert.equal(contact.version, 2);
  const history = await outreach.list(admin, f.check.publicId, source.id, {
    page: 1,
    pageSize: 1,
  });
  assert.equal(history.total, 1);
  assert.equal(history.items[0]?.actorName, admin.displayName);
  await assert.rejects(
    outreach.record(admin, f.check.publicId, source.id, input),
    /changed or closed/,
  );
  await assert.rejects(
    outreach.record(
      { ...f.verifier, userId: f.finance.userId },
      f.check.publicId,
      source.id,
      { ...input, version: 2 },
    ),
    /not found or not assigned/,
  );
  await methods.respond(admin, f.check.publicId, source.id, {
    version: 2,
    result: "CLEAR",
    reference: "TEST-SOURCE-001",
    summary: "Synthetic source response supported by the reviewed document.",
    evidenceIds: [f.document.publicId],
    evidenceVersions: [{ documentId: f.document.publicId, version: 1 }],
  });
  await assert.rejects(
    outreach.record(admin, f.check.publicId, source.id, {
      ...input,
      version: 3,
    }),
    /changed or closed/,
  );
  assert.equal(
    (await methods.list(admin, f.check.publicId)).items.find(
      (row) => row.id === source.id,
    )?.nextFollowUpAt,
    null,
  );
  assert.equal(
    await tx.outboxEvent.count({ where: { tenantId: f.tenant.id } }),
    0,
  );
}
