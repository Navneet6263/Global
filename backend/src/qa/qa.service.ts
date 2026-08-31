import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { QaDecisionDto } from "./dto/qa-decision.dto";
import type { QaQueryDto } from "./dto/qa-query.dto";
import { QA_REQUIRED_CHECKLIST } from "./qa.constants";

@Injectable()
export class QaService {
  constructor(private readonly prisma: PrismaService) {}

  async queue(actor: Actor, query: QaQueryDto) {
    const now = new Date();
    const baseWhere = {
      tenantId: actor.tenantId,
      ...(actor.branchId ? { branchId: actor.branchId } : {}),
      ...(actor.clientId ? { clientId: actor.clientId } : {}),
      status: "QA_REVIEW",
    } as const;
    const search = query.search?.trim();
    const [rows, awaiting, overdue, highRisk, claimed] = await Promise.all([
      this.prisma.verificationCase.findMany({
        where: {
          ...baseWhere,
          ...(search
            ? {
                OR: [
                  { caseNumber: { contains: search } },
                  { subject: { fullName: { contains: search } } },
                  { client: { displayName: { contains: search } } },
                ],
              }
            : {}),
        },
        select: {
          publicId: true,
          caseNumber: true,
          priority: true,
          dueAt: true,
          version: true,
          createdAt: true,
          qaClaimedAt: true,
          qaReviewer: { select: { publicId: true, displayName: true } },
          subject: { select: { publicId: true, fullName: true } },
          client: { select: { publicId: true, displayName: true } },
          checks: {
            select: {
              publicId: true,
              type: true,
              result: true,
              riskLevel: true,
              status: true,
              sourceSummary: true,
              updatedAt: true,
              findings: {
                select: {
                  publicId: true,
                  kind: true,
                  severity: true,
                  title: true,
                  description: true,
                  source: true,
                },
                orderBy: { createdAt: "asc" },
              },
              tasks: {
                where: { status: "COMPLETED" },
                select: {
                  completedAt: true,
                  completedBy: {
                    select: { publicId: true, displayName: true },
                  },
                },
                orderBy: { completedAt: "desc" },
                take: 1,
              },
            },
          },
          documents: {
            select: {
              publicId: true,
              type: true,
              status: true,
              currentVersion: true,
              versions: {
                select: {
                  originalName: true,
                  contentType: true,
                  sha256: true,
                  malwareState: true,
                  createdAt: true,
                },
                orderBy: { version: "desc" },
                take: 1,
              },
            },
            orderBy: { createdAt: "asc" },
          },
          fieldVisits: {
            select: {
              publicId: true,
              status: true,
              address: true,
              distanceMeters: true,
              capturedAt: true,
              evidence: {
                select: {
                  publicId: true,
                  type: true,
                  sha256: true,
                  capturedAt: true,
                },
                orderBy: { capturedAt: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { publicId: "asc" }],
        take: query.limit + 1,
        ...(query.cursor
          ? { cursor: { publicId: query.cursor }, skip: 1 }
          : {}),
      }),
      this.prisma.verificationCase.count({ where: baseWhere }),
      this.prisma.verificationCase.count({
        where: { ...baseWhere, dueAt: { lt: now } },
      }),
      this.prisma.verificationCase.count({
        where: {
          ...baseWhere,
          checks: { some: { riskLevel: { in: ["HIGH", "CRITICAL"] } } },
        },
      }),
      this.prisma.verificationCase.count({
        where: { ...baseWhere, qaReviewerId: { not: null } },
      }),
    ]);
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const items = page.map(({ publicId, ...row }) => ({
      id: publicId,
      ...row,
    }));
    return {
      items,
      nextCursor: hasMore ? page.at(-1)?.publicId : null,
      summary: {
        awaiting,
        overdue,
        highRisk,
        claimed,
      },
    };
  }

  async claim(actor: Actor, casePublicId: string, caseVersion: number) {
    const record = await this.prisma.verificationCase.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: casePublicId,
        ...(actor.branchId ? { branchId: actor.branchId } : {}),
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
      },
      select: {
        id: true,
        status: true,
        version: true,
        qaReviewerId: true,
        qaClaimedAt: true,
      },
    });
    if (!record) throw new NotFoundException("Case not found");
    if (record.status !== "QA_REVIEW")
      throw new ConflictException("Case is not awaiting QA review");
    if (record.version !== caseVersion)
      throw new ConflictException("Case changed; refresh and try again");
    const expired =
      !record.qaClaimedAt ||
      record.qaClaimedAt < new Date(Date.now() - 30 * 60_000);
    if (
      record.qaReviewerId &&
      record.qaReviewerId !== actor.userId &&
      !expired
    ) {
      throw new ConflictException(
        "Another reviewer is currently working on this case",
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: { id: record.id, version: caseVersion, status: "QA_REVIEW" },
        data: {
          qaReviewerId: actor.userId,
          qaClaimedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Case was claimed by another reviewer");
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "qa.case-claimed",
          resourceType: "case",
          resourcePublicId: casePublicId,
        },
      });
    });
    return {
      id: casePublicId,
      claimedBy: actor.userPublicId,
      caseVersion: caseVersion + 1,
    };
  }

  async decide(actor: Actor, casePublicId: string, input: QaDecisionDto) {
    const verificationCase = await this.prisma.verificationCase.findFirst({
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
      throw new BadRequestException(
        "Complete the full controlled QA checklist",
      );
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
          reason: input.notes,
        },
      });
      if (input.decision === "REWORK") {
        for (const check of verificationCase.checks.filter((item) =>
          rework.has(item.publicId),
        )) {
          const previousTask = check.tasks[0];
          await tx.caseCheck.update({
            where: { id: check.id },
            data: {
              status: previousTask?.assigneeId ? "ASSIGNED" : "PENDING",
              result: null,
              riskLevel: null,
              sourceSummary: null,
              completedAt: null,
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
