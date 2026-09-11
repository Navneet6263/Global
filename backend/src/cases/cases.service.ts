import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { ConsentIssuanceService } from "../consents/consent-issuance.service";
import { PrismaService } from "../database/prisma.service";
import { caseServiceCatalog } from "./case-service-plan";
import { createVerificationCase } from "./case-intake";
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

  async catalog(actor: Actor, clientId?: string) {
    return caseServiceCatalog(this.prisma, actor, clientId);
  }

  async create(actor: Actor, input: CreateCaseDto) {
    return createVerificationCase(
      this.prisma,
      this.pii,
      this.consentIssuance,
      actor,
      input,
    );
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
    await this.prisma.$transaction(async (tx) => {
      await this.workflow.assertAllowed(
        current.id,
        current.status,
        input.status,
        tx,
      );
      const result = await tx.verificationCase.updateMany({
        where: {
          id: current.id,
          tenantId: actor.tenantId,
          version: input.version,
        },
        data: {
          status: input.status,
          ...(current.status === "QA_REVIEW" && input.status === "IN_PROGRESS"
            ? { qaReviewerId: null, qaClaimedAt: null }
            : {}),
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
}
