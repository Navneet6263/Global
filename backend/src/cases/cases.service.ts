import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { PrismaService } from "../database/prisma.service";
import { presentCaseListItem } from "./case.presenter";
import { CaseReaderService } from "./case-reader.service";
import { caseListSelect } from "./case.selects";
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
  ) {}

  async create(actor: Actor, input: CreateCaseDto) {
    const client = await this.prisma.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.clientId,
        status: "ACTIVE",
        ...(actor.clientId ? { id: actor.clientId } : {}),
      },
      select: { id: true, slaHours: true },
    });
    if (!client) throw new NotFoundException("Active client not found");

    const now = new Date();
    const dueAt = new Date(
      now.getTime() +
        this.tatHours(input.priority, client.slaHours) * 3_600_000,
    );
    const caseNumber = this.caseNumber(now);
    const checkTypes = [...new Set(input.checks)];
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
        },
      });
      const verificationCase = await tx.verificationCase.create({
        data: {
          tenantId: actor.tenantId,
          clientId: client.id,
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
        select: caseListSelect,
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
            status: verificationCase.status,
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
      return verificationCase;
    });
    return presentCaseListItem(created, this.pii);
  }

  async transition(actor: Actor, publicId: string, input: TransitionCaseDto) {
    const current = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId },
      select: { id: true, status: true, version: true },
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
      if (result.count !== 1)
        throw new ConflictException("Case was updated by another user");
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
            status: input.status,
            version: current.version + 1,
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

  private caseNumber(now: Date): string {
    return `SG-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  private tatHours(priority: string, clientSla: number): number {
    return Math.min(
      clientSla,
      { URGENT: 24, HIGH: 48, NORMAL: 72, LOW: 120 }[priority] ?? 72,
    );
  }
}
