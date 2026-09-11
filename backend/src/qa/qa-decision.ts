import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import type { QaDecisionDto } from "./dto/qa-decision.dto";
import { QA_REQUIRED_CHECKLIST } from "./qa.constants";
import { assertLiveClaim, claimCutoff } from "./qa-claim";
import { assertCaseEvidenceReady } from "../documents/evidence-readiness";
import { restartCheckMethods } from "../verification/restart-check-methods";
import { updateCaseRisk } from "../verification/case-risk";
import { hasRecordedCaseSource } from "../common/auth/review-independence";

export async function decideQaCase(
  prisma: PrismaService,
  actor: Actor,
  casePublicId: string,
  input: QaDecisionDto,
) {
  const verificationCase = await prisma.verificationCase.findFirst({
    where: {
      tenantId: actor.tenantId,
      publicId: casePublicId,
      ...(actor.branchId ? { branchId: actor.branchId } : {}),
      ...(actor.clientId ? { clientId: actor.clientId } : {}),
    },
    include: {
      checks: {
        select: {
          id: true,
          publicId: true,
          status: true,
          dueAt: true,
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
            select: {
              assigneeId: true,
              completedById: true,
              dueAt: true,
              instructions: true,
            },
            orderBy: { completedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!verificationCase) throw new NotFoundException("Case not found");
  if (verificationCase.status !== "QA_REVIEW")
    throw new ConflictException("Case is not awaiting QA review");
  if (input.notes.trim().length < 10) {
    throw new BadRequestException("QA notes must contain a factual decision");
  }
  if (verificationCase.version !== input.caseVersion)
    throw new ConflictException("Case changed; refresh and try again");
  if (verificationCase.qaReviewerId !== actor.userId) {
    throw new ConflictException(
      "Claim this case before submitting a QA decision",
    );
  }
  assertLiveClaim(verificationCase.qaClaimedAt);
  if (
    verificationCase.checks.some((check) =>
      check.tasks.some((task) => task.completedById === actor.userId),
    )
  ) {
    throw new BadRequestException(
      "A verifier cannot independently QA their own completed work",
    );
  }
  if (
    input.checklist.length !== QA_REQUIRED_CHECKLIST.length ||
    QA_REQUIRED_CHECKLIST.some((item) => !input.checklist.includes(item))
  ) {
    throw new BadRequestException("Complete the full controlled QA checklist");
  }
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
    input.decision === "APPROVED" ? "MANAGER_REVIEW" : "IN_PROGRESS";
  const review = await prisma.$transaction(async (tx) => {
    if (await hasRecordedCaseSource(tx, actor, casePublicId)) {
      throw new BadRequestException(
        "A source-response author cannot independently QA the same case",
      );
    }
    if (input.decision === "APPROVED")
      await assertCaseEvidenceReady(tx, verificationCase.id);
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
      where: {
        id: verificationCase.id,
        version: input.caseVersion,
        status: "QA_REVIEW",
        qaReviewerId: actor.userId,
        qaClaimedAt: { gt: claimCutoff() },
      },
      data: {
        status: nextStatus,
        completedAt: null,
        qaReviewerId: null,
        qaClaimedAt: null,
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
        reason: input.notes.slice(0, 500),
      },
    });
    if (input.decision === "REWORK") {
      for (const check of verificationCase.checks.filter((item) =>
        rework.has(item.publicId),
      )) {
        const previousTask = check.tasks[0];
        await restartCheckMethods(tx, check.id, actor.userId);
        await tx.caseCheck.update({
          where: { id: check.id },
          data: {
            status: previousTask?.assigneeId ? "ASSIGNED" : "PENDING",
            result: null,
            riskLevel: null,
            sourceSummary: null,
            completedAt: null,
            reviewCycle: { increment: 1 },
            version: { increment: 1 },
          },
        });
        const task = await tx.checkTask.create({
          data: {
            tenantId: actor.tenantId,
            checkId: check.id,
            assigneeId: previousTask?.assigneeId,
            status: previousTask?.assigneeId ? "OPEN" : "UNASSIGNED",
            instructions: `QA rework required: ${input.notes.trim()}`.slice(
              0,
              1000,
            ),
            dueAt: check.dueAt ?? previousTask?.dueAt,
          },
          select: { publicId: true },
        });
        if (previousTask?.assigneeId) {
          await tx.notification.create({
            data: {
              tenantId: actor.tenantId,
              userId: previousTask.assigneeId,
              type: "QA_REWORK",
              title: "Verification rework required",
              body: input.notes.trim(),
              href: "/verifier",
            },
          });
        }
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "qa.rework-task-created",
            resourceType: "task",
            resourcePublicId: task.publicId,
            beforeJson: JSON.stringify({ findings: check.findings }),
            afterJson: JSON.stringify({
              checkId: check.publicId,
              assigneeId: previousTask?.assigneeId?.toString(),
            }),
          },
        });
      }
    }
    await updateCaseRisk(tx, verificationCase.id);
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
