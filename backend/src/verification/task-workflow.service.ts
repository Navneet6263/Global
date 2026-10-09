import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { UpdateTaskDto } from "./dto/update-task.dto";
import { QaReadinessService } from "./qa-readiness.service";
import { resolveDisposition } from "./dispositions";
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
            type: true,
            departmentId: true,
            case: {
              select: {
                publicId: true,
                caseNumber: true,
                branchId: true,
                clientId: true,
                status: true,
                workflowVersion: true,
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
    const disposition =
      input.status === "COMPLETED"
        ? resolveDisposition(input.result, input.disposition)
        : undefined;
    if (input.status === "BLOCKED" && !input.sourceSummary?.trim()) {
      throw new BadRequestException(
        "A factual blocking reason is required to block a task",
      );
    }

    // A routed (v2) check goes to its Team Leader for review before QA.
    const tlReview =
      input.status === "COMPLETED" &&
      task.check.case.workflowVersion === 2 &&
      task.check.departmentId !== null;
    const leadsIt =
      task.check.departmentId !== null &&
      (actor.departments ?? []).some(
        (d) => d.role === "LEAD" && d.id === task.check.departmentId,
      );
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
          status:
            input.status === "COMPLETED"
              ? tlReview
                ? "TL_REVIEW"
                : "COMPLETED"
              : input.status,
          result: input.status === "COMPLETED" ? input.result : undefined,
          disposition: input.status === "COMPLETED" ? disposition : undefined,
          sourceSummary:
            input.status === "COMPLETED"
              ? input.sourceSummary?.trim()
              : undefined,
          completedAt:
            input.status === "COMPLETED" && !tlReview ? new Date() : undefined,
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
            disposition,
            version: task.version + 1,
          }),
        },
      });
      if (
        input.status === "COMPLETED" &&
        (input.result === "UNABLE_TO_VERIFY" || disposition === "CLIENT_REVIEW")
      ) {
        // Notification matrix: UTV and client-review outcomes reach the responsible RM.
        const owner = await tx.verificationCase.findUnique({
          where: { id: task.check.caseId },
          select: { publicId: true, caseNumber: true, assignedOpsUserId: true },
        });
        if (owner?.assignedOpsUserId)
          await tx.notification.create({
            data: {
              tenantId: actor.tenantId,
              userId: owner.assignedOpsUserId,
              type:
                input.result === "UNABLE_TO_VERIFY"
                  ? "CHECK_UTV"
                  : "CHECK_CLIENT_REVIEW",
              title:
                input.result === "UNABLE_TO_VERIFY"
                  ? "Check unable to verify"
                  : "Check needs client review",
              body: `${owner.caseNumber}: a check was closed as ${input.result === "UNABLE_TO_VERIFY" ? "unable to verify" : "client review"}.`,
              href: `/spoc-rm/work?caseId=${owner.publicId}`,
            },
          });
      }
      if (input.status === "COMPLETED" && tlReview && !leadsIt) {
        const leads = await tx.departmentMember.findMany({
          where: { departmentId: task.check.departmentId!, role: "LEAD" },
          select: { userId: true },
        });
        if (leads.length)
          await tx.notification.createMany({
            data: leads.map((lead) => ({
              tenantId: actor.tenantId,
              userId: lead.userId,
              type: "CHECK_TL_REVIEW",
              title: `Review and forward: ${task.check.case.caseNumber}`,
              body: `The ${task.check.type.replaceAll("_", " ").toLowerCase()} check is done (${(input.result ?? "").replaceAll("_", " ").toLowerCase()}). Review it and forward to QA.`,
              href: "/verifier/team?view=review",
            })),
          });
      }
      if (input.status === "COMPLETED" && !tlReview) {
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
      /** The check now waits for its Team Leader's review before QA. */
      tlReview,
      /** The person who finished it is the Team Leader: offer "Forward to QA" now. */
      canForward: tlReview && leadsIt,
    };
  }

  /** A Team Leader's review task (finished work of a team it leads). */
  private async reviewTask(actor: Actor, taskPublicId: string) {
    const task = await this.prisma.checkTask.findFirst({
      where: { tenantId: actor.tenantId, publicId: taskPublicId },
      select: {
        id: true,
        publicId: true,
        status: true,
        version: true,
        assigneeId: true,
        check: {
          select: {
            id: true,
            publicId: true,
            caseId: true,
            type: true,
            status: true,
            result: true,
            departmentId: true,
            version: true,
            case: {
              select: {
                publicId: true,
                caseNumber: true,
                branchId: true,
                clientId: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!task) throw new NotFoundException("Check not found");
    const supervisor = actor.roles.some((role) =>
      ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
    );
    const leads = (actor.departments ?? []).some(
      (d) => d.role === "LEAD" && d.id === task.check.departmentId,
    );
    if (!supervisor && !leads)
      throw new ForbiddenException(
        "Only the team's Team Leader reviews this check",
      );
    if (task.check.status !== "TL_REVIEW")
      throw new ConflictException("This check is not waiting for review");
    if (
      !["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(task.check.case.status)
    )
      throw new ConflictException(
        "Verification work is locked for this case stage",
      );
    return task;
  }

  /** The Team Leader is satisfied: the check is complete and the case moves on to QA. */
  async forward(actor: Actor, taskPublicId: string, note?: string) {
    const task = await this.reviewTask(actor, taskPublicId);
    const comment = note?.trim() || null;
    let toQa = false;
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.caseCheck.updateMany({
        where: {
          id: task.check.id,
          status: "TL_REVIEW",
          version: task.check.version,
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("Check changed; refresh and try again");
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "check.forwarded-by-lead",
          resourceType: "check",
          resourcePublicId: task.check.publicId,
          afterJson: JSON.stringify({
            caseNumber: task.check.case.caseNumber,
            check: task.check.type,
            result: task.check.result,
            note: comment,
          }),
        },
      });
      if (task.assigneeId && task.assigneeId !== actor.userId)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: task.assigneeId,
            type: "CHECK_FORWARDED",
            title: `Forwarded to QA: ${task.check.case.caseNumber}`,
            body:
              comment ??
              "Your Team Leader reviewed your check and forwarded it.",
            href: "/verifier/history",
          },
        });
      toQa = await this.finishCheckTransaction(
        tx,
        actor,
        task.publicId,
        task.check,
        task.check.result ?? undefined,
      );
    });
    return { id: task.publicId, status: "COMPLETED", caseToQa: toQa };
  }

  /** The Team Leader wants changes: the check goes back to its verifier with the reason. */
  async sendBack(actor: Actor, taskPublicId: string, reason: string) {
    const text = reason?.trim() ?? "";
    if (text.length < 10)
      throw new BadRequestException(
        "Write what needs fixing (at least 10 characters)",
      );
    const task = await this.reviewTask(actor, taskPublicId);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.caseCheck.updateMany({
        where: {
          id: task.check.id,
          status: "TL_REVIEW",
          version: task.check.version,
        },
        data: {
          status: "IN_PROGRESS",
          completedAt: null,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("Check changed; refresh and try again");
      await tx.checkTask.update({
        where: { id: task.id },
        data: {
          status: "IN_PROGRESS",
          completedAt: null,
          completedById: null,
          instructions: `Sent back by your Team Leader: ${text}`.slice(0, 2000),
          version: { increment: 1 },
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "check.sent-back-by-lead",
          resourceType: "check",
          resourcePublicId: task.check.publicId,
          afterJson: JSON.stringify({
            caseNumber: task.check.case.caseNumber,
            check: task.check.type,
            reason: text,
          }),
        },
      });
      if (task.assigneeId && task.assigneeId !== actor.userId)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: task.assigneeId,
            type: "CHECK_SENT_BACK",
            title: `Sent back: ${task.check.case.caseNumber}`,
            body: text,
            href: `/verifier/queue?taskId=${task.publicId}`,
          },
        });
    });
    return { id: task.publicId, status: "IN_PROGRESS" };
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
  ): Promise<boolean> {
    await tx.outboxEvent.create({
      data: {
        tenantId: actor.tenantId,
        topic: "verification.check.completed",
        aggregateType: "check",
        aggregateId: check.publicId,
        payloadJson: JSON.stringify({ checkId: check.publicId, result }),
      },
    });
    return this.qaReadiness.promoteIfReady(tx, {
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
