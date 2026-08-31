import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { assertAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import { PrismaService } from "../database/prisma.service";
import {
  ACTIVE_TASK_STATUSES,
  type BulkAssignmentCheck,
  isAssignmentWriteConflict,
  notifyTaskAssignment,
  updateAssignedTask,
  validateAssignmentCheck,
  validateBulkAssignmentInput,
} from "./bulk-task-assignment.helpers";
import type { BulkAssignTasksDto } from "./dto/bulk-assign-tasks.dto";

@Injectable()
export class BulkTaskAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(actor: Actor, input: BulkAssignTasksDto) {
    assertAnyRole(
      actor,
      OPERATIONS_ROLES,
      "Only operations can assign verification work",
    );
    validateBulkAssignmentInput(input);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const assignee = await tx.user.findFirst({
            where: {
              tenantId: actor.tenantId,
              publicId: input.assigneeId,
              status: "ACTIVE",
              userRoles: { some: { role: { code: "VERIFIER" } } },
            },
            select: {
              id: true,
              publicId: true,
              displayName: true,
              branchId: true,
              clientId: true,
            },
          });
          if (!assignee)
            throw new NotFoundException("Active verifier not found");

          const checks = (await tx.caseCheck.findMany({
            where: {
              tenantId: actor.tenantId,
              publicId: { in: input.items.map((item) => item.checkId) },
              case: caseAccessScope(actor),
            },
            select: {
              id: true,
              publicId: true,
              status: true,
              case: {
                select: {
                  publicId: true,
                  caseNumber: true,
                  branchId: true,
                  clientId: true,
                  status: true,
                },
              },
              tasks: {
                where: { status: { in: ACTIVE_TASK_STATUSES } },
                select: {
                  id: true,
                  publicId: true,
                  status: true,
                  version: true,
                  assigneeId: true,
                  assignee: {
                    select: { publicId: true, displayName: true },
                  },
                },
              },
            },
          })) as BulkAssignmentCheck[];
          if (checks.length !== input.items.length) {
            throw new NotFoundException(
              "One or more verification checks are unavailable in your scope",
            );
          }

          const checksById = new Map(
            checks.map((check) => [check.publicId, check]),
          );
          const plan = input.items.map((item) => {
            const check = checksById.get(item.checkId)!;
            return {
              check,
              item,
              task: validateAssignmentCheck(check, item, input, assignee),
            };
          });
          const instructions = input.instructions?.trim();
          const assignedTasks: Array<{ id: string; checkId: string }> = [];

          for (const entry of plan) {
            const previous = entry.task?.assignee ?? null;
            const task = entry.task
              ? await updateAssignedTask(
                  tx,
                  entry.task,
                  assignee.id,
                  instructions,
                )
              : await tx.checkTask.create({
                  data: {
                    tenantId: actor.tenantId,
                    checkId: entry.check.id,
                    assigneeId: assignee.id,
                    status: "OPEN",
                    instructions,
                  },
                  select: { publicId: true, version: true },
                });
            await tx.caseCheck.update({
              where: { id: entry.check.id },
              data: { status: "ASSIGNED" },
            });
            await tx.auditEvent.create({
              data: {
                tenantId: actor.tenantId,
                actorUserId: actor.userId,
                action: previous ? "task.reassigned" : "task.assigned",
                resourceType: "task",
                resourcePublicId: task.publicId,
                beforeJson: JSON.stringify({
                  assigneeId: previous?.publicId ?? null,
                  status: entry.task?.status ?? null,
                  version: entry.task?.version ?? null,
                }),
                afterJson: JSON.stringify({
                  assigneeId: assignee.publicId,
                  assigneeName: assignee.displayName,
                  caseId: entry.check.case.publicId,
                  caseNumber: entry.check.case.caseNumber,
                  checkId: entry.check.publicId,
                  status: "OPEN",
                  version: task.version,
                  bulk: true,
                  instructions,
                }),
              },
            });
            await notifyTaskAssignment(
              tx,
              actor.tenantId,
              assignee,
              previous,
              entry.check,
            );
            assignedTasks.push({
              id: task.publicId,
              checkId: entry.check.publicId,
            });
          }

          return {
            assigned: assignedTasks.length,
            memberName: assignee.displayName,
            warnings: [] as string[],
            tasks: assignedTasks,
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (isAssignmentWriteConflict(error)) {
        throw new ConflictException(
          "Assignment queue changed; refresh before trying again",
        );
      }
      throw error;
    }
  }
}
