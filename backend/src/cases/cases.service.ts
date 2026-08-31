import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { ConsentIssuanceService } from "../consents/consent-issuance.service";
import { PrismaService } from "../database/prisma.service";
import { CheckTypes } from "./case.constants";
import { CaseReaderService } from "./case-reader.service";
import { CaseWorkflowPolicy } from "./case-workflow.policy";
import type { CreateCaseDto } from "./dto/create-case.dto";
import type { TransitionCaseDto } from "./dto/transition-case.dto";

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: CaseWorkflowPolicy,
    private readonly reader: CaseReaderService,
    private readonly pii: SubjectPiiService,
    private readonly consentIssuance: ConsentIssuanceService,
  ) {}

  async catalog(actor: Actor) {
    const packages = await this.prisma.servicePackage.findMany({
      where: { tenantId: actor.tenantId, isActive: true },
      select: {
        publicId: true,
        code: true,
        name: true,
        checksJson: true,
        price: true,
        tatHours: true,
      },
      orderBy: [{ name: "asc" }, { code: "asc" }],
    });
    return {
      items: packages.flatMap(({ publicId, checksJson, ...servicePackage }) => {
        const checks = this.parseChecks(checksJson);
        return checks.length
          ? [{ id: publicId, ...servicePackage, checks }]
          : [];
      }),
    };
  }

  async create(actor: Actor, input: CreateCaseDto) {
    const [client, servicePackage] = await Promise.all([
      this.prisma.client.findFirst({
        where: {
          tenantId: actor.tenantId,
          publicId: input.clientId,
          status: "ACTIVE",
          ...(actor.clientId ? { id: actor.clientId } : {}),
        },
        select: { id: true, slaHours: true },
      }),
      this.prisma.servicePackage.findFirst({
        where: {
          tenantId: actor.tenantId,
          publicId: input.servicePackageId,
          isActive: true,
        },
        select: {
          id: true,
          publicId: true,
          code: true,
          checksJson: true,
          tatHours: true,
        },
      }),
    ]);
    if (!client) throw new NotFoundException("Active client not found");
    if (!servicePackage) {
      throw new NotFoundException("Active service package not found");
    }
    const checkTypes = this.parseChecks(servicePackage.checksJson);
    if (!checkTypes.length) {
      throw new ConflictException("Service package has no valid checks");
    }

    const now = new Date();
    const dueAt = new Date(
      now.getTime() +
        this.tatHours(
          input.priority,
          client.slaHours,
          servicePackage.tatHours,
        ) *
          3_600_000,
    );
    const caseNumber = this.caseNumber(now);
    const created = await this.prisma.$transaction(async (tx) => {
      const subject = await tx.subject.create({
        data: {
          tenantId: actor.tenantId,
          fullName: input.fullName.trim(),
          piiCiphertext: this.pii.seal({
            email: input.email,
            phone: input.phone,
            employeeCode: input.employeeCode,
          }),
          piiKeyVersion: this.pii.keyVersion(),
        },
      });
      const verificationCase = await tx.verificationCase.create({
        data: {
          tenantId: actor.tenantId,
          branchId: actor.branchId,
          clientId: client.id,
          servicePackageId: servicePackage.id,
          subjectId: subject.id,
          caseNumber,
          externalRef: input.externalRef?.trim(),
          status: "CONSENT_PENDING",
          priority: input.priority,
          dueAt,
          checks: {
            create: checkTypes.map((type) => ({
              tenantId: actor.tenantId,
              type,
              status: "PENDING",
              dueAt,
            })),
          },
          statusHistory: {
            create: { toStatus: "CONSENT_PENDING", changedById: actor.userId },
          },
          consents: {
            create: {
              status: "REQUESTED",
              purpose:
                "Employment background verification for the selected checks",
              noticeVersion: "2026-01",
            },
          },
        },
        select: { id: true, publicId: true },
      });
      const consent = await tx.consent.findFirstOrThrow({
        where: { caseId: verificationCase.id },
        select: { id: true, publicId: true },
      });
      const consentDelivery = await this.consentIssuance.issue(tx, {
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
            servicePackageId: servicePackage.publicId,
            servicePackageCode: servicePackage.code,
            checks: checkTypes,
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

  async transition(actor: Actor, publicId: string, input: TransitionCaseDto) {
    const current = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId },
      select: { id: true, caseNumber: true, status: true, version: true },
    });
    if (!current) throw new NotFoundException("Case not found");
    if (current.version !== input.version) {
      throw new ConflictException(
        "Case changed since it was loaded; refresh and try again",
      );
    }
    await this.workflow.assertAllowed(current.id, current.status, input.status);

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.verificationCase.updateMany({
        where: {
          id: current.id,
          tenantId: actor.tenantId,
          version: input.version,
        },
        data: {
          status: input.status,
          version: { increment: 1 },
          completedAt: input.status === "COMPLETED" ? new Date() : undefined,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException("Case was updated by another user");
      }
      await tx.caseStatusHistory.create({
        data: {
          caseId: current.id,
          fromStatus: current.status,
          toStatus: input.status,
          changedById: actor.userId,
          reason: input.reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.transitioned",
          resourceType: "case",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            status: current.status,
            version: current.version,
          }),
          afterJson: JSON.stringify({
            caseNumber: current.caseNumber,
            status: input.status,
            version: current.version + 1,
            reason: input.reason,
          }),
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: actor.tenantId,
          topic: "case.status.changed",
          aggregateType: "case",
          aggregateId: publicId,
          payloadJson: JSON.stringify({
            from: current.status,
            to: input.status,
          }),
        },
      });
    });
    return this.reader.get(actor, publicId);
  }

  private parseChecks(value: string): string[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) return [];
      return [
        ...new Set(
          parsed.filter(
            (check): check is string =>
              typeof check === "string" &&
              CheckTypes.includes(check as (typeof CheckTypes)[number]),
          ),
        ),
      ];
    } catch {
      return [];
    }
  }

  private caseNumber(now: Date): string {
    return `SG-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  private tatHours(
    priority: string,
    clientSla: number,
    packageTat: number,
  ): number {
    const priorityCap =
      { URGENT: 24, HIGH: 48, NORMAL: 120, LOW: 168 }[priority] ?? 120;
    return Math.min(clientSla, packageTat, priorityCap);
  }
}
