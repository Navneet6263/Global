import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { QaDecisionDto } from "./dto/qa-decision.dto";

@Injectable()
export class QaService {
  constructor(private readonly prisma: PrismaService) {}

  async queue(actor: Actor) {
    const rows = await this.prisma.verificationCase.findMany({
      where: { tenantId: actor.tenantId, status: "QA_REVIEW" },
      select: {
        publicId: true,
        caseNumber: true,
        priority: true,
        dueAt: true,
        version: true,
        subject: { select: { publicId: true, fullName: true } },
        client: { select: { publicId: true, displayName: true } },
        checks: {
          select: {
            publicId: true,
            type: true,
            result: true,
            riskLevel: true,
            status: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: 100,
    });
    return {
      items: rows.map(({ publicId, ...row }) => ({ id: publicId, ...row })),
    };
  }

  async decide(actor: Actor, casePublicId: string, input: QaDecisionDto) {
    const verificationCase = await this.prisma.verificationCase.findFirst({
      where: { tenantId: actor.tenantId, publicId: casePublicId },
      include: {
        checks: { select: { id: true, publicId: true, status: true } },
      },
    });
    if (!verificationCase) throw new NotFoundException("Case not found");
    if (verificationCase.status !== "QA_REVIEW")
      throw new ConflictException("Case is not awaiting QA review");
    if (verificationCase.version !== input.caseVersion)
      throw new ConflictException("Case changed; refresh and try again");
    if (verificationCase.checks.some((check) => check.status !== "COMPLETED")) {
      throw new BadRequestException(
        "All checks must be completed before QA decision",
      );
    }
    if (input.decision === "REWORK" && !input.reworkCheckIds.length) {
      throw new BadRequestException("Choose at least one check for rework");
    }
    const rework = new Set(input.reworkCheckIds);
    if (
      [...rework].some(
        (id) => !verificationCase.checks.some((check) => check.publicId === id),
      )
    ) {
      throw new BadRequestException(
        "A rework check does not belong to this case",
      );
    }

    const nextStatus =
      input.decision === "APPROVED" ? "COMPLETED" : "IN_PROGRESS";
    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.qaReview.create({
        data: {
          caseId: verificationCase.id,
          reviewerId: actor.userId,
          decision: input.decision,
          notes: input.notes?.trim(),
          checklistJson: JSON.stringify(input.checklist),
        },
        select: {
          publicId: true,
          decision: true,
          notes: true,
          createdAt: true,
        },
      });
      const updated = await tx.verificationCase.updateMany({
        where: { id: verificationCase.id, version: input.caseVersion },
        data: {
          status: nextStatus,
          completedAt: input.decision === "APPROVED" ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Case was updated by another reviewer");
      await tx.caseStatusHistory.create({
        data: {
          caseId: verificationCase.id,
          fromStatus: "QA_REVIEW",
          toStatus: nextStatus,
          changedById: actor.userId,
          reason: input.notes,
        },
      });
      if (input.decision === "REWORK") {
        await tx.caseCheck.updateMany({
          where: { caseId: verificationCase.id, publicId: { in: [...rework] } },
          data: {
            status: "IN_PROGRESS",
            completedAt: null,
            version: { increment: 1 },
          },
        });
      } else {
        const report = await tx.report.create({
          data: { tenantId: actor.tenantId, caseId: verificationCase.id },
        });
        await tx.outboxEvent.create({
          data: {
            tenantId: actor.tenantId,
            topic: "report.generate.requested",
            aggregateType: "report",
            aggregateId: report.publicId,
            payloadJson: JSON.stringify({
              reportId: report.publicId,
              caseId: casePublicId,
              actorUserId: actor.userPublicId,
            }),
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: `qa.${input.decision.toLowerCase()}`,
          resourceType: "case",
          resourcePublicId: casePublicId,
          afterJson: JSON.stringify({
            decision: input.decision,
            checklist: input.checklist,
            reworkCheckIds: input.reworkCheckIds,
          }),
        },
      });
      return created;
    });
    return {
      id: review.publicId,
      decision: review.decision,
      notes: review.notes,
      createdAt: review.createdAt,
      caseStatus: nextStatus,
      caseVersion: verificationCase.version + 1,
    };
  }
}
