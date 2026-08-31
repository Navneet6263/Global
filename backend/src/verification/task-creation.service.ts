import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { assertAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import { PrismaService } from "../database/prisma.service";
import type { CreateTaskDto } from "./dto/create-task.dto";

@Injectable()
export class TaskCreationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: Actor, checkPublicId: string, input: CreateTaskDto) {
    assertAnyRole(
      actor,
      OPERATIONS_ROLES,
      "Only operations can create verification work",
    );
    const check = await this.prisma.caseCheck.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: checkPublicId,
        case: caseAccessScope(actor),
      },
      select: {
        id: true,
        caseId: true,
        status: true,
        case: { select: { branchId: true, clientId: true, status: true } },
      },
    });
    if (!check) throw new NotFoundException("Verification check not found");
    if (
      check.status === "COMPLETED" ||
      !["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(check.case.status)
    ) {
      throw new ConflictException(
        "Verification work can be created only for an active case check",
      );
    }

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
            AND: [
              check.case.branchId
                ? {
                    OR: [{ branchId: check.case.branchId }, { branchId: null }],
                  }
                : { branchId: null },
              { OR: [{ clientId: null }, { clientId: check.case.clientId }] },
            ],
            userRoles: { some: { role: { code: "VERIFIER" } } },
          },
          select: { id: true },
        })
      : null;
    if (input.assigneeId && !assignee) {
      throw new NotFoundException("Active verifier not found");
    }

    return this.prisma.$transaction(
      async (tx) => {
        const activeTask = await tx.checkTask.findFirst({
          where: {
            checkId: check.id,
            status: { in: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"] },
          },
          select: { id: true },
        });
        if (activeTask) {
          throw new ConflictException(
            "This verification check already has an active task",
          );
        }
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
      },
      { isolationLevel: "Serializable" },
    );
  }
}
