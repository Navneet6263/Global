import { randomUUID } from "node:crypto";
import type { Actor } from "../../src/common/auth/actor";
import type { Prisma } from "../../src/generated/prisma/client";

export async function deliveryWorkflowFixture(
  tx: Prisma.TransactionClient,
  tenantCode: string,
) {
  const tenant = await tx.tenant.create({
    data: { code: tenantCode, name: "Rollback-only workflow fixture" },
  });
  const client = await tx.client.create({
    data: {
      tenantId: tenant.id,
      code: "FIXTURE",
      legalName: "Rollback client",
      displayName: "Rollback client",
      status: "ACTIVE",
    },
  });
  const roleNames = [
    "VERIFIER",
    "QA_REVIEWER",
    "OPS_MANAGER",
    "FINANCE_MANAGER",
    "CLIENT_ADMIN",
  ];
  const actors: Actor[] = [];
  for (const role of roleNames) {
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: `${role.toLowerCase()}@rollback.invalid`,
        normalizedEmail: `${role.toLowerCase()}@rollback.invalid`,
        displayName: `Rollback ${role}`,
        passwordHash: "fixture-not-a-login-password",
        ...(role === "CLIENT_ADMIN" ? { clientId: client.id } : {}),
      },
    });
    actors.push({
      tenantId: tenant.id,
      tenantPublicId: tenant.publicId,
      tenantName: tenant.name,
      userId: user.id,
      userPublicId: user.publicId,
      displayName: user.displayName,
      email: user.email,
      roles: [role],
      permissions: ["*"],
      mustChangePassword: false,
      ...(role === "CLIENT_ADMIN"
        ? { clientId: client.id, clientPublicId: client.publicId }
        : {}),
    });
  }
  const [verifier, qa, manager, finance, clientActor] = actors as [
    Actor,
    Actor,
    Actor,
    Actor,
    Actor,
  ];
  const servicePackage = await tx.servicePackage.create({
    data: {
      tenantId: tenant.id,
      code: "ROLLBACK_HIRE",
      name: "Rollback HireCheck",
      serviceFamily: "HIRECHECK",
      checksJson: '["IDENTITY"]',
      requiredDocumentsJson: '["PAN"]',
      price: 100,
    },
  });
  const subject = await tx.subject.create({
    data: { tenantId: tenant.id, fullName: "Synthetic rollback candidate" },
  });
  const row = await tx.verificationCase.create({
    data: {
      tenantId: tenant.id,
      clientId: client.id,
      subjectId: subject.id,
      servicePackageId: servicePackage.id,
      caseNumber: `ROLLBACK-${randomUUID().slice(0, 8)}`,
      status: "QA_REVIEW",
      qaReviewerId: qa.userId,
      qaClaimedAt: new Date(),
      riskLevel: "LOW",
    },
  });
  const service = await tx.caseService.create({
    data: {
      caseId: row.id,
      servicePackageId: servicePackage.id,
      serviceFamily: "HIRECHECK",
      unitPrice: 100,
      requiredDocumentsJson: '["PAN"]',
    },
  });
  const check = await tx.caseCheck.create({
    data: {
      tenantId: tenant.id,
      caseId: row.id,
      caseServiceId: service.id,
      type: "IDENTITY",
      status: "COMPLETED",
      result: "CLEAR",
      riskLevel: "LOW",
      sourceSummary: "Synthetic reviewed source",
      completedAt: new Date(),
    },
  });
  await tx.checkTask.create({
    data: {
      tenantId: tenant.id,
      checkId: check.id,
      status: "COMPLETED",
      assigneeId: verifier.userId,
      completedById: verifier.userId,
      completedAt: new Date(),
    },
  });
  await tx.verificationMethodRun.create({
    data: {
      checkId: check.id,
      method: "MANUAL",
      status: "RESPONDED",
      result: "CLEAR",
      summary: "Synthetic manual review",
      createdById: verifier.userId,
    },
  });
  await tx.consent.create({
    data: {
      caseId: row.id,
      purpose: "Rollback verification",
      noticeVersion: "rollback-v1",
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });
  const document = await tx.document.create({
    data: {
      tenantId: tenant.id,
      caseId: row.id,
      type: "PAN",
      status: "VERIFIED",
      currentVersion: 1,
      reviewedById: verifier.userId,
      reviewedAt: new Date(),
      versions: {
        create: {
          version: 1,
          objectKey: `${tenant.publicId}/rollback/document`,
          originalName: "synthetic.pdf",
          contentType: "application/pdf",
          sizeBytes: 10n,
          sha256: "a".repeat(64),
          malwareState: "CLEAN",
        },
      },
    },
  });
  return {
    tenant,
    client,
    row,
    check,
    document,
    verifier,
    qa,
    manager,
    finance,
    clientActor,
  };
}
