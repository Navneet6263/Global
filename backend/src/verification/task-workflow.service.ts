import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { UpdateTaskDto } from "./dto/update-task.dto";
import { QaReadinessService } from "./qa-readiness.service";
import { assertCaseEvidenceReady } from "../documents/evidence-readiness";
import { updateCaseRisk } from "./case-risk";
import { assertMethodOutcomesReady } from "./method-outcome.policy";
import { lockMutableCaseEvidence } from "../documents/upload-document-policy";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  UNASSIGNED: ["IN_PROGRESS"],
  OPEN: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["COMPLETED", "BLOCKED"],
  BLOCKED: ["IN_PROGRESS"],
  COMPLETED: [],
};

export function highestRisk(
  findings: UpdateTaskDto["findings"],
): string | undefined {
  const weights = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as Record<
    string,
    number
  >;
  return findings.reduce<string | undefined>(
    (max, finding) =>
      !max || weights[finding.severity]! > weights[max]!
        ? finding.severity
        : max,
    undefined,
  );
}

@Injectable()
export class TaskWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qaReadiness: QaReadinessService,
  ) {}

  async update(actor: Actor, taskPublicId: string, input: UpdateTaskDto) {
    const task = await this.prisma.checkTask.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: taskPublicId,
        assigneeId: actor.userId,
        ...(actor.branchId || actor.clientId
          ? {
              check: {
                case: {
                  ...(actor.branchId ? { branchId: actor.branchId } : {}),
                  ...(actor.clientId ? { clientId: actor.clientId } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        check: {
          select: {
            id: true,
            publicId: true,
            caseId: true,
            case: {
              select: {
                publicId: true,
                branchId: true,
                clientId: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!task) {
      throw new NotFoundException("Task not found or not assigned to you");
    }
    if (task.version !== input.version) {
      throw new ConflictException("Task changed; refresh and try again");
    }
    if (
      !["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(task.check.case.status)
    ) {
      throw new ConflictException(
        "Verification work is locked for this case stage",
      );
    }
    if (!(ALLOWED_TRANSITIONS[task.status] ?? []).includes(input.status)) {
      throw new ConflictException(
        `Task cannot transition from ${task.status} to ${input.status}`,
      );
    }
    if (
      input.status === "COMPLETED" &&
      (!input.result || !input.sourceSummary?.trim())
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
      await lockMutableCaseEvidence(tx, task.check.caseId);
      if (input.status === "COMPLETED") {
        await assertCaseEvidenceReady(tx, task.check.caseId, {
          includeWork: false,
        });
        await assertMethodOutcomesReady(tx, task.check.id, input.result);
      }
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
      if (updated.count !== 1) {
        throw new ConflictException("Task was updated by another user");
      }
      await tx.caseCheck.update({
        where: { id: task.check.id },
        data: {
          status: input.status === "COMPLETED" ? "COMPLETED" : input.status,
          result: input.status === "COMPLETED" ? input.result : undefined,
          sourceSummary:
            input.status === "COMPLETED"
              ? input.sourceSummary?.trim()
              : undefined,
          completedAt: input.status === "COMPLETED" ? new Date() : undefined,
          riskLevel:
            input.status === "COMPLETED"
              ? (highestRisk(input.findings) ?? null)
              : input.findings.length
                ? highestRisk(input.findings)
                : undefined,
          version: { increment: 1 },
        },
      });
      if (input.status === "COMPLETED") {
        await updateCaseRisk(tx, task.check.caseId);
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
        await this.finishCheckTransaction(
          tx,
          actor,
          taskPublicId,
          task.check,
          input.result,
        );
      }
    });
    return {
      id: taskPublicId,
      status: input.status,
      version: task.version + 1,
    };
  }

  private async finishCheckTransaction(
    tx: Prisma.TransactionClient,
    actor: Actor,
    taskPublicId: string,
    check: {
      id: bigint;
      publicId: string;
      caseId: bigint;
      case: {
        publicId: string;
        branchId: bigint | null;
        clientId: bigint;
      };
    },
    result: string | undefined,
  ) {
    await tx.outboxEvent.create({
      data: {
        tenantId: actor.tenantId,
        topic: "verification.check.completed",
        aggregateType: "check",
        aggregateId: check.publicId,
        payloadJson: JSON.stringify({ checkId: check.publicId, result }),
      },
    });
    await this.qaReadiness.promoteIfReady(tx, {
      tenantId: actor.tenantId,
      caseId: check.caseId,
      casePublicId: check.case.publicId,
      branchId: check.case.branchId,
      clientId: check.case.clientId,
      changedById: actor.userId,
      fromStatus: "IN_PROGRESS",
      reason: "All verification checks completed",
      completedTaskId: taskPublicId,
    });
  }
}
