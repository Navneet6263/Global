import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { assertAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import { PrismaService } from "../database/prisma.service";
import type { ReassignTaskDto } from "./dto/reassign-task.dto";

const REASSIGNABLE_STATUSES = ["UNASSIGNED", "OPEN", "BLOCKED"];

@Injectable()
export class TaskAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async reassign(actor: Actor, taskPublicId: string, input: ReassignTaskDto) {
    assertAnyRole(
      actor,
      OPERATIONS_ROLES,
      "Only operations can reassign verification work",
    );
    const task = await this.prisma.checkTask.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: taskPublicId,
        check: {
          case: caseAccessScope(actor),
        },
      },
      select: {
        id: true,
        status: true,
        version: true,
        assignee: { select: { id: true, publicId: true, displayName: true } },
        check: {
          select: {
            id: true,
            publicId: true,
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
    if (!task) throw new NotFoundException("Verification task not found");
    if (task.version !== input.version) {
      throw new ConflictException("Task changed; refresh and try again");
    }
    if (!REASSIGNABLE_STATUSES.includes(task.status)) {
      throw new ConflictException(
        task.status === "IN_PROGRESS"
          ? "In-progress work must be blocked before reassignment"
          : "Completed verification work cannot be reassigned",
      );
    }
    if (
      !["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(task.check.case.status)
    ) {
      throw new ConflictException(
        "Verification work cannot be reassigned after the case leaves verification",
      );
    }

    const assignee = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.assigneeId,
        status: "ACTIVE",
        AND: [
          task.check.case.branchId
            ? {
                OR: [
                  { branchId: task.check.case.branchId },
                  { branchId: null },
                ],
              }
            : { branchId: null },
          {
            OR: [{ clientId: null }, { clientId: task.check.case.clientId }],
          },
        ],
        userRoles: { some: { role: { code: "VERIFIER" } } },
      },
      select: { id: true, publicId: true, displayName: true },
    });
    if (!assignee) throw new NotFoundException("Active verifier not found");
    if (task.assignee?.id === assignee.id) {
      throw new ConflictException("Task is already assigned to this verifier");
    }

    const instructions = input.instructions?.trim();
    const auditAction = task.assignee ? "task.reassigned" : "task.assigned";
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.checkTask.updateMany({
        where: {
          id: task.id,
          tenantId: actor.tenantId,
          version: input.version,
          status: { in: REASSIGNABLE_STATUSES },
        },
        data: {
          assigneeId: assignee.id,
          status: "OPEN",
          ...(instructions ? { instructions } : {}),
          blockerReason: null,
          blockedAt: null,
          startedAt: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Task was reassigned by another user");
      }
      await tx.caseCheck.update({
        where: { id: task.check.id },
        data: { status: "ASSIGNED" },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: auditAction,
          resourceType: "task",
          resourcePublicId: taskPublicId,
          beforeJson: JSON.stringify({
            assigneeId: task.assignee?.publicId ?? null,
            status: task.status,
            version: task.version,
          }),
          afterJson: JSON.stringify({
            assigneeId: assignee.publicId,
            status: "OPEN",
            version: task.version + 1,
            note: instructions,
          }),
        },
      });
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: assignee.id,
          type: "TASK_REASSIGNED",
          title: "Verification check assigned",
          body: `${task.check.case.caseNumber} has been assigned to you.`,
          href: "/verifier",
        },
      });
      if (task.assignee) {
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: task.assignee.id,
            type: "TASK_REASSIGNED_AWAY",
            title: "Verification check reassigned",
            body: `${task.check.case.caseNumber} is now owned by ${assignee.displayName}.`,
            href: "/verifier",
          },
        });
      }
    });

    return {
      id: taskPublicId,
      status: "OPEN",
      assignee: { id: assignee.publicId, displayName: assignee.displayName },
      version: task.version + 1,
    };
  }
}
