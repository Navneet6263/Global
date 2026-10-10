import { roleIs } from "../common/auth/role-filter";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type {
  CreateDepartmentDto,
  SetMemberDto,
  UpdateDepartmentDto,
} from "./dto/workflow.dto";
import { ACTIVE_TASK, isSupervisor } from "./workflow-access";

/** The system role a member needs to work in each kind of department. */
const MEMBER_ROLE: Record<string, string> = {
  DATA_ENTRY: "DATA_ENTRY",
  VERIFICATION: "VERIFIER",
};

export function parseCheckTypes(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Departments with members and their live workload. Everyone in the flow may read it. */
  async list(actor: Actor) {
    const rows = await this.prisma.department.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        publicId: true,
        code: true,
        name: true,
        kind: true,
        teamType: true,
        status: true,
        checkTypesJson: true,
        version: true,
        members: {
          orderBy: [{ role: "asc" }, { user: { displayName: "asc" } }],
          select: {
            role: true,
            user: {
              select: {
                id: true,
                publicId: true,
                displayName: true,
                email: true,
                status: true,
              },
            },
          },
        },
      },
    });
    const userIds = rows.flatMap((row) =>
      row.members.map((member) => member.user.id),
    );
    const [intake, tasks, unassignedByDepartment] = await Promise.all([
      userIds.length
        ? this.prisma.verificationCase.groupBy({
            by: ["dataEntryUserId"],
            where: {
              tenantId: actor.tenantId,
              dataEntryUserId: { in: userIds },
              intakeStage: { in: ["DATA_ENTRY", "CORRECTION"] },
            },
            _count: { _all: true },
          })
        : [],
      userIds.length
        ? this.prisma.checkTask.groupBy({
            by: ["assigneeId"],
            where: {
              tenantId: actor.tenantId,
              assigneeId: { in: userIds },
              status: { in: ACTIVE_TASK },
            },
            _count: { _all: true },
          })
        : [],
      this.unassignedByDepartment(actor),
    ]);
    const load = new Map<bigint, number>();
    for (const row of intake)
      if (row.dataEntryUserId) load.set(row.dataEntryUserId, row._count._all);
    for (const row of tasks)
      if (row.assigneeId)
        load.set(
          row.assigneeId,
          (load.get(row.assigneeId) ?? 0) + row._count._all,
        );
    return {
      items: rows.map((row) => ({
        id: row.publicId,
        code: row.code,
        name: row.name,
        kind: row.kind,
        teamType: row.teamType,
        status: row.status,
        version: row.version,
        checkTypes: parseCheckTypes(row.checkTypesJson),
        waitingForAssignment: unassignedByDepartment.get(row.id) ?? 0,
        members: row.members.map((member) => ({
          id: member.user.publicId,
          displayName: member.user.displayName,
          email: member.user.email,
          status: member.user.status,
          role: member.role,
          openWork: load.get(member.user.id) ?? 0,
        })),
      })),
    };
  }

  private async unassignedByDepartment(actor: Actor) {
    const counts = new Map<bigint, number>();
    const rows = await this.prisma.caseCheck.groupBy({
      by: ["departmentId"],
      where: {
        tenantId: actor.tenantId,
        departmentId: { not: null },
        tasks: { some: { status: "UNASSIGNED" } },
      },
      _count: { _all: true },
    });
    for (const row of rows)
      if (row.departmentId) counts.set(row.departmentId, row._count._all);
    return counts;
  }

  async create(actor: Actor, input: CreateDepartmentDto) {
    this.assertManager(actor);
    const exists = await this.prisma.department.findFirst({
      where: { tenantId: actor.tenantId, code: input.code },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException("A department with this code already exists");
    if (input.kind === "VERIFICATION" && !input.teamType)
      throw new BadRequestException(
        "Choose the team type: Employment, Education, Vendor or Digital",
      );
    const department = await this.prisma.$transaction(async (tx) => {
      const created = await tx.department.create({
        data: {
          tenantId: actor.tenantId,
          code: input.code,
          name: input.name.trim(),
          kind: input.kind,
          teamType: input.kind === "VERIFICATION" ? input.teamType : null,
          checkTypesJson: JSON.stringify(input.checkTypes ?? []),
        },
        select: {
          publicId: true,
          code: true,
          name: true,
          kind: true,
          teamType: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "department.created",
          resourceType: "department",
          resourcePublicId: created.publicId,
          afterJson: JSON.stringify({
            ...created,
            checkTypes: input.checkTypes ?? [],
          }),
        },
      });
      return created;
    });
    return { id: department.publicId, ...department };
  }

  async update(actor: Actor, publicId: string, input: UpdateDepartmentDto) {
    this.assertManager(actor);
    const current = await this.find(actor, publicId);
    if (current.version !== input.version)
      throw new ConflictException("Department changed; refresh and try again");
    if (input.status === "INACTIVE") {
      const open = await this.prisma.checkTask.count({
        where: {
          tenantId: actor.tenantId,
          status: { in: ACTIVE_TASK },
          check: { departmentId: current.id },
        },
      });
      if (open)
        throw new ConflictException(
          `${open} open checks are still routed to this department; finish or move them first`,
        );
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.department.updateMany({
        where: { id: current.id, version: input.version },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.checkTypes
            ? { checkTypesJson: JSON.stringify(input.checkTypes) }
            : {}),
          ...(input.teamType && current.kind === "VERIFICATION"
            ? { teamType: input.teamType }
            : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Department changed; refresh and try again",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "department.updated",
          resourceType: "department",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            name: current.name,
            status: current.status,
            checkTypes: parseCheckTypes(current.checkTypesJson),
          }),
          afterJson: JSON.stringify({
            name: input.name,
            status: input.status,
            checkTypes: input.checkTypes,
            teamType: input.teamType,
          }),
        },
      });
    });
    return { id: publicId, version: current.version + 1 };
  }

  /** Adds a member or changes its role (Team Leader / member). */
  async setMember(actor: Actor, publicId: string, input: SetMemberDto) {
    this.assertManager(actor);
    const department = await this.find(actor, publicId);
    const requiredRole = MEMBER_ROLE[department.kind];
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.userId,
        status: "ACTIVE",
        clientId: null,
        ...(requiredRole
          ? { userRoles: { some: { role: roleIs(requiredRole) } } }
          : {}),
      },
      select: { id: true, publicId: true, displayName: true },
    });
    if (!user)
      throw new BadRequestException(
        `Choose an active internal user with the ${requiredRole === "DATA_ENTRY" ? "Data Entry" : "Verifier"} role`,
      );
    const previous = await this.prisma.departmentMember.findUnique({
      where: {
        departmentId_userId: { departmentId: department.id, userId: user.id },
      },
      select: { role: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.departmentMember.upsert({
        where: {
          departmentId_userId: { departmentId: department.id, userId: user.id },
        },
        update: { role: input.role },
        create: {
          departmentId: department.id,
          userId: user.id,
          role: input.role,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: previous
            ? "department.member-role-changed"
            : "department.member-added",
          resourceType: "department",
          resourcePublicId: publicId,
          beforeJson: previous
            ? JSON.stringify({ userId: user.publicId, role: previous.role })
            : null,
          afterJson: JSON.stringify({
            userId: user.publicId,
            userName: user.displayName,
            role: input.role,
            department: department.name,
          }),
        },
      });
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: user.id,
          type: "DEPARTMENT_MEMBERSHIP",
          title: `${department.name} team`,
          body:
            input.role === "LEAD"
              ? `You are now the Team Leader of ${department.name}.`
              : `You were added to the ${department.name} team.`,
          href: department.kind === "DATA_ENTRY" ? "/data-entry" : "/verifier",
        },
      });
    });
    return { departmentId: publicId, userId: user.publicId, role: input.role };
  }

  async removeMember(actor: Actor, publicId: string, userPublicId: string) {
    this.assertManager(actor);
    const department = await this.find(actor, publicId);
    const member = await this.prisma.departmentMember.findFirst({
      where: { departmentId: department.id, user: { publicId: userPublicId } },
      select: {
        userId: true,
        role: true,
        user: { select: { displayName: true } },
      },
    });
    if (!member)
      throw new NotFoundException("Member not found in this department");
    await this.prisma.$transaction(async (tx) => {
      await tx.departmentMember.delete({
        where: {
          departmentId_userId: {
            departmentId: department.id,
            userId: member.userId,
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "department.member-removed",
          resourceType: "department",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            userId: userPublicId,
            userName: member.user.displayName,
            role: member.role,
          }),
        },
      });
    });
    // Existing assigned work stays with the person until a Team Leader reassigns it.
    return { departmentId: publicId, userId: userPublicId, removed: true };
  }

  private find(actor: Actor, publicId: string) {
    return this.prisma.department
      .findFirst({
        where: { tenantId: actor.tenantId, publicId },
        select: {
          id: true,
          name: true,
          kind: true,
          status: true,
          version: true,
          checkTypesJson: true,
        },
      })
      .then((row) => {
        if (!row) throw new NotFoundException("Department not found");
        return row;
      });
  }

  private assertManager(actor: Actor) {
    if (!isSupervisor(actor))
      throw new ForbiddenException(
        "Only Operations or a platform administrator can manage departments",
      );
  }
}
