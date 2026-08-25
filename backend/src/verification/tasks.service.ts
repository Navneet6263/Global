import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CreateTaskDto } from "./dto/create-task.dto";
import type { UpdateTaskDto } from "./dto/update-task.dto";

type MineTaskQuery = {
  status?: string;
  view?: string;
  search?: string;
  cursor?: string;
  limit: number;
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(actor: Actor, query: MineTaskQuery) {
    const search = query.search?.trim();
    const access = {
      tenantId: actor.tenantId,
      OR: [{ assigneeId: actor.userId }, { assigneeId: null }],
    };
    const where = {
      ...access,
      status:
        query.view === "ACTIVE"
          ? { in: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"] }
          : query.status,
      ...(search
        ? {
            check: {
              OR: [
                { type: { contains: search } },
                { case: { caseNumber: { contains: search } } },
                { case: { subject: { fullName: { contains: search } } } },
                { case: { client: { displayName: { contains: search } } } },
              ],
            },
          }
        : {}),
    };
    const rows = await this.prisma.checkTask.findMany({
      where,
      select: {
        publicId: true,
        status: true,
        instructions: true,
        dueAt: true,
        startedAt: true,
        completedAt: true,
        blockerReason: true,
        blockedAt: true,
        version: true,
        check: {
          select: {
            publicId: true,
            type: true,
            status: true,
            result: true,
            riskLevel: true,
            sourceSummary: true,
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
            case: {
              select: {
                publicId: true,
                caseNumber: true,
                priority: true,
                subject: { select: { publicId: true, fullName: true } },
                client: { select: { publicId: true, displayName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { publicId: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const [active, overdue, blocked, completedToday] = await Promise.all([
      this.prisma.checkTask.count({
        where: {
          ...access,
          status: { in: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"] },
        },
      }),
      this.prisma.checkTask.count({
        where: {
          ...access,
          status: { not: "COMPLETED" },
          dueAt: { lt: new Date() },
        },
      }),
      this.prisma.checkTask.count({ where: { ...access, status: "BLOCKED" } }),
      this.prisma.checkTask.count({
        where: {
          ...access,
          status: "COMPLETED",
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);
    return {
      items: page.map(({ publicId, ...row }) => ({ id: publicId, ...row })),
      nextCursor: hasMore ? page.at(-1)?.publicId : null,
      summary: { active, overdue, blocked, completedToday },
    };
  }

  async create(actor: Actor, checkPublicId: string, input: CreateTaskDto) {
    const check = await this.prisma.caseCheck.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: checkPublicId,
        ...(actor.clientId ? { case: { clientId: actor.clientId } } : {}),
      },
      select: { id: true, caseId: true },
    });
    if (!check) throw new NotFoundException("Verification check not found");
    const existingTask = await this.prisma.checkTask.findFirst({
      where: {
        checkId: check.id,
        status: { in: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"] },
      },
      select: { id: true },
    });
    if (existingTask) {
      throw new ConflictException(
        "This verification check already has an active task",
      );
    }
    const assignee = input.assigneeId
      ? await this.prisma.user.findFirst({
          where: {
            tenantId: actor.tenantId,
            publicId: input.assigneeId,
            status: "ACTIVE",
            userRoles: { some: { role: { code: "VERIFIER" } } },
          },
          select: { id: true },
        })
      : null;
    if (input.assigneeId && !assignee)
      throw new NotFoundException("Active verifier not found");

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.checkTask.create({
        data: {
          tenantId: actor.tenantId,
          checkId: check.id,
          assigneeId: assignee?.id,
          status: assignee ? "OPEN" : "UNASSIGNED",
          instructions: input.instructions?.trim(),
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        },
        select: {
          publicId: true,
          status: true,
          instructions: true,
          dueAt: true,
          version: true,
          createdAt: true,
        },
      });
      await tx.caseCheck.update({
        where: { id: check.id },
        data: { status: assignee ? "ASSIGNED" : "PENDING" },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "task.created",
          resourceType: "task",
          resourcePublicId: task.publicId,
          afterJson: JSON.stringify({
            assigneeId: input.assigneeId,
            status: task.status,
          }),
        },
      });
      if (assignee) {
        const caseRecord = await tx.verificationCase.findUniqueOrThrow({
          where: { id: check.caseId },
          select: { publicId: true, caseNumber: true },
        });
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: assignee.id,
            type: "TASK_ASSIGNED",
            title: "Verification check assigned",
            body: `${caseRecord.caseNumber} has a new check ready for verification.`,
            href: `/cases/${caseRecord.publicId}`,
          },
        });
      }
      return {
        id: task.publicId,
        status: task.status,
        instructions: task.instructions,
        dueAt: task.dueAt,
        version: task.version,
        createdAt: task.createdAt,
      };
    });
  }

  async update(actor: Actor, taskPublicId: string, input: UpdateTaskDto) {
    const task = await this.prisma.checkTask.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: taskPublicId,
        OR: [{ assigneeId: actor.userId }, { assigneeId: null }],
      },
      include: {
        check: {
          select: {
            id: true,
            publicId: true,
            caseId: true,
            case: { select: { publicId: true } },
          },
        },
      },
    });
    if (!task)
      throw new NotFoundException("Task not found or not assigned to you");
    if (task.version !== input.version)
      throw new ConflictException("Task changed; refresh and try again");
    const allowed: Record<string, string[]> = {
      UNASSIGNED: ["IN_PROGRESS"],
      OPEN: ["IN_PROGRESS", "BLOCKED"],
      IN_PROGRESS: ["COMPLETED", "BLOCKED"],
      BLOCKED: ["IN_PROGRESS"],
      COMPLETED: [],
    };
    if (!(allowed[task.status] ?? []).includes(input.status)) {
      throw new ConflictException(
        `Task cannot transition from ${task.status} to ${input.status}`,
      );
    }
    if (
      input.status === "COMPLETED" &&
      (!input.result || !input.sourceSummary)
    ) {
      throw new BadRequestException(
        "Result and source summary are required to complete a task",
      );
    }
    if (input.status === "BLOCKED" && !input.sourceSummary?.trim()) {
      throw new BadRequestException(
        "A factual blocking reason is required to block a task",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.checkTask.updateMany({
        where: { id: task.id, version: input.version },
        data: {
          status: input.status,
          assigneeId: task.assigneeId ?? actor.userId,
          startedAt:
            input.status === "IN_PROGRESS" && !task.startedAt
              ? new Date()
              : undefined,
          completedAt: input.status === "COMPLETED" ? new Date() : undefined,
          completedById:
            input.status === "COMPLETED" ? actor.userId : undefined,
          blockerReason:
            input.status === "BLOCKED"
              ? input.sourceSummary?.trim()
              : input.status === "IN_PROGRESS"
                ? null
                : undefined,
          blockedAt:
            input.status === "BLOCKED"
              ? new Date()
              : input.status === "IN_PROGRESS"
                ? null
                : undefined,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Task was updated by another user");
      await tx.caseCheck.update({
        where: { id: task.check.id },
        data: {
          status: input.status === "COMPLETED" ? "COMPLETED" : input.status,
          result: input.result,
          sourceSummary:
            input.status === "COMPLETED"
              ? input.sourceSummary?.trim()
              : undefined,
          completedAt: input.status === "COMPLETED" ? new Date() : undefined,
          riskLevel: this.risk(input.findings),
          version: { increment: 1 },
        },
      });
      if (input.status === "COMPLETED") {
        await tx.finding.deleteMany({ where: { checkId: task.check.id } });
      }
      if (input.findings.length) {
        await tx.finding.createMany({
          data: input.findings.map((finding) => ({
            checkId: task.check.id,
            ...finding,
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "task.updated",
          resourceType: "task",
          resourcePublicId: taskPublicId,
          beforeJson: JSON.stringify({
            status: task.status,
            version: task.version,
          }),
          afterJson: JSON.stringify({
            status: input.status,
            result: input.result,
            version: task.version + 1,
          }),
        },
      });
      if (input.status === "COMPLETED") {
        await tx.outboxEvent.create({
          data: {
            tenantId: actor.tenantId,
            topic: "verification.check.completed",
            aggregateType: "check",
            aggregateId: task.check.publicId,
            payloadJson: JSON.stringify({
              checkId: task.check.publicId,
              result: input.result,
            }),
          },
        });

        const unfinishedChecks = await tx.caseCheck.count({
          where: {
            caseId: task.check.caseId,
            status: { not: "COMPLETED" },
          },
        });
        if (unfinishedChecks === 0) {
          const currentCase = await tx.verificationCase.findUnique({
            where: { id: task.check.caseId },
            select: { status: true },
          });
          if (currentCase?.status === "IN_PROGRESS") {
            await tx.verificationCase.update({
              where: { id: task.check.caseId },
              data: { status: "QA_REVIEW", version: { increment: 1 } },
            });
            await tx.caseStatusHistory.create({
              data: {
                caseId: task.check.caseId,
                fromStatus: "IN_PROGRESS",
                toStatus: "QA_REVIEW",
                changedById: actor.userId,
                reason: "All verification checks completed",
              },
            });
            await tx.outboxEvent.create({
              data: {
                tenantId: actor.tenantId,
                topic: "verification.case.ready-for-qa",
                aggregateType: "case",
                aggregateId: task.check.case.publicId,
                payloadJson: JSON.stringify({
                  caseId: task.check.case.publicId,
                  completedTaskId: taskPublicId,
                }),
              },
            });
            const reviewers = await tx.user.findMany({
              where: {
                tenantId: actor.tenantId,
                status: "ACTIVE",
                userRoles: {
                  some: {
                    role: { code: { in: ["QA_REVIEWER", "OPS_MANAGER"] } },
                  },
                },
              },
              select: { id: true },
            });
            if (reviewers.length) {
              await tx.notification.createMany({
                data: reviewers.map((reviewer) => ({
                  tenantId: actor.tenantId,
                  userId: reviewer.id,
                  type: "QA_READY",
                  title: "Case ready for QA",
                  body: "All verification checks are complete and awaiting independent review.",
                  href: `/cases/${task.check.case.publicId}`,
                })),
              });
            }
          }
        }
      }
    });
    return {
      id: taskPublicId,
      status: input.status,
      version: task.version + 1,
    };
  }

  private risk(findings: UpdateTaskDto["findings"]): string | undefined {
    const weights = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as Record<
      string,
      number
    >;
    return findings.reduce(
      (max, finding) =>
        weights[finding.severity]! > weights[max]! ? finding.severity : max,
      "LOW",
    );
  }
}
