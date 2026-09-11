import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { hasRecordedCaseSource } from "../common/auth/review-independence";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { PrismaService } from "../database/prisma.service";
import { assertCaseEvidenceReady } from "../documents/evidence-readiness";
import type { ManagerReviewDto } from "./dto/manager-review.dto";
import {
  legacyApprovalRequired,
  reportApprovalSelect,
  snapshotForApproval,
} from "./report-snapshot";

export function assertManager(actor: Actor) {
  if (
    !actor.roles.some((role) =>
      ["OPS_MANAGER", "PLATFORM_ADMIN"].includes(role),
    )
  ) {
    throw new ForbiddenException(
      "An operations manager or platform administrator is required",
    );
  }
}

@Injectable()
export class ManagerReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pii: SubjectPiiService,
  ) {}

  async overview(actor: Actor, casePublicId: string) {
    assertManager(actor);
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: {
        status: true,
        version: true,
        qaReviews: reportApprovalSelect.qaReviews,
        reports: reportApprovalSelect.reports,
        checks: { select: { tasks: reportApprovalSelect.checks.select.tasks } },
        managerReviews: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            publicId: true,
            decision: true,
            notes: true,
            createdAt: true,
            reviewer: { select: { displayName: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Case not found");
    const qa = row.qaReviews[0];
    return {
      caseStatus: row.status,
      caseVersion: row.version,
      latestQa: qa
        ? {
            id: qa.publicId,
            decision: qa.decision,
            notes: qa.notes,
            reviewerName: qa.reviewer.displayName,
            createdAt: qa.createdAt,
          }
        : null,
      reviews: row.managerReviews.map((review) => ({
        id: review.publicId,
        decision: review.decision,
        notes: review.notes,
        createdAt: review.createdAt,
        reviewerName: review.reviewer.displayName,
      })),
      legacyApprovalRequired: legacyApprovalRequired(row),
      canApprove:
        (row.status === "MANAGER_REVIEW" || legacyApprovalRequired(row)) &&
        qa?.decision === "APPROVED" &&
        qa?.reviewerId !== actor.userId &&
        !row.checks.some((check) =>
          check.tasks.some((task) => task.completedById === actor.userId),
        ) &&
        !(await hasRecordedCaseSource(this.prisma, actor, casePublicId)),
    };
  }

  async decide(actor: Actor, publicId: string, input: ManagerReviewDto) {
    assertManager(actor);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.verificationCase.findFirst({
        where: { ...caseAccessScope(actor), publicId },
        select: reportApprovalSelect,
      });
      if (!row) throw new NotFoundException("Case not found");
      const legacyRecovery = legacyApprovalRequired(row);
      if (
        row.version !== input.caseVersion ||
        (row.status !== "MANAGER_REVIEW" && !legacyRecovery)
      ) {
        throw new ConflictException(
          "Case is not awaiting this manager decision; refresh and try again",
        );
      }
      const qa = row.qaReviews[0];
      if (!qa || qa.decision !== "APPROVED")
        throw new BadRequestException("Approved QA review is required");
      if (
        qa.reviewerId === actor.userId ||
        row.checks.some((check) =>
          check.tasks.some((task) => task.completedById === actor.userId),
        ) ||
        (await hasRecordedCaseSource(tx, actor, publicId))
      ) {
        throw new ForbiddenException(
          "Manager approval must be independent of verification and QA",
        );
      }
      const approved = input.decision === "APPROVED";
      if (approved) {
        await assertCaseEvidenceReady(tx, row.id);
        if (row.checks.some((check) => check.status !== "COMPLETED")) {
          throw new BadRequestException("Complete every check before approval");
        }
        if (!input.recommendation || input.recommendation.trim().length < 10) {
          throw new BadRequestException(
            "A factual final recommendation is required",
          );
        }
        const highRisk = row.checks.some((check) =>
          ["HIGH", "CRITICAL"].includes(check.riskLevel ?? ""),
        );
        if (highRisk && !input.highRiskAcknowledged) {
          throw new BadRequestException(
            "Explicitly acknowledge the high-risk findings before approval",
          );
        }
      }
      const now = new Date();
      const nextStatus = approved ? "REPORT_PENDING" : "QA_REVIEW";
      const updated = await tx.verificationCase.updateMany({
        where: { id: row.id, version: input.caseVersion, status: row.status },
        data: {
          status: nextStatus,
          version: { increment: 1 },
          completedAt: null,
          qaReviewerId: null,
          qaClaimedAt: null,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Case was updated concurrently");
      const review = await tx.managerReview.create({
        data: {
          caseId: row.id,
          reviewerId: actor.userId,
          qaReviewId: qa.id,
          decision: input.decision,
          notes: input.notes.trim(),
          snapshotJson: JSON.stringify(
            snapshotForApproval(
              row,
              actor.displayName,
              input.recommendation?.trim() ?? input.notes.trim(),
              now,
              this.pii,
            ),
          ),
        },
      });
      let reportId: string | undefined;
      if (approved) {
        if (legacyRecovery)
          await tx.report.updateMany({
            where: {
              caseId: row.id,
              workflowVersion: 1,
              status: { in: ["QUEUED", "FAILED"] },
            },
            data: { status: "SUPERSEDED" },
          });
        const report = await tx.report.create({
          data: {
            tenantId: actor.tenantId,
            caseId: row.id,
            managerReviewId: review.id,
            workflowVersion: 2,
            status: "QUEUED",
          },
        });
        reportId = report.publicId;
        await tx.outboxEvent.create({
          data: {
            tenantId: actor.tenantId,
            topic: "report.generate.requested",
            aggregateType: "report",
            aggregateId: report.publicId,
            payloadJson: JSON.stringify({
              reportId: report.publicId,
              caseId: publicId,
              actorUserId: actor.userPublicId,
            }),
          },
        });
      }
      await tx.caseStatusHistory.create({
        data: {
          caseId: row.id,
          fromStatus: row.status,
          toStatus: nextStatus,
          changedById: actor.userId,
          reason: input.notes.trim().slice(0, 500),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: `manager.${input.decision.toLowerCase()}`,
          resourceType: "case",
          resourcePublicId: publicId,
          afterJson: JSON.stringify({
            managerReviewId: review.publicId,
            reportId,
            qaReviewId: qa.publicId,
            highRiskAcknowledged: input.highRiskAcknowledged ?? false,
            notes: input.notes.trim(),
            legacyRecovery,
            status: nextStatus,
          }),
        },
      });
      return {
        id: review.publicId,
        caseStatus: nextStatus,
        caseVersion: row.version + 1,
        reportId,
      };
    });
  }
}
