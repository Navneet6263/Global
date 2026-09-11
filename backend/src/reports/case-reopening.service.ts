import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import type { ReopenCaseDto } from "./dto/manager-review.dto";
import { assertManager } from "./manager-review.service";
import { restartCheckMethods } from "../verification/restart-check-methods";
import { updateCaseRisk } from "../verification/case-risk";

@Injectable()
export class CaseReopeningService {
  constructor(private readonly prisma: PrismaService) {}

  async reopen(actor: Actor, publicId: string, input: ReopenCaseDto) {
    assertManager(actor);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.verificationCase.findFirst({
        where: { ...caseAccessScope(actor), publicId },
        select: {
          id: true,
          status: true,
          version: true,
          qaReviews: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true },
          },
          checks: {
            select: {
              id: true,
              publicId: true,
              dueAt: true,
              result: true,
              sourceSummary: true,
              riskLevel: true,
              reviewCycle: true,
              findings: {
                select: {
                  kind: true,
                  severity: true,
                  title: true,
                  description: true,
                  source: true,
                },
              },
              tasks: {
                where: { status: "COMPLETED" },
                orderBy: { completedAt: "desc" },
                take: 1,
                select: { assigneeId: true, completedById: true },
              },
            },
          },
        },
      });
      if (!row) throw new NotFoundException("Case not found");
      if (
        row.version !== input.caseVersion ||
        ![
          "MANAGER_REVIEW",
          "REPORT_PENDING",
          "PAYMENT_PENDING",
          "COMPLETED",
          "CLOSED",
        ].includes(row.status)
      ) {
        throw new ConflictException(
          "Case cannot be reopened in its current state",
        );
      }
      const requested = new Set(input.checkIds);
      const checks = row.checks.filter((check) =>
        requested.has(check.publicId),
      );
      if (checks.length !== requested.size || !checks.length) {
        throw new BadRequestException("Select checks belonging to this case");
      }
      if (!row.qaReviews[0])
        throw new BadRequestException(
          "A previous QA review is required for controlled reopening",
        );
      const changed = await tx.verificationCase.updateMany({
        where: { id: row.id, version: input.caseVersion, status: row.status },
        data: {
          status: "IN_PROGRESS",
          completedAt: null,
          riskLevel: null,
          qaReviewerId: null,
          qaClaimedAt: null,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("Case changed concurrently");
      const reopening = await tx.managerReview.create({
        data: {
          caseId: row.id,
          reviewerId: actor.userId,
          qaReviewId: row.qaReviews[0].id,
          decision: "REOPENED",
          notes: input.notes.trim(),
          snapshotJson: JSON.stringify({
            previousStatus: row.status,
            previousVersion: row.version,
            checks: checks.map((check) => ({
              checkId: check.publicId,
              reviewCycle: check.reviewCycle,
              result: check.result,
              sourceSummary: check.sourceSummary,
              riskLevel: check.riskLevel,
              findings: check.findings,
            })),
          }),
        },
      });
      await tx.report.updateMany({
        where: {
          caseId: row.id,
          status: { in: ["QUEUED", "FAILED", "PREPARED", "PUBLISHED"] },
        },
        data: { status: "SUPERSEDED" },
      });
      for (const check of checks) {
        await restartCheckMethods(tx, check.id, actor.userId);
        const assigneeId = check.tasks[0]?.assigneeId;
        await tx.caseCheck.update({
          where: { id: check.id },
          data: {
            status: assigneeId ? "ASSIGNED" : "PENDING",
            result: null,
            riskLevel: null,
            completedAt: null,
            reviewCycle: { increment: 1 },
            sourceSummary: null,
            version: { increment: 1 },
          },
        });
        await tx.checkTask.create({
          data: {
            tenantId: actor.tenantId,
            checkId: check.id,
            assigneeId,
            status: assigneeId ? "OPEN" : "UNASSIGNED",
            dueAt: check.dueAt,
            instructions:
              `Manager-approved reopening: ${input.notes.trim()}`.slice(
                0,
                1000,
              ),
          },
        });
      }
      await updateCaseRisk(tx, row.id);
      await tx.caseStatusHistory.create({
        data: {
          caseId: row.id,
          fromStatus: row.status,
          toStatus: "IN_PROGRESS",
          changedById: actor.userId,
          reason: input.notes.trim().slice(0, 500),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.reopening-approved",
          resourceType: "case",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            status: row.status,
            version: row.version,
          }),
          afterJson: JSON.stringify({
            status: "IN_PROGRESS",
            checkIds: [...requested],
            notes: input.notes.trim(),
            historicalReportsPreserved: true,
            managerReviewId: reopening.publicId,
          }),
        },
      });
      return { caseStatus: "IN_PROGRESS", caseVersion: row.version + 1 };
    });
  }
}
