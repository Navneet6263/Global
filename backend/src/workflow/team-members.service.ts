import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hashPassword } from "../auth/password";
import type { Actor } from "../common/auth/actor";
import { effectiveRole } from "../common/auth/role-filter";
import { PrismaService } from "../database/prisma.service";
import {
  assertEmailAvailable,
  insertUserAccount,
  resetAccountPassword,
  resolveRoles,
  revokeSessions,
} from "../users/user-accounts";
import { joinDepartments, personalRoles } from "../users/user-setup";
import { ACTIVE_TASK } from "./workflow-access";

/** The working role a member of each team kind gets; a Team Leader can give only this. */
const MEMBER_ROLE: Readonly<Record<string, "VERIFIER" | "DATA_ENTRY">> = {
  VERIFICATION: "VERIFIER",
  DATA_ENTRY: "DATA_ENTRY",
};

const parsePermissions = (json: string) => {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
};

/**
 * A Team Leader's own people: list them, create a login for a new member of a team it
 * leads (Verifier / Data Entry only, optionally with narrowed access), suspend or
 * reactivate them and reset their password. Leads, admins and people with other roles
 * are never managed here. Every change is audited with `via: TEAM_LEADER`.
 */
@Injectable()
export class TeamMembersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Teams the actor leads that can take members (verification and Data Entry). */
  private async ledTeams(actor: Actor) {
    const ids = (actor.departments ?? [])
      .filter((d) => d.role === "LEAD" && MEMBER_ROLE[d.kind])
      .map((d) => d.id);
    if (!ids.length)
      throw new ForbiddenException("This page is for Team Leaders");
    return this.prisma.department.findMany({
      where: { tenantId: actor.tenantId, id: { in: ids }, status: "ACTIVE" },
      select: { id: true, publicId: true, name: true, kind: true },
      orderBy: { name: "asc" },
    });
  }

  async overview(actor: Actor) {
    const teams = await this.ledTeams(actor);
    const memberships = await this.prisma.departmentMember.findMany({
      where: { departmentId: { in: teams.map((t) => t.id) } },
      select: {
        role: true,
        departmentId: true,
        user: {
          select: {
            id: true,
            publicId: true,
            displayName: true,
            email: true,
            phone: true,
            status: true,
            version: true,
            lastLoginAt: true,
            createdAt: true,
            userRoles: {
              select: {
                role: {
                  select: { code: true, baseRoleCode: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { user: { displayName: "asc" } },
    });
    const userIds = [...new Set(memberships.map((m) => m.user.id))];
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const [open, done, intake, ready, baseRoles] = await Promise.all([
      this.prisma.checkTask.groupBy({
        by: ["assigneeId"],
        where: {
          tenantId: actor.tenantId,
          status: { in: ACTIVE_TASK },
          assigneeId: { in: userIds },
        },
        _count: { _all: true },
      }),
      this.prisma.checkTask.groupBy({
        by: ["assigneeId"],
        where: {
          tenantId: actor.tenantId,
          status: "COMPLETED",
          completedAt: { gte: weekAgo },
          assigneeId: { in: userIds },
        },
        _count: { _all: true },
      }),
      this.prisma.verificationCase.groupBy({
        by: ["dataEntryUserId"],
        where: {
          tenantId: actor.tenantId,
          intakeStage: { in: ["DATA_ENTRY", "CORRECTION"] },
          dataEntryUserId: { in: userIds },
        },
        _count: { _all: true },
      }),
      this.prisma.verificationCase.groupBy({
        by: ["dataEntryUserId"],
        where: {
          tenantId: actor.tenantId,
          dataEntryReadyAt: { gte: weekAgo },
          dataEntryUserId: { in: userIds },
        },
        _count: { _all: true },
      }),
      this.prisma.role.findMany({
        where: {
          tenantId: actor.tenantId,
          isSystem: true,
          code: { in: [...new Set(teams.map((t) => MEMBER_ROLE[t.kind]!))] },
        },
        select: { code: true, name: true, permissionsJson: true },
      }),
    ]);
    const countOf = (
      rows: Array<{ _count: { _all: number } } & Record<string, unknown>>,
      key: string,
      id: bigint,
    ) => rows.find((row) => row[key] === id)?._count._all ?? 0;
    return {
      teams: teams.map((team) => ({
        id: team.publicId,
        name: team.name,
        kind: team.kind,
        memberRole: MEMBER_ROLE[team.kind]!,
      })),
      roles: baseRoles.map((role) => ({
        code: role.code,
        name: role.name,
        permissions: parsePermissions(role.permissionsJson),
      })),
      members: memberships.map((membership) => {
        const team = teams.find((t) => t.id === membership.departmentId)!;
        const verification = team.kind === "VERIFICATION";
        const roles = membership.user.userRoles.map(({ role }) =>
          effectiveRole(role),
        );
        const customised = membership.user.userRoles.some(
          ({ role }) => role.baseRoleCode,
        );
        return {
          id: membership.user.publicId,
          name: membership.user.displayName,
          email: membership.user.email,
          phone: membership.user.phone,
          status: membership.user.status,
          version: membership.user.version,
          lastLoginAt: membership.user.lastLoginAt,
          createdAt: membership.user.createdAt,
          teamRole: membership.role,
          team: { id: team.publicId, name: team.name },
          roles,
          customAccess: customised,
          openWork: verification
            ? countOf(open, "assigneeId", membership.user.id)
            : countOf(intake, "dataEntryUserId", membership.user.id),
          doneThisWeek: verification
            ? countOf(done, "assigneeId", membership.user.id)
            : countOf(ready, "dataEntryUserId", membership.user.id),
          isYou: membership.user.id === actor.userId,
          canManage:
            membership.role === "MEMBER" &&
            membership.user.id !== actor.userId &&
            roles.every((code) => code === MEMBER_ROLE[team.kind]),
        };
      }),
      generatedAt: new Date(),
    };
  }

  async create(
    actor: Actor,
    input: {
      displayName: string;
      email: string;
      phone?: string;
      temporaryPassword: string;
      departmentId: string;
      permissions?: string[];
    },
  ) {
    const teams = await this.ledTeams(actor);
    const team = teams.find(
      (t) => t.publicId.toLowerCase() === input.departmentId.toLowerCase(),
    );
    if (!team)
      throw new ForbiddenException(
        "You can add people only to a team you lead",
      );
    const roleCode = MEMBER_ROLE[team.kind]!;
    const passwordHash = await hashPassword(input.temporaryPassword);
    return this.prisma.$transaction(async (tx) => {
      await assertEmailAvailable(tx, actor.tenantId, input.email);
      const base = await resolveRoles(tx, actor.tenantId, [roleCode]);
      const given = await personalRoles(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        displayName: input.displayName,
        roles: base,
        access: input.permissions
          ? [{ role: roleCode, permissions: input.permissions }]
          : undefined,
      });
      const row = await insertUserAccount(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        email: input.email,
        displayName: input.displayName,
        phone: input.phone,
        passwordHash,
        roles: given.roles,
        branchId: actor.branchId ?? undefined,
        audit: {
          createdVia: "TEAM_LEADER",
          team: team.name,
          ...(given.created.length ? { personalRoles: given.created } : {}),
        },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { publicId: row.publicId },
        select: { id: true },
      });
      await joinDepartments(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        user: {
          id: user.id,
          publicId: row.publicId,
          displayName: row.displayName,
        },
        roleCodes: [roleCode],
        departments: [{ id: team.publicId }],
      });
      const { publicId, ...account } = row;
      return {
        id: publicId,
        ...account,
        roles: [roleCode],
        customAccess: given.created.length > 0,
        team: { id: team.publicId, name: team.name },
      };
    });
  }

  /** A member the actor may manage: in a team it leads, plain member, only that team's role. */
  private async manageable(actor: Actor, publicId: string) {
    const teams = await this.ledTeams(actor);
    const user = await this.prisma.user.findFirst({
      where: { tenantId: actor.tenantId, publicId },
      select: {
        id: true,
        publicId: true,
        displayName: true,
        status: true,
        version: true,
        userRoles: {
          select: { role: { select: { code: true, baseRoleCode: true } } },
        },
        departmentMemberships: {
          where: { departmentId: { in: teams.map((t) => t.id) } },
          select: { role: true, departmentId: true },
        },
      },
    });
    if (!user || !user.departmentMemberships.length)
      throw new NotFoundException("Team member not found");
    const membership = user.departmentMemberships[0]!;
    const team = teams.find((t) => t.id === membership.departmentId)!;
    const roles = user.userRoles.map(({ role }) => effectiveRole(role));
    if (
      user.id === actor.userId ||
      membership.role !== "MEMBER" ||
      !roles.every((code) => code === MEMBER_ROLE[team.kind])
    )
      throw new ForbiddenException(
        "Only plain team members can be changed here; ask Operations for anyone else",
      );
    return { user, team };
  }

  async setStatus(
    actor: Actor,
    publicId: string,
    input: { status: "ACTIVE" | "SUSPENDED"; version: number },
  ) {
    const { user, team } = await this.manageable(actor, publicId);
    if (user.version !== input.version)
      throw new ConflictException("This person changed; refresh and try again");
    if (user.status === input.status)
      throw new ConflictException(`Already ${input.status.toLowerCase()}`);
    if (!["ACTIVE", "SUSPENDED"].includes(user.status))
      throw new BadRequestException("This account cannot be changed here");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: user.id, version: input.version },
        data: { status: input.status, version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "This person changed; refresh and try again",
        );
      if (input.status === "SUSPENDED") await revokeSessions(tx, user.id);
      const openWork = await tx.checkTask.count({
        where: {
          tenantId: actor.tenantId,
          assigneeId: user.id,
          status: { in: ACTIVE_TASK },
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "user.updated",
          resourceType: "user",
          resourcePublicId: user.publicId,
          beforeJson: JSON.stringify({
            status: user.status,
            version: user.version,
          }),
          afterJson: JSON.stringify({
            status: input.status,
            version: user.version + 1,
            via: "TEAM_LEADER",
            team: team.name,
          }),
        },
      });
      return {
        id: user.publicId,
        status: input.status,
        version: user.version + 1,
        openWork,
      };
    });
  }

  async resetPassword(
    actor: Actor,
    publicId: string,
    temporaryPassword: string,
  ) {
    const { user, team } = await this.manageable(actor, publicId);
    const passwordHash = await hashPassword(temporaryPassword);
    await this.prisma.$transaction((tx) =>
      resetAccountPassword(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        userId: user.id,
        publicId: user.publicId,
        passwordHash,
        audit: { via: "TEAM_LEADER", team: team.name },
      }),
    );
    return { reset: true };
  }
}
