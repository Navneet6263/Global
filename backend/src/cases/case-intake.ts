import { ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import type { SubjectPiiService } from "../common/security/subject-pii.service";
import type { ConsentIssuanceService } from "../consents/consent-issuance.service";
import type { CreateCaseDto } from "./dto/create-case.dto";
import { loadCaseServicePlan } from "./case-service-plan";

export async function createVerificationCase(
  prisma: PrismaService,
  pii: SubjectPiiService,
  issuance: ConsentIssuanceService,
  actor: Actor,
  input: CreateCaseDto,
) {
  const { client, services } = await loadCaseServicePlan(prisma, actor, input);
  const now = new Date();
  const dueAt = new Date(
    now.getTime() +
      Math.max(...services.map((service) => service.tatHours)) * 3_600_000,
  );
  const caseNumber = `SG-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const created = await prisma.$transaction(async (tx) => {
    // Hold the policy read until commit: Finance cannot set a hold between
    // validation and insertion. Shared row locks still allow concurrent intake.
    const [currentClient] = await tx.$queryRaw<
      Array<{ id: bigint; creditHold: boolean }>
    >`
      SELECT [id], [creditHold] FROM [dbo].[Client] WITH (HOLDLOCK, ROWLOCK)
      WHERE [id] = ${client.id} AND [tenantId] = ${actor.tenantId}
        AND [status] = 'ACTIVE' AND [version] = ${client.version}`;
    if (!currentClient)
      throw new ConflictException(
        "Client configuration changed; refresh the case form",
      );
    if (currentClient.creditHold)
      throw new ConflictException(
        "This organisation is on a Finance intake hold. Contact your account manager before creating new cases; existing cases remain accessible.",
      );
    const subject = await tx.subject.create({
      data: {
        tenantId: actor.tenantId,
        fullName: input.fullName.trim(),
        piiCiphertext: pii.seal({
          email: input.email,
          phone: input.phone,
          employeeCode: input.employeeCode,
        }),
        piiKeyVersion: pii.keyVersion(),
      },
    });
    const verificationCase = await tx.verificationCase.create({
      data: {
        tenantId: actor.tenantId,
        branchId: actor.branchId,
        clientId: client.id,
        servicePackageId: services.find(
          (service) => service.pkg.publicId === input.servicePackageId,
        )!.pkg.id,
        subjectId: subject.id,
        caseNumber,
        externalRef: input.externalRef?.trim(),
        status: "CONSENT_PENDING",
        priority: input.priority,
        dueAt,
        statusHistory: {
          create: { toStatus: "CONSENT_PENDING", changedById: actor.userId },
        },
        consents: {
          create: {
            status: "REQUESTED",
            purpose:
              `Verification requested for ${services.map((service) => `${service.pkg.name} (${service.pkg.serviceFamily})`).join(", ")}. Selected checks and evidence are limited to this request.`.slice(
                0,
                500,
              ),
            noticeVersion: "2026-09-services",
          },
        },
      },
      select: { id: true, publicId: true },
    });
    for (const service of services) {
      const row = await tx.caseService.create({
        data: {
          caseId: verificationCase.id,
          servicePackageId: service.pkg.id,
          serviceFamily: service.pkg.serviceFamily,
          configurationJson: JSON.stringify(service.details),
          requiredDocumentsJson: service.pkg.requiredDocumentsJson,
          unitPrice: service.unitPrice,
          taxRate: service.taxRate,
          tatHours: service.tatHours,
        },
      });
      await tx.caseCheck.createMany({
        data: service.checks.map((type) => ({
          tenantId: actor.tenantId,
          caseId: verificationCase.id,
          caseServiceId: row.id,
          type,
          status: "PENDING",
          dueAt: new Date(now.getTime() + service.tatHours * 3_600_000),
        })),
      });
    }
    const consent = await tx.consent.findFirstOrThrow({
      where: { caseId: verificationCase.id },
      select: { id: true, publicId: true },
    });
    const consentDelivery = await issuance.issue(tx, {
      consentId: consent.id,
      consentPublicId: consent.publicId,
      tenantId: actor.tenantId,
      casePublicId: verificationCase.publicId,
      actorUserId: actor.userId,
      email: input.email,
      phone: input.phone,
    });
    await tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "case.created",
        resourceType: "case",
        resourcePublicId: verificationCase.publicId,
        afterJson: JSON.stringify({
          caseNumber,
          status: "CONSENT_PENDING",
          services: services.map((service) => ({
            packageId: service.pkg.publicId,
            family: service.pkg.serviceFamily,
            checks: service.checks,
          })),
        }),
      },
    });
    await tx.outboxEvent.create({
      data: {
        tenantId: actor.tenantId,
        topic: "case.created",
        aggregateType: "case",
        aggregateId: verificationCase.publicId,
        payloadJson: JSON.stringify({ caseId: verificationCase.publicId }),
      },
    });
    return { casePublicId: verificationCase.publicId, consentDelivery };
  });
  return {
    id: created.casePublicId,
    caseNumber,
    status: "CONSENT_PENDING",
    consentDelivery: created.consentDelivery,
  };
}
